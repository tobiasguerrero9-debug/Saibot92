// Finite, read-only verification against the hosted API and public exchange stream.
import fs from 'node:fs';
import {LiquidityStressClient} from '../src/services/liquidityStressClient.js';
import {wsManager} from '../src/services/binanceWebSocketManager.js';
const started=Date.now(),duration=Number(process.env.STRESS_VALIDATION_SECONDS||2580)*1000;
const historyPath='work/stress-recovery-live-history.local';
const storage={getItem:()=>fs.existsSync(historyPath)?fs.readFileSync(historyPath,'utf8'):null,setItem:(_k,v)=>fs.writeFileSync(historyPath,v)};
const client=new LiquidityStressClient({storage,fetchImpl:path=>fetch('https://www.saibot92.auction'+path,{signal:AbortSignal.timeout(30000)})});
let messages=0,liquidations=0;const checks=[];
wsManager.connect(['btcusdt@miniTicker','btcusdt@aggTrade','!forceOrder@arr'],(_s,data)=>{messages++;if(data?.e==='forceOrder')liquidations++;},()=>{});
client.start();
function report(){const snapshot=client.snapshot(),markets=snapshot.markets.filter(m=>['BTCUSDT','ETHUSDT','SOLUSDT'].includes(m.symbol));const value={elapsedSeconds:Math.round((Date.now()-started)/1000),at:new Date().toISOString(),connection:snapshot.connection,error:snapshot.error,messages,liquidations,markets:markets.map(m=>({symbol:m.symbol,score:m.score,validFactors:m.validFactors,factors:Object.fromEntries(Object.entries(m.factors).map(([k,v])=>[k,{value:v.value,score:v.score,validity:v.validity}])),coverage:m.coverage}))};checks.push(value);fs.writeFileSync('work/stress-recovery-live-validation.local',JSON.stringify({startedAt:new Date(started).toISOString(),checks},null,2));console.log(JSON.stringify({elapsed:value.elapsedSeconds,connection:value.connection,messages,liquidations,markets:value.markets.map(m=>({symbol:m.symbol,score:m.score,ready:m.validFactors,samples:m.coverage.samples,book:m.coverage.book.currentSamples,liq:m.coverage.liquidation.currentSamples,baseline:m.coverage.liquidation.baselineSamples}))}));}
const timer=setInterval(report,60000);
setTimeout(()=>{report();clearInterval(timer);client.shutdown();wsManager.disconnect();},duration);
