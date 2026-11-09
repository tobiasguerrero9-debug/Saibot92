import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { MainnetAdapter } from '../server/augustus/mainnetAdapter.js';
import { MainnetContextFeed, validateLiveContext } from '../server/augustus/mainnetContext.js';
import { authorizationReadiness } from '../server/augustus/mainnetAccountState.js';
import { ProposalEngine } from '../server/augustus/proposalEngine.js';
import { ProductSession } from '../server/augustus/productSession.js';
import { ProductAuth } from '../server/augustus/productAuth.js';
import { SessionAudit } from '../server/augustus/sessionAudit.js';

const adapter = new MainnetAdapter(), feed = new MainnetContextFeed();
const csrf = randomBytes(32).toString('hex');
const stopFeed = feed.start();
const proposalEngine = new ProposalEngine({ adapter, feed });
const product = new ProductSession({ adapter, feed, engine: new ProposalEngine({ adapter, feed }), audit: new SessionAudit('work/augustus-product-session.local') });
const productAuth = new ProductAuth();
// Build real What Changed history even before the review screen is opened.
const observationTimer = setInterval(() => { if (!product.session.killed) void proposalEngine.evaluate(); else void feed.read().catch(() => {}); void product.tick(); }, 5000);
void proposalEngine.evaluate();
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
const server = http.createServer(async (req, res) => {
  if (!['127.0.0.1:8791', '127.0.0.1:5173', 'localhost:5173'].includes(req.headers.host) || (req.headers.origin && !['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:8791'].includes(req.headers.origin))) return send(res, 403, { error: 'Local origin rejected.' });
  try {
    if (req.url?.startsWith('/api/augustus-product/')) {
      const route = req.url.slice('/api/augustus-product'.length);
      if (req.method === 'GET' && route === '/bootstrap') { const [state, context] = await Promise.all([adapter.read(), feed.read().catch(() => null)]); return send(res, 200, { csrf, dedicatedPilot: true, state: { market: state.market }, context, executionEnabled: false, environment: 'development' }); }
      const cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(x => x.length === 2));
      let body = {};
      if (req.method === 'POST') {
        if (req.headers['x-augustus-canary-csrf'] !== csrf) return send(res, 403, { error: 'Refresh the page before continuing.' });
        let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 8192) throw Error('Request too large.'); } body = JSON.parse(text || '{}');
      }
      if (req.method === 'POST' && route === '/challenge') return send(res, 200, productAuth.challenge(body.address));
      if (req.method === 'POST' && route === '/session') { const session = await productAuth.authenticate(body); product.connect(session.address); res.setHeader('Set-Cookie', `augustus_pilot_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`); return send(res, 200, { address: session.address }); }
      let address; try { address = productAuth.address(req.headers.authorization || (cookies.augustus_pilot_session ? 'Bearer ' + cookies.augustus_pilot_session : '')); } catch { return send(res, 401, { error: 'Connect your wallet to continue.' }); }
      if (req.method === 'GET' && route === '/status') return send(res, 200, await product.status(address));
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not supported.' });
      if (route === '/risk') product.configure(address, body);
      else if (route === '/arm') await product.arm(address);
      else if (route === '/reject') product.reject(address, body.proposalId);
      else if (route === '/execute') await product.execute(address, body);
      else if (route === '/kill') await product.kill(address, body.confirmClose);
      else if (route === '/reset') product.reset(address);
      else if (route === '/disconnect') { product.disconnect(address); productAuth.logout(req.headers.authorization || 'Bearer ' + cookies.augustus_pilot_session); res.setHeader('Set-Cookie', 'augustus_pilot_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send(res, 200, { disconnected: true }); }
      else if (route === '/close') await product.close(address, body.confirmed);
      else return send(res, 404, { error: 'Unknown product action.' });
      return send(res, 200, await product.status(address));
    }
    if (req.url === '/api/augustus-canary/snapshot' && req.method === 'GET') {
      const [state, contextResult] = await Promise.all([adapter.read(), feed.read().then(context => { try { validateLiveContext(context); return { context, ready: true }; } catch (e) { return { context, ready: false, reason: e.message }; } }).catch(() => ({ context: null, ready: false, reason: 'Research source unavailable.' }))]);
      return send(res, 200, { executionEnabled: false, state, ...contextResult, readiness: authorizationReadiness(state, contextResult.context), proposalEngine: product.session.killed ? { decision: 'NO TRADE', proposal: null, reasons: ['KILL SWITCH active.'], executionEnabled: false } : proposalEngine.status(), csrf });
    }
    if (req.url === '/api/augustus-canary/proposal-engine' && req.method === 'GET') return send(res, 200, product.session.killed ? { decision: 'NO TRADE', proposal: null, reasons: ['KILL SWITCH active.'], executionEnabled: false } : await proposalEngine.evaluate());
    if (['/api/augustus-canary/proposal', '/api/augustus-canary/proposal-engine/config'].includes(req.url) && req.method === 'POST') {
      if (req.headers['x-augustus-canary-csrf'] !== csrf) return send(res, 403, { error: 'Refresh local snapshot before proposal review.' });
      if (product.session.killed) throw Error('KILL SWITCH active. Reset monitoring before configuring proposals.');
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) throw Error('Proposal too large.'); }
      proposalEngine.configure(JSON.parse(body));
      return send(res, 200, await proposalEngine.evaluate());
    }
    return send(res, 404, { error: 'Only read-only snapshot and unsigned proposal preview are available.' });
  } catch (error) { return send(res, 400, { error: String(error.message).split('\n')[0].replace(/0x[0-9a-f]{64,}/gi, '[redacted]').slice(0, 300), executionEnabled: false }); }
});
server.requestTimeout = 15000;
server.listen(8791, '127.0.0.1', () => console.log('MAINNET_CANARY read-only review service: 127.0.0.1:8791. No wallet, signatures, orders or transfer routes.'));
process.once('SIGINT', () => { clearInterval(observationTimer); stopFeed(); server.close(); });
