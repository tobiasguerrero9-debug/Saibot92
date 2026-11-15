import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStress,compositeStress,orderBookMetrics,historicalFactors,observedFactors,rankStress,stressState,STRESS_MODEL} from '../../src/services/liquidityStressModel.js';
const now=1800000000000;
const history=Array.from({length:400},(_,i)=>({t:now-(399-i)*30000,covered:true,liquidationUsd:i%17===0?500:0,book:{valid:true,spreadBps:1+(i%7)/10,depthUsd:10000+(i%11)*100,bidUsd:5000,askUsd:5000,imbalance:0}}));
test('robust own-market normalization handles units, flat references and extreme outliers',()=>{
  const refs=Array.from({length:50},(_,i)=>i);assert.equal(normalizeStress(25,refs).score,normalizeStress(2500,refs.map(v=>v*100)).score);assert.equal(normalizeStress(1e300,refs).score<=100,true);assert.equal(normalizeStress(0,Array(20).fill(0)).score,0);assert.equal(normalizeStress(10,Array(20).fill(0)).score,100);assert.equal(normalizeStress(NaN,refs),null);assert.equal(normalizeStress(1,[1]),null);
});
test('versioned weights are exact; any missing factor blocks composite without redistribution',()=>{
  const factors=Object.fromEntries(['oi','liquidation','volatility','book'].map(k=>[k,{score:80,validity:'VALID'}]));assert.equal(compositeStress(factors).score,80);assert.equal(compositeStress({...factors,book:{score:null,validity:'STALE'}}).score,null);assert.throws(()=>compositeStress(factors,{version:'bad',weights:{oi:1,book:1,volatility:1,liquidation:1}}));assert.equal(compositeStress({...factors,oi:{score:101,validity:'VALID'}}).score,null);assert.equal(STRESS_MODEL.version,'LSM-1.0.0');
});
test('display states are explicit conventions and never directional claims',()=>{assert.deepEqual([0,29,30,54,55,74,75,100,null].map(stressState),['LOW','LOW','MODERATE','MODERATE','ELEVATED','ELEVATED','HIGH','HIGH','INSUFFICIENT DATA']);});
test('depth computation validates both sides, spread, notional band and truncation',()=>{
  const b={bids:[['99.99','10'],['99.94','100']],asks:[['100.01','20'],['100.06','100']],T:now};const r=orderBookMetrics(b,now);assert.equal(r.valid,true);assert.ok(Math.abs(r.spreadBps-2)<1e-6);assert.equal(r.bidUsd,999.9);assert.equal(r.askUsd,2000.2);assert.equal(orderBookMetrics({...b,asks:[['99','1'],['100','1']]},now).valid,false);assert.equal(orderBookMetrics({...b,bids:[['99.99','1'],['99.98','1']]},now).valid,false);assert.equal(orderBookMetrics({...b,T:now-70000},now).valid,false);assert.equal(orderBookMetrics({bids:[],asks:[]},now).valid,false);
});
test('separate 15m and 1h histories use consistent windows and unannualized volatility',()=>{
  const oi=Array.from({length:499},(_,i)=>({timestamp:now-(498-i)*300000,sumOpenInterest:1000+i+(i>495?i*20:0)}));const bars=Array.from({length:499},(_,i)=>[now-(499-i)*300000,0,0,0,100+i/20+(i>495?i/30:0),0,now-(498-i)*300000-1]);const short=historicalFactors(oi,bars,'15m',now),long=historicalFactors(oi,bars,'1h',now);assert.equal(short.oi.validity,'VALID');assert.equal(long.volatility.validity,'VALID');assert.notEqual(short.oi.value,long.oi.value);assert.notEqual(short.volatility.value,long.volatility.value);assert.match(short.volatility.source,/unannualized/);assert.throws(()=>historicalFactors(oi,bars,'5m',now));
});
test('missing, newly listed, zero/negative and stale historical data fail closed',()=>{
  assert.notEqual(historicalFactors([],[],'15m',now).oi.validity,'VALID');const oi=Array.from({length:499},(_,i)=>({timestamp:now-(498-i)*300000,sumOpenInterest:i===498?0:100}));assert.equal(historicalFactors(oi,[],'15m',now).oi.validity,'INVALID OI');assert.equal(historicalFactors(oi,[],'15m',now+900000).oi.validity,'STALE OI');
});
test('complete retained observation windows yield valid factors; gaps and cold starts do not',()=>{
  for(const tf of ['15m','1h']){const r=observedFactors(history,tf,now);assert.equal(r.liquidation.validity,'VALID');assert.equal(r.book.validity,'VALID');assert.ok(r.coverage.baselineWindows>=20);}
  assert.notEqual(observedFactors(history.slice(-30),'15m',now).liquidation.validity,'VALID');const gap=history.map((r,i)=>i===390?{...r,covered:false,book:{valid:false}}:r);assert.equal(observedFactors(gap,'15m',now).liquidation.score,null);assert.equal(observedFactors(gap,'15m',now).book.score,null);assert.equal(observedFactors(history,'15m',now+70000).book.score,null);
});
test('ranking uses qualified stress first, then liquidity for unqualified rows',()=>{
  const rows=[{symbol:'A',score:null,quoteVolume24h:100},{symbol:'B',score:20,quoteVolume24h:20},{symbol:'C',score:90,quoteVolume24h:10},{symbol:'D',score:null,quoteVolume24h:200}];assert.deepEqual(rankStress(rows).map(x=>x.symbol),['C','B','D','A']);assert.equal(rows[0].symbol,'A');
});
