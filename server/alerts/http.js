export function createAlertsHandler(repository) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Content-Type','application/json');
    if (req.method !== 'GET') { res.statusCode=405; res.setHeader('Allow','GET'); res.end(JSON.stringify({ error:'Read state is local to your browser.' })); return; }
    const url = new URL(req.url,'http://internal'), route = req.query?.route || url.searchParams.get('route');
    const path = route ? '/api/alerts/' + route : url.pathname;
    if (!['/api/alerts','/api/alerts/live','/api/alerts/status'].includes(path)) {res.statusCode=404;res.end('{}');return;}
    try { const data = await repository.read(); res.statusCode=200; res.end(JSON.stringify(path.endsWith('/live') ? { conditions:data.conditions,status:data.status } : path.endsWith('/status') ? data.status : data)); }
    catch { res.statusCode=503;res.end(JSON.stringify({error:'Alerts backend unavailable',events:[],conditions:[],status:{state:'OFFLINE'}})); }
  };
}
