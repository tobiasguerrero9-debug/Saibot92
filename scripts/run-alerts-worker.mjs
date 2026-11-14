import { createAlertsRepository } from '../server/alerts/repository.js';
import { AlertsWorker } from '../server/alerts/worker.js';
import { runAlertsDaemon } from '../server/alerts/daemon.js';
import { safePersistenceError } from '../server/alerts/reliability.js';
let repository, stopping = false;
const fatal = error => { console.error(JSON.stringify({event:'ALERTS_FATAL',code:safePersistenceError(error).code})); process.exit(1); };
process.on('uncaughtException', fatal);
process.on('unhandledRejection', fatal);
process.once('SIGINT',()=>{stopping=true;});process.once('SIGTERM',()=>{stopping=true;});
try {
  const env = process.argv.includes('--local') ? {...process.env, ALERTS_STORAGE:'sqlite', ALERTS_ENV:'development'} : process.env;
  repository = await createAlertsRepository(env);
  const worker = new AlertsWorker({ repository });
  console.log('Alerts background worker started; cadence 30s.');
  await runAlertsDaemon({ worker, stopping: () => stopping });
} catch { console.error('Alerts worker unavailable; verify environment and migration.');process.exitCode=1; }
finally { await repository?.close(); }
