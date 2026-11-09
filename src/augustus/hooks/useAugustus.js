import { useEffect, useRef, useState } from 'react';
import { HyperliquidExecutionClient } from '../services/hyperliquidExecutionClient.js';
import { HyperliquidInfoClient } from '../services/hyperliquidInfoClient.js';
import { verifyHolder } from '../services/holderAccessService.js';
import { transitionState } from '../state/augustusState.js';
import { DEFAULT_RISK } from '../config.js';

export function useAugustus() {
  const [state, setState] = useState('LOCKED'), stateRef = useRef('LOCKED');
  const [config, setConfig] = useState(null), [access, setAccess] = useState(null), [snapshot, setSnapshot] = useState(null);
  const [mode, setMode] = useState('OBSERVE'), [settings, setSettings] = useState({ ...DEFAULT_RISK });
  const [proposal, setProposal] = useState(null), [risk, setRisk] = useState(null), [result, setResult] = useState(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [stream, setStream] = useState('DISCONNECTED'), [history, setHistory] = useState([]);
  const [symbol, setSymbol] = useState('ETH');
  const client = useRef(new HyperliquidExecutionClient()), info = useRef(new HyperliquidInfoClient());
  const accountRef = useRef(null), generation = useRef(0), operation = useRef(false);
  const move = next => { stateRef.current = transitionState(stateRef.current, next); setState(stateRef.current); };
  const lock = () => {
    generation.current++; accountRef.current = null;
    void client.current.disconnect().catch(() => {});
    setAccess(null); setSnapshot(null); setProposal(null); setRisk(null); setResult(null); setStream('DISCONNECTED');
    if (stateRef.current !== 'LOCKED') move('LOCKED');
  };
  useEffect(() => {
    let live = true;
    const sessionClient = client.current, sessionGeneration = generation;
    sessionClient.config().then(value => { if (live) setConfig(value); }).catch(() => { if (live) setError('Local TESTNET service unavailable. Run npm run augustus:server.'); });
    const provider = window.ethereum;
    const changed = () => { lock(); setError('Wallet or network changed. Access revoked; reconnect and verify again.'); };
    provider?.on?.('accountsChanged', changed); provider?.on?.('chainChanged', changed); provider?.on?.('disconnect', changed);
    return () => { live = false; sessionGeneration.current++; void sessionClient.disconnect().catch(() => {}); provider?.removeListener?.('accountsChanged', changed); provider?.removeListener?.('chainChanged', changed); provider?.removeListener?.('disconnect', changed); };
    // One session owns its listeners and auth token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async currentGeneration => {
    const verification = await verifyHolder(window.ethereum, accountRef.current, config);
    if (currentGeneration !== generation.current) return;
    if (!verification.granted) { lock(); throw new Error(`Holder verification: ${verification.status}`); }
    const data = await client.current.snapshot();
    if (currentGeneration !== generation.current) return;
    setAccess(verification); setSnapshot(data);
    if (stateRef.current === 'OBSERVING' && data.account.positions.length) move('POSITION_OPEN');
    else if (stateRef.current === 'POSITION_OPEN' && !data.account.positions.length) { move('EXITED'); move('OBSERVING'); }
    return data;
  };
  useEffect(() => {
    if (!access?.granted) return;
    let active = true, timer, reading = false; const currentGeneration = generation.current;
    const poll = async () => {
      if (!active || reading) return; reading = true;
      try { await refresh(currentGeneration); } catch (err) { if (active) { setError(err.message); lock(); } }
      finally { reading = false; if (active) timer = setTimeout(poll, 5000); }
    };
    timer = setTimeout(poll, 5000);
    const stop = info.current.watchMarket(symbol, () => {}, setStream);
    return () => { active = false; clearTimeout(timer); stop(); };
    // Refresh uses the authenticated account, invalidated by generation on wallet changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access?.granted, symbol]);

  const run = async action => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(''); const currentGeneration = generation.current;
    try { await action(currentGeneration); } catch (err) {
      if (currentGeneration === generation.current) { setError(err.message); if (!['LOCKED', 'ERROR'].includes(stateRef.current)) move('ERROR'); }
    } finally { operation.current = false; setBusy(false); }
  };
  const connect = () => run(async currentGeneration => {
    if (!config) throw new Error('Start the local service before connecting.');
    if (!window.ethereum) throw new Error('An EIP-1193 wallet is required. No wallet provider detected.');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (currentGeneration !== generation.current) return;
    const check = await verifyHolder(window.ethereum, accounts[0], config);
    if (currentGeneration !== generation.current) return;
    if (!check.granted) throw new Error(`Holder verification: ${check.status}`);
    await client.current.authenticate(window.ethereum, accounts[0]);
    if (currentGeneration !== generation.current) { void client.current.disconnect(); return; }
    accountRef.current = accounts[0];
    const data = await refresh(currentGeneration);
    if (!data || currentGeneration !== generation.current) return;
    move('DISCONNECTED'); move('OBSERVING');
    if (data.account.positions.length) move('POSITION_OPEN');
  });
  const propose = input => run(async currentGeneration => {
    if (mode !== 'COPILOT') throw new Error('Switch to COPILOT to create a proposal.');
    if (stateRef.current === 'ERROR') move('OBSERVING');
    if (stateRef.current === 'AWAITING_APPROVAL') move('OBSERVING');
    move('ANALYZING'); setProposal(null); setResult(null);
    await refresh(currentGeneration);
    const data = await client.current.propose({ ...input, symbol, settings });
    if (currentGeneration !== generation.current) return;
    setProposal(data.proposal); setRisk(data.risk);
    if (data.risk.decision === 'REJECT') move('RISK_BLOCKED');
    else { move('PROPOSAL_READY'); move('AWAITING_APPROVAL'); }
  });
  const approve = () => run(async currentGeneration => {
    if (mode !== 'COPILOT' || stateRef.current !== 'AWAITING_APPROVAL' || !proposal || proposal.expiresAt <= Date.now()) throw new Error('A fresh allowed proposal and explicit approval are required.');
    await refresh(currentGeneration);
    if (currentGeneration !== generation.current) return;
    move('EXECUTING');
    const execution = await client.current.approve(proposal.id);
    if (currentGeneration !== generation.current) return;
    setResult(execution); setHistory(items => [{ timestamp: Date.now(), proposalId: proposal.id, symbol: proposal.symbol, side: proposal.side, entry: proposal.entry, size: proposal.size, risk: proposal.maxLoss, userApproval: true, orderId: execution.orderId, status: execution.status }, ...items]);
    if (execution.status === 'REJECTED') move('RISK_BLOCKED');
    else if (execution.status === 'FAILED' || execution.uncertain) move('ERROR');
    else { const data = await refresh(currentGeneration); if (data) move(data.account.positions.length ? 'POSITION_OPEN' : 'OBSERVING'); }
  });
  const reject = () => { if (stateRef.current === 'AWAITING_APPROVAL') move('OBSERVING'); setProposal(null); setRisk(null); };
  const manage = (action, market, orderId) => run(async currentGeneration => {
    if (mode !== 'COPILOT') throw new Error('COPILOT mode and explicit confirmation required.');
    const previous = stateRef.current;
    if (!['POSITION_OPEN', 'OBSERVING'].includes(previous)) throw new Error('Refresh account state before managing.');
    move('MANAGING'); const data = await client.current.manage(action, market, orderId);
    if (currentGeneration !== generation.current) return;
    setResult(data); setHistory(items => [{ timestamp: Date.now(), symbol: market, action, userApproval: true, status: data.status }, ...items]);
    const fresh = await refresh(currentGeneration);
    if (fresh) { if (fresh.account.positions.length) move('POSITION_OPEN'); else { move('EXITED'); move('OBSERVING'); } }
  });
  return { state, config, access, snapshot, mode, setMode, settings, setSettings, symbol, setSymbol, proposal, risk, result, error, busy, stream, history, connect, lock, propose, approve, reject, manage };
}
