import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {socketGeometry} from '../src/physical.mjs';
import {createGame,dispatch,currentAttempt} from '../src/core.mjs';
const c=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url)));
const surfaces=JSON.parse(readFileSync(new URL('../assets/surfaces.json',import.meta.url)));
test('support-issued SD fits the front-visible Folio slot and remains removable',()=>{
  let state=createGame(c);state.run.id=2;state.run.rank=state.run.poc_rank=state.run.equipment_rank=3;
  state.run.chapter_grants[3]=false;state.run.cash=5000;state.meta.learned_intro_ids=c.jobs.map(j=>j.id);
  state=dispatch(state,{type:'accept',jobId:'JOB_C_001'},c);
  const a=currentAttempt(state),poc=c.pocs.find(p=>p.family===a.device.family&&p.versions.includes(a.device.version)&&p.axis==='root');
  state=dispatch(state,{type:'grant',rank:3,choice:poc.id},c);
  const model=c.devices.find(d=>d.id===a.hardware_model_id),g=socketGeometry(model,model.ports[0],0,{x:100,y:200,w:500,h:400},surfaces[model.id].ports[0]);
  assert.equal(g.visible,true);assert.ok(g.y>550,'slot should be on the lower casing, not the keyboard');
  state=dispatch(state,{type:'insert',pocId:poc.id,portIndex:0},c);assert.equal(currentAttempt(state).runtime.media[0].pocId,poc.id);
  state=dispatch(state,{type:'eject'},c);assert.equal(currentAttempt(state).runtime.media.length,0);
});
test('calibrated laptop sockets move with their visible casing across all eight views',()=>{
  const model=c.devices.find(d=>d.id==='H_E_006');
  for(let i=0;i<2;i++)for(let view=0;view<8;view++){
    const calibration=surfaces[model.id].ports[i],g=socketGeometry(model,model.ports[i],view,{x:50,y:30,w:500,h:350},calibration);
    assert.equal(g.visible,!!calibration.views[view]);
    if(g.visible){assert.ok(g.y>300);assert.ok(Math.abs(Math.hypot(g.nx,g.ny)-1)<1e-9);}
  }
});
