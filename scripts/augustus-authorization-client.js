// Local authorization UI only. Never log signatures, typed payloads or secrets.
const statusElement = document.getElementById('status');
const button = document.getElementById('approve');
const diagnostics = document.getElementById('diagnostics');
const debug = document.getElementById('debug');
let provider = null, busy = false, signing = false, remotePhase = 'UNKNOWN';
const trace = message => { debug.textContent += '\n' + new Date().toLocaleTimeString() + ' ' + message; };
const errorText = error => ('code=' + (Number.isInteger(error?.code) ? error.code : 'unavailable') + ' ' + String(error?.message || 'Unknown error')).replace(/0x[0-9a-f]{64,}/gi, '[redacted cryptographic data]').slice(0, 500);
function showError(error) { const text = errorText(error); statusElement.textContent = 'ERROR: ' + text; trace('ERROR: ' + text); }
window.addEventListener('error', event => showError({ message: event.message }));
window.addEventListener('unhandledrejection', event => { event.preventDefault(); showError(event.reason); });
function bounded(promise, ms = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Request timed out. Resolve pending requests in MetaMask; check authorization status before retrying.')), ms);
    Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
async function call(path, data) {
  const response = await fetch('/api/' + path, { method: data ? 'POST' : 'GET', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', 'X-Augustus-CSRF': csrf }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const body = await response.json();
  if (!response.ok) throw Error('Local API ' + path + ' (' + response.status + '): ' + (body.error || 'Request rejected'));
  return body;
}
async function request(method, params) {
  if (!provider?.request) throw Error('No injected wallet provider. Enable MetaMask for this site.');
  trace('WALLET REQUEST: ' + method);
  try { return await bounded(provider.request({ method, ...(params ? { params } : {}) }), method === 'eth_signTypedData_v4' ? 110000 : 10000); }
  catch (error) { trace('WALLET REJECTED ' + method + ': ' + errorText(error)); throw error; }
}
function render() {
  // Authorization is independent of balance, holder access and execution settings.
  button.disabled = busy || remotePhase !== 'READY';
  button.title = busy ? 'Authorization request in progress' : remotePhase !== 'READY' ? 'Server phase: ' + remotePhase : 'Authorize the TESTNET agent only';
}
async function detect() {
  provider = provider || window.ethereum?.providers?.find(p => p.isMetaMask) || window.ethereum || null;
  diagnostics.textContent = 'window.ethereum: ' + Boolean(window.ethereum) + '\nProvider: ' + (provider?.isMetaMask ? 'MetaMask' : provider ? 'EIP-1193' : 'unavailable');
  if (provider) {
    const accounts = await request('eth_accounts');
    diagnostics.textContent += '\neth_accounts: ' + (accounts[0] || 'not connected') + '\nMaster matched: ' + (accounts[0]?.toLowerCase() === master.toLowerCase()) + '\nButton enabled: ' + !button.disabled + '\nClick listener attached: YES';
  }
}
window.addEventListener('eip6963:announceProvider', event => { if (event.detail?.info?.rdns === 'io.metamask') { provider = event.detail.provider; void detect().catch(showError); } });
window.addEventListener('ethereum#initialized', () => void detect().catch(showError));
window.addEventListener('focus', () => void detect().catch(showError));
async function poll(allowSignature = false) {
  const state = await call('status'); remotePhase = state.phase; render();
  document.getElementById('plan').textContent = JSON.stringify(state.plan, null, 2);
  statusElement.textContent = state.phase;
  if (state.failure) { statusElement.textContent = 'ERROR at ' + state.failure.stage + ': ' + state.failure.name + ': ' + state.failure.message; trace(statusElement.textContent); }
  if (state.phase === 'AUTHORIZED_VERIFIED') trace('AUTHORIZED — VERIFIED ON TESTNET');
  if (state.phase === 'SIGNATURE_REQUIRED' && allowSignature && !signing) {
    signing = true;
    try {
      const accounts = await request('eth_accounts');
      const chain = await request('eth_chainId');
      if (accounts[0]?.toLowerCase() !== master.toLowerCase() || BigInt(chain) !== BigInt(state.typedData.domain.chainId)) throw Error('Wallet or signing network changed.');
      if (state.typedData.primaryType !== 'HyperliquidTransaction:ApproveAgent' || state.typedData.message.hyperliquidChain !== 'Testnet' || state.typedData.message.agentAddress.toLowerCase() !== state.plan.agentAddress.toLowerCase()) throw Error('Unsafe approval payload rejected.');
      trace('APPROVEAGENT PAYLOAD CONSTRUCTED — TESTNET ONLY');
      trace('REQUESTING SIGNATURE — manually review and approve in MetaMask');
      statusElement.textContent = 'REQUESTING SIGNATURE — WAITING FOR METAMASK';
      const signature = await request('eth_signTypedData_v4', [master, JSON.stringify(state.typedData)]);
      trace('SIGNATURE RECEIVED (not displayed)');
      trace('LOCAL SIGNATURE VERIFICATION — POST /api/signature');
      await call('signature', { signature });
      trace('LOCAL SIGNER VERIFIED — SUBMITTING TO TESTNET — APPROVEAGENT ONLY');
    } catch (error) {
      showError(error);
      // Cancel only the signature wait; never automatically retry a submission.
      try { await call('cancel', {}); } catch (cancelError) { showError(cancelError); }
      remotePhase = 'CANCELED'; render(); return;
    }
  }
  if (!['READY', 'AUTHORIZED_VERIFIED', 'SUBMITTED_VERIFY_REQUIRED', 'FAILED_OR_UNCERTAIN_CHECK_AUTHORIZATION', 'CANCELED'].includes(state.phase)) {
    setTimeout(() => poll(allowSignature).catch(error => { remotePhase = 'UNKNOWN'; render(); showError(error); }), 500);
  }
}
button.addEventListener('click', async () => {
  trace('CLICK RECEIVED');
  if (busy || remotePhase !== 'READY') { trace('CLICK BLOCKED: ' + remotePhase); return; }
  busy = true; render();
  try {
    await detect();
    if (!provider) throw Error('MetaMask provider unavailable. Enable the extension for this local site.');
    trace('WALLET DETECTED');
    let accounts = await request('eth_accounts');
    if (!accounts.length) { trace('REQUESTING WALLET CONNECTION'); accounts = await request('eth_requestAccounts'); }
    if (accounts[0]?.toLowerCase() !== master.toLowerCase()) throw Error('Wrong selected wallet. Select the dedicated AUGUSTUS92 master.');
    trace('MASTER MATCHED');
    const chainId = await request('eth_chainId');
    trace('BUILDING APPROVE AGENT PAYLOAD');
    remotePhase = 'PREPARING';
    await call('start', { address: accounts[0], chainId });
    await poll(true);
  } catch (error) {
    showError(error);
    try { remotePhase = (await call('status')).phase; } catch { remotePhase = 'UNKNOWN'; }
  } finally { busy = false; render(); }
});
trace('JS BOOTED: auth-signature-v3');
trace('CLICK LISTENER ATTACHED');
render();
window.dispatchEvent(new Event('eip6963:requestProvider'));
void detect().catch(showError);
void poll(false).catch(error => { remotePhase = 'UNKNOWN'; render(); showError(error); });
