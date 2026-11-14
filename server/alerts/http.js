import { SnapshotReads } from './reliability.js';
import { publicSnapshot } from './engine.js';
const readers = new WeakMap();
export function createAlertsHandler(repository) {
  if (!readers.has(repository)) readers.set(repository, new SnapshotReads(options => repository.read(options)));
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Content-Type','application/json');
    if (req.method !== 'GET') { res.statusCode=405; res.setHeader('Allow','GET'); res.end(JSON.stringify({ error:'Read state is local to your browser.' })); return; }
    const url = new URL(req.url,'http://internal'), route = req.query?.route || url.searchParams.get('route');
    const path = route ? '/api/alerts/' + route : url.pathname;
    if (!['/api/alerts','/api/alerts/live','/api/alerts/status'].includes(path)) {res.statusCode=404;res.end('{}');return;}
    const view = path.endsWith('/live') ? 'live' : path.endsWith('/status') ? 'status' : (req.query?.view || url.searchParams.get('view')) === 'inbox' ? 'inbox' : 'all';
    try {
      const cached = await readers.get(repository).get(view);
      // Health is recomputed even when the short read cache is used.
      const data = publicSnapshot({ ...cached, status: cached.status }, cached.events);
      res.statusCode=200; res.end(JSON.stringify(path.endsWith('/live') ? { conditions:data.conditions,status:data.status } : path.endsWith('/status') ? data.status : view === 'inbox' ? { ...data, markets: [] } : data));
    }
    catch (error) { const retryAfterSeconds = error.retryAfterSeconds || 1; res.statusCode=503;res.setHeader('Retry-After',String(retryAfterSeconds));res.end(JSON.stringify({error:'Alerts backend unavailable',events:[],conditions:[],status:{state:'OFFLINE',persistence:'UNAVAILABLE',retryAfterSeconds}})); }
  };
}
