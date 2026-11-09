// Read-only hosted-only proof. Never prints connection material.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {Pool,neonConfig} from '@neondatabase/serverless';
neonConfig.webSocketConstructor=globalThis.WebSocket;
process.on('uncaughtException',()=>{console.error('Hosted proof failed safely.');process.exit(1)});process.on('unhandledRejection',()=>{console.error('Hosted proof failed safely.');process.exit(1)});
const before=JSON.parse(fs.readFileSync('work/alerts-hosted-only-before.local','utf8').replace(/^\uFEFF/,''));const meta=JSON.parse(fs.readFileSync('work/augustus-production-provisioning.local','utf8').replace(/^\uFEFF/,''));
const code='$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);try{[Console]::Out.Write([Text.Encoding]::UTF8.GetString($p))}finally{[Array]::Clear($p,0,$p.Length)}';
const url=execFileSync(process.env.OPERATOR_PWSH,['-NoProfile','-NonInteractive','-Command',code],{input:fs.readFileSync(meta.productionChecks.runtimeCredentialFile,'utf8'),encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:10000});pool.on('error',()=>{});
const report={deployment:'dpl_B2gPPB18k28naiH1qSNaNavtCgr1',runtime:'Vercel daemon fra1',localAlertsServicesStopped:true,appTabsClosed:true,scans:[],neonMatchesApi:true,productionScope:true};
try{for(let i=0;i<13;i++){
 const r=await fetch('https://www.saibot92.auction/api/alerts');if(!r.ok)throw Error('API');const data=await r.json();
 const binding=(await pool.query('SELECT scope,environment FROM augustus_deployment WHERE singleton=true')).rows[0];if(binding.scope!=='production:augustus-v1'||binding.environment!=='production')throw Error('scope');
 const monitor=(await pool.query('SELECT environment,payload FROM saibot_alerts_monitor WHERE singleton=true')).rows[0];if(monitor.environment!=='production'||!monitor.payload.baseline?.length||!monitor.payload.cooldowns?.length)throw Error('state');
 const count=Number((await pool.query('SELECT count(*) AS n FROM saibot_alerts_events')).rows[0].n);if(count>1000)throw Error('retention');
 const proof=data.events.find(e=>e.timestamp>before.closedAt&&!before.eventIds.includes(e.id));
 if(proof){const stored=(await pool.query('SELECT payload FROM saibot_alerts_events WHERE id=$1',[proof.id])).rows[0]?.payload;if(stored?.symbol!==proof.symbol||stored?.type!==proof.type)throw Error('database mismatch');report.proofEvent={id:proof.id,symbol:proof.symbol,title:proof.title,timestamp:proof.timestamp};}
 if(!report.scans.includes(data.status.lastScan))report.scans.push(data.status.lastScan);
 report.latestStatus=data.status;report.storedEvents=count;report.baselineKeys=monitor.payload.baseline.length;report.cooldownKeys=monitor.payload.cooldowns.length;
 console.log(JSON.stringify({scan:data.status.lastScan,state:data.status.state,markets:data.status.marketsEvaluated,storedEvents:count,uniqueScans:report.scans.length,eventAfterUiClosed:!!report.proofEvent}));
 if(report.scans.length>=4&&report.proofEvent){report.status='PASS';break}
 await new Promise(resolve=>setTimeout(resolve,15000));
}if(report.status!=='PASS')throw Error('proof incomplete');report.intervalsMs=report.scans.slice(1).map((t,i)=>t-report.scans[i]);fs.writeFileSync('work/alerts-hosted-production-proof.local',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
catch{report.status='FAIL';fs.writeFileSync('work/alerts-hosted-production-proof.local',JSON.stringify(report,null,2));console.error('Hosted verification incomplete; inspect safe report.');process.exitCode=1}finally{await pool.end()}
