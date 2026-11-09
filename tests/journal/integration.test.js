import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {Pool,neonConfig} from '@neondatabase/serverless';
import {operatorTarget,applyJournal} from '../../scripts/journal-operator.mjs';
import {JournalRepository,journalConfig} from '../../server/journal/repository.js';
import {createJournalHandler} from '../../server/journal/http.js';
neonConfig.webSocketConstructor=globalThis.WebSocket;
let target,owner,repo,handler,a,b;
const entry=(extra={})=>({requestId:randomUUID(),symbol:'ETHUSDT',direction:'LONG',resultStatus:'OPEN',thesis:'Validation-only thesis '+randomUUID(),notes:'Structured review of the observed setup',leverage:'2',tags:['mistake:late'],...extra});
class Client{
 constructor(){this.account=privateKeyToAccount(generatePrivateKey());this.cookies={};}
 async call(route='',body,overrides={}){const headers={host:new URL(target.env.AUGUSTUS_ORIGIN).host,origin:target.env.AUGUSTUS_ORIGIN,cookie:Object.entries(this.cookies).map(([k,v])=>`${k}=${v}`).join(';'),'content-type':'application/json','x-journal-csrf':this.csrf,'x-forwarded-for':this.account.address,...overrides};let payload;const response={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},getHeader(k){return this.headers[k]},end(s){payload=JSON.parse(s)}};
 await handler({method:body===undefined?'GET':'POST',url:'/api/journal',query:{route},headers,body},response);
 for(const c of response.headers['Set-Cookie']||[]){const [n,v]=c.split(';')[0].split('=');this.cookies[n]=v;}
 return {status:response.statusCode,body:payload};}
 async connect(){this.csrf=(await this.call('bootstrap')).body.csrf;const c=(await this.call('challenge',{address:this.account.address})).body;const signature=await this.account.signMessage({message:c.message});const result=await this.call('session',{address:this.account.address,...c,signature});assert.equal(result.status,200);this.wallet=result.body.wallet;return c;}
}
before(async()=>{target=await operatorTarget(false);assert.equal(target.env.AUGUSTUS_ENV,'preview');await applyJournal(target);owner=new Pool({connectionString:target.owner,max:1});owner.on('error',()=>{});repo=new JournalRepository(journalConfig(target.env));handler=createJournalHandler(repo);
 await owner.query("INSERT INTO saibot_alerts_monitor(singleton,environment,payload) VALUES(true,'preview',$1) ON CONFLICT(singleton) DO UPDATE SET payload=EXCLUDED.payload",[JSON.stringify({status:{lastScan:Date.now()},markets:[{symbol:'ETHUSDT',price:2000,fundingRate:0.0001,agentInfo:{state:'OBSERVING',marketBias:'NEUTRAL',contextScore:65}}]})]);
 await owner.query('INSERT INTO saibot_alerts_events(id,observed_at,payload) VALUES($1,now(),$2) ON CONFLICT DO NOTHING',['journal-validation-alert',JSON.stringify({id:'journal-validation-alert',symbol:'ETHUSDT',type:'SQUEEZE_DETECTED',severity:'HIGH',title:'Preview-only fixture'})]);
 a=new Client();b=new Client();await a.connect();await b.connect();});
after(async()=>{await repo?.store.pool.end();await owner?.end();});
test('wallet signature, origin and CSRF protect private APIs; nonce replay and wrong-wallet proof fail',async()=>{
 const anonymous=new Client();assert.equal((await anonymous.call()).status,401);assert.equal((await a.call('compute',undefined,{origin:'https://attacker.invalid'})).status,403);assert.equal((await a.call('',entry(),{'x-journal-csrf':'wrong'})).status,403);
 const x=new Client();x.csrf=(await x.call('bootstrap')).body.csrf;const challenge=(await x.call('challenge',{address:x.account.address})).body;
 const wrong=await b.account.signMessage({message:challenge.message});assert.equal((await x.call('session',{address:x.account.address,...challenge,signature:wrong})).status,401);
 const good=await x.account.signMessage({message:challenge.message});assert.equal((await x.call('session',{address:x.account.address,...challenge,signature:good})).status,401);
});
test('create captures server market and Alerts plus immutable browser context; retry creates one entry',async()=>{
 const input=entry({clientContext:{symbol:'ETHUSDT',oi:123,whatChanged:['Existing browser event']}});const first=await a.call('',input);assert.equal(first.status,201);const retry=await a.call('',input);assert.equal(retry.body.id,first.body.id);assert.equal(retry.body.duplicate,true);
 assert.equal((await a.call('',{...input,requestId:randomUUID()})).status,409);assert.equal((await a.call('',{...input,notes:'Different request content'})).status,409);
 const d=(await a.call(first.body.id)).body;assert.equal(d.snapshot.server.market.symbol,'ETHUSDT');assert.equal(d.snapshot.server.alerts[0].id,'journal-validation-alert');assert.equal(d.snapshot.browser.trust,'CLIENT_REPORTED_UNVERIFIED');assert.equal(d.snapshot.browser.context.oi,123);
 await owner.query("UPDATE saibot_alerts_monitor SET payload=jsonb_set(payload,'{markets,0,price}','3000') WHERE singleton=true");assert.deepEqual((await a.call(first.body.id)).body.snapshot,d.snapshot);
 await assert.rejects(repo.store.transaction(a.wallet,c=>c.query("UPDATE journal_entries SET snapshot='{}' WHERE id=$1",[first.body.id])));
});
test('completion awards exactly once under concurrency, persists balance/analysis/memory and keeps original context',async()=>{
 const made=(await a.call('',entry())).body;assert.equal((await a.call(`${made.id}/complete`,{})).status,422);
 const before=(await a.call(made.id)).body;
 const results=await Promise.all(Array.from({length:4},()=>a.call(`${made.id}/complete`,{resultStatus:'WIN',pnl:'12',notes:'Recorded the completed trade review'})));
 assert.ok(results.every(r=>r.status===200));assert.equal(results.filter(r=>r.body.awarded).length,1);
 const d=(await a.call(made.id)).body;assert.equal(d.status,'COMPLETED');assert.equal(d.compute,10);assert.equal(d.input.resultStatus,'OPEN');assert.equal(d.completion.resultStatus,'WIN');assert.deepEqual(d.snapshot,before.snapshot);assert.equal(d.analysis.method,'DETERMINISTIC_V1');
 assert.equal((await a.call('compute')).body.balance,'10');assert.equal((await a.call('memory')).body.payload.totalJournals,1);assert.ok((await a.call()).body.entries.some(e=>e.id===made.id&&e.result==='WIN'));
 const otherConnection=new JournalRepository(journalConfig(target.env));try{assert.equal((await otherConnection.overview(a.wallet)).compute.balance,'10');}finally{await otherConnection.store.pool.end();}
 assert.equal((await b.call(made.id)).status,404);assert.equal((await b.call(`${made.id}/complete`,{})).status,404);assert.equal((await b.call('compute')).body.balance,'0');
 const hidden=await repo.store.transaction(b.wallet,c=>c.query('SELECT id FROM journal_entries WHERE id=$1',[made.id]));assert.equal(hidden.rows.length,0);
});
test('malformed input, client credits/wallet injection and missing wallet cannot award Compute',async()=>{
 for(const bad of [{leverage:1000},{notes:''},{symbol:"ETH'; DROP TABLE journal_entries;--"},{credits_delta:100000},{wallet:b.wallet}])assert.equal((await a.call('',entry(bad))).status,422);
 const made=(await a.call('',entry())).body;assert.equal((await a.call(`${made.id}/complete`,{credits:10000})).status,422);assert.equal((await a.call(`${made.id}/complete`,{resultStatus:'WIN',pnl:'-5'})).status,422);assert.equal((await a.call('compute')).body.balance,'10');
 const old=await applyJournal(target);assert.equal(old.applied,false);assert.equal((await a.call('compute')).body.balance,'10');
});
test('daily completion cap rejects farming beyond ten awards without partial completion',async()=>{
 for(let i=0;i<9;i++){const r=(await a.call('',entry({resultStatus:'BREAKEVEN',pnl:'0'}))).body;const completed=await a.call(`${r.id}/complete`,{});assert.equal(completed.status,200);}
 const extra=(await a.call('',entry({resultStatus:'LOSS',pnl:'-1'}))).body;assert.equal((await a.call(`${extra.id}/complete`,{})).status,429);assert.equal((await a.call(extra.id)).body.status,'DRAFT');assert.equal((await a.call('compute')).body.balance,'100');
});

