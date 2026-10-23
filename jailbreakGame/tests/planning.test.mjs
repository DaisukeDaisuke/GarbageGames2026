import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,dispatch,currentAttempt,quoteOperation,executeRoute,planRoutes} from '../src/core.mjs';
import {simulatePlan,planningChoices} from '../src/planning.mjs';
const c=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url)));
function ready(job='JOB_E_001'){let s=createGame(c);s.run.id=2;s.run.rank=s.run.poc_rank=s.run.equipment_rank=5;s.run.cash=10000;s.meta.learned_intro_ids=c.jobs.map(j=>j.id);s.run.owned_equipment=c.equipment.map(e=>e.id);s.run.owned_pocs=c.pocs.map(p=>p.id);return dispatch(s,{type:'accept',jobId:job},c);}
test('C2 simulation uses real operations and leaves real objects, cash and history untouched',()=>{
  let s=ready(),before=JSON.stringify(s);
  const result=simulatePlan(s,[{type:'insert',pocId:'P01'},{type:'start',operation:{type:'poc'}}],c);
  assert.equal(JSON.stringify(s),before);assert.equal(result.error,null);assert.ok(result.checks.every(r=>r.ok));assert.equal(s.run.history.length,0);
  assert.throws(()=>simulatePlan(s,[{type:'deliver'}],c),/試算/);
});
test('C2 reports destructive history even if final data can be restored',()=>{
  const s=ready('JOB_D_004'),result=simulatePlan(s,[{type:'start',operation:{type:'backup',categories:['data','apps','settings']}},{type:'start',operation:{type:'reimage',development:true}},{type:'start',operation:{type:'restore',categories:['data','apps','settings']}}],c);
  assert.equal(result.error,null);assert.ok(result.steps[1].warnings.length);assert.ok(result.checks.some(r=>r.label.includes('禁止履歴')&&!r.ok));
});
test('C2 does not invent an owned medium or an unlocked catalogue',()=>{
  let s=createGame(c);s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);
  assert.ok(!planningChoices(s,c,'buy').some(x=>x.action.id==='P30'));
  assert.match(simulatePlan(s,[{type:'insert',pocId:'P02'}],c).error,/所有/);
});
test('composite preview includes a forbidden root unlock in its second child',()=>{
  let s=ready('JOB_E_002');s=executeRoute(s,'JOB_E_002','dock',c).state;s.run.skills=['B1','B2','B3'];currentAttempt(s).job.forbid=['root'];s=dispatch(s,{type:'insert',pocIds:['P02','P01']},c);
  const q=quoteOperation(s,{type:'poc'},c);assert.equal(q.stages.length,2);assert.equal(q.totalDuration,2400);assert.ok(q.warnings.some(w=>w.includes('管理者')));
  assert.throws(()=>dispatch(s,{type:'start',operation:{type:'poc'}},c),/確認/);
});
test('C3 current-state candidates preserve already applied work and do not reset history',()=>{
  let s=ready();s=executeRoute(s,'JOB_E_001','P01',c).state;const ps=planRoutes(s,'JOB_E_001',c,{current:true});assert.ok(ps.some(p=>p.valid&&p.upfront===0&&p.operations===0));
  currentAttempt(s).job.forbid=['root'];const job={...currentAttempt(s).job};assert.ok(!planRoutes(s,job,c,{current:true}).some(p=>p.valid));
});
test('M15 waits for actual inserted media and advances only after completion',()=>{
  let s=ready();s=executeRoute(s,'JOB_E_001','P01',c).state;s=dispatch(s,{type:'deliver'},c);s=dispatch(s,{type:'saveRecipe',jobId:'JOB_E_001'},c);s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);s=dispatch(s,{type:'replayRecipe',recipeId:'recipe:JOB_E_001'},c);
  s=dispatch(s,{type:'recipeAuto',enabled:true},c);assert.equal(currentAttempt(s).runtime.pending,null);assert.match(currentAttempt(s).runtime.recipe.paused,/媒体/);
  s=dispatch(s,{type:'insert',pocId:'P01'},c);s=dispatch(s,{type:'recipeAuto',enabled:true},c);assert.equal(currentAttempt(s).runtime.recipe.index,0);s=dispatch(s,{type:'tick',ms:2400},c);assert.equal(currentAttempt(s).runtime.recipe.index,1);assert.equal(currentAttempt(s).device.security.root,true);
  assert.throws(()=>dispatch(s,{type:'replayRecipe',recipeId:'recipe:JOB_E_001'},c),/開始状態/);
});
test('M15 stops before a paid service instead of silently charging it',()=>{
  let s=ready('JOB_E_002');s=executeRoute(s,'JOB_E_002','S:install',c).state;s=dispatch(s,{type:'deliver'},c);s=dispatch(s,{type:'saveRecipe',jobId:'JOB_E_002'},c);s=dispatch(s,{type:'accept',jobId:'JOB_E_002'},c);s=dispatch(s,{type:'replayRecipe',recipeId:'recipe:JOB_E_002'},c);const cash=s.run.cash;s=dispatch(s,{type:'recipeAuto',enabled:true},c);
  assert.equal(s.run.cash,cash);assert.equal(currentAttempt(s).runtime.pending,null);assert.match(currentAttempt(s).runtime.recipe.paused,/確認/);
});
