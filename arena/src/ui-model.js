import {skills,enemies,totalBouts,boutRows} from './engine.js';

export function randomSeedText(fill=values=>globalThis.crypto.getRandomValues(values),clock=Date.now){
 try{return [...fill(new Uint32Array(2))].map(x=>x.toString(16).padStart(8,'0')).join('');}
 catch{return BigInt.asUintN(64,BigInt(clock())).toString(16).padStart(16,'0');}
}

export function tournamentTree(run){
 const rows=boutRows(run);
 const edges=[[0,2],[0,3],[1,4],[1,5],[2,6],[2,7],[3,6],[3,7],[4,6],[4,7],[5,6],[5,7],[6,8],[7,8],[8,9]];
 for(let i=5;i<rows.length;i++)for(const from of rows[i-1])for(const to of rows[i]){
  if(run.campaign===9&&i===6){
   const pair=run.seventhPairs?.[from]||(from===run.sixthChoices[0]?[13,14]:[17,18]);
   if(!pair.includes(to))continue;
  }
  if(run.campaign===9&&i===7&&!run.seventhPairs&&(from===13||from===14?to!==15:to!==16))continue;
  edges.push([from,to]);
 }
 return {rows:rows.map((ids,bout)=>ids.map(id=>({id,bout,name:enemies[run.nodes[id].enemy].name,slots:[...run.nodes[id].slots],hp:enemies[run.nodes[id].enemy].hp,spd:enemies[run.nodes[id].enemy].spd}))),edges};
}

export function battlePresentation(before,after){
 if(before.screen!==1||after.screen===1)return null;
 if(!after.won)return null;
 return {bout:before.bout+1,round:before.round,enemy:before.duel?'CHALLENGER':enemies[before.nodes[before.node].enemy].name,
  enemyArt:before.duel?'player':enemies[before.nodes[before.node].enemy].name.toLowerCase().replaceAll(' ','-'),
  gold:after.gold-before.gold,final:before.duel||before.bout===totalBouts(before)-1,hp:after.you.hp,mp:after.you.mp};
}

export function skillSound(id,stage=0){
 if(stage===2)return 'ui';
 if(id===1||id===10)return 'guard';
 if(id===2||id===8||id===14)return 'heal';
 if(stage===1)return [17,19].includes(id)?'magic':'hit';
 if([5,6,7,9,11,13,16,17,19].includes(id))return 'magic';
 return 'slash';
}

export function itemDelta(before,after){return after.map((n,i)=>`${n} (${n-before[i]>=0?'+':''}${n-before[i]})`);}
