import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,dispatch,executeRoute,planRoutes,currentAttempt} from '../src/core.mjs';
const c=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url),'utf8'));
function veteran(cash=400){
  let s=createGame(c,'3141592653589793');s.run.id=2;s.run.cash=cash;
  s.meta.learned_intro_ids=c.jobs.map(j=>j.id);s.run.inbox_policy_version=0;
  return dispatch(s,{type:'mailboxRefresh'},c);
}
test('opening the PC or requesting old shuffle never rerolls offers',()=>{
  let s=veteran(),inbox=[...s.run.inbox],revision=s.run.inbox_revision;
  for(let i=0;i<8;i++){
    s=dispatch(s,{type:'shuffle'},c);s=dispatch(s,{type:'mailboxRefresh'},c);
    assert.deepEqual(s.run.inbox,inbox);assert.equal(s.run.inbox_revision,revision);
  }
  s=dispatch(s,{type:'openCatalog',rank:1,kind:'both'},c);
  assert.deepEqual(s.run.inbox,inbox);assert.equal(s.run.inbox_revision,revision);
});
test('every advertised contract has an affordable feasible path; reduced funds only prune the same batch',()=>{
  let s=veteran(150);assert.ok(s.run.inbox.length>1);assert.ok(!s.run.inbox.includes('JOB_E_002'));
  for(const id of s.run.inbox)assert.ok(planRoutes(s,id,c).some(p=>p.valid&&p.upfront<=150),id);
  const old=[...s.run.inbox],revision=s.run.inbox_revision;s.run.cash=0;
  s=dispatch(s,{type:'mailboxRefresh'},c);
  assert.deepEqual(s.run.inbox,old.filter(id=>planRoutes(s,id,c).some(p=>p.valid&&p.upfront===0)));
  assert.equal(s.run.inbox_revision,revision);
  assert.ok(s.run.inbox.every(id=>old.includes(id)));
});
test('only a real delivery advances the offer batch, practice does not',()=>{
  let s=veteran(),revision=s.run.inbox_revision;
  s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);s=executeRoute(s,'JOB_E_001','P01',c).state;s=dispatch(s,{type:'deliver'},c);
  assert.equal(s.run.inbox_revision,revision+1);
  const inbox=[...s.run.inbox];revision=s.run.inbox_revision;
  s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);s=executeRoute(s,'JOB_E_001','P01',c).state;s=dispatch(s,{type:'deliver'},c);
  assert.equal(s.run.inbox_revision,revision);assert.deepEqual(s.run.inbox,inbox);
});
test('full reception refuses another contract without changing accepted work or selection',()=>{
  let s=veteran();s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);
  const before=JSON.stringify(s),id=s.run.active_id;
  assert.throws(()=>dispatch(s,{type:'accept',jobId:'JOB_E_004'},c),/受付が満杯/);
  assert.equal(JSON.stringify(s),before);assert.equal(currentAttempt(s).id,id);
  s=dispatch(s,{type:'mailboxRefresh'},c);assert.equal(currentAttempt(s).id,id);assert.equal(s.run.attempts.length,1);
});
test('a second reception slot keeps both physical devices and can reselect the first',()=>{
  let s=veteran();s.run.owned_equipment.push('M12');s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);
  const first=structuredClone(currentAttempt(s));s=dispatch(s,{type:'accept',jobId:'JOB_E_004'},c);
  assert.equal(s.run.attempts.length,2);assert.deepEqual(s.run.attempts[0],first);
  s=dispatch(s,{type:'select',attemptId:first.id},c);assert.deepEqual(currentAttempt(s),first);
});
test('abandon restores only the returned contract without refreshing unrelated offers',()=>{
  let s=veteran();const jobId=s.run.inbox[0],old=[...s.run.inbox],revision=s.run.inbox_revision;
  s=dispatch(s,{type:'accept',jobId},c);s=dispatch(s,{type:'abandon'},c);
  assert.deepEqual(s.run.inbox,old);assert.equal(s.run.inbox_revision,revision);
});
test('older saved inboxes migrate once, preserving accepted devices and then staying fixed',()=>{
  let s=veteran();s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);delete s.run.inbox_policy_version;s.run.inbox=['JOB_E_002'];s.run.cash=0;
  const accepted=structuredClone(s.run.attempts);s=dispatch(s,{type:'mailboxRefresh'},c);
  assert.deepEqual(s.run.attempts,accepted);assert.equal(s.run.inbox_policy_version,2);assert.ok(!s.run.inbox.includes('JOB_E_002'));
  const inbox=[...s.run.inbox];s=dispatch(s,{type:'mailboxRefresh'},c);assert.deepEqual(s.run.inbox,inbox);
});
