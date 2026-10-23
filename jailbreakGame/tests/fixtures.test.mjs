import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,executeRoute,dispatch,currentAttempt,inspect,planRoutes,availableJobs} from '../src/core.mjs';
import {graduationPending} from '../src/tutorial.mjs';
const content=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url),'utf8'));

for(const job of content.jobs){
  for(let i=0;i<job.routes.length;i++){
    test(`${job.id} route ${String.fromCharCode(65+i)} reaches its contract`,()=>{
      const state=createGame(content,'2031748926501234');
      state.run.rank=state.run.poc_rank=state.run.equipment_rank=job.rank;state.run.cash=100000;
      const result=executeRoute(state,job,job.routes[i],content);
      assert.deepEqual(result.checks.filter(row=>!row.ok),[]);
      assert.ok(result.upfront>=0&&Number.isSafeInteger(result.upfront));
      assert.ok(result.attempt.device.family===job.family);
      assert.ok(result.attempt.log.length>0);
      assert.ok(result.attempt.runtime.pending===null);
    });
  }
}

test('fixture alternatives represent genuinely different operation sequences',()=>{
  for(const job of content.jobs){
    const routes=job.routes.map(route=>{
      const state=createGame(content);state.run.rank=state.run.poc_rank=state.run.equipment_rank=job.rank;state.run.cash=100000;
      const result=executeRoute(state,job,route,content);
      return JSON.stringify(result.attempt.log.map(step=>step.operation));
    });
    assert.equal(new Set(routes).size,routes.length,job.id);
  }
});

function completeCalls(state){
  if(graduationPending(state))state=dispatch(state,{type:'tutorialGraduationCall'},content);
  for(const id of [...state.run.pending_calls])state=dispatch(state,{type:'call',id},content);
  for(const rank of [...state.run.book_pending])state=dispatch(state,{type:'openCatalog',rank,kind:'both'},content);
  for(const [rank,received] of Object.entries(state.run.chapter_grants))if(received===false)state=dispatch(state,{type:'grant',rank:Number(rank),choice:'cash'},content);
  return state;
}
test('initial $400 tutorial has exact service and ownership economics',()=>{
  let state=createGame(content);
  for(const [jobId,route] of [['JOB_E_001','P01'],['JOB_E_002','dock S:install'],['JOB_E_003','S:root']]){
    state=dispatch(state,{type:'accept',jobId},content);
    state=executeRoute(state,jobId,route,content).state;
    state=dispatch(state,{type:'deliver'},content);
  }
  assert.equal(state.run.cash,711);assert.equal(state.run.eligible_reward_total,720);assert.equal(state.meta.sp_total_earned,3);
});

for(const seed of ['0000000000000001','0000000000000002','1111222233334444','8593184719205671']){
  test(`two training jobs and five regular deliveries need no support: seed ${seed}`,()=>{
    let state=createGame(content,seed);
    for(let i=0;i<7;i++){
      state=completeCalls(state);
      const jobs=state.run.inbox.map(id=>content.jobs.find(j=>j.id===id)).filter(j=>j.rank===state.run.rank);
      const options=jobs.flatMap(job=>planRoutes(state,job,content).filter(p=>p.valid&&p.upfront<=state.run.cash).map(p=>({job,plan:p})));
      assert.ok(options.length>0,`rank ${state.run.rank}, step ${i}, cash ${state.run.cash}, inbox ${state.run.inbox}`);
      options.sort((a,b)=>a.plan.upfront-b.plan.upfront||a.plan.operations-b.plan.operations);
      const choice=options[0];state=dispatch(state,{type:'accept',jobId:choice.job.id},content);
      state=executeRoute(state,choice.job,choice.plan.route,content).state;
      assert.ok(inspect(currentAttempt(state),content).every(row=>row.ok));
      state=dispatch(state,{type:'deliver'},content);assert.ok(state.run.cash>=0);
    }
    assert.equal(state.run.main_completed.length,5);assert.equal(state.run.support_total,0);
    assert.ok(state.meta.sp_total_earned>=3);
    const oldCash=state.run.cash,eligible=state.run.eligible_reward_total;
    state=dispatch(state,{type:'retire'},content);state=dispatch(state,{type:'rehire'},content);
    assert.equal(state.run.start_cash,400+Math.floor(eligible/2));
    assert.equal(state.run.cash,state.run.start_cash);assert.notEqual(state.run.cash,oldCash+400+Math.floor(eligible/2));
  });
}
