import { createAlertsRepository } from '../server/alerts/repository.js';
import { createAlertsHandler } from '../server/alerts/http.js';
let repository;
export default async function handler(req,res) {
  try { repository ||= createAlertsRepository(); await createAlertsHandler(await repository)(req,res); }
  catch { res.statusCode=503;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Alerts backend unavailable',status:{state:'OFFLINE'}})); }
}
