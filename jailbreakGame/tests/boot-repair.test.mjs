import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame,dispatch,currentAttempt} from '../src/core.mjs';
import {exportSave,importSave} from '../src/storage.mjs';
import {bootRepairLesson,bootRepairStatus} from '../src/boot-repair.mjs';
import {workshopLesson,finishWorkshopLesson,workshopGuideStatus} from '../src/workshop-guides.mjs';
import {focusScreen,visibleScreen,terminalViewport} from '../src/terminal-view.mjs';
const c=JSON.parse(fs.readFileSync(new URL('../data/content.json',import.meta.url),'utf8'));
function ready(id){const s=createGame(c);s.run.id=2;s.run.rank=5;s.run.poc_rank=5;s.run.equipment_rank=5;s.run.cash=10000;s.meta.learned_intro_ids=c.jobs.map(j=>j.id);s.meta.history=c.jobs.map(j=>({grade:j.grade,job_id:j.id,practice:false}));return dispatch(s,{type:'accept',jobId:id},c);}
function perform(s,operation){s=dispatch(s,{type:'start',operation,confirmed:true},c);return dispatch(s,{type:'tick',ms:10000},c);}
test('arrival of a nonbooting device gets a phone lesson without requiring a player mistake',()=>{
  let s=ready('JOB_D_016');const a=currentAttempt(s),snapshot=structuredClone(a.device),cash=s.run.cash;
  assert.equal(s.run.assistance.queue.length,0);
  const lesson=workshopLesson(s,c);assert.equal(lesson.id,'boot-online');assert.match(lesson.pages.join(''),/データ消去禁止/);
  s=importSave(exportSave(finishWorkshopLesson(s,lesson)),c);
  assert.equal(workshopGuideStatus(s).phase,'boot-service');assert.equal(workshopLesson(s,c),null);
  const fee=Math.ceil(a.job.reward*.25);s=perform(s,bootRepairStatus(s).operation);
  assert.deepEqual(currentAttempt(s).device,{...snapshot,operational:true,history:{...snapshot.history,network:1}});
  assert.equal(s.run.cash,cash-fee);assert.equal(bootRepairStatus(s),null);
});
test('boot instruction repeats from the handset but automatic calls are once per repair type',()=>{
  let s=ready('JOB_D_016');s=finishWorkshopLesson(s,bootRepairLesson(s));
  assert.equal(bootRepairLesson(s),null);assert.equal(bootRepairLesson(s,true).id,'boot-online');
  s.run.attempts=[];s.run.active_id=null;s=dispatch(s,{type:'accept',jobId:'JOB_C_020'},c);
  assert.equal(bootRepairLesson(s).id,'boot-offline');
});
test('offline repair walks through rescue, recovery and restore using real equipment',()=>{
  let s=ready('JOB_C_020');const original=structuredClone(currentAttempt(s).device),lesson=workshopLesson(s,c);assert.equal(lesson.id,'boot-offline');
  s=finishWorkshopLesson(s,lesson);
  for(const [id,phase] of [['M06','boot-rescue'],['M05','boot-reimage'],['M04','boot-restore']]){
    assert.equal(bootRepairStatus(s).phase,'boot-buy');assert.equal(bootRepairStatus(s).itemId,id);
    s=dispatch(s,{type:'buy',id},c);assert.equal(bootRepairStatus(s).phase,phase);
    const operation=bootRepairStatus(s).operation;s=perform(s,operation);s=importSave(exportSave(s),c);
  }
  const d=currentAttempt(s).device;assert.equal(d.operational,true);assert.equal(d.history.network,0);assert.equal(d.version,original.version);
  for(const field of ['data','apps','settings','setting_fingerprints'])assert.deepEqual(d[field],original[field]);
  assert.equal(bootRepairStatus(s),null);assert.equal(s.run.assistance.queue.length,0);
});
test('a nonbooting device can interrupt independent practice while ordinary lessons remain quiet',()=>{
  const s=ready('JOB_D_016');s.run.tutorial={independentActive:true};assert.equal(workshopLesson(s,c).id,'boot-online');
});
test('portrait, landscape and dock screens cover the readable viewport without fitting the whole machine',()=>{
  for(const [width,height] of [[1527,1247],[1024,768],[800,653],[390,844]]){
    const s={W:width,H:height,scale:1};const viewport=terminalViewport(s);
    for(const p of [{x:120,y:80,w:120,h:250},{x:40,y:80,w:240,h:120},{x:140,y:320,w:62,h:57}]){
      const camera=focusScreen(p,s),transform={x:s.W/2-camera.x*camera.scale,y:s.H/2-camera.y*camera.scale,scale:camera.scale};
      const visible=visibleScreen(p,transform,s);
      for(const key of ['x','y','w','h'])assert.ok(Math.abs(visible[key]-viewport[key])<1e-6,`${width} ${key}`);
      assert.ok(p.w*camera.scale>=viewport.w-.001);assert.ok(p.h*camera.scale>=viewport.h-.001);
    }
  }
});
