import test from 'node:test';
import assert from 'node:assert/strict';
import { ScannerUniverse } from '../../src/services/scannerUniverse.js';
import { AlertsInbox } from '../../src/services/alertsInbox.js';
import { classifyAgentState } from '../../src/services/agentStateClassifier.js';
const row = { symbol:'ETHUSDT',baseAsset:'ETH',price:2000,priceChange24h:3,quoteVolume24h:10000000,fundingRate:-0.0001,isFeatured:true };

test('Neon/Alerts outage cannot prevent scanner discovery, funding or existing squeeze classification', async()=>{
  const alerts = new AlertsInbox({fetchImpl:async()=>({ok:false,status:503})});
  await alerts.refresh(); assert.equal(alerts.marketSnapshot().status.state,'OFFLINE');
  const scanner = new ScannerUniverse({load:async()=>[row],clock:()=>100});
  await scanner.refresh(); assert.equal(scanner.snapshot().markets.length,1);
  assert.deepEqual(scanner.snapshot().markets[0].agentInfo,classifyAgentState(row));
  assert.equal(scanner.snapshot().markets[0].agentInfo.marketBias,'SHORT SQUEEZE');
  assert.equal(scanner.snapshot().status.state,'ONLINE');
  assert.equal(alerts.snapshot().length,0); // No synthetic Alerts to bypass persistence.
});
test('scanner coalesces refreshes and subscribers into one 30-second batch loop',async()=>{
  let loads=0,timers=0,cancels=0,finish;const scanner=new ScannerUniverse({load:()=>{loads++;return new Promise(r=>finish=r)},interval:(fn,ms)=>{assert.equal(ms,30000);timers++;return 1},cancel:()=>cancels++});
  const stop=scanner.start(),stop2=scanner.start();const first=scanner.refresh();assert.equal(first,scanner.refresh());
  await Promise.resolve();finish([row]);await first;assert.equal(loads,1);assert.equal(timers,1);stop();assert.equal(cancels,0);stop2();stop2();assert.equal(cancels,1);
});
test('upstream outage preserves last observations, marks stale data and recovers on next poll',async()=>{
  let now=100,fail=false;const scanner=new ScannerUniverse({clock:()=>now,load:async()=>{if(fail)throw Error();return[row]}});
  await scanner.refresh();fail=true;now+=30000;await scanner.refresh();assert.equal(scanner.snapshot().status.state,'DEGRADED');assert.equal(scanner.snapshot().markets.length,1);assert.equal(scanner.snapshot().observedAt,100);
  now+=40000;await scanner.refresh();assert.equal(scanner.snapshot().status.state,'OFFLINE');assert.match(scanner.snapshot().error,/last observed/);
  fail=false;await scanner.refresh();assert.equal(scanner.snapshot().status.state,'ONLINE');assert.equal(scanner.snapshot().error,null);assert.equal(scanner.snapshot().observedAt,now);
});
test('first request failure and empty/incomplete batch never claim a genuine zero-contract universe',async()=>{
  for(const load of [async()=>{throw Error()},async()=>[]]){const scanner=new ScannerUniverse({load});await scanner.refresh();assert.equal(scanner.snapshot().observedAt,null);assert.match(scanner.snapshot().error,/count is unknown/);assert.equal(scanner.snapshot().status.state,'OFFLINE');}
});
test('hung fetch is aborted and releases single-flight lock for recovery',async()=>{
  let signal;const scanner=new ScannerUniverse({load:s=>{signal=s;return new Promise(()=>{})},timeoutMs:5});await scanner.refresh();assert.equal(signal.aborted,true);assert.equal(scanner.pending,null);scanner.load=async()=>[row];await scanner.refresh();assert.equal(scanner.snapshot().status.state,'ONLINE');
});
