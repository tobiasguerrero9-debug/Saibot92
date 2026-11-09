import {randomUUID} from 'node:crypto';
import {HostedStore} from '../augustus/hosted/store.js';
import {validateEntry,buildAnalysis,JournalError} from './domain.js';
export function journalConfig(env=process.env){
  const stage=env.AUGUSTUS_ENV,origin=env.AUGUSTUS_ORIGIN,scope=env.AUGUSTUS_DATABASE_SCOPE;
  const url=new URL(env.DATABASE_URL||'');
  if(!['development','preview','production'].includes(stage)||env.VERCEL_ENV&&env.VERCEL_ENV!==stage||!scope?.startsWith(stage+':')||!url.hostname.endsWith('.neon.tech')||url.searchParams.get('sslmode')!=='require'||new URL(origin).origin!==origin||stage!=='development'&&!origin.startsWith('https://'))throw Error('Journal configuration unavailable');
  return {stage,origin,databaseScope:scope,databaseUrl:env.DATABASE_URL};
}
export class JournalRepository {
  constructor(config,store=new HostedStore(config)){this.config=config;this.store=store;}
  async create(wallet,raw){
    const data=validateEntry(raw);
    const result=await this.store.transaction(wallet,async c=>{
      const previous=(await c.query('SELECT id,fingerprint FROM journal_entries WHERE wallet=$1 AND request_id=$2',[wallet,data.requestId])).rows[0];
      if(previous)return previous.fingerprint===data.fingerprint?{id:previous.id,duplicate:true}:{error:'Request ID already used for different content',status:409};
      const duplicate=(await c.query('SELECT id FROM journal_entries WHERE wallet=$1 AND fingerprint=$2',[wallet,data.fingerprint])).rows[0];if(duplicate)return {error:'This journal content is already stored',status:409};
      const observed=(await c.query("SELECT payload->'status' AS status,(SELECT m FROM jsonb_array_elements(COALESCE(payload->'markets','[]')) m WHERE m->>'symbol'=$1 LIMIT 1) AS market FROM saibot_alerts_monitor WHERE singleton=true",[data.input.symbol])).rows[0];
      const alerts=(await c.query("SELECT id,payload->>'type' AS type,payload->>'severity' AS severity,payload->>'title' AS title,observed_at FROM saibot_alerts_events WHERE payload->>'symbol'=$1 ORDER BY observed_at DESC LIMIT 5",[data.input.symbol])).rows;
      const hosted=(await c.query("SELECT payload,observed_at FROM augustus_context WHERE payload->>'symbol'=$1 ORDER BY observed_at DESC LIMIT 1",[data.input.symbol.replace(/USDT$/,'')])).rows[0];
      const now=Date.now(),snapshot={capturedAt:new Date(now).toISOString(),server:{market:observed?.market??null,observedAt:observed?.status?.lastScan??null,stale:!observed?.status?.lastScan||now<observed.status.lastScan||now-observed.status.lastScan>65000,alerts,hosted:hosted?{...hosted,stale:now-new Date(hosted.observed_at).getTime()>65000}:null},browser:{trust:'CLIENT_REPORTED_UNVERIFIED',context:data.clientContext}};
      const id=randomUUID();await c.query('INSERT INTO journal_entries(id,wallet,request_id,fingerprint,input,snapshot) VALUES($1,$2,$3,$4,$5,$6)',[id,wallet,data.requestId,data.fingerprint,JSON.stringify(data.input),JSON.stringify(snapshot)]);return {id,duplicate:false};
    });if(result.error)throw new JournalError(result.error,result.status);return result;
  }
  async list(wallet,cursor=null){if(cursor&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor))throw new JournalError('Invalid history cursor');return this.store.transaction(wallet,async c=>{const rows=(await c.query("SELECT e.id,e.created_at,e.status,e.input->>'symbol' AS symbol,e.input->>'direction' AS direction,COALESCE(e.completion,e.input)->>'resultStatus' AS result,e.snapshot#>>'{server,market,agentInfo,state}' AS regime,COALESCE(l.credits_delta,0) AS compute FROM journal_entries e LEFT JOIN compute_ledger l ON l.journal_id=e.id AND l.wallet=e.wallet WHERE e.wallet=$1 AND ($2::uuid IS NULL OR (e.created_at,e.id)<(SELECT created_at,id FROM journal_entries WHERE wallet=$1 AND id=$2::uuid)) ORDER BY e.created_at DESC,e.id DESC LIMIT 31",[wallet,cursor])).rows;return {entries:rows.slice(0,30),nextCursor:rows.length>30?rows[29].id:null};});}
  async detail(wallet,id){const row=await this.store.transaction(wallet,async c=>(await c.query('SELECT e.id,e.wallet,e.input,e.snapshot,e.completion,e.status,e.created_at,e.completed_at,a.payload AS analysis,COALESCE(l.credits_delta,0) AS compute FROM journal_entries e LEFT JOIN journal_analysis a ON a.journal_id=e.id AND a.wallet=e.wallet LEFT JOIN compute_ledger l ON l.journal_id=e.id AND l.wallet=e.wallet WHERE e.wallet=$1 AND e.id=$2',[wallet,id])).rows[0]);if(!row)throw new JournalError('Journal not found',404);return row;}
  async overview(wallet){return this.store.transaction(wallet,async c=>({compute:(await c.query('SELECT COALESCE(sum(credits_delta),0)::bigint AS balance FROM compute_ledger WHERE wallet=$1',[wallet])).rows[0],memory:(await c.query('SELECT payload,updated_at FROM agent_memory WHERE wallet=$1',[wallet])).rows[0]??{payload:{totalJournals:0}}}));}
  async complete(wallet,id,review={}){
    if(Object.keys(review).some(k=>!['notes','resultStatus','exit','pnl'].includes(k)))throw new JournalError('Unknown completion field');
    const result=await this.store.transaction(wallet,async c=>{
      const e=(await c.query('SELECT id,input,snapshot,status FROM journal_entries WHERE wallet=$1 AND id=$2 FOR UPDATE',[wallet,id])).rows[0];
      if(!e)return {error:'Journal not found',status:404};if(e.status==='COMPLETED')return {id,awarded:false,credits:0};let effective;try{effective=validateEntry({...e.input,...review,requestId:e.id}).input;}catch(error){return {error:error.message,status:422};}if(effective.resultStatus==='OPEN')return {error:'Record a final result before completing a journal',status:422};
      const daily=Number((await c.query("SELECT count(*) AS n FROM compute_ledger WHERE wallet=$1 AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",[wallet])).rows[0].n);if(daily>=10)return {error:'Daily completion limit reached (10 per wallet, UTC)',status:429};
      await c.query("UPDATE journal_entries SET status='COMPLETED',completed_at=now(),completion=$3 WHERE wallet=$1 AND id=$2",[wallet,id,JSON.stringify(effective)]);
      await c.query('INSERT INTO journal_analysis(journal_id,wallet,payload) VALUES($1,$2,$3)',[id,wallet,JSON.stringify(buildAnalysis({...e,input:effective}))]);
      const balance=(BigInt((await c.query('SELECT COALESCE(sum(credits_delta),0) AS n FROM compute_ledger WHERE wallet=$1',[wallet])).rows[0].n)+10n).toString();
      await c.query("INSERT INTO compute_ledger(id,wallet,journal_id,action,credits_delta,balance_after) VALUES($1,$2,$3,'JOURNAL_COMPLETED',10,$4)",[randomUUID(),wallet,id,balance]);
      const memory=(await c.query(`WITH done AS (SELECT COALESCE(completion,input) AS input,snapshot FROM journal_entries WHERE wallet=$1 AND status='COMPLETED'),symbols AS(SELECT input->>'symbol' AS symbol,count(*) AS journals FROM done GROUP BY 1 ORDER BY journals DESC,symbol LIMIT 5),regimes AS(SELECT COALESCE(snapshot#>>'{server,market,agentInfo,state}','UNAVAILABLE') AS regime,count(*) AS journals,count(*) FILTER(WHERE input->>'resultStatus'='WIN') AS wins,count(*) FILTER(WHERE input->>'resultStatus'='LOSS') AS losses FROM done GROUP BY 1 ORDER BY journals DESC LIMIT 8),tags AS(SELECT tag,count(*) AS journals FROM done CROSS JOIN LATERAL jsonb_array_elements_text(input->'tags') tag WHERE tag LIKE 'mistake:%' GROUP BY tag ORDER BY journals DESC,tag LIMIT 8),alert_types AS(SELECT event->>'type' AS type,count(*) AS journals FROM done CROSS JOIN LATERAL jsonb_array_elements(COALESCE(snapshot#>'{server,alerts}','[]')) event GROUP BY 1 ORDER BY journals DESC,type LIMIT 5),entry_contexts AS(SELECT input->>'trigger' AS trigger,count(*) AS journals FROM done WHERE input->>'trigger'<>'' GROUP BY 1 ORDER BY journals DESC,trigger LIMIT 5) SELECT jsonb_build_object('totalJournals',count(*),'longs',count(*) FILTER(WHERE input->>'direction'='LONG'),'shorts',count(*) FILTER(WHERE input->>'direction'='SHORT'),'noTrades',count(*) FILTER(WHERE input->>'direction'='NO TRADE'),'averageLeverage',avg((input->>'leverage')::numeric),'topSymbols',COALESCE((SELECT jsonb_agg(symbols) FROM symbols),'[]'),'performanceByRegime',COALESCE((SELECT jsonb_agg(regimes) FROM regimes),'[]'),'mistakeTags',COALESCE((SELECT jsonb_agg(tags) FROM tags),'[]'),'frequentAlerts',COALESCE((SELECT jsonb_agg(alert_types) FROM alert_types),'[]'),'commonEntryContexts',COALESCE((SELECT jsonb_agg(entry_contexts) FROM entry_contexts),'[]'),'basis','Self-reported completed journals; not verified trading performance') AS payload FROM done`,[wallet])).rows[0].payload;
      await c.query('INSERT INTO agent_memory(wallet,payload) VALUES($1,$2) ON CONFLICT(wallet) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()',[wallet,JSON.stringify(memory)]);return {id,awarded:true,credits:10,balance};
    });if(result.error)throw new JournalError(result.error,result.status);return result;
  }
}




