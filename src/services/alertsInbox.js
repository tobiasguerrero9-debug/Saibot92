// Backend data only. This module never imports a classifier or market feed.
export class AlertsInbox {
  constructor({ fetchImpl = (...args) => fetch(...args), storage, interval = (fn,ms) => globalThis.setInterval(fn,ms), cancel = id => globalThis.clearInterval(id) } = {}) {
    Object.assign(this,{ fetchImpl,storage,interval,cancel });this.listeners=new Set();this.events=[];this.conditions=[];this.readIds=new Set();this.users=0;this.pending=null;this.hasLoaded=false;this.receivedVersion=0;
    this.marketValue={markets:[],loading:true,error:null,status:{state:'OFFLINE'},observedAt:null};
    try { this.readIds=new Set(JSON.parse(storage?.getItem('saibot92.alert-read.v2')||'[]').slice(0,1000)); } catch { /* Read markers are optional. */ }
  }
  subscribe = fn => {this.listeners.add(fn);return()=>this.listeners.delete(fn)};
  snapshot = () => this.events;
  liveSnapshot = () => this.conditions;
  marketSnapshot = () => this.marketValue;
  notify(){this.listeners.forEach(fn=>{try{fn()}catch{/* A UI/audio listener must not turn a successful fetch into a delivery failure. */}})}
  acknowledge(id){for(const e of this.events)if(!id||id===e.id)this.readIds.add(e.id);this.readIds=new Set([...this.readIds].slice(-1000));try{this.storage?.setItem('saibot92.alert-read.v2',JSON.stringify([...this.readIds]))}catch{/* Session read state remains. */}this.events=this.events.map(e=>({...e,acknowledged:this.readIds.has(e.id)}));this.notify()}
  refresh = () => {
    if(this.pending)return this.pending;
    this.pending=Promise.resolve().then(()=>this.fetchImpl('/api/alerts',{signal:AbortSignal.timeout(12000)})).then(async r=>{if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.events)||!Array.isArray(data.conditions)||!Array.isArray(data.markets))throw Error();
      this.hasLoaded=true;this.receivedVersion++;this.events=data.events.slice(0,100).map(e=>({...e,acknowledged:this.readIds.has(e.id)}));
      const age=Date.now()-data.serverTime;
      this.conditions=data.conditions.map(e=>({...e,observedAt:e.observedAt+age}));
      this.marketValue={markets:data.markets,loading:false,error:data.status?.state==='ONLINE'?null:'Background monitoring is unavailable or delayed.',status:data.status,observedAt:data.status?.lastScan};this.notify();
    }).catch(()=>{this.conditions=[];this.marketValue={...this.marketValue,loading:false,error:'Alerts backend unavailable. Retrying automatically.',status:{...this.marketValue.status,state:'OFFLINE'}};this.notify()}).finally(()=>{this.pending=null});return this.pending;
  };
  start=()=>{if(++this.users===1){void this.refresh();this.timer=this.interval(this.refresh,15000)}let stopped=false;return()=>{if(stopped)return;stopped=true;if(--this.users===0)this.cancel(this.timer)}};
}
let storage;try{storage=globalThis.localStorage}catch{/* Browser read markers unavailable. */}
export const alertsInbox=new AlertsInbox({storage});
