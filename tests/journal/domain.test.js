import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {validateEntry,buildAnalysis} from '../../server/journal/domain.js';
const raw=()=>({requestId:randomUUID(),symbol:'ETHUSDT',direction:'LONG',resultStatus:'OPEN',thesis:'Observed context before entry',notes:'Review will record execution honestly',tags:['mistake:late','context'],entry:'0.00000001',leverage:'2'});
test('structured input normalizes units and accepts no-trade while rejecting malformed or extreme values',()=>{
 const r=validateEntry(raw());assert.equal(r.input.entry,1e-8);assert.equal(validateEntry({...r.input,requestId:randomUUID()}).input.entry,1e-8);
 assert.equal(validateEntry({...raw(),direction:'NO TRADE',resultStatus:'NO TRADE'}).input.direction,'NO TRADE');
 for(const change of [{leverage:'101'},{entry:'NaN'},{pnl:Infinity},{entry:'-1'},{positionSize:'1e9'},{leverage:0},{thesis:'short'},{notes:''},{wallet:'0x1'},{credits_delta:1000},{direction:'SHORT',resultStatus:'NO TRADE'},{resultStatus:'WIN',pnl:'-1'},{tags:['x'.repeat(33)]}])assert.throws(()=>validateEntry({...raw(),...change}));
});
test('browser snapshots are copied, bounded and labelled separately from trusted telemetry',()=>{
 const source={symbol:'ETHUSDT',agentState:'OBSERVING',whatChanged:['OI rose'],alerts:[{id:'a',type:'SQUEEZE_DETECTED',severity:'HIGH'}]};
 const r=validateEntry({...raw(),clientContext:source});source.whatChanged[0]='mutated';assert.equal(r.clientContext.whatChanged[0],'OI rose');
 assert.throws(()=>validateEntry({...raw(),clientContext:{symbol:'BTCUSDT'}}));assert.throws(()=>validateEntry({...raw(),clientContext:{symbol:'ETHUSDT',x:'x'.repeat(21000)}}));
});
test('idempotency fingerprints ignore request IDs and deterministic analysis never certifies fills or psychology',()=>{
 const a=validateEntry(raw()),b=validateEntry({...raw(),requestId:randomUUID()});assert.equal(a.fingerprint,b.fingerprint);
 const review=buildAnalysis({input:a.input,snapshot:{server:{market:{agentInfo:{state:'OBSERVING',marketBias:'NEUTRAL'}},stale:false}}});
 assert.equal(review.method,'DETERMINISTIC_V1');assert.match(review.whatHappened,/No exchange fills are verified/);assert.match(review.whatWasValid,/does not verify/);assert.match(review.memoryUpdate,/No psychological/);
});
