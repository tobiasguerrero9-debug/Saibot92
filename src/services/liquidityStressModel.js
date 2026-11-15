export const STRESS_MODEL = Object.freeze({ version: 'LSM-1.0.1', weights: Object.freeze({ oi: .25, liquidation: .25, volatility: .20, book: .30 }), stepMs: 30000, minBaseline: 20, bandBps: 5, freshMs: 65000 });
export const STRESS_WINDOWS = { '15m': 900000, '1h': 3600000 };
export const FACTOR_NAMES = { oi: 'OI Instability', liquidation: 'Liquidation Intensity', volatility: 'Volatility Shock', book: 'Order Book Fragility' };
const finite = n => Number.isFinite(n);
const positive = n => finite(n) && n > 0;
const mean = a => a.reduce((s,n)=>s+n,0)/a.length;
export function median(a) { const b=[...a].sort((x,y)=>x-y);return b.length ? (b[Math.floor((b.length-1)/2)]+b[Math.ceil((b.length-1)/2)])/2 : null; }
export function normalizeStress(value, reference, min = STRESS_MODEL.minBaseline) {
  if (!finite(value) || reference.length < min || reference.some(n=>!finite(n))) return null;
  const center=median(reference),mad=median(reference.map(n=>Math.abs(n-center)));
  // Upper-tail empirical rank: median = 0, largest observed tail approaches 100.
  // Bounded ranks + median/MAD winsorization prevent one extreme baseline dominating scale.
  const clip=n=>mad>0?Math.max(center-6*mad,Math.min(center+6*mad,n)):n;
  const x=clip(value),b=reference.map(clip),rank=(b.filter(n=>n<x).length+.5*b.filter(n=>n===x).length)/b.length;
  return { score: Math.round(Math.max(0,Math.min(100,200*(rank-.5)))), median:center,mad,samples:b.length,method:'Own-market upper-tail empirical rank; median/MAD winsorization (6 MAD)' };
}
export function stressState(score) { return score===null?'INSUFFICIENT DATA':score<30?'LOW':score<55?'MODERATE':score<75?'ELEVATED':'HIGH'; }
export function factor(value, source, observedAt, reference, unit, reason=null) {
  const basis=reason?null:normalizeStress(value,reference);
  return {value:finite(value)?value:null,unit,source,observedAt:finite(observedAt)?observedAt:null,validity:reason||(!basis?'INSUFFICIENT HISTORY':'VALID'),score:basis?.score??null,normalization:basis};
}
export function historicalFactors(oi, klines, timeframe, now=Date.now()) {
  const windowMs=STRESS_WINDOWS[timeframe];if(!windowMs)throw Error('Unsupported timeframe');
  const n=windowMs/300000;
  const points=(Array.isArray(oi)?oi:[]).map(r=>({t:Number(r.timestamp),v:Number(r.sumOpenInterest)})).sort((a,b)=>a.t-b.t);
  const bars=(Array.isArray(klines)?klines:[]).filter(k=>Number(k[6])<=now).map(k=>({t:Number(k[0]),end:Number(k[6]),v:Number(k[4])})).sort((a,b)=>a.t-b.t);
  const oiSeries=[],volSeries=[];
  for(let end=points.length-1;end>=n;end-=n){const slice=points.slice(end-n,end+1);if(slice.every((p,i)=>positive(p.v)&&(!i||p.t-slice[i-1].t===300000)))oiSeries.push(100*Math.abs(Math.log(slice.at(-1).v/slice[0].v)));else oiSeries.push(null);}
  for(let end=bars.length-1;end>=n;end-=n){const slice=bars.slice(end-n,end+1);if(slice.every((p,i)=>positive(p.v)&&(!i||p.t-slice[i-1].t===300000)))volSeries.push(100*Math.sqrt(slice.slice(1).reduce((s,p,i)=>s+Math.log(p.v/slice[i].v)**2,0)));else volSeries.push(null);}
  const latestOi=points.at(-1)?.t,latestVol=bars.at(-1)?.end;
  const fresh=t=>finite(t)&&now>=t-5000&&now-t<=420000;
  return {
    oi:factor(oiSeries[0],'Binance openInterestHist / 5m; quantity log change',latestOi,oiSeries.slice(1).filter(finite),'log %',!fresh(latestOi)?'STALE OI':oiSeries[0]===null?'INVALID OI':null),
    volatility:factor(volSeries[0],'Binance closed 5m klines; unannualized realized volatility',latestVol,volSeries.slice(1).filter(finite),'%',!fresh(latestVol)?'STALE CANDLES':volSeries[0]===null?'INVALID CANDLES':null),
  };
}
export function orderBookMetrics(book, receivedAt=Date.now(), bandBps=STRESS_MODEL.bandBps) {
  const invalid=reason=>({valid:false,reason,observedAt:receivedAt,source:'Binance REST depth, limit 500',bandBps});
  if(!Array.isArray(book?.bids)||!Array.isArray(book?.asks)||book.bids.length<2||book.asks.length<2)return invalid('SPARSE OR MISSING BOOK');
  const bids=book.bids.map(([p,q])=>[Number(p),Number(q)]),asks=book.asks.map(([p,q])=>[Number(p),Number(q)]);
  if([...bids,...asks].some(([p,q])=>!positive(p)||!finite(q)||q<0)||bids.some((p,i)=>i&&p[0]>=bids[i-1][0])||asks.some((p,i)=>i&&p[0]<=asks[i-1][0])||bids[0][0]>=asks[0][0])return invalid('INVALID OR CROSSED BOOK');
  const mid=(bids[0][0]+asks[0][0])/2,lo=mid*(1-bandBps/10000),hi=mid*(1+bandBps/10000);
  if(bids.at(-1)[0]>lo||asks.at(-1)[0]<hi)return invalid('DEPTH TRUNCATED BEFORE BAND BOUNDARY');
  const bidUsd=bids.filter(([p])=>p>=lo).reduce((s,[p,q])=>s+p*q,0),askUsd=asks.filter(([p])=>p<=hi).reduce((s,[p,q])=>s+p*q,0);
  if(!positive(bidUsd)||!positive(askUsd))return invalid('EMPTY LIQUIDITY BAND');
  const observedAt=Number(book.T||book.E)||receivedAt;
  if(observedAt>receivedAt+5000||receivedAt-observedAt>STRESS_MODEL.freshMs)return invalid('STALE BOOK');
  return {valid:true,source:'Binance REST depth, limit 500',observedAt,receivedAt,bandBps,mid,spreadBps:(asks[0][0]-bids[0][0])/mid*10000,bidUsd,askUsd,depthUsd:bidUsd+askUsd,imbalance:(bidUsd-askUsd)/(bidUsd+askUsd)};
}
function complete(rows,n,kind) {
  return rows.length===n&&rows.every((r,i)=>(kind==='liquidation'?r.covered&&finite(r.liquidationUsd)&&r.liquidationUsd>=0:r.book?.valid&&positive(r.book.depthUsd)&&positive(r.book.bidUsd)&&positive(r.book.askUsd)&&finite(r.book.spreadBps)&&r.book.spreadBps>=0&&finite(r.book.imbalance))&&(!i||r.t-rows[i-1].t===STRESS_MODEL.stepMs));
}
export function observedFactors(history,timeframe,now=Date.now()) {
  const w=STRESS_WINDOWS[timeframe];if(!w)throw Error('Unsupported timeframe');
  const rows=[...(history||[])].filter(r=>finite(r.t)&&r.t<=now).sort((a,b)=>a.t-b.t),n=w/STRESS_MODEL.stepMs,last=rows.at(-1),current=rows.slice(-n);
  const fresh=last&&now-last.t<=STRESS_MODEL.freshMs;
  const earlier=rows.filter(r=>r.t<=last?.t-w),liqReference=[];
  for(let end=earlier.length;end>=n&&liqReference.length<120;end--){const slice=earlier.slice(end-n,end);if(complete(slice,n,'liquidation'))liqReference.push(slice.reduce((s,r)=>s+r.liquidationUsd,0));}
  const liqValid=fresh&&complete(current,n,'liquidation');
  const liquidation=factor(liqValid?current.reduce((s,r)=>s+r.liquidationUsd,0):null,'Observed forceOrder last fills; sampled stream, NOT total exchange liquidations',last?.t,liqReference,'USDT',!fresh?'STALE / NO OBSERVATIONS':!liqValid?'INCOMPLETE STREAM COVERAGE':null);
  const oldBooks=[...new Map(earlier.filter(r=>complete([r],1,'book')).map(r=>[r.book.observedAt??r.t,r.book])).values()],bookValid=fresh&&complete(current,n,'book');
  let book=factor(null,'Binance depth; window average, ±5 bps band',last?.t,[],'profile',!fresh?'STALE / NO OBSERVATIONS':'INSUFFICIENT BOOK HISTORY');
  if(bookValid&&oldBooks.length>=STRESS_MODEL.minBaseline){
    const spread=mean(current.map(r=>r.book.spreadBps)),depth=mean(current.map(r=>r.book.depthUsd));
    const spreadBasis=normalizeStress(spread,oldBooks.map(b=>b.spreadBps)),depthBasis=normalizeStress(-Math.log(depth),oldBooks.map(b=>-Math.log(b.depthUsd)));
    book={value:depth,unit:'USDT in band',source:'Binance depth; window average, ±5 bps band',observedAt:last.t,validity:'VALID',score:Math.round(.4*spreadBasis.score+.6*depthBasis.score),normalization:{method:'40% relative spread stress + 60% relative depth loss; own-market ranks',samples:oldBooks.length},metrics:{spreadBps:spread,depthUsd:depth,bidUsd:mean(current.map(r=>r.book.bidUsd)),askUsd:mean(current.map(r=>r.book.askUsd)),imbalance:mean(current.map(r=>r.book.imbalance)),depthDeteriorationPct:100*(1-depth/median(oldBooks.map(b=>b.depthUsd)))}};
  }
  const progress=(kind,baseline,valid)=>{let tail=0;for(let i=rows.length-1;i>=0;i--){if(!complete([rows[i]],1,kind)||(i<rows.length-1&&rows[i+1].t-rows[i].t!==STRESS_MODEL.stepMs))break;tail++;}
    const count=current.filter(r=>complete([r],1,kind)).length,required=kind==='liquidation'?2*n+STRESS_MODEL.minBaseline-1:n+STRESS_MODEL.minBaseline;
    const remaining=valid?0:Math.max(1,(baseline>=STRESS_MODEL.minBaseline?n:required)-tail);
    return {currentSamples:count,requiredCurrentSamples:n,baselineSamples:baseline,requiredBaselineSamples:STRESS_MODEL.minBaseline,consecutiveSamples:tail,requiredTotalSamples:required,coveragePercent:Math.round(100*count/n),remainingSeconds:remaining*STRESS_MODEL.stepMs/1000,lastValidAt:(()=>{const r=[...rows].reverse().find(r=>complete([r],1,kind));return (kind==='book'?r?.book?.observedAt:r?.t)??null})()};};
  return {liquidation,book,coverage:{samples:rows.length,requiredCurrentSamples:n,baselineWindows:liqReference.length,scope:'This browser only; gaps invalidate windows',warmupMinutes:2*w/60000+(STRESS_MODEL.minBaseline-1)/2,liquidation:progress('liquidation',liqReference.length,liquidation.validity==='VALID'),book:progress('book',oldBooks.length,book.validity==='VALID')}};
}
export function compositeStress(factors,config=STRESS_MODEL) {
  const keys=Object.keys(FACTOR_NAMES),weights=config.weights;
  if(keys.some(k=>!finite(weights[k])||weights[k]<0)||Math.abs(keys.reduce((s,k)=>s+weights[k],0)-1)>1e-8)throw Error('Weights must sum to one');
  const valid=keys.every(k=>factors[k]?.validity==='VALID'&&finite(factors[k].score)&&factors[k].score>=0&&factors[k].score<=100);
  const score=valid?Math.round(keys.reduce((s,k)=>s+weights[k]*factors[k].score,0)):null;
  const drivers=keys.filter(k=>factors[k]?.validity==='VALID').sort((a,b)=>weights[b]*factors[b].score-weights[a]*factors[a].score);
  return {score,state:stressState(score),modelVersion:config.version,drivers,summary:valid?`${FACTOR_NAMES[drivers[0]]} contributes most to observed stress. This measures fragility, not price direction.`:'A composite needs four valid factors. Missing coverage is not scored as zero; weights are not redistributed.'};
}
export function rankStress(rows) { return [...rows].sort((a,b)=>(a.score===null)-(b.score===null)||(b.score??0)-(a.score??0)||b.quoteVolume24h-a.quoteVolume24h||a.symbol.localeCompare(b.symbol)); }
