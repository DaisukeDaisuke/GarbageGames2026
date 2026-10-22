// GPT6 Pro extension point: pure decisions; the engine remains authoritative.
import {skills,items,enemies,clone,routes,learnable,availableActions,operation} from '../engine.js';
export const STRATEGY_VERSION='1.1';
export const STRATEGIES=[
 {name:'技ランク優先型',tag:'RANK',description:'技の評価を基準に、確実な一手を積み重ねる。',weights:[4,1],gear:[1,5],depth:1},
 {name:'相性重視型',tag:'SYNERGY',description:'Focus・Burn・Bankと敵の予告を組み合わせる。',weights:[4,1.3],gear:[2,3,4],depth:2},
 {name:'生存優先型',tag:'SURVIVAL',description:'予告を受け切り、HPとMPを次の戦いへ残す。',weights:[7,2],gear:[1,8,5],depth:2},
 {name:'短期先読み型',tag:'LOOKAHEAD',description:'共通戦闘処理で3手先まで比較する。',weights:[4.5,1.2],gear:[1,5],depth:3},
 {name:'乱択試行型',tag:'ROLLOUT',description:'独立した乱数で有限の行動列を試行する。',weights:[4,1],gear:[1,2,8,3,5],depth:3}
];
const rank=[12,4,1,15,24,20,16,22,8,12,10,14,17,18,14,21,11,18,19,9];
const command=id=>id<0?'next':'use '+skills[id].name;
function value(r,start,p){
 if(r.you.hp<=0)return -100000;
 if(r.enemy.hp<=0||r.screen!==1&&r.won)return 100000+r.you.hp*p.weights[0]+r.you.mp*p.weights[1]-r.rounds*8;
 if(r.screen===5)return -100000;
 return r.you.hp*p.weights[0]+r.you.mp*p.weights[1]-r.enemy.hp*6-r.enemy.mp*.1+(r.you.focus?12:0)+r.you.bank*1.3-r.you.burn*5+r.enemy.burn*5+(r.you.pending.power>0?r.you.pending.power*2:0)-Math.max(0,r.rounds-start.rounds)*6;
}
function evaluateSkill(id,r,policy){let v=rank[id];if(policy===1){if(id===6&&r.you.slots.includes(5))v+=16;if(id===5&&r.you.slots.includes(6))v+=14;if(id===15)v+=8;}if(policy===2&&[7,14,10].includes(id))v+=18;if(policy===3&&[18,7,15].includes(id))v+=9;return v;}
export function chooseBattleAction(r,index,rng){
 const p=STRATEGIES[index],choices=availableActions(r);
 if(choices.length===1)return choices[0];
 let best=choices[0],bestValue=-Infinity;
 for(const first of choices){
  const initial=clone(r);if(operation(initial,command(first)))continue;
  let frontier=[initial],candidate=value(initial,r,p);
  if(index===4){
   let total=0;
   for(let sample=0;sample<6;sample++){const x=clone(initial);for(let depth=1;depth<p.depth&&x.screen===1;depth++){const a=availableActions(x);const id=a[Math.floor(rng.percent()*a.length/100)];operation(x,command(id));}total+=value(x,r,p);}candidate=total/6;
  }else{
   for(let depth=1;depth<p.depth;depth++){
    const next=[];
    for(const x of frontier){if(x.screen!==1){next.push(x);continue;}for(const id of availableActions(x)){const y=clone(x);if(!operation(y,command(id)))next.push(y);}}
    next.sort((a,b)=>value(b,r,p)-value(a,r,p));frontier=next.slice(0,8);if(!frontier.length)break;candidate=value(frontier[0],r,p);
   }
  }
  // Ranking breaks strategically comparable choices without overriding survival.
  candidate+=(first>=0?evaluateSkill(first,r,index):0)*(index===0?.65:.08);
  if(index===1&&first===6&&r.enemy.burn>0)candidate+=8;
  if(candidate>bestValue){bestValue=candidate;best=first;}
 }
 return best;
}
function chooseRoute(r,index,rng){
 const available=routes(r);if(index===4)return available[Math.floor(rng.percent()*available.length/100)];
 return [...available].sort((a,b)=>{const cost=n=>{const e=enemies[r.nodes[n].enemy];return e.hp+(e.spd>r.you.spd?14:0)+(r.nodes[n].slots.includes(5)?8:0)+(index===1&&r.nodes[n].slots.includes(6)?-20:0);};return cost(a)-cost(b);})[0];
}
export function chooseTournamentOperation(r,index,rng,trial){
  let op;
  if(r.screen===0)op='route '+chooseRoute(r,index,rng);
  else if(r.screen===1)op=command(chooseBattleAction(r,index,rng));
  else if(r.screen===4)op='leave-booth';
  else if(r.screen===2){
   const available=learnable(r);available.sort((a,b)=>evaluateSkill(b,r,index)-evaluateSkill(a,r,index));
   const worst=r.you.slots.map((id,i)=>({id,i})).sort((a,b)=>evaluateSkill(a.id,r,index)-evaluateSkill(b.id,r,index))[0];
   if(!r.learned_here&&available.length&&evaluateSkill(available[0],r,index)>evaluateSkill(worst.id,r,index))op=`learn ${available[0]} ${worst.i+1}`;
   else op='leave-booth';
  }else if(r.screen===3){
   const gear=[...STRATEGIES[index].gear];if(index===4)gear.sort((a,b)=>((a+trial)%5)-((b+trial)%5));
   let buy=gear.find(id=>!r.owned[id]&&r.gold>=items[id].price&&(!items[id].second||r.bout===3)&&((items[id].charm?r.preview_charm:r.preview_armor)<0));
   // The second shop may replace a slower charm with the purchased quick pin.
   if(buy===undefined&&r.bout===3&&[0,2,3].includes(index)&&!r.owned[5]&&r.gold>=100)buy=5;
   op=buy===undefined?'leave-shop':'buy '+buy;
  }else return null;
  return op;
}
