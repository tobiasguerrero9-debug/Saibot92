import test from 'node:test';
import assert from 'node:assert/strict';
import { PersistenceBackoff, SnapshotReads } from '../../server/alerts/reliability.js';
import { PostgresAlertsRepository } from '../../server/alerts/repository.js';
import { createAlertsHandler } from '../../server/alerts/http.js';
import { guardedCycle, runAlertsDaemon } from '../../server/alerts/daemon.js';
import { EventEmitter } from 'node:events';

test('persistence retries are bounded, quota failures cool down, success resets and secrets are excluded',()=>{
  let now=0;const b=new PersistenceBackoff({clock:()=>now});
  for(let i=0;i<7;i++){const e=b.fail(Object.assign(Error('postgres://secret'),{code:'08006'}));assert.equal(e.retryAfterSeconds,Math.min(30,2**i));assert.throws(()=>b.check(),/unavailable/);now=b.retryAt;b.check();}
  b.success();assert.equal(b.fail({code:'08006'}).retryAfterSeconds,1);
  assert.equal(b.fail({code:'53000'}).retryAfterSeconds,300);assert.ok(!JSON.stringify(b.lastError).includes('secret'));now=b.retryAt;b.check();b.success();assert.equal(b.failures,0);
});
test('concurrent reads coalesce, cache expires, and failed reads are never cached as success',async()=>{
  let calls=0,now=0,fail=false;const reads=new SnapshotReads(async()=>{calls++;if(fail)throw Error();return{status:{state:'ONLINE'}}},{clock:()=>now,ttlMs:5});
  await Promise.all([reads.get('inbox'),reads.get('inbox'),reads.get('inbox')]);assert.equal(calls,1);await reads.get('inbox');assert.equal(calls,1);now=6;fail=true;await assert.rejects(reads.get('inbox'));fail=false;await reads.get('inbox');assert.equal(calls,3);
});
const env={DATABASE_URL:'postgres://unused:unused@example.neon.tech/test?sslmode=require',AUGUSTUS_ENV:'production',AUGUSTUS_DATABASE_SCOPE:'production:test'};
function fixture(){let now=0,fail=false,connects=0;const sql=[],released=[],telemetry=[];const client={query:async(q)=>{sql.push(q);if(q.includes('augustus_deployment'))return{rows:[{scope:'production:test',environment:'production'}]};if(q.includes('saibot_alerts_monitor'))return{rows:[{environment:'production',payload:{status:{state:'ONLINE',lastScan:Date.now()},conditions:[]}}]};return{rows:[]}},release:bad=>released.push(bad)};const pool={on(){},connect:async()=>{connects++;if(fail)throw Object.assign(Error('secret URL'),{code:'53000'});return client},end:async()=>{}};const repo=new PostgresAlertsRepository(env,{pool,clock:()=>now,report:r=>telemetry.push(r)});return{repo,sql,released,telemetry,setFail:v=>fail=v,advance:v=>now+=v,connects:()=>connects,client};}
test('status/live reads skip history and worker state; inbox skips universe; default preserves API',async()=>{
  const f=fixture();for(const view of ['status','live','inbox','all']){f.sql.length=0;await f.repo.read({view});const query=f.sql.find(q=>q.includes('saibot_alerts_monitor'));assert.ok(!query.includes('SELECT environment,payload FROM'));assert.equal(f.sql.some(q=>q.includes('saibot_alerts_events')),['all','inbox'].includes(view));if(view==='inbox')assert.ok(!query.includes("'markets'"));if(view==='all')assert.match(query,/- 'baseline' - 'cooldowns'/);}
  assert.ok(f.telemetry.every(t=>t.responseBytes>=0&&t.durationMs>=0));assert.ok(!JSON.stringify(f.telemetry).includes('unused'));
});
test('database reconnect waits through quota backoff and rereads durable state after recovery',async()=>{
  const f=fixture();f.setFail(true);await assert.rejects(f.repo.read(),{code:'53000'});assert.equal(f.connects(),1);await assert.rejects(f.repo.read());assert.equal(f.connects(),1);f.advance(300000);f.setFail(false);assert.equal((await f.repo.read()).status.state,'ONLINE');assert.equal(f.connects(),2);assert.equal(f.repo.backoff.failures,0);
});
test('failed transaction rolls back and destroys the broken connection',async()=>{
  const f=fixture();const original=f.client.query;f.client.query=async q=>{if(q.includes('augustus_deployment'))throw Object.assign(Error('private connection material'),{code:'08006'});return original(q)};
  await assert.rejects(f.repo.read(),{code:'08006'});assert.ok(f.sql.includes('ROLLBACK'));assert.equal(f.released[0],true);
});
test('checked-out client socket errors are observed, never uncaught, and the connection is discarded',async()=>{
  const f=fixture(),events=new EventEmitter();f.client.on=events.on.bind(events);const query=f.client.query;f.client.query=async q=>{if(q==='BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ')events.emit('error',Error('socket closed'));return query(q)};
  await assert.doesNotReject(f.repo.read());assert.equal(f.released[0],true);assert.equal(events.listenerCount('error'),1);f.repo.observeClient(f.client);assert.equal(events.listenerCount('error'),1);
});
test('failed upstream scan updates health only without erasing prior universe, baselines or cooldowns',async()=>{
  const f=fixture();const original=f.client.query;f.client.query=async q=>q.includes('pg_try_advisory')?{rows:[{acquired:true}]}:original(q);
  await f.repo.cycle(async()=>({status:{state:'DEGRADED'},newEvents:[]}));assert.ok(f.sql.some(q=>q.includes('jsonb_set')));assert.ok(!f.sql.some(q=>q.includes('INSERT INTO saibot_alerts_monitor')));
});
test('HTTP quota response is explicit 503 and retryable without leaking safe-code internals or secrets',async()=>{
  const handler=createAlertsHandler({read:async()=>{throw Object.assign(Error('postgres://secret'),{retryAfterSeconds:300})}});let body;const headers={};const res={setHeader(k,v){headers[k]=v},end(v){body=JSON.parse(v)}};await handler({method:'GET',url:'/api/alerts?view=inbox'},res);assert.equal(res.statusCode,503);assert.equal(headers['Retry-After'],'300');assert.equal(body.status.persistence,'UNAVAILABLE');assert.ok(!JSON.stringify(body).includes('secret'));
});
test('inbox projection keeps API shape and uses a distinct lightweight read',async()=>{
  let view;const handler=createAlertsHandler({read:async options=>{view=options.view;return{events:[],conditions:[],markets:[{symbol:'ETHUSDT'}],status:{state:'ONLINE',lastScan:Date.now()}}}});let body;await handler({method:'GET',url:'/api/alerts?view=inbox'},{setHeader(){},end(v){body=JSON.parse(v)}});assert.equal(view,'inbox');assert.deepEqual(body.markets,[]);assert.equal(body.status.state,'ONLINE');
});
test('frozen cycle invokes process replacement hook without starting a second cycle',async()=>{
  let frozen=0,calls=0;await assert.rejects(guardedCycle({cycle:()=>{calls++;return new Promise(()=>{})}},{deadlineMs:5,onFrozen:()=>frozen++}),/watchdog/);assert.equal(calls,1);assert.equal(frozen,1);
});
test('daemon survives database interruption with bounded retry and emits progress/recovery telemetry',async()=>{
  let now=0,cycles=0,stop=false;const logs=[];await runAlertsDaemon({worker:{},clock:()=>now,sleep:async ms=>{now+=ms},stopping:()=>stop,log:r=>logs.push(r),cycle:async()=>{cycles++;if(cycles===1)throw Object.assign(Error('secret'),{code:'53000',retryAfterSeconds:300});stop=true;return{committed:true,state:'ONLINE',events:1}}});assert.equal(cycles,2);assert.equal(now,300000);assert.ok(logs.some(r=>r.event==='ALERTS_PERSISTENCE_UNAVAILABLE'&&r.retryAfterMs===300000));assert.ok(logs.some(r=>r.event==='ALERTS_SCAN'&&r.state==='ONLINE'));assert.ok(!JSON.stringify(logs).includes('secret'));
});
