import {randomBytes,createHash} from 'node:crypto';
import {isAddress,verifyMessage} from 'viem';
import {JournalError} from './domain.js';
export const digest=s=>createHash('sha256').update(s).digest('hex');
const zero='0x0000000000000000000000000000000000000000';
export class JournalAuth {
  constructor(store,config,verify=verifyMessage){Object.assign(this,{store,config,verify});}
  async challenge(address,csrf){
    if(!isAddress(address)||address===zero)throw new JournalError('A nonzero EVM wallet is required');
    const wallet=address.toLowerCase(),nonce=randomBytes(24).toString('hex'),expires=Date.now()+120000;
    const message=`Sign in to SAIBOT92 Journal\nOrigin: ${this.config.origin}\nEnvironment: ${this.config.stage}\nWallet: ${wallet}\nNonce: ${nonce}\nExpires: ${expires}\nJournal, memory and offchain Compute identity only. No trading, transfer, agent delegation or token approval.`;
    await this.store.transaction(zero,async c=>{await c.query('DELETE FROM journal_login_challenges WHERE expires_at<now()');await c.query('INSERT INTO journal_login_challenges(nonce_hash,wallet,message,csrf_hash,expires_at) VALUES($1,$2,$3,$4,$5)',[digest(nonce),wallet,message,digest(csrf),new Date(expires)]);});return {nonce,message};
  }
  async login(input,csrf){
    if(!isAddress(input.address)||! /^[0-9a-f]{48}$/i.test(input.nonce||'')||! /^0x[0-9a-f]{130}$/i.test(input.signature||'')||typeof input.message!=='string'||input.message.length>2000)throw new JournalError('Invalid wallet proof',401);
    const wallet=input.address.toLowerCase(),token=randomBytes(32).toString('hex');
    const valid=await this.store.transaction(zero,async c=>{
      const challenge=(await c.query('DELETE FROM journal_login_challenges WHERE nonce_hash=$1 RETURNING wallet,message,csrf_hash,expires_at',[digest(input.nonce)])).rows[0];
      if(!challenge||challenge.wallet!==wallet||challenge.message!==input.message||challenge.csrf_hash!==digest(csrf)||new Date(challenge.expires_at).getTime()<=Date.now())return false;
      try{if(!await this.verify({address:wallet,message:challenge.message,signature:input.signature}))return false;}catch{return false;}
      await c.query('DELETE FROM journal_sessions WHERE expires_at<now()');await c.query('INSERT INTO journal_sessions(token_hash,wallet,csrf_hash,origin,expires_at) VALUES($1,$2,$3,$4,$5)',[digest(token),wallet,digest(csrf),this.config.origin,new Date(Date.now()+1800000)]);return true;
    });if(!valid)throw new JournalError('Wallet proof expired or rejected',401);return {token,wallet};
  }
  async session(token,csrf=null){
    if(! /^[0-9a-f]{64}$/i.test(token||''))throw new JournalError('Connect and sign in to Journal',401);
    const s=await this.store.transaction(zero,async c=>(await c.query('SELECT wallet,csrf_hash,origin,expires_at FROM journal_sessions WHERE token_hash=$1',[digest(token)])).rows[0]);
    if(!s||new Date(s.expires_at).getTime()<=Date.now()||s.origin!==this.config.origin||csrf&&s.csrf_hash!==digest(csrf))throw new JournalError('Journal session expired',401);return s.wallet;
  }
  async logout(token){if(token)await this.store.transaction(zero,c=>c.query('DELETE FROM journal_sessions WHERE token_hash=$1',[digest(token)]));}
}
