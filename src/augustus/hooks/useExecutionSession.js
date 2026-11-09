import { useEffect, useRef, useState } from 'react';
import { HyperliquidExecutionClient } from '../services/hyperliquidExecutionClient.js';
import { verifyHolder } from '../services/holderAccessService.js';

export function useExecutionSession() {
  const client = useRef(new HyperliquidExecutionClient()), generation = useRef(0), wallet = useRef(null), liveAccess = useRef(false);
  const [config, setConfig] = useState(null), [access, setAccess] = useState(null), [data, setData] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  const invalidate = () => {
    generation.current++; liveAccess.current = false; wallet.current = null; setAccess(null); setData(null);
    void client.current.request('/execution/stop', {}).catch(() => {}).finally(() => client.current.disconnect().catch(() => {}));
  };
  useEffect(() => {
    let active = true; const transport = client.current, ref = generation;
    transport.config().then(value => { if (active) setConfig(value); }).catch(() => { if (active) setError('Local execution service unavailable. Start npm run augustus:server.'); });
    const provider = window.ethereum;
    const changed = () => { invalidate(); setError('Wallet/network changed. STOP requested; server heartbeat also prevents orphan entries.'); };
    provider?.on?.('accountsChanged', changed); provider?.on?.('chainChanged', changed); provider?.on?.('disconnect', changed);
    return () => { active = false; ref.current++; provider?.removeListener?.('accountsChanged', changed); provider?.removeListener?.('chainChanged', changed); provider?.removeListener?.('disconnect', changed); if (transport.token) void transport.request('/execution/stop', {}).catch(() => {}).finally(() => transport.disconnect().catch(() => {})); };
    // The single mounted terminal owns the wallet session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const run = async action => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); const id = generation.current;
    try { const result = await action(); if (id === generation.current && result) setData(result); return result; }
    catch (err) { if (id === generation.current) setError(err.message); }
    finally { pending.current = false; setBusy(false); }
  };
  const connect = () => run(async () => {
    if (!config || !window.ethereum) throw new Error('Local service and an EIP-1193 wallet are required.');
    const id = generation.current;
    const addresses = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const checked = await verifyHolder(window.ethereum, addresses[0], config);
    if (id !== generation.current) return;
    if (!checked.granted) throw new Error(`Holder access: ${checked.status}`);
    await client.current.authenticate(window.ethereum, addresses[0]);
    if (id !== generation.current) { await client.current.disconnect(); return; }
    wallet.current = addresses[0]; liveAccess.current = true; setAccess(checked);
    return client.current.request('/execution/status');
  });
  useEffect(() => {
    if (!access?.granted) return;
    let active = true, timer; const id = generation.current;
    const poll = async () => {
      try {
        const checked = await verifyHolder(window.ethereum, wallet.current, config);
        if (!active || id !== generation.current) return;
        if (!checked.granted) { invalidate(); throw new Error('Holder/wallet verification failed. STOP requested.'); }
        const result = await client.current.request('/execution/status');
        if (active && id === generation.current) setData(result);
      } catch (err) { if (active && id === generation.current) { setError(err.message); invalidate(); } }
      finally { if (active && liveAccess.current) timer = setTimeout(poll, 2000); }
    };
    timer = setTimeout(poll, 2000);
    return () => { active = false; clearTimeout(timer); };
    // Authentication is revoked on network/account changes, not silently refreshed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access?.granted]);
  return { config, access, data, busy, error, connect, disconnect: invalidate,
    configure: envelope => run(() => client.current.request('/execution/configure', envelope)),
    arm: () => run(() => client.current.request('/execution/arm', { approved: true })),
    // STOP bypasses the UI's pending-operation guard so it can interrupt an in-flight entry.
    stop: async () => { try { const value = await client.current.request('/execution/stop', {}); setData(value); } catch (err) { setError(`STOP not yet confirmed: ${err.message}`); } },
    closeNow: () => run(() => client.current.request('/execution/close', { approved: true })),
    force: side => run(() => client.current.request('/execution/force', { side })),
  };
}
