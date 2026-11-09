// Operator orchestration: connection strings remain in memory, never printed.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Pool,neonConfig} from '@neondatabase/serverless';
import {migrateJournal} from './migrate-journal.mjs';
neonConfig.webSocketConstructor=globalThis.WebSocket;
const root='C:/Users/tobia/AppData/Roaming/npm/node_modules/neon';
const pkg=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')),cli=path.join(root,typeof pkg.bin==='string'?pkg.bin:pkg.bin.neon);
const meta=JSON.parse(readFileSync('work/augustus-production-provisioning.local','utf8').replace(/^\uFEFF/,''));
const neon=args=>execFileSync(process.execPath,[cli,...args,'--no-color'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:45000});
const connection=(branch,role)=>{const raw=neon(['connection-string',branch,'--project-id',meta.projectId,'--role-name',role,'--database-name',meta.database,'--ssl','require']);const match=raw.match(/postgres(?:ql)?:\/\/[^\s"<>]+/);if(!match)throw Error('Connection unavailable');return match[0];};
export async function operatorTarget(production=false){
 if(meta.projectId!=='dark-term-83490658')throw Error('Unexpected project');
 let branch=meta.productionBranchId;
 if(!production){const file='work/journal-validation.local';if(existsSync(file))branch=JSON.parse(readFileSync(file,'utf8')).branchId;else{const r=JSON.parse(neon(['branches','create','--project-id',meta.projectId,'--parent',meta.productionBranchId,'--schema-only','--name','journal-validation-20261109','--expires-at',new Date(Date.now()+86400000).toISOString(),'--no-secrets','-o','json']));branch=r.branch?.id||r.id;if(!branch||branch===meta.productionBranchId)throw Error('Isolated validation branch unavailable');writeFileSync(file,JSON.stringify({projectId:meta.projectId,branchId:branch}));}}
 if(!production&&branch===meta.productionBranchId)throw Error('Validation must never target production');
 const owner=connection(branch,meta.migrationRole),runtime=connection(branch,meta.runtimeRole);
 const pool=new Pool({connectionString:owner,max:1,connectionTimeoutMillis:10000});pool.on('error',()=>{});
 let scope,stage=production?'production':'preview';
 try{if(!production){scope='preview:journal-validation';await pool.query("INSERT INTO augustus_deployment(singleton,scope,environment) VALUES(true,$1,'preview') ON CONFLICT(singleton) DO UPDATE SET scope=EXCLUDED.scope,environment=EXCLUDED.environment",[scope]);}else{const b=(await pool.query('SELECT scope,environment FROM augustus_deployment WHERE singleton=true')).rows[0];if(b?.environment!=='production')throw Error('Production binding mismatch');scope=b.scope;}}finally{await pool.end();}
 return {branch,owner,runtime,role:meta.runtimeRole,env:{DATABASE_URL:runtime,AUGUSTUS_ENV:stage,AUGUSTUS_ORIGIN:production?'https://www.saibot92.auction':'https://journal-validation.invalid',AUGUSTUS_DATABASE_SCOPE:scope}};
}
export async function applyJournal(target){return migrateJournal({...target.env,DATABASE_MIGRATION_URL:target.owner,JOURNAL_RUNTIME_ROLE:target.role});}
if(process.argv[1]?.endsWith('journal-operator.mjs')){
 let step='existing Neon authentication';
 try{const production=process.argv[2]==='--production-apply';if(!production&&process.argv[2]!=='--validation-apply')throw Error('Explicit target required');const target=await operatorTarget(production);step='migration';const result=await applyJournal(target);console.log(JSON.stringify({status:'PASS',branch:target.branch,...result}));}catch{console.error(JSON.stringify({status:'BLOCKED',step,action:'Verify existing Neon CLI authentication and operator role; no alternate database is created.'}));process.exitCode=1;}
}
