import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {miniAppView,miniAppSearch} from '../../src/services/miniAppNavigation.js';
test('direct Journal/scanner URLs and refresh resolve from URL; default app behavior remains intelligence',()=>{
  for(const [search,view]of [['','intelligence'],['?view=journal','journal'],['?view=scanner','scanner'],['?view=intelligence','intelligence'],['?view=unknown','intelligence'],['?view=https://attacker.invalid','intelligence']])assert.equal(miniAppView(search),view);
});
test('view transitions preserve other parameters and history snapshots remain independent',()=>{
  const initial=new URLSearchParams('utm_source=header');
  const journal=miniAppSearch(initial,'journal'),scanner=miniAppSearch(journal,'scanner'),home=miniAppSearch(scanner,'intelligence');
  assert.equal(initial.toString(),'utm_source=header');assert.equal(journal.get('view'),'journal');assert.equal(scanner.get('view'),'scanner');assert.equal(home.has('view'),false);assert.equal(home.get('utm_source'),'header');
  assert.deepEqual([initial,journal,scanner,journal,initial].map(miniAppView),['intelligence','journal','scanner','journal','intelligence']);assert.throws(()=>miniAppSearch(initial,'unknown'));
});
test('rendered landing header exposes desktop and compact Journal links while Launch App retains its original route',async()=>{
  const {default:Navbar}=await import('../../work/journal-nav-ui/Navbar.js');
  const html=renderToString(React.createElement(MemoryRouter,null,React.createElement(Navbar)));
  const links=[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(m=>({attrs:m[1],text:m[2].replace(/<[^>]*>/g,'').trim()}));
  const journal=links.filter(l=>l.text==='JOURNAL');assert.equal(journal.length,2);for(const link of journal)assert.match(link.attrs,/href="\/app\?view=journal"/);
  assert.match(journal[1].attrs,/xl:hidden/);assert.match(links.find(l=>l.text==='Launch App').attrs,/href="\/app"/);
});
