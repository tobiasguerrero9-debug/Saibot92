import {createHash} from 'node:crypto';
export class JournalError extends Error {constructor(message,status=422){super(message);this.status=status;}}
const fail=m=>{throw new JournalError(m)};
export function validateEntry(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('Journal object required');
  const fields=['requestId','symbol','marketType','direction','entry','exit','positionSize','leverage','stop','takeProfit','pnl','thesis','trigger','resultStatus','notes','tags','clientContext'];
  if(Object.keys(raw).some(k=>!fields.includes(k)))fail('Unknown journal field');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.requestId||''))fail('Valid request ID required');
  const text=(name,min=0,max=2000)=>{const v=raw[name]??'';if(typeof v!=='string'||v.trim().length<min||v.length>max)fail(`Invalid ${name}`);return v.trim()};
  const symbol=text('symbol',2,30).toUpperCase();if(!/^[A-Z0-9]{2,30}$/.test(symbol))fail('Invalid symbol');
  const direction=text('direction');if(!['LONG','SHORT','NO TRADE'].includes(direction))fail('Invalid direction');
  const resultStatus=text('resultStatus');if(!['OPEN','WIN','LOSS','BREAKEVEN','NO TRADE'].includes(resultStatus))fail('Invalid result status');
  if((direction==='NO TRADE')!==(resultStatus==='NO TRADE'))fail('No-trade direction and result must agree');
  const marketType=raw.marketType||'PERPETUAL';if(!['PERPETUAL','SPOT','FUTURES','OTHER'].includes(marketType))fail('Invalid market type');
  const numbers={};for(const name of ['entry','exit','positionSize','leverage','stop','takeProfit','pnl']){
    const v=raw[name];if(v===undefined||v===null||v===''){numbers[name]=null;continue;}
    if(!['string','number'].includes(typeof v)||(typeof v==='string'&&! /^-?\d{1,16}(\.\d{1,8})?$/.test(v))||(typeof v==='number'&&(!Number.isFinite(v)||Number(v.toFixed(8))!==v)))fail(`Invalid ${name}`);
    const n=Number(v),max=name==='leverage'?100:1e15;
    if(!Number.isFinite(n)||Math.abs(n)>max||(name!=='pnl'&&n<=0)||(name==='leverage'&&n<1))fail(`Invalid ${name}`);numbers[name]=n;
  }
  if(resultStatus==='WIN'&&numbers.pnl!==null&&numbers.pnl<=0||resultStatus==='LOSS'&&numbers.pnl!==null&&numbers.pnl>=0||resultStatus==='BREAKEVEN'&&numbers.pnl!==null&&numbers.pnl!==0)fail('PnL and result disagree');
  if(!Array.isArray(raw.tags??[])||(raw.tags??[]).length>12)fail('Invalid tags');
  const tags=[...new Set((raw.tags??[]).map(t=>{if(typeof t!=='string'||! /^[a-z0-9_: -]{1,32}$/i.test(t))fail('Invalid tag');return t.trim().toLowerCase()}))].sort();
  const input={symbol,marketType,direction,...numbers,resultStatus,thesis:text('thesis',10),trigger:text('trigger'),notes:text('notes',10),tags};
  const fingerprint=createHash('sha256').update(JSON.stringify(input).replace(/\s+/g,' ')).digest('hex');
  const context=raw.clientContext??null;
  if(context!==null&&(!context||typeof context!=='object'||Array.isArray(context)||JSON.stringify(context).length>20000||context.symbol!==symbol))fail('Invalid context snapshot');
  return {requestId:raw.requestId.toLowerCase(),input,fingerprint,clientContext:context?JSON.parse(JSON.stringify(context)):null};
}
export function buildAnalysis(entry){
  const i=entry.input,s=entry.snapshot;
  return {method:'DETERMINISTIC_V1',whatHappened:`${i.symbol}: ${i.direction}; result recorded by the wallet owner as ${i.resultStatus}. No exchange fills are verified.`,whatWasValid:`Recorded controls: ${i.stop!==null?'stop provided':'no stop provided'}, ${i.takeProfit!==null?'take profit provided':'no take profit provided'}. Presence does not verify execution or strategy quality.`,whatFailed:i.resultStatus==='LOSS'?`Loss recorded. The review states: ${i.notes}`:'No failure cause is inferred from this record.',marketContext:s.server?.market?`Server snapshot: ${s.server.market.agentInfo?.state??'unavailable'}; bias ${s.server.market.agentInfo?.marketBias??'unavailable'}; ${s.server.stale?'STALE':'observed at capture'}.`:'Server context unavailable at capture; browser context, if present, is unverified.',executionNote:`Thesis: ${i.thesis}\nTrigger: ${i.trigger||'not recorded'}\nReview: ${i.notes}`,memoryUpdate:'Adds one completed self-reported journal to wallet memory. No psychological or verified profitability claim.'};
}

