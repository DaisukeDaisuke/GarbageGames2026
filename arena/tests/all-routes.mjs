import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Session,Lcg64,routes,skills,availableActions,enemies} from '../src/engine.js';
import {chooseTournamentOperation} from '../src/arena/strategies.js';
import {tournamentTree} from '../src/ui-model.js';
const seeds=Array.from({length:10},(_,i)=>(i+1).toString(16).padStart(16,'0'));
const paths=[];
for(const a of [0,1])for(const b of [2+a*2,3+a*2])for(const c of [6,7])
for(const d of [10,11,12])for(const e of [13,14])for(const f of [15,16])for(const g of [17,18])paths.push([a,b,c,8,9,d,e,f,g,19]);
assert.equal(paths.length,192);assert.equal(enemies.length,20);
const results=[],failures=[];
function execute(seed,path,policy){
 const s=new Session(seed),rng=new Lcg64(1n),booths=[],shops=[];
 for(let step=0;step<512&&s.run.screen!==5;step++){
  const r=s.run;let op;
  if(r.screen===0){assert.ok(routes(r).includes(path[r.bout]));op='route '+path[r.bout];}
  else op=chooseTournamentOperation(r,policy,rng,1);
  if(op.startsWith('use ')){
   const id=skills.findIndex(x=>x.name===op.slice(4));
   assert.ok(r.registered[id],`Unregistered skill ${op}`);
   assert.ok(availableActions(r).includes(id),`Unequipped skill ${op}`);
  }
  if(op==='leave-booth'&&r.screen===2)booths.push(r.bout);
  if(op==='leave-shop')shops.push(r.bout);
  assert.equal(s.commit(op),'',op);
 }
 if(!s.run.won||s.run.screen!==5)return null;
 assert.equal(s.run.reward,2);assert.equal(s.run.defeated.length,10);
 assert.deepEqual(s.run.path,path);assert.deepEqual(booths,[2,4,6,8]);assert.deepEqual(shops,[2,4,6,8]);
 const record=s.record(),restored=Session.restore(record);
 assert.deepEqual(restored.run,s.run);
 return {seed,path,policy,rounds:s.run.rounds,hp:s.run.you.hp,reward:s.run.reward,guilds:booths,shops,record};
}
for(const seed of seeds){
 const tree=tournamentTree(new Session(seed).run);assert.equal(tree.rows.length,10);assert.equal(tree.rows.flat().length,20);
 let won=0;
 for(const path of paths){let result;
  for(const policy of [1,3,2,0,4]){result=execute(seed,path,policy);if(result)break;}
  if(result){results.push(result);won++;}else failures.push({seed,path});
 }
 console.log(`SEED ${seed}: ${won}/192 legal gold-crown paths; every successful record replayed`);
}
fs.mkdirSync(new URL('../tests/output/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../tests/output/all-routes.json',import.meta.url),JSON.stringify({seeds,pathsPerSeed:192,tested:192*seeds.length,passed:results.length,failures,results}));
assert.deepEqual(failures,[],'Every branch must have a legal gold-crown witness');
console.log(`PASS ${results.length} full tournaments / all 192 branches × 10 seeds / four guilds and four shops / legal actions / exact replay`);
