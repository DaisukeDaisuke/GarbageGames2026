import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDisplay} from '../src/display.mjs';
import {createGame,dispatch} from '../src/core.mjs';
import {handsetAttachment} from '../src/phone.mjs';
const c=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url))),d=createDisplay(c);
test('all content identifiers resolve to descriptive names, including prose references',()=>{
  for(const group of ['pocs','equipment','skills','services','jobs','devices','events','endings'])for(const item of c[group]){
    assert.ok(d.map[item.id]?.name);assert.notEqual(d.text(item.id),item.id);
  }
  assert.equal(d.text('初期P01は枠外。M02/M03。C2を使用。'),'初期KomaOS 1.0 / 1.1 管理者制限解除は枠外。外部画面ドック/USB-A/C変換器。'+d.name('C2')+'を使用。');
});
test('all fixture route displays are human-readable and contain no raw DSL or identifiers',()=>{
  for(const job of c.jobs)for(const route of job.routes){const text=d.route(route);assert.doesNotMatch(text,/\b(?:P\d\d|M\d\d|S:|L:|B:|Q:|R:|root|install|feature|theme=|output=)/);assert.ok(text.startsWith('1. '));}
  assert.equal(d.operation({type:'setting',key:'theme',value:'custom'}),'配色を「依頼どおり」に変更');
});
test('phone onboarding advances once per button and persists without skipping stages',()=>{
  let state=createGame(c);assert.equal(state.run.intro.stage,0);
  for(let i=1;i<=4;i++){state=dispatch(state,{type:'introNext'},c);state=JSON.parse(JSON.stringify(state));assert.equal(state.run.intro.stage,i);assert.equal(state.run.intro.complete,i===4);}
  state=dispatch(state,{type:'introNext'},c);assert.equal(state.run.intro.stage,4);
});
test('handset cord attachment rotates with the receiver instead of floating at its old corner',()=>{
  const center={x:600,y:647},width=190,aspect=265/744,theta=-.62;
  const point=handsetAttachment(center,theta,width,aspect),flat=handsetAttachment(center,0,width,aspect);
  assert.ok(Math.abs(Math.hypot(point.x-center.x,point.y-center.y)-Math.hypot(flat.x-center.x,flat.y-center.y))<1e-8);
  assert.ok(point.y>flat.y+35);assert.ok(point.x>flat.x);
});
test('all 100 devices have eight independently cropped complete artwork frames',()=>{
  const frames=JSON.parse(readFileSync(new URL('../assets/frames.json',import.meta.url)));assert.equal(Object.keys(frames).length,20);
  for(const entries of Object.values(frames)){assert.equal(entries.length,40);for(const f of entries){assert.ok(f.w>15&&f.h>60);assert.ok(f.x>=0&&f.y>=0);}}
  const portraits=JSON.parse(readFileSync(new URL('../assets/portrait-frames.json',import.meta.url)));assert.equal(portraits.length,3);assert.ok(portraits.every(p=>p.h>600));
});
