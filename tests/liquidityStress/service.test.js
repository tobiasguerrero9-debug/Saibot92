import test from 'node:test';import assert from 'node:assert/strict';
import {StressDataService,createStressHandler} from '../../server/liquidityStress/service.js';
import {LiquidityStressClient} from '../../src/services/liquidityStressClient.js';
import {BinanceWebSocketManager} from '../../src/services/binanceWebSocketManager.js';
test('request queue enforces three concurrent operations and coalesces cached requests',async()=>{
  let active=0,max=0,calls=0;const s=new StressDataService({fetchImpl:async()=>{calls++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;return new Response('{}')}});await Promise.all(Array.from({length:12},()=>s.request('/test',1,Date.now()+2000)));assert.equal(max,3);await Promise.all([s.cached('x',5000,async()=>++calls),s.cached('x',5000,async()=>++calls)]);assert.equal(calls,13);
});
test('Binance 429/418 triggers shared cooldown without a retry storm',async()=>{
  for(const status of [429,418]){let calls=0;const s=new StressDataService({fetchImpl:async()=>{calls++;return new Response('{}',{status,headers:{'retry-after':'120'}})}});await assert.rejects(s.request('/test',1,Date.now()+5000),/RATE LIMITED/);await assert.rejects(s.request('/test',1,Date.now()+5000),/RATE LIMITED/);assert.equal(calls,1);}
});
test('per-instance weight budget bounds traffic and upstream failures are explicit',async()=>{
  let calls=0;const s=new StressDataService({budget:2,fetchImpl:async()=>{calls++;return new Response('{}')}});await s.request('/test',2,Date.now()+5000);await assert.rejects(s.request('/test',1,Date.now()+5000),/BUDGET/);assert.equal(calls,1);const failing=new StressDataService({fetchImpl:async()=>new Response('{}',{status:503})});await assert.rejects(failing.request('/test',1,Date.now()+5000),/UNAVAILABLE/);
});
test('empty universe and symbol injection return safe errors; POST cannot mutate anything',async()=>{
  const s=new StressDataService({universe:async()=>[]}),h=createStressHandler(s);for(const [url,method,status] of [['/api/liquidity-stress','GET',503],['/api/liquidity-stress?symbol=../../secret','GET',400],['/api/liquidity-stress','POST',405]]){let body;const res={setHeader(){},end(s){body=s}};await h({url,method},res);assert.equal(res.statusCode,status);assert.ok(!body.includes('secret'));}
});
test('optional stream observers cannot break existing consumers and never create a new connection',()=>{
  const s=new BinanceWebSocketManager();let notified=0;const off=s.observe(()=>{throw Error()},()=>notified++);s.onStatusChangeCallback=()=>notified++;s.setStatus('CONNECTED');assert.equal(notified,3);assert.equal(s.socket,null);off();assert.equal(s.observers.size,0);
});
test('Stress API failure does not write synthetic scores, Alerts or Scanner state',async()=>{
  const client=new LiquidityStressClient({fetchImpl:async()=>({ok:false})});await client.refresh();assert.equal(client.snapshot().selected,null);assert.match(client.snapshot().error,/unavailable/);assert.equal(client.histories.size,0);assert.equal(typeof client.observeUniverse,'undefined');
});

test('exchange clock alignment rejects stale data without rejecting healthy sources on skewed hosts',async()=>{
 const now=1_800_000_000_000, offset=660000;let calls=0;
 const s=new StressDataService({clock:()=>now,universe:async()=>[{symbol:'ETHUSDT',price:100,quoteVolume24h:100}],fetchImpl:async url=>{calls++;const path=new URL(url).pathname;return new Response(JSON.stringify(path.endsWith('/time')?{serverTime:now+offset}:path.endsWith('/depth')?{T:now+offset,bids:[[99.99,10],[99,10]],asks:[[100.01,10],[101,10]]}:[]));}});
 const first=await s.snapshot('ETHUSDT');assert.equal(first.observedAt,now+offset);assert.equal(first.markets[0].book.valid,true);assert.equal(first.markets[0].timeframes['15m'].oi.score,null);await s.snapshot('ETHUSDT');assert.equal(calls,4,'cached snapshots reuse all four upstream sources');
});
test('client normalizes stream timestamps against exchange time, not the host clock',()=>{
 const c=new LiquidityStressClient({clock:()=>100000});c.timeOffset=660000;c.trackingSince.set('ETHUSDT',0);c.receive('!forceOrder@arr',{o:{s:'ETHUSDT',T:760000,l:'2',ap:'100'}});assert.equal(c.events.get(780000).get('ETHUSDT'),200);
});

test('shared connection uses official market stream route and retains requested subscriptions',()=>{
 const previous=globalThis.WebSocket;let url;globalThis.WebSocket=class{constructor(value){url=value}close(){}};
 try{const manager=new BinanceWebSocketManager();manager.connect(['btcusdt@aggTrade','!forceOrder@arr'],()=>{});assert.equal(url,'wss://fstream.binance.com/market/stream?streams=btcusdt@aggTrade/!forceOrder@arr');manager.disconnect();}finally{globalThis.WebSocket=previous}
});

test('real cadence semantics: jittered HTTP, quiet connected feed, retained history and fixed bins complete calibration',()=>{
 let now=1800000000000;const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const stream={currentStreams:['!forceOrder@arr']};let c=new LiquidityStressClient({clock:()=>now,storage,stream});
 const snapshot=()=>({observedAt:now,watchlistSymbols:['BTCUSDT','ETHUSDT','SOLUSDT'],markets:['BTCUSDT','ETHUSDT','SOLUSDT'].map(symbol=>({symbol,quoteVolume24h:100,book:{valid:true,observedAt:now,spreadBps:1,bidUsd:100,askUsd:200,depthUsd:300,imbalance:-1/3},timeframes:Object.fromEntries(['15m','1h'].map(tf=>[tf,Object.fromEntries(['oi','volatility'].map(k=>[k,{score:20,validity:'VALID'}]))]))}))});
 c.response=snapshot();c.ingest(c.response);c.status('CONNECTED');let nextFetch=now+33000;
 for(let i=0;i<2440;i++){now+=1000;c.receive('btcusdt@miniTicker',{});if(now>=nextFetch){c.response=snapshot();c.ingest(c.response);nextFetch+=i%2?28000:32000;}c.retain();}
 for(const market of c.snapshot().markets){assert.equal(market.factors.liquidation.value,0,'observed zero is valid on a continuously healthy stream');assert.equal(market.factors.liquidation.validity,'VALID');assert.equal(market.factors.book.validity,'VALID');assert.equal(market.validFactors,4);assert.equal(market.score,9);assert.equal(market.coverage.liquidation.remainingSeconds,0);}
 const count=c.histories.get('ETHUSDT').length;const reloaded=new LiquidityStressClient({clock:()=>now,storage,stream});assert.equal(reloaded.histories.get('ETHUSDT').length,count,'reload retains finalized public observations');
 c.timeframe='1h';c.evaluate();assert.equal(c.snapshot().selected?.score,null,'1h cannot borrow a qualified 15m baseline');
 c.status('DISCONNECTED');now+=31000;c.retain();c.timeframe='15m';c.evaluate();assert.equal(c.snapshot().selected?.score,null,'disconnect invalidates composite');assert.ok(c.histories.get('ETHUSDT').length>=count,'history is preserved, not reset');
});
test('event-time bucketing deduplicates last fills and does not mix neighboring intervals',()=>{
 let now=1800000000000;const c=new LiquidityStressClient({clock:()=>now});c.trackingSince.set('ETHUSDT',now);
 const event={o:{s:'ETHUSDT',S:'SELL',T:now+1000,l:'2',ap:'100',z:'999'}};now+=1000;c.receive('!forceOrder@arr',event);c.receive('!forceOrder@arr',event);assert.equal(c.events.get(1800000030000).get('ETHUSDT'),200);now+=30000;c.receive('!forceOrder@arr',{o:{...event.o,T:now,l:'1'}});assert.equal(c.events.get(1800000060000).get('ETHUSDT'),100);
});
test('an open socket without the liquidation subscription cannot assert zero-liquidation coverage',()=>{
 let now=1800000000000;const c=new LiquidityStressClient({clock:()=>now,stream:{currentStreams:['btcusdt@miniTicker']}});c.response={observedAt:now,markets:[{symbol:'ETHUSDT',timeframes:{'15m':{},'1h':{}}}],watchlistSymbols:[]};c.ingest(c.response);c.status('CONNECTED');for(let i=0;i<61;i++){now+=1000;c.receive('btcusdt@miniTicker',{});c.retain();}assert.equal(c.histories.get('ETHUSDT').at(-1).covered,false);assert.match(c.snapshot().connection,/SUBSCRIPTION MISSING/);
});
