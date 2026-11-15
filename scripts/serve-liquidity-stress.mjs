import { createServer } from 'node:http';
import { createStressHandler } from '../server/liquidityStress/service.js';
createServer(createStressHandler()).listen(8794,'127.0.0.1',()=>console.log('Read-only Liquidity Stress API: http://127.0.0.1:8794'));
