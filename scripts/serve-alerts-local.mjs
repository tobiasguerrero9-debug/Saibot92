import { createServer } from 'node:http';
import { createAlertsRepository } from '../server/alerts/repository.js';
import { createAlertsHandler } from '../server/alerts/http.js';
const repository=await createAlertsRepository({...process.env,ALERTS_STORAGE:'sqlite',ALERTS_ENV:'development'});
const server=createServer(createAlertsHandler(repository));
server.listen(8793,'127.0.0.1',()=>console.log('Alerts local read-only API: http://127.0.0.1:8793/api/alerts'));
const stop=()=>server.close(async()=>{await repository.close();process.exit(0);});process.once('SIGINT',stop);process.once('SIGTERM',stop);
process.on('uncaughtException',()=>{console.error('Alerts local API stopped safely.');process.exit(1)});
