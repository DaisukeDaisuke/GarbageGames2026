import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame,dispatch,currentAttempt,inspect} from '../src/core.mjs';
import {exportSave,importSave} from '../src/storage.mjs';
import {scrollMetrics} from '../src/scroll-layout.mjs';
import {workshopLesson,workshopGuideStatus,finishWorkshopLesson,requestSaleLesson} from '../src/workshop-guides.mjs';
const c=JSON.parse(fs.readFileSync(new URL('../data/content.json',import.meta.url),'utf8'));
test('bottom scroll limit stays fixed across floating point cancellation',()=>{
  let offset=500;const offsets=[];
  for(let i=0;i<100;i++){const m=scrollMetrics(832+(i%2?1e-10:-1e-10),400,offset);offset=m.offset;offsets.push(offset);assert.equal(m.atBottom,true);}
  assert.deepEqual([...new Set(offsets)],[432]);assert.equal(scrollMetrics(400,400).overflow,false);
});
test('first Type-C media lesson guides compatible media without a needless adapter',()=>{
  let s=createGame(c);s.run.id=2;s.run.rank=2;s.run.poc_rank=2;s.run.equipment_rank=2;s.run.cash=2000;
  s=dispatch(s,{type:'accept',jobId:'JOB_D_001'},c);
  const event=workshopLesson(s,c);assert.equal(event.id,'usb-c');
  s=importSave(exportSave(finishWorkshopLesson(s,event)),c);
  assert.equal(workshopGuideStatus(s).phase,'buy-type-c');assert.equal(workshopGuideStatus(s).itemId,'P03');
  s=dispatch(s,{type:'buy',id:'P03'},c);assert.equal(workshopGuideStatus(s).phase,'insert-type-c');
  s=dispatch(s,{type:'insert',pocId:'P03',port:0},c);assert.equal(workshopGuideStatus(s).phase,'done');assert.equal(workshopLesson(s,c),null);
});
test('Type-C adapter lesson persists through reload and guides equipment purchase then connection',()=>{
  let s=createGame(c);s.run.id=2;s.run.rank=2;s.run.poc_rank=2;s.run.equipment_rank=2;s.run.cash=2000;s.run.completed=['JOB_D_001','JOB_D_002','JOB_D_003','JOB_D_004'];s.meta.history=s.run.completed.map(job_id=>({job_id,grade:'D',practice:false}));
  s=dispatch(s,{type:'accept',jobId:'JOB_D_020'},c);
  const event=workshopLesson(s,c);assert.equal(event.id,'usb-c-adapter');
  s=importSave(exportSave(finishWorkshopLesson(s,event)),c);
  assert.equal(workshopGuideStatus(s).phase,'buy-adapter');assert.equal(workshopLesson(s,c),null);
  s=dispatch(s,{type:'buy',id:'M03'},c);assert.equal(workshopGuideStatus(s).phase,'connect-adapter');
  s=dispatch(s,{type:'start',operation:{type:'adapter'},confirmed:true},c);s=dispatch(s,{type:'tick',ms:2400},c);
  assert.equal(workshopGuideStatus(s).phase,'done');assert.equal(workshopLesson(s,c),null);
});
test('supply lesson leads through new products to a single choice',()=>{
  let s=createGame(c);s.run.rank=2;s.run.chapter_grants[2]=false;s.run.book_pending=[2];
  const event=workshopLesson(s,c);assert.equal(event.id,'supplies');s=finishWorkshopLesson(s,event);
  assert.equal(workshopGuideStatus(s).phase,'grant-catalog');
  s=dispatch(s,{type:'openCatalog',rank:2,kind:'both'},c);assert.equal(workshopGuideStatus(s).phase,'grant-select');
  s=dispatch(s,{type:'grant',rank:2,choice:'cash'},c);assert.equal(workshopGuideStatus(s).phase,'done');assert.equal(workshopLesson(s,c),null);
});
test('first sale asks for instruction without selling or changing money',()=>{
  let s=createGame(c);const before=s.run.cash;s=requestSaleLesson(s,'P02');
  const event=workshopLesson(s,c);assert.equal(event.id,'sale');assert.match(event.pages.join(''),/買い戻せない/);
  s=importSave(exportSave(finishWorkshopLesson(s,event)),c);assert.equal(s.run.cash,before);assert.equal(s.meta.workshop_lessons.filter(x=>x==='sale').length,1);
  assert.equal(workshopLesson(requestSaleLesson(s,'P02'),c),null);
});
test('independent job suppresses new regular lessons until delivery',()=>{
  const s=createGame(c);s.run.tutorial={independentActive:true};s.run.chapter_grants[2]=false;
  assert.equal(workshopLesson(s,c),null);
});
function ready(jobId){
  let s=createGame(c);s.run.id=2;s.run.rank=s.run.poc_rank=s.run.equipment_rank=5;s.run.cash=50000;
  s.meta.learned_intro_ids=c.jobs.map(j=>j.id);s.meta.history=c.jobs.map(j=>({grade:j.grade,practice:false}));
  return dispatch(s,{type:'accept',jobId},c);
}
const perform=(s,operation)=>dispatch(dispatch(s,{type:'start',operation,confirmed:true},c),{type:'tick',ms:2400},c);
test('the reported profile job requests feature media, calls after purchase, and guides execution then editing',()=>{
  let s=ready('JOB_A_018');
  let lesson=workshopLesson(s,c);assert.equal(lesson.id,'profile-prepare');assert.equal(lesson.mediaId,'P30');
  assert.ok(lesson.pages.every(p=>!p.includes('管理者制限解除')));
  s=finishWorkshopLesson(s,lesson);assert.equal(workshopGuideStatus(s).phase,'profile-buy');
  assert.equal(workshopLesson(s,c),null);
  s=dispatch(s,{type:'buy',id:'P30'},c);lesson=workshopLesson(s,c);assert.equal(lesson.id,'profile-use');
  s=importSave(exportSave(finishWorkshopLesson(s,lesson)),c);assert.equal(workshopGuideStatus(s).phase,'profile-insert');
  s=dispatch(s,{type:'insert',pocId:'P30',portIndex:0},c);assert.equal(workshopGuideStatus(s).phase,'profile-execute');
  s=perform(s,{type:'poc',pocId:'P30'});assert.equal(s.run.assistance.queue.length,0);assert.equal(workshopGuideStatus(s).phase,'profile-edit');
  s=perform(s,{type:'setting',key:'profile',value:'custom'});assert.equal(s.run.assistance.queue[0]?.axis,'feature');
  s=perform(s,{type:'lock',axis:'feature'});assert.ok(inspect(currentAttempt(s),c).every(r=>r.ok));
  assert.equal(workshopLesson(s,c),null);assert.equal(currentAttempt(s).device.security.root,true);
});
test('attached presets are taught after boot repair and call again only after the transfer equipment arrives',()=>{
  let s=ready('JOB_A_019');let lesson=workshopLesson(s,c);assert.equal(lesson.id,'boot-online');
  s=finishWorkshopLesson(s,lesson);assert.equal(workshopGuideStatus(s).phase,'boot-service');
  s=perform(s,{type:'service',serviceId:'S02'});lesson=workshopLesson(s,c);assert.equal(lesson.id,'preset-prepare');
  s=finishWorkshopLesson(s,lesson);assert.equal(workshopGuideStatus(s).phase,'preset-buy');assert.equal(workshopLesson(s,c),null);
  s=dispatch(s,{type:'buy',id:'M13'},c);lesson=workshopLesson(s,c);assert.equal(lesson.id,'preset-use');
  s=finishWorkshopLesson(s,lesson);assert.equal(workshopGuideStatus(s).phase,'preset-apply');
  s=perform(s,{type:'preset'});assert.equal(workshopGuideStatus(s).phase,'done');assert.ok(inspect(currentAttempt(s),c).every(r=>r.ok));
});
test('after the fifth delivery call, the guide points toward personnel without retiring automatically',()=>{
  const s=createGame(c);s.run.main_completed=['1','2','3','4','5'];s.run.completed_calls=['CALL06'];
  assert.equal(workshopGuideStatus(s).phase,'career-personnel');assert.equal(s.run.status,'active');
  s.run.status='retired';assert.equal(workshopGuideStatus(s).phase,'done');
});
