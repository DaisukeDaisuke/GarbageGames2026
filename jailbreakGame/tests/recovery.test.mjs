import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,dispatch,currentAttempt,inspect,executeRoute} from '../src/core.mjs';
import {exportSave,importSave} from '../src/storage.mjs';
import {recoveryIncoming,recoveryHint,recoveryInstruction,RECOVERY_PATTERNS} from '../src/recovery.mjs';
const c=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url),'utf8'));
const perform=(s,operation)=>dispatch(dispatch(s,{type:'start',operation,confirmed:true},c),{type:'tick',ms:2400},c);
function second(){
  let s=createGame(c,'7429138652006184');
  s=executeRoute(s,'JOB_E_001','P01',c).state;
  s=dispatch(s,{type:'deliver'},c);
  s=dispatch(s,{type:'accept',jobId:'JOB_E_002'},c);
  s=dispatch(s,{type:'buy',id:'M02'},c);
  return perform(s,{type:'dock'});
}
function ready(jobId){
  let s=createGame(c);s.run.id=2;s.run.rank=s.run.poc_rank=s.run.equipment_rank=5;s.run.cash=50000;
  s.meta.learned_intro_ids=c.jobs.map(j=>j.id);s.meta.history=c.jobs.map(j=>({grade:j.grade,practice:false}));
  s.run.owned_equipment=c.equipment.map(e=>e.id);s.run.owned_pocs=c.pocs.map(p=>p.id);
  return dispatch(s,{type:'accept',jobId},c);
}
test('the first install unlock is preparation, while delivery still requires relocking',()=>{
  let s=ready('JOB_E_007');
  s=dispatch(s,{type:'insert',pocId:'P02'},c);s=perform(s,{type:'poc',pocId:'P02'});
  assert.equal(recoveryIncoming(s),null);
  assert.throws(()=>dispatch(s,{type:'deliver'},c),/アプリ導入/);
  s=perform(s,{type:'install',app:'筆記'});
  s=importSave(exportSave(s),c);s=dispatch(s,{type:'recoveryScan'},c);
  assert.equal(recoveryIncoming(s)?.pattern,'wrong-unlock');
  assert.equal(recoveryIncoming(s)?.axis,'install');
  s=perform(s,{type:'lock',axis:'install'});
  assert.ok(inspect(currentAttempt(s),c).every(r=>r.ok));
  s=perform(s,{type:'poc',pocId:'P02'});
  assert.equal(recoveryIncoming(s)?.pattern,'wrong-unlock');
});
test('first-time prerequisite exceptions cover app removal and setting changes',()=>{
  for(const [jobId,axis,operation] of [
    ['JOB_E_018','install',{type:'remove',app:'写真整理'}],
    ['JOB_E_013','feature',{type:'setting',key:'content',value:'custom'}]
  ]){
    let s=ready(jobId);s=perform(s,{type:'service',serviceId:'S01',axes:[axis]});
    assert.equal(recoveryIncoming(s),null,jobId);
    s=perform(s,operation);s=perform(s,{type:'lock',axis});
    assert.ok(inspect(currentAttempt(s),c).every(r=>r.ok),jobId);
    s=perform(s,{type:'service',serviceId:'S01',axes:[axis]});
    assert.equal(recoveryIncoming(s)?.pattern,'wrong-unlock',jobId);
  }
});
test('working dependencies defer relock advice while unrelated permissions still trigger it',()=>{
  let s=ready('JOB_E_007');
  s=perform(s,{type:'service',serviceId:'S01',axes:['install']});
  s=perform(s,{type:'lock',axis:'install'});
  s=perform(s,{type:'service',serviceId:'S01',axes:['install']});
  assert.equal(recoveryIncoming(s),null);
  s=perform(s,{type:'install',app:'筆記'});
  assert.equal(recoveryIncoming(s)?.pattern,'wrong-unlock');
  s=ready('JOB_E_007');s=perform(s,{type:'service',serviceId:'S01',axes:['root']});
  assert.equal(recoveryIncoming(s)?.axis,'root');
  s=ready('JOB_D_010');s=perform(s,{type:'service',serviceId:'S01',axes:['root','install']});
  assert.equal(recoveryIncoming(s),null);
});
test('the reported initially unlocked display job waits until its content has been changed',()=>{
  let s=ready('JOB_D_015');
  s=perform(s,{type:'lock',axis:'root'});s=perform(s,{type:'lock',axis:'install'});
  s=importSave(exportSave(s),c);s=dispatch(s,{type:'recoveryScan'},c);
  assert.equal(recoveryIncoming(s),null);
  const before=structuredClone(currentAttempt(s).device);
  assert.equal(before.security.feature,true);
  s=perform(s,{type:'setting',key:'content',value:'custom'});
  assert.equal(recoveryIncoming(s)?.axis,'feature');
  assert.deepEqual(recoveryIncoming(s)?.operation,{type:'lock',axis:'feature'});
  s=perform(s,{type:'lock',axis:'feature'});
  assert.equal(recoveryIncoming(s),null);assert.ok(inspect(currentAttempt(s),c).every(r=>r.ok));
});
test('all dependent apps and settings must be finished before their own axis gets a relock call',()=>{
  let s=ready('JOB_A_014');
  s=perform(s,{type:'service',serviceId:'S01',axes:['install','feature']});
  s=perform(s,{type:'install',app:'作品閲覧'});s=perform(s,{type:'setting',key:'theme',value:'custom'});
  assert.equal(recoveryIncoming(s),null);
  s=perform(s,{type:'install',app:'字幕'});assert.equal(recoveryIncoming(s)?.axis,'install');
  assert.ok(s.run.assistance.queue.every(e=>e.axis!=='feature'));
  s=perform(s,{type:'lock',axis:'install'});assert.equal(recoveryIncoming(s),null);
  s=perform(s,{type:'setting',key:'content',value:'custom'});assert.equal(recoveryIncoming(s)?.axis,'feature');
});
test('old erroneous preparation calls are cleared without changing the device',()=>{
  let s=ready('JOB_E_007');s=perform(s,{type:'service',serviceId:'S01',axes:['install']});
  for(const e of currentAttempt(s).log)delete e.work_unlock_axes;
  const stale={id:'old',attemptId:currentAttempt(s).id,kind:'axis',axis:'install',value:false,pattern:'wrong-unlock',labels:['アプリ導入権限']};
  s.run.assistance={queue:[stale],active:structuredClone(stale),hints:[structuredClone(stale)]};
  const device=structuredClone(currentAttempt(s).device);
  s=dispatch(s,{type:'recoveryScan'},c);
  assert.equal(recoveryIncoming(s),null);assert.equal(s.run.assistance.active,null);assert.deepEqual(s.run.assistance.hints,[]);
  assert.deepEqual(currentAttempt(s).device,device);
});
test('recovery waits in a persistent queue, calls once per pattern and permits unlimited manual recall',()=>{
  let s=second();assert.equal(recoveryIncoming(s),null);
  s=dispatch(s,{type:'insert',pocId:'P01'},c);
  s=perform(s,{type:'poc'});
  assert.equal(s.run.assistance.queue.length,1);assert.equal(recoveryIncoming(s).pattern,'wrong-unlock');
  const originalPages=[...recoveryIncoming(s).pages];
  s=importSave(exportSave(s),c);s=dispatch(s,{type:'tick',ms:2400},c);
  assert.equal(s.run.assistance.queue.length,1);assert.deepEqual(recoveryIncoming(s).pages,originalPages);
  s=dispatch(s,{type:'recoveryCall',id:recoveryIncoming(s).id},c);
  assert.throws(()=>dispatch(s,{type:'recoveryComplete'},c),/まだ完了/);
  assert.deepEqual(s.run.assistance.active.operation,{type:'lock',axis:'root'});
  const cash=s.run.cash;s=perform(s,s.run.assistance.active.operation);
  assert.equal(s.run.assistance.active,null);assert.equal(s.run.cash,cash);
  s=perform(s,{type:'poc'});assert.equal(recoveryIncoming(s),null);
  assert.equal(recoveryHint(s).pattern,'wrong-unlock');assert.deepEqual(recoveryHint(s).pages,originalPages);
  const recalled=recoveryHint(s).id;
  s=dispatch(s,{type:'recoveryCall',id:recalled},c);
  s=dispatch(s,{type:'recoveryCall',id:recalled},c);
  assert.deepEqual(s.run.assistance.active.pages,originalPages);
  s=perform(s,s.run.assistance.active.operation);
  s=dispatch(s,{type:'eject'},c);s=dispatch(s,{type:'buy',id:'P02'},c);s=dispatch(s,{type:'insert',pocId:'P02'},c);
  s=perform(s,{type:'poc'});assert.ok(inspect(currentAttempt(s),c).every(row=>row.ok));
  assert.equal(s.meta.assistance_seen_patterns.filter(p=>p==='wrong-unlock').length,1);
});
test('data-loss retry atomically replaces only the attempt without refund or repeated rewards',()=>{
  let s=ready('JOB_E_001');const initialUid=currentAttempt(s).device_uid;
  s=perform(s,{type:'reimage',development:false});
  const incoming=s.run.assistance.queue.find(e=>e.pattern==='data-loss');assert.ok(incoming?.retry);
  s=dispatch(s,{type:'recoveryCall',id:incoming.id},c);
  const cash=s.run.cash,owned=[...s.run.owned_equipment],sp=s.meta.sp_total_earned,rewards=s.run.eligible_reward_total;
  s=dispatch(s,{type:'recoveryRetry'},c);
  assert.notEqual(currentAttempt(s).device_uid,initialUid);assert.equal(currentAttempt(s).job_id,'JOB_E_001');
  assert.deepEqual(currentAttempt(s).device.data,currentAttempt(s).snapshot.data);
  assert.equal(s.run.cash,cash);assert.deepEqual(s.run.owned_equipment,owned);
  assert.equal(s.meta.sp_total_earned,sp);assert.equal(s.run.eligible_reward_total,rewards);
  assert.equal(recoveryIncoming(s),null);assert.equal(s.run.assistance.active,null);
  assert.throws(()=>dispatch(s,{type:'recoveryRetry'},c),/受け直し/);
});
test('a settings regression has its own first-time call and is repaired by the normal setting operation',()=>{
  let s=ready('JOB_E_004');assert.equal(recoveryIncoming(s),null);
  s=executeRoute(s,'JOB_E_004','P06 theme=custom',c).state;
  s.meta.assistance_seen_patterns.push('wrong-unlock');
  s=perform(s,{type:'setting',key:'theme',value:'standard'});
  assert.equal(recoveryIncoming(s).pattern,'incorrect-setting');
  s=dispatch(s,{type:'recoveryCall',id:recoveryIncoming(s).id},c);
  assert.deepEqual(s.run.assistance.active.operation,{type:'setting',key:'theme',value:'custom'});
  s=perform(s,s.run.assistance.active.operation);assert.equal(s.run.assistance.active,null);
  assert.ok(inspect(currentAttempt(s),c).every(row=>row.ok));
});
test('unanswered obsolete calls disappear if the player repairs the mistake first',()=>{
  let s=second();s=dispatch(s,{type:'insert',pocId:'P01'},c);s=perform(s,{type:'poc'});
  assert.ok(recoveryIncoming(s));s=perform(s,{type:'lock',axis:'root'});
  assert.equal(recoveryIncoming(s),null);assert.deepEqual(s.meta.assistance_seen_patterns,[]);
});
test('OS media incompatibility and forbidden histories are distinct first-time patterns',()=>{
  let s=ready('JOB_E_014');s.run.owned_pocs=['P01','P02','P06'];
  s=perform(s,{type:'service',serviceId:'S03'});
  assert.equal(recoveryIncoming(s).pattern,'media-incompatible-os');assert.ok(recoveryIncoming(s).retry);
  const j=c.jobs.find(j=>j.forbid.includes('root')&&j.network!==false);
  s=ready(j.id);s=perform(s,{type:'service',serviceId:'S01',axes:['root']});
  assert.ok(s.run.assistance.queue.some(e=>e.pattern==='forbidden-history'&&e.retry));
  assert.ok(Object.keys(RECOVERY_PATTERNS).includes('data-loss'));
});
test('old saves scan committed regressions without alarming on initially unmet requirements',()=>{
  let s=second();delete s.run.assistance;delete s.meta.assistance_seen_patterns;
  s=dispatch(s,{type:'recoveryScan'},c);assert.equal(recoveryIncoming(s),null);
  s=dispatch(s,{type:'insert',pocId:'P01'},c);s=perform(s,{type:'poc'});
  delete s.run.assistance;
  s=importSave(exportSave(s),c);s=dispatch(s,{type:'recoveryScan'},c);
  assert.equal(recoveryIncoming(s).pattern,'wrong-unlock');assert.equal(s.run.assistance.queue.length,1);
  s=dispatch(s,{type:'recoveryScan'},c);assert.equal(s.run.assistance.queue.length,1);
  s=dispatch(s,{type:'recoveryCall',id:recoveryIncoming(s).id},c);
  delete s.run.assistance;s=dispatch(s,{type:'recoveryScan'},c);
  assert.equal(recoveryIncoming(s),null);assert.equal(recoveryHint(s).pattern,'wrong-unlock');
  let lost=ready('JOB_E_001');lost=perform(lost,{type:'reimage',development:false});delete lost.run.assistance;
  lost=dispatch(lost,{type:'recoveryScan'},c);
  assert.ok(recoveryIncoming(lost)?.retry);assert.equal(recoveryIncoming(lost).pattern,'data-loss');
});
test('an unrelated app never substitutes the requested app and guidance names the current contract app',()=>{
  let s=ready('JOB_E_006');
  s=perform(s,{type:'service',serviceId:'S01',axes:['install']});
  assert.equal(recoveryIncoming(s),null);
  s=perform(s,{type:'install',app:'筆記'});
  const e=recoveryIncoming(s);assert.equal(e.pattern,'wrong-app-selected');assert.equal(e.app,'写真整理');
  assert.ok(e.pages.join('').includes('追加したアプリを消す必要はない'));
  assert.equal(inspect(currentAttempt(s),c).find(r=>r.label==='アプリ：写真整理').ok,false);
  assert.throws(()=>dispatch(s,{type:'deliver'},c),/写真整理/);
  s=importSave(exportSave(s),c);s=dispatch(s,{type:'recoveryCall',id:e.id},c);
  assert.deepEqual(s.run.assistance.active.operation,{type:'install',app:'写真整理'});
  assert.match(recoveryInstruction(s,s.run.assistance.active),/写真整理/);
  s=perform(s,s.run.assistance.active.operation);
  assert.equal(s.run.assistance.active,null);assert.ok(currentAttempt(s).device.apps.includes('筆記'));
  assert.ok(inspect(currentAttempt(s),c).every(r=>r.ok));
  s=perform(s,{type:'remove',app:'手帳'});
  assert.equal(recoveryIncoming(s).pattern,'required-app-missing');assert.equal(recoveryIncoming(s).app,'手帳');
  assert.ok(recoveryIncoming(s).pages.every(page=>!page.includes('写真整理')));
});
test('unrelated apps remain allowed when contract apps are already present',()=>{
  let s=ready('JOB_E_006');s=perform(s,{type:'service',serviceId:'S01',axes:['install']});
  s=perform(s,{type:'install',app:'写真整理'});s=perform(s,{type:'install',app:'筆記'});
  assert.equal(recoveryIncoming(s),null);assert.ok(inspect(currentAttempt(s),c).every(r=>r.ok));
  assert.doesNotThrow(()=>dispatch(s,{type:'deliver'},c));
});
test('forbidden OS updates explain the irreversible contract history and offer a real retry once per pattern',()=>{
  let s=ready('JOB_D_001');const uid=currentAttempt(s).device_uid;
  s=perform(s,{type:'service',serviceId:'S03'});
  const e=recoveryIncoming(s);assert.equal(e.pattern,'forbidden-history');assert.ok(e.retry);
  assert.match(e.pages.join(''),/OS更新そのものが禁止/);assert.match(e.pages.join(''),/更新した履歴は取り消せない/);
  assert.equal(inspect(currentAttempt(s),c).find(r=>r.label==='禁止履歴：OS更新').ok,false);
  s=dispatch(s,{type:'recoveryCall',id:e.id},c);s=dispatch(s,{type:'recoveryRetry'},c);
  assert.notEqual(currentAttempt(s).device_uid,uid);assert.equal(currentAttempt(s).device.version,'1.0');
  s=perform(s,{type:'service',serviceId:'S03'});
  assert.ok(s.run.assistance.queue.every(e=>e.pattern!=='forbidden-history'));
  const manual=s.run.assistance.hints.find(e=>e.pattern==='forbidden-history');assert.ok(manual);
  s=dispatch(s,{type:'recoveryCall',id:manual.id},c);assert.deepEqual(s.run.assistance.active.pages,e.pages);
});
