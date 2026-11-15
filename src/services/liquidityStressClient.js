import { wsManager } from './binanceWebSocketManager.js';
import { STRESS_MODEL, observedFactors, compositeStress, rankStress } from './liquidityStressModel.js';
const KEY='saibot92.liquidity-stress.LSM-1.0.0';
export class LiquidityStressClient {
  constructor({fetchImpl=(...a)=>fetch(...a),stream=wsManager,clock=Date.now,storage}={}) {
    Object.assign(this,{fetchImpl,stream,clock,storage});this.listeners=new Set();this.histories=new Map();this.pending=null;this.symbol='BTCUSDT';this.timeframe='15m';this.connected=false;this.lastMessageAt=0;this.continuityStart=Infinity;this.lastPoll=0;this.liquidations=new Map();this.seen=new Set();this.previousScores=new Map();this.users=0;
    this.timeOffset=0;this.value={loading:true,error:null,markets:[],watchlist:[],selected:null,historyPersistent:!!storage};
    try{const saved=JSON.parse(storage?.getItem(KEY)||'[]');for(const [symbol,rows] of saved.slice(0,24)){if(/^[A-Z0-9]{2,24}USDT$/.test(symbol)&&Array.isArray(rows))this.histories.set(symbol,rows.filter(r=>Number.isFinite(r.t)&&r.t>clock()-12000000&&r.t<=clock()+86400000).slice(-400));}}catch{/* Invalid local history starts with no score. */}
  }
  subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)};
  snapshot=()=>this.value;
  publish(patch){this.value={...this.value,...patch};this.listeners.forEach(fn=>{try{fn()}catch{/* Optional UI listener */}})}
  receive=(stream,data)=>{
    this.lastMessageAt=this.clock();
    if(stream!=='!forceOrder@arr'&&!stream?.endsWith('@forceOrder'))return;
    const o=data?.o,symbol=o?.s,qty=Number(o?.l),price=Number(o?.ap),time=Number(o?.T);
    if(!/^[A-Z0-9]{2,24}USDT$/.test(symbol||'')||!Number.isFinite(qty)||qty<=0||!Number.isFinite(price)||price<=0||!Number.isFinite(time)||Math.abs(this.clock()+this.timeOffset-time)>65000)return;
    const key=[symbol,time,o.S,o.p,o.q,qty,price].join(':');if(this.seen.has(key))return;this.seen.add(key);if(this.seen.size>5000)this.seen.delete(this.seen.values().next().value);
    if(this.response?.markets.some(m=>m.symbol===symbol))this.liquidations.set(symbol,(this.liquidations.get(symbol)||0)+qty*price);
  };
  status=status=>{this.connected=status==='CONNECTED';this.continuityStart=this.connected?this.clock():Infinity;};
  retain(response){
    const now=this.clock(),t=Math.floor((now+this.timeOffset)/30000)*30000;
    const covered=this.connected&&now-this.lastMessageAt<15000&&this.lastPoll>0&&now-this.lastPoll<=45000&&this.continuityStart<=this.lastPoll;
    for(const m of response.markets){const rows=this.histories.get(m.symbol)||[],b=m.book;
      if(!rows.length||t>rows.at(-1).t){const book=b?.valid?{valid:true,spreadBps:b.spreadBps,bidUsd:b.bidUsd,askUsd:b.askUsd,depthUsd:b.depthUsd,imbalance:b.imbalance}:{valid:false};
        rows.push({t,book,covered,liquidationUsd:covered?(this.liquidations.get(m.symbol)||0):null});this.histories.delete(m.symbol);this.histories.set(m.symbol,rows.filter(r=>r.t>=t-12000000).slice(-400));}
    }
    while(this.histories.size>24)this.histories.delete(this.histories.keys().next().value);
    this.liquidations.clear();this.lastPoll=now;
    try{this.storage?.setItem(KEY,JSON.stringify([...this.histories]));}catch{this.value.historyPersistent=false;}
  }
  evaluate(){
    if(!this.response)return;const now=this.clock()+this.timeOffset,stale=now-this.response.observedAt>STRESS_MODEL.freshMs;
    const markets=this.response.markets.map(m=>{
      const observed=observedFactors(this.histories.get(m.symbol),this.timeframe,now);
      const factors={...m.timeframes[this.timeframe],liquidation:observed.liquidation,book:observed.book};
      if(stale)for(const key of Object.keys(factors))factors[key]={...factors[key],score:null,validity:'STALE SNAPSHOT'};
      const result=compositeStress(factors),key=m.symbol+':'+this.timeframe,prior=this.previousScores.get(key);
      const delta=result.score!==null&&prior?.t<this.response.observedAt?result.score-prior.score:null;
      if(result.score!==null)this.previousScores.set(key,{score:result.score,t:this.response.observedAt});else this.previousScores.delete(key);
      return {...m,...result,factors,coverage:observed.coverage,delta,evaluatedAt:now,freshness:stale?'STALE':'OBSERVED',timeframe:this.timeframe};
    });
    this.publish({markets,watchlist:rankStress(markets.filter(m=>this.response.watchlistSymbols.includes(m.symbol))),selected:markets.find(m=>m.symbol===this.symbol),observedAt:this.response.observedAt,loading:false});
  }
  refresh=()=>{
    if(this.pending)return this.pending;const requested=this.symbol;
    this.pending=Promise.resolve().then(()=>this.fetchImpl('/api/liquidity-stress?symbol='+encodeURIComponent(requested),{signal:AbortSignal.timeout(30000)})).then(async r=>{if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.markets)||!data.markets.length||data.markets.some(m=>!m.timeframes?.['15m']||!m.timeframes?.['1h'])||!Array.isArray(data.watchlistSymbols)||!Number.isFinite(data.observedAt))throw Error();this.timeOffset=data.observedAt-this.clock();this.response=data;this.retain(data);this.publish({error:null});this.evaluate();})
      .catch(()=>{this.lastPoll=0;this.liquidations.clear();this.publish({loading:false,error:'Liquidity Stress data unavailable. Retrying automatically.'});if(this.response){this.response={...this.response,observedAt:0};this.evaluate();}})
      .finally(()=>{this.pending=null;if(requested!==this.symbol&&this.users)void this.refresh();});return this.pending;
  };
  select(symbol,timeframe){const changed=symbol!==this.symbol;this.symbol=symbol;this.timeframe=timeframe;this.evaluate();if(changed)void this.refresh();}
  start=()=>{
    if(++this.users===1){this.unobserve=this.stream.observe(this.receive,this.status);void this.refresh();this.timer=setInterval(this.refresh,30000);}
    let stopped=false;return()=>{if(stopped)return;stopped=true;if(--this.users===0){clearInterval(this.timer);this.unobserve?.();this.lastPoll=0;this.continuityStart=Infinity;}};
  };
}
let storage;try{storage=globalThis.localStorage}catch{/* Observations can remain session-only. */}
export const liquidityStressClient=new LiquidityStressClient({storage});
