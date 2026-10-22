// Replay and tournament orchestration. Decision logic lives in arena/strategies.js.
import {clone,Lcg64,seedText,Session,score,chooseAction,actionFor} from './engine.js';
import {STRATEGY_VERSION,STRATEGIES,chooseBattleAction,chooseTournamentOperation} from './arena/strategies.js';
export const POLICY_VERSION=STRATEGY_VERSION;
export const POLICIES=STRATEGIES;
export const policyAction=chooseBattleAction;
export function runTrial(index,trial,seed,campaign=9){
 const policySeed=seedText(BigInt('0x'+seed)^BigInt((index+1)*100003+trial*7919));const rng=new Lcg64(BigInt('0x'+policySeed));
 const s=new Session(seed,true,campaign);let count=0,stalled=0,last='';
 while(s.run.screen!==5&&count++<512){
  const r=s.run,op=chooseTournamentOperation(r,index,rng,trial);
  if(op===null)return {policy:index,trial,seed,policySeed,status:'error',reason:'未知の画面'};
  const fingerprint=JSON.stringify([r.screen,r.bout,r.round,r.you.hp,r.you.mp,r.gold,r.you.slots,r.owned]);
  stalled=fingerprint===last?stalled+1:0;last=fingerprint;
  if(stalled>3)return {policy:index,trial,seed,policySeed,status:'limit',reason:'状態が進まない操作を検出'};
  const error=s.commit(op);if(error)return {policy:index,trial,seed,policySeed,status:'error',reason:error};
 }
 if(s.run.screen!==5)return {policy:index,trial,seed,policySeed,status:'limit',reason:'大会操作上限512件'};
 const record=s.record(),replayed=Session.restore(record);
 if(JSON.stringify(replayed.run)!==JSON.stringify(s.run))throw Error('優勝者の再生状態が一致しません。');
 return {policy:index,policyVersion:POLICY_VERSION,trial,seed,policySeed,status:s.run.won?'winner':'defeat',score:score(s.run),record,snapshot:clone(replayed.run)};
}
export const TRIAL_SEEDS=Array.from({length:10},(_,i)=>seedText(BigInt(i+1)));
export function opponentForecast(r,index,rng){
 const view=clone(r);[view.you,view.enemy]=[view.enemy,view.you];view.forecast=chooseAction(view);view.duel=true;
 const id=policyAction(view,index,rng);return actionFor(r.enemy,id);
}
export function createDuel(player,challenger){
 const original=Session.restore(challenger.record).run;
 if(!original.won||original.screen!==5||challenger.policyVersion!==POLICY_VERSION)throw Error('優勝記録を確認できません。');
 const r=clone(player);r.enemy=clone(original.you);r.duel=true;r.screen=1;r.round=1;r.log=[];r.won=false;
 for(const fighter of [r.you,r.enemy]){fighter.hp=fighter.max_hp;fighter.mp=fighter.max_mp;}
 r.opponentMetadata={registered:clone(original.registered),owned:clone(original.owned),armor:original.armor,charm:original.charm};
 const rng=new Lcg64(BigInt('0x'+challenger.policySeed));r.forecast=opponentForecast(r,challenger.policy,rng);r.policy_rng=seedText(rng.state);return r;
}
export function duelForecast(r,index){const rng=new Lcg64(BigInt('0x'+r.policy_rng));const a=opponentForecast(r,index,rng);r.policy_rng=seedText(rng.state);return a;}
