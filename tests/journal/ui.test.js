import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {buildJournalContext,captureJournalContext} from '../../src/services/journalContext.js';
test('market auto-capture includes existing metrics and Alerts without attaching a previous symbol',()=>{
 const data={symbol:'ETHUSDT',openInterestUsd:120,openInterestCoins:3,fundingRate:0.0001,liquidations:[{id:'x'}]};
 const snapshot=buildJournalContext({symbol:'ETHUSDT',marketData:data,agentState:{state:'OBSERVING',marketBias:'NEUTRAL',contextScore:65},conditions:[{symbol:'ETHUSDT',type:'SQUEEZE_DETECTED'}],alerts:[{id:'alert',symbol:'ETHUSDT',severity:'HIGH'}]});
 assert.equal(snapshot.market.oiUsd,120);assert.equal(snapshot.alerts[0].id,'alert');assert.equal(snapshot.squeezeState.length,1);const frozen=captureJournalContext(snapshot);data.openInterestUsd=400;assert.equal(frozen.market.oiUsd,120);
 const stale=buildJournalContext({symbol:'BTCUSDT',marketData:data,agentState:{state:'WRONG_SYMBOL'}});assert.equal(stale.market,null);assert.equal(stale.agentState,null);assert.equal(stale.isStale,true);
});
test('journal UI renders required form, compact Compute, history and memory without claiming a signed-in wallet',async()=>{
 const {default:Journal}=await import('../../work/journal-ui/Journal.js');
 const html=renderToString(React.createElement(Journal,{context:{symbol:'ETHUSDT'}}));
 for(const text of ['SAIBOT92 JOURNAL','COMPUTE','CONNECT WALLET','Thesis','Notes / review','JOURNAL HISTORY','SIGN IN TO SAVE','AUTO-CAPTURED CONTEXT'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('+10 COMPUTE · MEMORY UPDATED'));assert.ok(html.includes('disabled=""'));
});
