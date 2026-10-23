import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,dispatch,executeRoute,currentAttempt,planRoutes,endingOptions,carryLimits,preparationLimit,startingRank,progressLabel,quoteOperation} from '../src/core.mjs';
const c=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url),'utf8'));
function veteran(){
  const s=createGame(c,'5172346890136587');s.run.id=2;
  s.meta.learned_intro_ids=c.jobs.map(j=>j.id);s.meta.sp_total_earned=180;
  return s;
}
function rehire(skills,extra={}){
  let s=veteran();s.run.eligible_reward_total=10000;
  s=dispatch(s,{type:'retire'},c);s=dispatch(s,{type:'allocate',ids:skills},c);
  return dispatch(s,{type:'rehire',...extra},c);
}
function answerCalls(s){
  for(const id of [...s.run.pending_calls])s=dispatch(s,{type:'call',id},c);
  for(const rank of [...s.run.book_pending])s=dispatch(s,{type:'openCatalog',rank,kind:'both'},c);
  for(const [rank,received] of Object.entries(s.run.chapter_grants))if(received===false)s=dispatch(s,{type:'grant',rank:Number(rank),choice:'cash'},c);
  return s;
}
test('training deliveries do not consume the five regular contract slots',()=>{
  let s=createGame(c);assert.equal(progressLabel(s),'研修 0/2台');
  for(const [jobId,route] of [['JOB_E_001','P01'],['JOB_E_002','dock S:install']]){
    s=dispatch(s,{type:'accept',jobId},c);s=executeRoute(s,jobId,route,c).state;s=dispatch(s,{type:'deliver'},c);
    assert.equal(s.run.main_completed.length,0);
  }
  assert.equal(progressLabel(s),'納品 0/5件');assert.equal(s.run.completed.length,2);
});
test('starting-credit introductions cost 10 SP each and enforce ancestors',()=>{
  let s=veteran();s=dispatch(s,{type:'retire'},c);
  assert.throws(()=>dispatch(s,{type:'allocate',ids:['R3']},c),/前提/);
  s.meta.sp_total_earned=9;assert.throws(()=>dispatch(s,{type:'allocate',ids:['R2']},c),/SP/);
  for(let rank=2;rank<=5;rank++){
    const ids=Array.from({length:rank-1},(_,i)=>'R'+(i+2));
    assert.equal(ids.reduce((sum,id)=>sum+c.skills.find(s=>s.id===id).cost,0),10*(rank-1));
    const next=rehire(ids);assert.equal(startingRank(ids),rank);
    assert.equal(next.run.rank,rank);assert.equal(next.run.poc_rank,rank);assert.equal(next.run.equipment_rank,rank);
    assert.ok(next.run.completed_calls.includes('CALL01'));assert.equal(progressLabel(next),'納品 0/5件');
    const jobs=next.run.inbox.map(id=>c.jobs.find(j=>j.id===id));
    assert.ok(jobs.some(j=>j.rank===rank));assert.ok(jobs.some(j=>j.family==='KomaOS'));
    assert.ok(jobs.every(j=>planRoutes(next,j,c).some(p=>p.valid&&p.upfront<=next.run.cash)));
  }
});
for(const [skills,expected] of [[['R2'],['D','C','B','A','A']],[['R2','R3','R4','R5'],['A','A','A','A','A']]]){
  test(`starting credit ${skills.at(-1)} still completes exactly five regular jobs`,()=>{
    let s=rehire(skills);const grades=[];
    for(let i=0;i<5;i++){
      s=answerCalls(s);
      const options=s.run.inbox.map(id=>c.jobs.find(j=>j.id===id)).filter(j=>j.rank===s.run.rank).flatMap(job=>planRoutes(s,job,c).filter(p=>p.valid&&p.upfront<=s.run.cash).map(plan=>({job,plan}))).sort((a,b)=>a.plan.upfront-b.plan.upfront);
      assert.ok(options.length,`${s.run.rank}: ${s.run.inbox}`);
      const {job,plan}=options[0];grades.push(job.grade);
      s=dispatch(s,{type:'accept',jobId:job.id},c);s=executeRoute(s,job,plan.route,c).state;s=dispatch(s,{type:'deliver'},c);
      assert.equal(s.run.main_completed.length,i+1);
      assert.ok(!s.run.pending_calls.includes('CALL01'));
    }
    assert.deepEqual(grades,expected);assert.equal(progressLabel(s),'納品 5/5件');
    assert.ok(endingOptions(s,c).find(e=>e.id==='END_TRAINING').available);
    assert.ok(s.run.pending_calls.includes('CALL06'));assert.equal(s.run.support_total,0);
  });
}
test('media/equipment buyout supports two items, upgraded four, and legacy singular saves',()=>{
  const pocIds=['P02','P03','P04','P05'],equipmentIds=['M02','M03','M04','M05'];
  const retired=()=>{let s=veteran();s.run.owned_pocs.push(...pocIds);s.run.owned_equipment.push(...equipmentIds);s.meta.proven_owned_item_ids=[...pocIds,...equipmentIds];return dispatch(s,{type:'retire'},c);};
  let s=dispatch(retired(),{type:'allocate',ids:['A1','A2']},c);
  assert.deepEqual(carryLimits(s.meta.skill_allocations),{pocs:2,equipment:2});
  assert.throws(()=>dispatch(s,{type:'rehire',pocIds:pocIds.slice(0,3)},c),/媒体/);
  const two=dispatch(s,{type:'rehire',pocIds:pocIds.slice(0,2),equipmentIds:equipmentIds.slice(0,2)},c);
  assert.deepEqual(two.run.owned_pocs,['P01',...pocIds.slice(0,2)]);assert.deepEqual(two.run.owned_equipment,['M01',...equipmentIds.slice(0,2)]);
  assert.ok(dispatch(s,{type:'rehire',pocId:'P02',equipmentId:'M02'},c).run.owned_pocs.includes('P02'));
  s=dispatch(retired(),{type:'allocate',ids:['A1','A2','A4','A5']},c);
  const four=dispatch(s,{type:'rehire',pocIds,equipmentIds},c);assert.deepEqual(carryLimits(s.meta.skill_allocations),{pocs:4,equipment:4});
  assert.ok(pocIds.every(id=>four.run.owned_pocs.includes(id)));assert.ok(equipmentIds.every(id=>four.run.owned_equipment.includes(id)));
});
test('old twelve-slot saves migrate progress without changing accepted work, earnings or skills',()=>{
  let s=veteran();s=dispatch(s,{type:'accept',jobId:'JOB_E_004'},c);
  delete s.run.progress_version;delete s.run.progress_start_rank;
  s.run.completed=s.run.main_completed=['JOB_E_001','JOB_E_002','JOB_E_003','JOB_D_001','JOB_D_003','JOB_C_001','JOB_C_003'];
  s.run.rank=3;s.run.skills=['A1','B1'];s.run.cash=1547;s.run.eligible_reward_total=2200;
  const attempts=structuredClone(s.run.attempts);s=dispatch(s,{type:'mailboxRefresh'},c);
  assert.deepEqual(s.run.main_completed,['JOB_E_001','JOB_E_002','JOB_E_003','JOB_D_001','JOB_D_003']);assert.deepEqual(s.run.attempts,attempts);
  assert.equal(s.run.cash,1547);assert.equal(s.run.eligible_reward_total,2200);assert.deepEqual(s.run.skills,['A1','B1']);
  assert.equal(s.run.progress_version,2);assert.ok(s.run.pending_calls.includes('CALL04'));
});
test('automatic preparation chooses required compatible media, with four-slot alternate-version preparation',()=>{
  let s=veteran();s.run.skills=['B1'];s.run.owned_pocs=c.pocs.map(p=>p.id);
  s=dispatch(s,{type:'accept',jobId:'JOB_E_004'},c);
  assert.equal(preparationLimit(s),2);assert.equal(s.run.prepared.length,2);assert.equal(s.run.prepared[0],'P06');
  assert.ok(s.run.prepared.every(id=>{const p=c.pocs.find(p=>p.id===id);return p.family===currentAttempt(s).device.family&&p.versions.includes(currentAttempt(s).device.version);}));
  s.run.skills.push('B4');s=dispatch(s,{type:'select',attemptId:s.run.active_id},c);assert.equal(preparationLimit(s),4);assert.equal(s.run.prepared.length,4);
  assert.equal(s.run.prepared[0],'P06');assert.ok(s.run.prepared.every(id=>c.pocs.find(p=>p.id===id).family==='KomaOS'));
});
test('new preparation and duplicate skills have real effects without extra equipment',()=>{
  let s=veteran();s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);s=dispatch(s,{type:'insert',pocId:'P01'},c);
  const normal=quoteOperation(s,{type:'poc'},c);s.run.skills=['C1','C2','C4'];
  const fast=quoteOperation(s,{type:'poc'},c);assert.equal(fast.duration,Math.ceil(normal.duration*.75));assert.equal(fast.cost,normal.cost);
  assert.throws(()=>dispatch(s,{type:'duplicate',pocId:'P01'},c),/複製器/);
  s.run.skills=['D1','D2','D3','D4'];s=dispatch(s,{type:'duplicate',pocId:'P01'},c);assert.equal(s.run.copies.P01,2);assert.ok(!s.run.owned_equipment.includes('M08'));
  s=dispatch(s,{type:'accept',jobId:'JOB_E_004'},c);s=dispatch(s,{type:'insert',pocId:'P01',instance:1},c);assert.equal(currentAttempt(s).runtime.media[0].instance,1);
});
test('two-contract reservations remain useful when each rank has only one main slot',()=>{
  let s=veteran();s.run.skills=['D1','D2'];s=dispatch(s,{type:'reserve',jobIds:['JOB_E_001','JOB_E_004']},c);
  assert.deepEqual(new Set(s.run.reserved),new Set(['JOB_E_001','JOB_E_004']));
  s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);s=executeRoute(s,'JOB_E_001','P01',c).state;s=dispatch(s,{type:'deliver'},c);
  assert.ok(s.run.inbox.includes('JOB_E_004'));assert.equal(s.run.main_completed.length,1);
});
test('familiar lower-rank work counts toward all five deliveries, without repeat farming',()=>{
  let s=rehire(['R2','R3','R4','R5']);
  for(const jobId of ['JOB_E_001','JOB_E_003','JOB_E_004','JOB_E_005','JOB_E_007']){
    const plan=planRoutes(s,jobId,c).find(p=>p.valid&&p.upfront<=s.run.cash);assert.ok(plan,jobId);
    s=dispatch(s,{type:'accept',jobId},c);s=executeRoute(s,jobId,plan.route,c).state;s=dispatch(s,{type:'deliver'},c);
  }
  assert.equal(s.run.main_completed.length,5);assert.equal(progressLabel(s),'納品 5/5件');
  const cash=s.run.cash;s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);s=executeRoute(s,'JOB_E_001','P01',c).state;s=dispatch(s,{type:'deliver'},c);
  assert.equal(s.run.main_completed.length,5);assert.equal(s.run.cash,cash);assert.ok(s.run.pending_calls.includes('CALL06'));
});
