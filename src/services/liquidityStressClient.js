import { wsManager } from './binanceWebSocketManager.js';
import { STRESS_MODEL, observedFactors, compositeStress, rankStress } from './liquidityStressModel.js';
export const STRESS_HISTORY_KEY='saibot92.liquidity-stress.observations-v2';
const STEP=STRESS_MODEL.stepMs;
export class LiquidityStressClient {
  constructor({fetchImpl=(...a)=>fetch(...a),stream=wsManager,clock=Date.now,storage}={}) {
    Object.assign(this,{fetchImpl,stream,clock,storage});this.listeners=new Set();this.histories=new Map();this.pending=null;this.symbol='BTCUSDT';this.timeframe='15m';this.connected=false;this.lastMessageAt=0;this.continuityStart=Infinity;this.seen=new Set();this.previousScores=new Map();this.users=0;this.timeOffset=0;
    this.events=new Map();this.books=new Map();this.trackingSince=new Map();this.lastTick=null;this.lastClosedEnd=null;this.running=false;
    this.value={loading:true,error:null,markets:[],watchlist:[],selected:null,historyPersistent:!!storage};
    try {const saved=JSON.parse(storage?.getItem(STRESS_HISTORY_KEY)||'[]');for(const [symbol,rows] of saved.slice(0,24)){if(/^[A-Z0-9]{2,24}USDT$/.test(symbol)&&Array.isArray(rows))this.histories.set(symbol,rows.filter(r=>Number.isFinite(r.t)&&r.t>clock()-12000000&&r.t<=clock()+86400000).slice(-400));}}catch{/* Invalid local history cannot produce a score. */}
  }
  subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)};
  snapshot=()=>this.value;
  publish(patch){this.value={...this.value,...patch};this.listeners.forEach(fn=>{try{fn()}catch{/* Optional UI listener */}})}
  receive=(stream,data)=>{
    const localNow=this.clock();
    // Transport heartbeats, not the presence of liquidation events, establish continuity.
    if(this.lastMessageAt&&localNow-this.lastMessageAt>15000)this.continuityStart=localNow;
    this.lastMessageAt=localNow;
    if(stream!=='!forceOrder@arr'&&!stream?.endsWith('@forceOrder'))return;
    const o=data?.o,symbol=o?.s,qty=Number(o?.l),price=Number(o?.ap),time=Number(o?.T);
    if((data?.st&&Number(data.st)!==1)||!/^[A-Z0-9]{2,24}USDT$/.test(symbol||'')||!Number.isFinite(qty)||qty<=0||!Number.isFinite(price)||price<=0||!Number.isFinite(time)||Math.abs(localNow+this.timeOffset-time)>65000)return;
    const key=[symbol,time,o.S,o.p,o.q,qty,price].join(':');if(this.seen.has(key))return;this.seen.add(key);if(this.seen.size>5000)this.seen.delete(this.seen.values().next().value);
    const end=(Math.floor(time/STEP)+1)*STEP;
    if(this.lastClosedEnd!==null&&end<=this.lastClosedEnd)return; // Never rewrite a finalized interval with late events.
    if(this.trackingSince.has(symbol)){const bucket=this.events.get(end)||new Map();bucket.set(symbol,(bucket.get(symbol)||0)+qty*price);this.events.set(end,bucket);}
  };
  status=status=>{const connected=status==='CONNECTED';if(connected!==this.connected)this.continuityStart=connected?this.clock():Infinity;this.connected=connected;};
  ingest(data){
    const now=this.clock()+this.timeOffset;
    for(const m of data.markets){if(!this.trackingSince.has(m.symbol))this.trackingSince.set(m.symbol,now);const rows=this.books.get(m.symbol)||[];
      if(m.book?.valid&&Number.isFinite(m.book.observedAt)&&!rows.some(b=>b.observedAt===m.book.observedAt))rows.push({...m.book});
      this.books.set(m.symbol,rows.filter(b=>b.observedAt>now-180000).slice(-8));
    }
    if(this.lastClosedEnd===null){this.lastClosedEnd=Math.floor(now/STEP)*STEP;this.lastTick=this.clock();}
  }
  retain=()=>{
    if(!this.response||this.lastClosedEnd===null)return;
    const localNow=this.clock(),now=localNow+this.timeOffset,end=Math.floor(now/STEP)*STEP;
    if(this.lastTick!==null&&localNow-this.lastTick>5000)this.continuityStart=localNow; // Suspended event loops cannot claim stream coverage.
    this.lastTick=localNow;
    if(end<=this.lastClosedEnd){if(!this.lastEvaluation||localNow-this.lastEvaluation>=5000)this.evaluate();return;}
    // A long suspension creates a real gap, not hundreds of invented samples.
    if(end-this.lastClosedEnd>2*STEP)this.lastClosedEnd=end-STEP;
    for(let t=this.lastClosedEnd+STEP;t<=end;t+=STEP){
      const covered=this.stream.currentStreams?.includes('!forceOrder@arr')&&this.connected&&localNow-this.lastMessageAt<15000&&this.continuityStart+this.timeOffset<=t-STEP;
      for(const m of this.response.markets){
        const rows=this.histories.get(m.symbol)||[];
        const b=(this.books.get(m.symbol)||[]).filter(b=>b.observedAt<=t&&t-b.observedAt<=STRESS_MODEL.freshMs).at(-1);
        const tracked=this.trackingSince.get(m.symbol)<=t-STEP;
        const book=b?{...b,valid:true}:{valid:false};
        if(!rows.length||t>rows.at(-1).t){rows.push({t,book,covered:covered&&tracked,liquidationUsd:covered&&tracked?(this.events.get(t)?.get(m.symbol)||0):null});this.histories.delete(m.symbol);this.histories.set(m.symbol,rows.filter(r=>r.t>=t-12000000).slice(-400));}
      }
    }
    this.lastClosedEnd=end;for(const t of this.events.keys())if(t<=end)this.events.delete(t);
    while(this.histories.size>24)this.histories.delete(this.histories.keys().next().value);
    for(const symbol of this.trackingSince.keys())if(!this.response.markets.some(m=>m.symbol===symbol)){this.trackingSince.delete(symbol);this.books.delete(symbol);}
    try{this.storage?.setItem(STRESS_HISTORY_KEY,JSON.stringify([...this.histories]));}catch{this.value.historyPersistent=false;}
    this.evaluate();
  };
  evaluate(){
    if(!this.response)return;this.lastEvaluation=this.clock();const now=this.clock()+this.timeOffset,stale=now-this.response.observedAt>STRESS_MODEL.freshMs;
    const markets=this.response.markets.map(m=>{
      const observed=observedFactors(this.histories.get(m.symbol),this.timeframe,now);
      const factors={...m.timeframes[this.timeframe],liquidation:observed.liquidation,book:observed.book};
      if(stale)for(const key of Object.keys(factors))factors[key]={...factors[key],score:null,validity:'STALE SNAPSHOT'};
      const result=compositeStress(factors),key=m.symbol+':'+this.timeframe,prior=this.previousScores.get(key);
      const delta=result.score!==null&&prior?.t<Math.max(this.response.observedAt,this.lastClosedEnd||0)?result.score-prior.score:null;
      if(result.score!==null)this.previousScores.set(key,{score:result.score,t:Math.max(this.response.observedAt,this.lastClosedEnd||0)});else this.previousScores.delete(key);
      return {...m,...result,factors,coverage:observed.coverage,validFactors:Object.values(factors).filter(f=>f.validity==='VALID').length,delta,evaluatedAt:now,freshness:stale?'STALE':'OBSERVED',timeframe:this.timeframe};
    });
    this.publish({markets,watchlist:rankStress(markets.filter(m=>this.response.watchlistSymbols.includes(m.symbol))),selected:markets.find(m=>m.symbol===this.symbol),observedAt:this.response.observedAt,loading:false,connection:!this.stream.currentStreams?.includes('!forceOrder@arr')?'LIQUIDATION SUBSCRIPTION MISSING':this.connected?(this.clock()-this.lastMessageAt<15000?'CONNECTED / HEARTBEAT FRESH':'CONNECTED / HEARTBEAT STALE'):'DISCONNECTED'});
  }
  refresh=()=>{
    if(this.pending)return this.pending;const requested=this.symbol;
    this.pending=Promise.resolve().then(()=>this.fetchImpl('/api/liquidity-stress?symbol='+encodeURIComponent(requested),{signal:AbortSignal.timeout(30000)})).then(async r=>{if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.markets)||!data.markets.length||data.markets.some(m=>!m.timeframes?.['15m']||!m.timeframes?.['1h'])||!Array.isArray(data.watchlistSymbols)||!Number.isFinite(data.observedAt))throw Error();this.timeOffset=data.observedAt-this.clock();this.response=data;this.ingest(data);this.publish({error:null});this.evaluate();})
      .catch(()=>{this.publish({loading:false,error:'Liquidity Stress data unavailable. Retrying automatically.'});if(this.response){this.response={...this.response,observedAt:0};this.evaluate();}})
      .finally(()=>{this.pending=null;if(requested!==this.symbol&&this.running)void this.refresh();});return this.pending;
  };
  select(symbol,timeframe){const changed=symbol!==this.symbol;this.symbol=symbol;this.timeframe=timeframe;this.evaluate();if(changed)void this.refresh();}
  start=()=>{
    this.users++;
    if(!this.running){this.running=true;this.unobserve=this.stream.observe(this.receive,this.status);void this.refresh();this.timer=setInterval(this.refresh,30000);this.sampleTimer=setInterval(this.retain,1000);}
    // Collection survives navigation between /app views after first visiting Stress.
    let stopped=false;return()=>{if(!stopped){stopped=true;this.users--;}};
  };
  shutdown=()=>{clearInterval(this.timer);clearInterval(this.sampleTimer);this.unobserve?.();this.running=false;this.continuityStart=Infinity;this.lastTick=null;this.lastClosedEnd=null;this.books.clear();this.events.clear();this.trackingSince.clear();};
}
let storage;try{storage=globalThis.localStorage}catch{/* Observations can remain session-only. */}
export const liquidityStressClient=new LiquidityStressClient({storage});
