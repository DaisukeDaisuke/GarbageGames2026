import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame,dispatch,currentAttempt,executeRoute,inspect} from '../src/core.mjs';
import {exportSave,importSave} from '../src/storage.mjs';
import {recoveryIncoming} from '../src/recovery.mjs';
import {FIRST_JOB,SECOND_JOB,REPAIR_PAGES,WRONG_PURCHASE_CALL,tutorialStatus,initialMediaVisible,graduationPending,tutorialRetirementBlocked,wrongPurchaseInFreeTutorial,wrongPurchaseCallPending,queueWrongPurchaseCall,finishWrongPurchaseCall} from '../src/tutorial.mjs';
const c=JSON.parse(fs.readFileSync(new URL('../data/content.json',import.meta.url)));
test('first repair guidance follows actual insertion, execution, ejection and delivery',()=>{
  let s=createGame(c);assert.equal(tutorialStatus(s).phase,'welcome');
  for(let i=0;i<4;i++)s=dispatch(s,{type:'introNext'},c);
  assert.equal(tutorialStatus(s).phase,'contract');
  assert.throws(()=>dispatch(s,{type:'tutorialBriefingNext'},c),/届いて/);
  s=dispatch(s,{type:'accept',jobId:FIRST_JOB},c);assert.equal(tutorialStatus(s).phase,'briefing');
  for(const page of REPAIR_PAGES)s=dispatch(s,{type:'tutorialBriefingNext'},c);
  assert.equal(tutorialStatus(s).phase,'insert');
  s=dispatch(s,{type:'insert',pocId:'P01'},c);assert.equal(tutorialStatus(s).phase,'execute');
  s=dispatch(s,{type:'start',operation:{type:'poc'},confirmed:true},c);assert.equal(tutorialStatus(s).phase,'processing');
  s=dispatch(s,{type:'tick',ms:2400},c);assert.equal(tutorialStatus(s).phase,'eject');
  s=dispatch(s,{type:'eject'},c);assert.equal(tutorialStatus(s).phase,'inspect');
  s=dispatch(s,{type:'deliver'},c);assert.equal(tutorialStatus(s).phase,'followup-call');
  s=dispatch(s,{type:'shuffle'},c);assert.equal(tutorialStatus(s).phase,'followup-call');assert.ok(s.run.pending_calls.includes('CALL01'));
  s=dispatch(s,{type:'call',id:'CALL01'},c);assert.equal(tutorialStatus(s).phase,'next-order');
  s=dispatch(s,{type:'accept',jobId:'JOB_E_002'},c);assert.equal(tutorialStatus(s).phase,'buy-poc');
  s=dispatch(s,{type:'buy',id:'P02'},c);assert.equal(tutorialStatus(s).phase,'buy-equipment');
  s=dispatch(s,{type:'buy',id:'M02'},c);assert.equal(tutorialStatus(s).phase,'second-dock');assert.equal(s.run.cash,200);
  assert.equal(currentAttempt(s).device.display,false);
  s=dispatch(s,{type:'start',operation:{type:'dock'}},c);assert.equal(tutorialStatus(s).phase,'second-docking');
  s=dispatch(s,{type:'tick',ms:2400},c);assert.equal(tutorialStatus(s).phase,'second-insert');assert.equal(currentAttempt(s).device.display,false);
  s=dispatch(s,{type:'insert',pocId:'P02'},c);assert.equal(tutorialStatus(s).phase,'second-execute');
  s=dispatch(s,{type:'start',operation:{type:'poc'},confirmed:true},c);assert.equal(tutorialStatus(s).phase,'second-processing');
  s=dispatch(s,{type:'tick',ms:2400},c);assert.equal(tutorialStatus(s).phase,'second-eject');
  s=dispatch(s,{type:'eject'},c);assert.equal(tutorialStatus(s).phase,'second-inspect');
  s=dispatch(s,{type:'deliver'},c);assert.equal(tutorialStatus(s).phase,'graduation-call');
  s=dispatch(s,{type:'tutorialGraduationCall'},c);assert.equal(tutorialStatus(s).phase,'done');
});

function deliverTwo(){
  let s=createGame(c);
  s=executeRoute(s,FIRST_JOB,'P01',c).state;s=dispatch(s,{type:'deliver'},c);
  s=dispatch(s,{type:'call',id:'CALL01'},c);
  s=executeRoute(s,SECOND_JOB,'dock P02',c).state;
  assert.equal(currentAttempt(s).device.display,false);
  assert.ok(inspect(currentAttempt(s),c).every(row=>row.ok));
  return dispatch(s,{type:'deliver'},c);
}
test('KomaOS 2.0 independent tutorial cancels irrelevant purchases and persists a single warning call',()=>{
  let s=createGame(c);
  assert.equal(wrongPurchaseInFreeTutorial(s,'P05'),false,'regular purchases are unaffected before the independent tutorial');
  s=dispatch(deliverTwo(),{type:'tutorialGraduationCall'},c);
  assert.equal(s.run.tutorial.independentActive,true);
  const initialCash=s.run.cash,initialPocs=[...s.run.owned_pocs],initialEquipment=[...s.run.owned_equipment];
  for(const itemId of ['P02','P05','P06','P07','M02','M03'])assert.equal(wrongPurchaseInFreeTutorial(s,itemId),true,itemId);
  assert.equal(wrongPurchaseInFreeTutorial(s,'P04'),false,'the required PoC is still purchasable');
  s=queueWrongPurchaseCall(s);
  assert.equal(wrongPurchaseCallPending(s),true);
  assert.equal(s.run.cash,initialCash,'canceling the purchase spends no money');
  assert.deepEqual(s.run.owned_pocs,initialPocs);
  assert.deepEqual(s.run.owned_equipment,initialEquipment);
  s=importSave(exportSave(s),c);
  assert.equal(wrongPurchaseCallPending(s),true,'the incoming call survives reload');
  assert.ok(WRONG_PURCHASE_CALL.pages.join('').includes('私側で引き受けている'));
  s=finishWrongPurchaseCall(s);
  assert.equal(wrongPurchaseCallPending(s),false);
  assert.equal(s.run.tutorial.wrongPurchaseCallHeard,true,'repeat attempts need not ring again');
  s=dispatch(s,{type:'accept',jobId:'JOB_E_003'},c);
  assert.equal(wrongPurchaseInFreeTutorial(s,'M02'),true,'the warning still applies after accepting the job');
  s=dispatch(s,{type:'buy',id:'P04'},c);
  assert.equal(s.run.cash,initialCash-260);
  assert.ok(s.run.owned_pocs.includes('P04'));
  s=executeRoute(s,'JOB_E_003','P04',c).state;
  s=dispatch(s,{type:'deliver'},c);
  assert.equal(wrongPurchaseInFreeTutorial(s,'P05'),false,'other purchases work normally after the independent tutorial');
});
test('broken second screen requires the dock for local operations, without requiring screen repair',()=>{
  let s=createGame(c);s=executeRoute(s,FIRST_JOB,'P01',c).state;s=dispatch(s,{type:'deliver'},c);
  s=dispatch(s,{type:'accept',jobId:SECOND_JOB},c);s=dispatch(s,{type:'buy',id:'P02'},c);s=dispatch(s,{type:'insert',pocId:'P02'},c);
  assert.throws(()=>dispatch(s,{type:'start',operation:{type:'poc'},confirmed:true},c),/画面/);
  assert.equal(currentAttempt(s).device.display,false);
  const before=structuredClone(currentAttempt(s));
  const restored=importSave(exportSave(s),c);assert.deepEqual(currentAttempt(restored),before);
  // An already accepted pre-update device retains its own saved hardware state.
  currentAttempt(s).device.display=true;currentAttempt(s).snapshot.display=true;
  assert.equal(currentAttempt(importSave(exportSave(s),c)).device.display,true);
});
test('graduation survives reload, is heard once, and ordinary calls wait for one further real delivery',()=>{
  let s=deliverTwo();assert.equal(graduationPending(s),true);
  s=importSave(exportSave(s),c);assert.equal(tutorialStatus(s).phase,'graduation-call');
  s=dispatch(s,{type:'tutorialGraduationCall'},c);assert.equal(graduationPending(s),false);assert.equal(s.run.tutorial.independentActive,true);
  const once=JSON.stringify(s);s=dispatch(s,{type:'tutorialGraduationCall'},c);assert.equal(JSON.stringify(s),once);
  s=executeRoute(s,FIRST_JOB,'P01',c).state;s=dispatch(s,{type:'deliver'},c);
  assert.equal(s.run.tutorial.independentActive,true);assert.deepEqual(s.run.pending_calls,[]);
  s=importSave(exportSave(s),c);assert.equal(s.run.tutorial.independentActive,true);
  s=executeRoute(s,'JOB_E_003','S:root',c).state;s=dispatch(s,{type:'deliver'},c);
  assert.equal(s.run.tutorial.independentActive,false);assert.ok(s.run.pending_calls.includes('CALL02'));
  assert.equal(graduationPending(s),false);
});
test('independent assignment still receives recovery calls',()=>{
  let s=dispatch(deliverTwo(),{type:'tutorialGraduationCall'},c);
  s=dispatch(s,{type:'accept',jobId:'JOB_E_003'},c);
  // Clearing the device violates its data preservation requirement.
  s.run.owned_equipment.push('M05');
  s=dispatch(s,{type:'start',operation:{type:'reimage',development:false},confirmed:true},c);
  s=dispatch(s,{type:'tick',ms:10000},c);
  assert.ok(recoveryIncoming(s));assert.equal(s.run.tutorial.independentActive,true);assert.deepEqual(s.run.pending_calls,[]);
});
test('retirement preserves progress while blocked during the first two jobs and works afterwards',()=>{
  let s=createGame(c);assert.equal(tutorialRetirementBlocked(s),true);
  let before=JSON.stringify(s);assert.throws(()=>dispatch(s,{type:'retire'},c),/研修中/);assert.equal(JSON.stringify(s),before);
  s=executeRoute(s,FIRST_JOB,'P01',c).state;s=dispatch(s,{type:'deliver'},c);
  before=JSON.stringify(s);assert.equal(tutorialRetirementBlocked(s),true);assert.throws(()=>dispatch(s,{type:'retire'},c),/研修中/);assert.equal(JSON.stringify(s),before);
  s=executeRoute(s,SECOND_JOB,'dock P02',c).state;s=dispatch(s,{type:'deliver'},c);
  assert.equal(tutorialRetirementBlocked(s),false);s=dispatch(s,{type:'retire'},c);assert.equal(s.run.status,'retired');
});
test('existing saves receive the arrival briefing without resetting repairs or earned progress',()=>{
  let s=createGame(c);s.run.intro={stage:4,complete:true};s=dispatch(s,{type:'accept',jobId:FIRST_JOB},c);
  delete s.run.tutorial;const before=structuredClone(s.run.attempts[0]);
  assert.equal(tutorialStatus(s).phase,'briefing');s=dispatch(s,{type:'tutorialBriefingNext'},c);
  assert.deepEqual(s.run.attempts[0],before);assert.equal(tutorialStatus(JSON.parse(JSON.stringify(s))).page,1);
  s.run.completed.push(FIRST_JOB);s.run.attempts=[];s.run.active_id=null;assert.equal(tutorialStatus(s).phase,'next-order');
});
test('USB appears at repair page 3/6 and remains available after reading earlier messages',()=>{
  let s=createGame(c);assert.equal(initialMediaVisible(s),false);
  for(let i=0;i<4;i++){s=dispatch(s,{type:'introNext'},c);assert.equal(initialMediaVisible(s),false);}
  s=dispatch(s,{type:'accept',jobId:FIRST_JOB},c);assert.equal(initialMediaVisible(s),false);
  s=dispatch(s,{type:'tutorialBriefingNext'},c);assert.equal(initialMediaVisible(s),false);
  s=dispatch(s,{type:'tutorialBriefingNext'},c);assert.equal(initialMediaVisible(s),true);
  const saved=JSON.stringify(s);
  assert.equal(initialMediaVisible(JSON.parse(saved)),true);assert.equal(REPAIR_PAGES.length,6);
  for(let i=2;i<6;i++)s=dispatch(s,{type:'tutorialBriefingNext'},c);
  assert.equal(s.run.tutorial.briefed,true);assert.equal(initialMediaVisible(s),true);
});
test('lifetime completion prevents an old partial tutorial from resuming after the two repairs were learned',()=>{
  const s=createGame(c);s.run.intro={stage:4,complete:true};
  s.run.completed=[FIRST_JOB];s.meta.learned_intro_ids=[FIRST_JOB,SECOND_JOB];
  s.run.pending_calls=['CALL01'];s.run.tutorial={briefed:true,briefingPage:6};
  assert.equal(tutorialStatus(s).phase,'done');assert.equal(tutorialRetirementBlocked(s),false);
  s.run.id=2;s.run.completed=[];s.run.pending_calls=[];s.run.tutorial={briefed:false,briefingPage:2};
  assert.equal(tutorialStatus(s).phase,'done');assert.equal(initialMediaVisible(s),true);
});
