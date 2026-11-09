import { createAlertsRepository } from '../server/alerts/repository.js';
import { AlertsWorker } from '../server/alerts/worker.js';
let repository, stopping = false;
process.on('uncaughtException', () => { console.error('Alerts worker stopped safely.'); process.exit(1); });
process.on('unhandledRejection', () => { console.error('Alerts worker stopped safely.'); process.exit(1); });
process.once('SIGINT',()=>{stopping=true;});process.once('SIGTERM',()=>{stopping=true;});
try {
  const env = process.argv.includes('--local') ? {...process.env, ALERTS_STORAGE:'sqlite', ALERTS_ENV:'development'} : process.env;
  repository = await createAlertsRepository(env);
  const worker = new AlertsWorker({ repository });
  console.log('Alerts background worker started; cadence 30s.');
  do {
    const started = Date.now();
    try { const result=await worker.cycle(); console.log(JSON.stringify({event:'ALERTS_SCAN',committed:result.committed===true,skipped:result.skipped===true,events:result.events||0})); }
    catch { console.error('Alerts scan unconfirmed; baseline preserved.'); }
    const until=started+30000;while(!stopping && Date.now()<until) await new Promise(r=>setTimeout(r,Math.min(1000,until-Date.now())));
  } while(!stopping);
} catch { console.error('Alerts worker unavailable; verify environment and migration.');process.exitCode=1; }
finally { await repository?.close(); }
