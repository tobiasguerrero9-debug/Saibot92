import { readFileSync } from 'node:fs';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { approveAgent } from '@nktkas/hyperliquid/api/exchange';
import { recoverApprovalSigner, safeAuthorizationError } from '../server/augustus/approvalSignature.js';
import { authorizationPlan, approvalOnlyTransport, assertTypedApproval, AUTH_MASTER, AUTH_AGENT } from '../server/augustus/authorizationFlow.js';

const args = process.argv.slice(2);
if (args.some(arg => !['--dry-run', '--execute'].includes(arg)) || (args.includes('--dry-run') && args.includes('--execute'))) { console.error('Use --dry-run or --execute.'); process.exit(1); }
const plan = authorizationPlan();
if (!args.includes('--execute')) {
  // Local manifest only. No HTTP server, API calls, signatures, secrets or private-key reads.
  console.log(JSON.stringify({ ...plan, mode: 'DRY_RUN', authorizationSent: false }, null, 2));
} else {
  const origin = 'http://127.0.0.1:8789';
  const csrf = randomBytes(32).toString('hex');
  const transport = approvalOnlyTransport(new HttpTransport({ isTestnet: true, apiUrl: 'https://api.hyperliquid-testnet.xyz', timeout: 10000 }), plan);
  const info = new InfoClient({ transport });
  let phase = 'READY', attempted = false, typed = null, originalTyped = null, resolveSignature, rejectSignature, signatureTimer, failure = null;
  const state = () => ({ phase, plan, failure, build: 'auth-signature-v3', typedData: phase === 'SIGNATURE_REQUIRED' ? typed : null });
  const send = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
  const jsonBody = async req => { let data = ''; for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 8192) throw new Error('Oversized request.'); } return JSON.parse(data || '{}'); };
  async function performApproval(chainId) {
    try {
      const wallet = { address: AUTH_MASTER, signTypedData: async request => {
        assertTypedApproval(request, plan, chainId);
        originalTyped = request;
        typed = JSON.parse(JSON.stringify(request, (_, value) => typeof value === 'bigint' ? `0x${value.toString(16)}` : value));
        typed.types = { EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }], ...typed.types };
        phase = 'SIGNATURE_REQUIRED';
        return new Promise((resolve, reject) => { resolveSignature = resolve; rejectSignature = reject; signatureTimer = setTimeout(() => reject(new Error('Signature window expired.')), 120000); });
      } };
      const response = await approveAgent({ transport, wallet, signatureChainId: chainId }, { agentAddress: AUTH_AGENT, agentName: plan.agentName });
      if (response.status !== 'ok' || response.response?.type !== 'default') throw new Error('Approval response unrecognized.');
      phase = 'VERIFYING';
      const agents = await info.extraAgents({ user: AUTH_MASTER });
      phase = agents.some(agent => agent.address.toLowerCase() === AUTH_AGENT.toLowerCase() && agent.validUntil !== null && agent.validUntil > Date.now() && agent.validUntil <= plan.expiresAt + 1000) ? 'AUTHORIZED_VERIFIED' : 'SUBMITTED_VERIFY_REQUIRED';
    } catch (error) {
      // No error object, signature, wallet payload or private key is printed or persisted.
      failure = { stage: phase, ...safeAuthorizationError(error), ...(Number.isInteger(error?.code) ? { code: error.code } : {}) };
      if (phase !== 'CANCELED') phase = 'FAILED_OR_UNCERTAIN_CHECK_AUTHORIZATION';
    } finally { clearTimeout(signatureTimer); typed = null; originalTyped = null; resolveSignature = null; rejectSignature = null; }
  }
  const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AUGUSTUS92 — TESTNET agent approval</title><style>body{max-width:760px;margin:40px auto;padding:20px;background:#0f1015;color:#eee;font:14px/1.7 monospace}h1,b{color:#2fe7cf}pre{white-space:pre-wrap;overflow-wrap:anywhere}button{padding:14px;background:#15121d;color:#2fe7cf;border:1px solid #2fe7cf;cursor:pointer}button:disabled{opacity:.4}p{color:#bcc3ce}</style><h1>AUGUSTUS92 / TESTNET AUTHORIZATION</h1><p>Approve the displayed delegated agent only. This action places no orders and moves no funds. It grants trading authority until the displayed expiry; ETH-only limits are enforced by AUGUSTUS92, not encoded in this delegation.</p><pre id="plan"></pre><button id="approve">CONNECT MASTER & AUTHORIZE AGENT</button><p>Local build: <b>auth-signature-v3</b></p><pre id="status">BOOTING — if this remains visible, the browser blocked the script.</pre><pre id="diagnostics"></pre><pre id="debug" aria-live="polite">Waiting for JavaScript bootstrap.</pre><script nonce="${csrf}">
const csrf=${JSON.stringify(csrf)}, master=${JSON.stringify(AUTH_MASTER)};
${readFileSync(new URL('./augustus-authorization-client.js', import.meta.url), 'utf8')}
</script></html>`;
  const server = http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== '127.0.0.1:8789' || (req.headers.origin && req.headers.origin !== origin)) return send(res, 403, { error: 'Origin/host rejected.' });
      if (req.url === '/' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${csrf}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`, 'X-Content-Type-Options': 'nosniff' }); res.end(page); return; }
      if (req.headers['x-augustus-csrf'] !== csrf || (req.method === 'POST' && req.headers.origin !== origin)) return send(res, 403, { error: 'Local request rejected.' });
      if (req.url === '/api/status' && req.method === 'GET') return send(res, 200, state());
      if (req.method !== 'POST') return send(res, 405, { error: 'Method rejected.' });
      const data = await jsonBody(req);
      if (req.url === '/api/start') {
        if (attempted || data.address?.toLowerCase() !== AUTH_MASTER.toLowerCase() || !/^0x[0-9a-f]+$/i.test(data.chainId || '') || BigInt(data.chainId) <= 0n || Date.now() >= plan.expiresAt - 60000) return send(res, 409, { error: 'Wrong master, expired plan or approval already attempted.' });
        attempted = true; phase = 'PREPARING'; void performApproval(data.chainId); return send(res, 200, { phase });
      }
      if (req.url === '/api/signature') {
        if (phase !== 'SIGNATURE_REQUIRED' || !originalTyped || !/^0x[0-9a-f]{130}$/i.test(data.signature || '')) return send(res, 400, { error: 'Signature rejected.' });
        let signer;
        try { signer = recoverApprovalSigner(typed, plan, originalTyped.domain.chainId, data.signature); }
        catch (error) { const safe = safeAuthorizationError(error); return send(res, 400, { error: 'Local signature verification: ' + safe.name + ': ' + safe.message }); }
        if (signer.toLowerCase() !== AUTH_MASTER.toLowerCase() || phase !== 'SIGNATURE_REQUIRED') return send(res, 400, { error: 'Wrong signer or expired signature window; approval was not submitted.' });
        phase = 'SUBMITTING_APPROVAL_ONLY'; clearTimeout(signatureTimer); resolveSignature(data.signature); return send(res, 200, { phase });
      }
      if (req.url === '/api/cancel') { if (!['PREPARING', 'SIGNATURE_REQUIRED'].includes(phase)) return send(res, 409, { error: 'Cannot cancel a submitted approval; check authorization status.' }); phase = 'CANCELED'; rejectSignature?.(new Error('Signature wait canceled.')); return send(res, 200, { phase }); }
      return send(res, 404, { error: 'Unknown route.' });
    } catch (error) { const safe = safeAuthorizationError(error); return send(res, 400, { error: safe.name + ': ' + safe.message }); }
  });
  server.requestTimeout = 10000;
  server.listen(8789, '127.0.0.1', () => console.log(`Authorization-only local page: ${origin}\nMaster: ${AUTH_MASTER}\nAgent: ${AUTH_AGENT}\nTESTNET only. No order/transfer actions. Trading stays disabled.`));
  server.on('error', () => { console.error('Local authorization server could not start.'); process.exitCode = 1; });
  process.once('SIGINT', () => { rejectSignature?.(new Error('Local authorization stopped.')); clearTimeout(signatureTimer); server.close(() => process.exit(0)); });
}
