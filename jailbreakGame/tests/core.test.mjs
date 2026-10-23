import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,dispatch,currentAttempt,inspect,executeRoute,quoteOperation,endingOptions,previewContract} from '../src/core.mjs';
import {saveGame,loadGame,exportSave,importSave} from '../src/storage.mjs';
import {socketGeometry,DIRECTIONS} from '../src/physical.mjs';
const c=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url),'utf8'));
function ready(jobId='JOB_E_001'){
  let s=createGame(c,'3187502468915032');s.run.id=2;s.run.rank=s.run.poc_rank=s.run.equipment_rank=5;s.run.cash=50000;
  s.meta.learned_intro_ids=c.jobs.map(j=>j.id);s.meta.history=c.jobs.map(j=>({grade:j.grade,practice:false}));
  s.run.owned_equipment=c.equipment.map(e=>e.id);s.run.owned_pocs=c.pocs.map(p=>p.id);
  return dispatch(s,{type:'accept',jobId},c);
}
function op(s,operation){s=dispatch(s,{type:'start',operation,confirmed:true},c);return dispatch(s,{type:'tick',ms:10000},c);}
function finish(s){while(currentAttempt(s)?.runtime.pending)s=dispatch(s,{type:'tick',ms:10000},c);return s;}
function route(s,text){return executeRoute(s,currentAttempt(s).job,text,c).state;}
test('T01/T19: insert is physical preparation, inspection is pure, delivery pays once',()=>{
  let s=createGame(c);s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);s=dispatch(s,{type:'insert',pocId:'P01'},c);
  assert.equal(currentAttempt(s).device.security.root,false);
  const before=JSON.stringify(s);inspect(currentAttempt(s),c);inspect(currentAttempt(s),c);assert.equal(JSON.stringify(s),before);
  s=op(s,{type:'poc'});s=dispatch(s,{type:'deliver'},c);assert.equal(s.run.cash,580);assert.equal(s.meta.sp_total_earned,1);
  assert.throws(()=>dispatch(s,{type:'deliver'},c));
});
test('T02: opening root does not open install and violates E002 return conditions',()=>{
  let s=ready('JOB_E_002');s=route(s,'dock P01');assert.equal(currentAttempt(s).device.security.install,false);assert.ok(inspect(currentAttempt(s),c).some(r=>!r.ok));
});
test('T03/T04/T10: version compatibility and connector compatibility are independent',()=>{
  let s=ready('JOB_D_020');assert.throws(()=>dispatch(s,{type:'insert',pocId:'P02'},c),/USB/);
  s=op(s,{type:'adapter'});s=dispatch(s,{type:'insert',pocId:'P02'},c);s=dispatch(s,{type:'eject'},c);
  assert.throws(()=>dispatch(s,{type:'insert',pocId:'P03'},c),/KomaOS/);
  const d=c.jobs.find(j=>j.family==='MiraOS'&&j.version==='1.1');s=ready(d.id);assert.throws(()=>dispatch(s,{type:'insert',pocId:'P03'},c),/1.1/);
});
test('T09: docking does not repair the built-in display',()=>{let s=ready('JOB_E_011');s=op(s,{type:'dock'});assert.equal(currentAttempt(s).runtime.dock,true);assert.equal(currentAttempt(s).device.display,false);s=route(s,'P01');});
test('T11/T13: restored bytes do not erase the historical erase violation',()=>{
  let s=ready('JOB_D_004');s=op(s,{type:'backup',categories:['data','apps','settings']});const data=structuredClone(currentAttempt(s).device.data);
  const q=quoteOperation(s,{type:'reimage',development:true},c);assert.ok(q.warnings.some(w=>w.includes('禁止')));
  assert.throws(()=>dispatch(s,{type:'start',operation:{type:'reimage',development:true}},c),/確認/);
  s=op(s,{type:'reimage',development:true});s=op(s,{type:'restore',categories:['data','apps','settings']});assert.deepEqual(currentAttempt(s).device.data,data);assert.equal(currentAttempt(s).device.security.root,true);assert.ok(inspect(currentAttempt(s),c).some(r=>r.label.includes('禁止履歴')&&!r.ok));
});
test('T12: rescue reads dead hardware without repairing it',()=>{let s=ready('JOB_A_009');assert.throws(()=>quoteOperation(s,{type:'backup',categories:['data']},c),/起動/);s=op(s,{type:'rescue',categories:['data','apps','settings']});assert.equal(currentAttempt(s).device.operational,false);assert.ok(s.run.backups[currentAttempt(s).device_uid]);});
test('T14: updating preserves settings, closes all axes, and cannot downgrade',()=>{let s=ready('JOB_E_004');s=route(s,'P06 theme=custom');s=op(s,{type:'service',serviceId:'S03'});assert.equal(currentAttempt(s).device.settings.theme,'custom');assert.deepEqual(Object.values(currentAttempt(s).device.security),[false,false,false]);});
test('T15: offline contracts reject online services before mutation',()=>{const j=c.jobs.find(j=>j.network===false&&j.goal.version);let s=ready(j.id);const old=JSON.stringify(s);assert.throws(()=>op(s,{type:'service',serviceId:'S03'}),/通信/);assert.equal(JSON.stringify(s),old);s=op(s,{type:'update',offline:true});assert.equal(currentAttempt(s).device.history.network,0);});
test('T16: preset changes only attached settings and leaves feature closed',()=>{const j=c.jobs.find(j=>j.preset);let s=ready(j.id);s=op(s,{type:'preset'});assert.equal(currentAttempt(s).device.security.feature,false);for(const [k,v] of Object.entries(j.goal.settings))assert.equal(currentAttempt(s).device.settings[k],v);});
test('T17: management app needs root even after installation succeeds',()=>{const j=c.jobs.find(j=>j.goal.apps?.includes('管理アプリ'));let s=ready(j.id);s=route(s,j.routes[0]);s=op(s,{type:'lock',axis:'root'});assert.ok(inspect(currentAttempt(s),c).some(r=>r.label==='管理アプリの起動'&&!r.ok));});
test('T20/T24: interrupted operation commits its exact charge and effect once',()=>{let s=ready('JOB_E_002');const cash=s.run.cash,q=quoteOperation(s,{type:'service',serviceId:'S01',axes:['install']},c);s=dispatch(s,{type:'start',operation:q.operation},c);s=importSave(exportSave(s),c);s=finish(s);assert.equal(s.run.cash,cash-Math.ceil(240*.35));const after=JSON.stringify(s);s=dispatch(s,{type:'tick',ms:10000},c);assert.equal(JSON.stringify(s),after);});
test('T06/T07: call, catalogue and grant are separate and idempotent',()=>{let s=createGame(c);for(const [jobId,r] of [['JOB_E_001','P01'],['JOB_E_002','dock S:install'],['JOB_E_003','S:root']]){s=dispatch(s,{type:'accept',jobId},c);s=executeRoute(s,jobId,r,c).state;s=dispatch(s,{type:'deliver'},c);if(jobId==='JOB_E_002')s=dispatch(s,{type:'tutorialGraduationCall'},c);}assert.equal(s.run.rank,1);s=dispatch(s,{type:'call',id:'CALL02'},c);assert.equal(s.run.rank,2);assert.equal(s.run.poc_rank,1);s=dispatch(s,{type:'openCatalog',rank:2,kind:'poc'},c);assert.equal(s.run.poc_rank,2);assert.equal(s.run.equipment_rank,1);s=dispatch(s,{type:'grant',rank:2,choice:'cash'},c);const cash=s.run.cash;s=dispatch(s,{type:'call',id:'CALL02'},c);assert.equal(s.run.cash,cash);assert.throws(()=>dispatch(s,{type:'grant',rank:2,choice:'cash'},c));});
test('T22/T37: a second desk cannot use an occupied physical instance without duplication',()=>{let s=ready('JOB_E_001');s.run.skills=['D1','D2','D3'];s=dispatch(s,{type:'insert',pocId:'P01'},c);s=dispatch(s,{type:'accept',jobId:'JOB_E_002'},c);assert.throws(()=>dispatch(s,{type:'insert',pocId:'P01'},c),/使用中/);s=dispatch(s,{type:'duplicate',pocId:'P01'},c);s=dispatch(s,{type:'insert',pocId:'P01',instance:1},c);assert.equal(currentAttempt(s).runtime.media[0].instance,1);});
test('T31/T47/T48: pending retirement settles once and only last-run eligible rewards carry',()=>{let s=ready();s.run.eligible_reward_total=1001;s=dispatch(s,{type:'insert',pocId:'P01'},c);s=dispatch(s,{type:'start',operation:{type:'poc'}},c);s=dispatch(s,{type:'retire'},c);assert.equal(s.run.status,'active');s=finish(s);assert.equal(s.run.status,'retired');assert.equal(s.meta.sp_total_earned,0);s=dispatch(s,{type:'rehire'},c);assert.equal(s.run.cash,900);assert.throws(()=>dispatch(s,{type:'rehire'},c));s=dispatch(s,{type:'retire'},c);s=dispatch(s,{type:'rehire'},c);assert.equal(s.run.cash,400);});
test('T32/T49: repeat practice gives neither reward nor SP',()=>{let s=ready('JOB_E_001');s=route(s,'P01');s=dispatch(s,{type:'deliver'},c);const sp=s.meta.sp_total_earned,cash=s.run.cash;s=dispatch(s,{type:'accept',jobId:'JOB_E_001'},c);s=route(s,'P01');s=dispatch(s,{type:'deliver'},c);assert.equal(s.meta.sp_total_earned,sp);assert.equal(s.run.cash,cash);});
test('T33: allocations require ancestors, fit total SP and freeze at rehire',()=>{let s=createGame(c);s.run.id=2;s.meta.sp_total_earned=10;s=dispatch(s,{type:'retire'},c);assert.throws(()=>dispatch(s,{type:'allocate',ids:['A3']},c),/前提/);s=dispatch(s,{type:'allocate',ids:['A1','A2','B1','B2','F1']},c);s=dispatch(s,{type:'rehire'},c);assert.ok(s.run.skills.includes('F1'));assert.throws(()=>dispatch(s,{type:'allocate',ids:[]},c));});
test('T34/T35: surrender needs meaningful delivery and lifetime reward cannot repeat',()=>{let s=ready('JOB_D_001');assert.throws(()=>dispatch(s,{type:'surrender',pocId:'P03'},c),/実質的/);s=route(s,'P03');s=dispatch(s,{type:'deliver'},c);const cash=s.run.cash;s=dispatch(s,{type:'surrender',pocId:'P03'},c);assert.equal(s.run.cash,cash+330);assert.throws(()=>dispatch(s,{type:'buy',id:'P03'},c),/買い直/);s=dispatch(s,{type:'retire'},c);s=dispatch(s,{type:'rehire'},c);s.run.poc_rank=2;s.run.cash=1000;s=dispatch(s,{type:'buy',id:'P03'},c);assert.equal(s.run.cash,780);assert.throws(()=>dispatch(s,{type:'surrender',pocId:'P03'},c),/生涯/);});
test('T36: composite stages are sequential and retirement retains only committed effects',()=>{let s=ready('JOB_D_002');s.run.skills=['B1','B2','B3'];s=dispatch(s,{type:'insert',pocIds:['P08','P10','P12']},c);s=dispatch(s,{type:'start',operation:{type:'poc'},confirmed:true},c);s=dispatch(s,{type:'tick',ms:1500},c);assert.equal(currentAttempt(s).device.security.root,true);assert.equal(currentAttempt(s).device.security.install,false);assert.ok(currentAttempt(s).runtime.pending);});
test('T39: every authored socket is visible in some but not all eight views',()=>{assert.equal(DIRECTIONS.length,8);for(const model of c.devices)for(const port of model.ports){const gs=DIRECTIONS.map((_,i)=>socketGeometry(model,port,i,{x:0,y:0,w:500,h:500}));assert.ok(gs.some(g=>g.visible),model.id);if(gs[0].face!=='top')assert.ok(gs.some(g=>!g.visible),model.id);assert.ok(gs.every(g=>Number.isFinite(g.x)&&Number.isFinite(g.y)));}});
test('T45/T46: seven optional endings include unconditional resignation and no arrest event',()=>{const s=createGame(c),opts=endingOptions(s,c);assert.equal(opts.length,7);assert.equal(opts.filter(e=>e.available).length,1);assert.equal(opts[0].id,'END_FREE');assert.ok(!opts.some(e=>e.id.includes('ARREST')));});
test('contract preview covers all jobs without requiring a real acceptance',()=>{for(const job of c.jobs){const a=previewContract(c,job);assert.equal(a.job_id,job.id);assert.ok(inspect(a,c).length>=2);}});
class Memory {constructor(){this.map=new Map();this.fail=null;}getItem(k){return this.map.get(k)??null;}setItem(k,v){if(this.fail===k)throw new Error('write failed');this.map.set(k,v);}}
test('atomic storage: a failed head publication preserves the committed save',()=>{const mem=new Memory(),s=createGame(c);saveGame(s,mem,'x');const old=exportSave(loadGame(c,mem,'x').state);mem.fail='x:head';const next=structuredClone(s);next.run.cash=777;assert.throws(()=>saveGame(next,mem,'x'));assert.equal(exportSave(loadGame(c,mem,'x').state),old);});
test('atomic storage: a corrupted active slot recovers the previous valid state',()=>{const mem=new Memory(),s=createGame(c);saveGame(s,mem,'x');const next=structuredClone(s);next.run.cash=777;saveGame(next,mem,'x');mem.map.set('x:slot:'+mem.getItem('x:head'),'broken');const loaded=loadGame(c,mem,'x');assert.equal(loaded.recovered,true);assert.equal(loaded.state.run.cash,400);assert.throws(()=>importSave(exportSave(next).replace('777','778'),c),/照合/);});
