import { getMarketUniverse } from '../../src/services/marketUniverseService.js';
import { historicalFactors, orderBookMetrics } from '../../src/services/liquidityStressModel.js';

export class StressDataService {
  constructor({fetchImpl=fetch,universe=signal=>getMarketUniverse({signal,strict:true}),clock=Date.now,budget=600}={}) {
    Object.assign(this,{fetchImpl,universe,clock,budget});this.cache=new Map();this.queue=[];this.active=0;this.used=0;this.period=0;this.cooldownUntil=0;
  }
  cached(key,ttl,load) {
    const now=this.clock(),old=this.cache.get(key);if(old&&(old.pending||now<old.until))return old.promise;
    const item={pending:true,until:0};item.promise=Promise.resolve().then(load).then(data=>{item.pending=false;item.until=this.clock()+ttl;return data}).catch(error=>{if(this.cache.get(key)===item)this.cache.delete(key);throw error});
    this.cache.set(key,item);if(this.cache.size>100)for(const [k,v] of this.cache){if(!v.pending&&k!==key){this.cache.delete(k);break;}}
    return item.promise;
  }
  limited(task) { return new Promise((resolve,reject)=>{this.queue.push({task,resolve,reject});this.drain();}); }
  drain() { while(this.active<3&&this.queue.length){const job=this.queue.shift();this.active++;Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{this.active--;this.drain()});} }
  request(path,weight,deadline) {
    return this.limited(async()=>{
      const now=this.clock();if(now>=deadline)throw Error('REQUEST DEADLINE');
      if(now<this.cooldownUntil)throw Error('RATE LIMITED');
      if(now-this.period>=60000){this.period=now;this.used=0;}
      if(this.used+weight>this.budget)throw Error('REQUEST BUDGET');this.used+=weight;
      const r=await this.fetchImpl('https://fapi.binance.com'+path,{signal:AbortSignal.timeout(Math.min(8000,deadline-now))});
      const upstreamWeight=Number(r.headers.get('x-mbx-used-weight-1m'));
      if(upstreamWeight>=1200)this.cooldownUntil=this.clock()+60000;
      if(r.status===429||r.status===418){const retry=r.headers.get('retry-after');const delay=Number(retry);this.cooldownUntil=this.clock()+Math.max(60000,Math.min(3600000,Number.isFinite(delay)&&delay>0?delay*1000:60000));throw Error('RATE LIMITED');}
      if(!r.ok)throw Error('UPSTREAM UNAVAILABLE');return r.json();
    });
  }
  async snapshot(symbol) {
    const started=this.clock(),deadline=started+25000;
    const universe=await this.cached('universe',60000,()=>this.universe(AbortSignal.timeout(12000)));
    if(!Array.isArray(universe)||!universe.length)throw Error('EMPTY UNIVERSE');
    const liquid=[...universe].filter(m=>m.symbol?.endsWith('USDT')&&m.price>0&&m.quoteVolume24h>0).sort((a,b)=>b.quoteVolume24h-a.quoteVolume24h).slice(0,20);
    const selected=universe.find(m=>m.symbol===symbol);if(!selected)throw Error('UNSUPPORTED SYMBOL');
    const alignment=await this.cached('exchangeClock',60000,async()=>{const before=this.clock(),data=await this.request('/fapi/v1/time',1,deadline),after=this.clock();if(!Number.isFinite(data.serverTime)||after-before>3000)throw Error('UNRELIABLE EXCHANGE CLOCK');return{offset:data.serverTime-(before+after)/2,uncertaintyMs:(after-before)/2};});
    const exchangeNow=()=>this.clock()+alignment.offset;
    const targets=liquid.some(m=>m.symbol===symbol)?liquid:[...liquid,selected];
    const markets=await Promise.all(targets.map(async m=>{
      const base=m.symbol;
      const responses=await Promise.allSettled([
        this.cached('oi:'+base,60000,()=>this.request(`/futures/data/openInterestHist?symbol=${base}&period=5m&limit=499`,1,deadline)),
        this.cached('bars:'+base,60000,()=>this.request(`/fapi/v1/klines?symbol=${base}&interval=5m&limit=499`,2,deadline)),
        this.cached('book:'+base,25000,async()=>{const b=await this.request(`/fapi/v1/depth?symbol=${base}&limit=500`,10,deadline);return orderBookMetrics(b,exchangeNow());}),
      ]);
      const [oi,bars,depth]=responses.map(r=>r.status==='fulfilled'?r.value:null);
      return {symbol:base,quoteVolume24h:m.quoteVolume24h,fundingRate:m.fundingRate,price:m.price,
        book:depth||{valid:false,reason:'DEPTH UNAVAILABLE / RATE LIMITED',observedAt:exchangeNow()},
        timeframes:Object.fromEntries(['15m','1h'].map(tf=>[tf,historicalFactors(oi,bars,tf,exchangeNow())])),
        quality:responses.every(r=>r.status==='fulfilled')?'OBSERVED':'PARTIAL DATA'};
    }));
    return {observedAt:exchangeNow(),clockSource:'Binance server time, RTT-adjusted',clockUncertaintyMs:alignment.uncertaintyMs,selectedSymbol:symbol,watchlistSymbols:liquid.map(m=>m.symbol),markets,
      budget:{maximumConcurrentRequests:3,weightBudgetPerWarmInstancePerMinute:this.budget,estimatedWeightUsed:this.used,cooldownUntil:this.cooldownUntil},
      historyScope:'Depth/liquidation history is browser-retained, not a global archive. Cold or incomplete coverage remains INSUFFICIENT DATA.'};
  }
}
export function createStressHandler(service=new StressDataService()) {
  return async(req,res)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end('{}');return;}
    const url=new URL(req.url,'http://internal'),symbol=String(req.query?.symbol||url.searchParams.get('symbol')||'BTCUSDT').toUpperCase();
    if(!/^[A-Z0-9]{2,24}USDT$/.test(symbol)){res.statusCode=400;res.end(JSON.stringify({error:'Unsupported symbol format'}));return;}
    try{const data=await service.snapshot(symbol);res.statusCode=200;res.end(JSON.stringify(data));}
    catch(error){res.statusCode=error.message==='UNSUPPORTED SYMBOL'?400:503;res.setHeader('Retry-After','30');res.end(JSON.stringify({error:'Liquidity Stress data unavailable. Retry later.',state:'INSUFFICIENT DATA'}));}
  };
}
