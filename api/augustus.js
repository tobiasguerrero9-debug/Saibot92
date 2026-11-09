import { randomBytes } from 'node:crypto';
import { hostedConfig } from '../server/augustus/hosted/config.js';
import { HostedStore } from '../server/augustus/hosted/store.js';
import { AgentVault } from '../server/augustus/hosted/agentVault.js';
import { HostedAuth, digest } from '../server/augustus/hosted/auth.js';
import { HostedRuntime, publicData } from '../server/augustus/hosted/runtime.js';
import { publicMonitoring } from '../server/augustus/publicMonitoring.js';
let resources;
const zero = '0x0000000000000000000000000000000000000000';
const cookieMap = header => Object.fromEntries(String(header || '').split(';').map(s => s.trim().split('=')).filter(pair => pair.length === 2));
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  const route = String(req.query?.route || new URL(req.url, 'http://internal').searchParams.get('route') || 'health').replace(/^\//, '');
  const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(publicData(body))); };
  if (route === 'diagnostics') return send(403, { error: 'Developer diagnostics are not public.' });
  if (route === 'health') return send(200, { service: 'augustus', executionEnabled: false, configured: !!process.env.DATABASE_URL && !!process.env.AGENT_ENCRYPTION_KEY_BASE64 });
  let config;
  try { config = hostedConfig(); } catch { return send(503, { error: 'Augustus backend is not configured. Execution is disabled.', executionEnabled: false }); }
  if (req.headers.host !== new URL(config.origin).host || (req.headers.origin && req.headers.origin !== config.origin) || (req.method === 'POST' && req.headers.origin !== config.origin)) return send(403, { error: 'Origin rejected.' });
  try {
    if (!resources) { const store = new HostedStore(config), vault = new AgentVault(config); resources = { store, auth: new HostedAuth({ store, vault, config }), runtime: new HostedRuntime({ store, vault, config }) }; }
    const { store, auth, runtime } = resources;
    await store.health();
    const authRoute = ['challenge', 'session'].includes(route);
    await store.rateLimit(digest(config.cronSecret + ':' + (authRoute ? 'auth:' : 'api:') + String(req.headers['x-forwarded-for'] || 'unknown')), authRoute ? 30 : 90);
    const secure = config.stage !== 'development', prefix = secure ? '__Host-Augustus' : 'augustus_', cookies = cookieMap(req.headers.cookie);
    const sessionName = prefix + 'Session', csrfName = prefix + 'CSRF';
    let csrf = cookies[csrfName];
    const setCookie = (name, value, maxAge) => { const previous = res.getHeader('Set-Cookie') || []; res.setHeader('Set-Cookie', [...(Array.isArray(previous) ? previous : [previous]), `${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`]); };
    if (req.method === 'GET' && route === 'bootstrap') {
      if (!/^[0-9a-f]{64}$/.test(csrf || '')) { csrf = randomBytes(32).toString('hex'); setCookie(csrfName, csrf, 1800); }
      const [meta, context] = await Promise.all([fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs' }), signal: AbortSignal.timeout(10000) }).then(r => { if (!r.ok) throw Error(); return r.json(); }), store.transaction(zero, c => runtime.context(c)).catch(() => null)]);
      const index = meta[0]?.universe?.findIndex(m => m.name === 'ETH'); if (!(index >= 0)) throw Error('ETH metadata unavailable');
      return send(200, { csrf, serverTime: Date.now(), dedicatedPilot: false, state: { market: { ...meta[0].universe[index], ...meta[1][index], asset: index } }, context, monitoring: publicMonitoring(context), executionEnabled: false, environment: config.stage });
    }
    if (req.method === 'GET' && route === 'ready') { let contextReady = true; try { await store.transaction(zero, c => runtime.context(c)); } catch { contextReady = false; } const protection = await store.transaction(zero, c => runtime.executions.gate(c, zero)); return send(contextReady && protection.protectionWorker ? 200 : 503, { database: true, persistence: true, context: contextReady, protectionWorker: protection.protectionWorker, executionEnabled: false, accountApprovalRequired: true }); }
    let input = {};
    if (req.method === 'POST') {
      if (!/^[0-9a-f]{64}$/.test(csrf || '') || req.headers['x-augustus-canary-csrf'] !== csrf || !req.headers['content-type']?.startsWith('application/json')) return send(403, { error: 'Refresh the page before continuing.' });
      if (req.body !== undefined) { if (JSON.stringify(req.body).length > 8192) throw Error(); input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
      else { let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 8192) throw Error(); } input = JSON.parse(body || '{}'); }
    }
    if (req.method === 'POST' && route === 'challenge') return send(200, await auth.challenge(input.address));
    if (req.method === 'POST' && route === 'session') {
      const session = await auth.authenticate(input, csrf); await runtime.tenant(session.address, 'connect');
      setCookie(sessionName, session.token, 1800); setCookie(csrfName, csrf, 1800); return send(200, { address: session.address, agentAddress: session.agentAddress });
    }
    if (req.method === 'POST' && route === 'disconnect') { setCookie(sessionName, '', 0); let owner; try { owner = await auth.session(cookies[sessionName]); } catch { /* Expired sessions still clear their cookie. */ } if (owner) await runtime.tenant(owner, 'disconnect'); await auth.logout(cookies[sessionName]); return send(200, { disconnected: true }); }
    let wallet; try { wallet = await auth.session(cookies[sessionName], req.method === 'POST' ? csrf : null); } catch { return send(401, { error: 'Connect your wallet to continue.' }); }
    if (req.method === 'GET' && route === 'status') return send(200, await runtime.tenant(wallet));
    if (req.method !== 'POST' || !['risk', 'arm', 'reject', 'execute', 'kill', 'reset', 'close'].includes(route)) return send(404, { error: 'Unknown operation.' });
    const result = await runtime.tenant(wallet, route, input, { sessionTokenHash: digest(cookies[sessionName]) }); return send(result.blocked ? 423 : 200, result);
  } catch { return send(503, { error: 'Verified identity, agent mapping or durable persistence is unavailable. Operation blocked.', executionEnabled: false }); }
}
