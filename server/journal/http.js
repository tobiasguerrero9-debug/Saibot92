import {randomBytes} from 'node:crypto';
import {JournalAuth,digest} from './auth.js';
import {JournalError} from './domain.js';
export function createJournalHandler(repository,auth=new JournalAuth(repository.store,repository.config)){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json');
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  const config=repository.config;
  if(req.headers.host!==new URL(config.origin).host||req.headers.origin&&req.headers.origin!==config.origin||req.method==='POST'&&req.headers.origin!==config.origin)return send(403,{error:'Origin rejected'});
  if(!['GET','POST'].includes(req.method))return send(405,{error:'Method not allowed'});
  const url=new URL(req.url,config.origin),route=String(req.query?.route??url.searchParams.get('route')??'').replace(/^\/+|\/+$/g,'');
  const prefix=config.stage==='development'?'journal_':'__Host-Journal',sessionName=prefix+'Session',csrfName=prefix+'CSRF';
  const cookies=Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim().split('=')).filter(v=>v.length===2));let csrf=cookies[csrfName];
  const cookie=(name,value,age=1800)=>{const old=res.getHeader('Set-Cookie')||[];res.setHeader('Set-Cookie',[...(Array.isArray(old)?old:[old]),`${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${config.stage==='development'?'':'; Secure'}`]);};
  try{
   await repository.store.rateLimit(digest('journal:'+String(req.headers['x-forwarded-for']||'unknown')),['challenge','session'].includes(route)?20:90);
   if(req.method==='GET'&&route==='bootstrap'){
    if(! /^[0-9a-f]{64}$/.test(csrf||'')){csrf=randomBytes(32).toString('hex');cookie(csrfName,csrf);}
    let wallet=null;try{wallet=await auth.session(cookies[sessionName]);}catch{/* No authenticated wallet is inferred. */}
    return send(200,{csrf,wallet,identityOnly:true});
   }
   let input={};if(req.method==='POST'){
    if(! /^[0-9a-f]{64}$/.test(csrf||'')||req.headers['x-journal-csrf']!==csrf||!req.headers['content-type']?.startsWith('application/json'))return send(403,{error:'Refresh Journal before submitting'});
    if(req.body!==undefined){if(JSON.stringify(req.body).length>32768)throw new JournalError('Body too large',413);input=typeof req.body==='string'?JSON.parse(req.body):req.body;}
    else{let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>32768)throw new JournalError('Body too large',413);}input=JSON.parse(text||'{}');}
    if(!input||typeof input!=='object'||Array.isArray(input))throw new JournalError('JSON object required');
   }
   if(req.method==='POST'&&route==='challenge')return send(200,await auth.challenge(input.address,csrf));
   if(req.method==='POST'&&route==='session'){const result=await auth.login(input,csrf);cookie(sessionName,result.token);cookie(csrfName,csrf);return send(200,{wallet:result.wallet});}
   if(req.method==='POST'&&route==='logout'){await auth.logout(cookies[sessionName]);cookie(sessionName,'',0);return send(200,{disconnected:true});}
   const wallet=await auth.session(cookies[sessionName],req.method==='POST'?csrf:null);
   if(req.method==='GET'&&route==='')return send(200,await repository.list(wallet,url.searchParams.get('cursor')));
   if(req.method==='POST'&&route==='')return send(201,await repository.create(wallet,input));
   if(req.method==='GET'&&['compute','memory'].includes(route)){const state=await repository.overview(wallet);return send(200,route==='compute'?state.compute:state.memory);}
   const match=/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/complete)?$/i.exec(route);
   if(match&&req.method==='GET'&&!match[2])return send(200,await repository.detail(wallet,match[1]));
   if(match&&req.method==='POST'&&match[2])return send(200,await repository.complete(wallet,match[1],input));
   return send(404,{error:'Journal route not found'});
  }catch(error){return send(error instanceof JournalError?error.status:503,{error:error instanceof JournalError?error.message:'Journal persistence unavailable; no success or credit is inferred'});}
 };
}
