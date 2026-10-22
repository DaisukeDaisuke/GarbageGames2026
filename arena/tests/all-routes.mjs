import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Session,Lcg64,routes,skills,availableActions,enemies} from '../src/engine.js';
import {chooseTournamentOperation} from '../src/arena/strategies.js';
import {tournamentTree} from '../src/ui-model.js';
const seeds=Array.from({length:10},(_,i)=>(i+1).toString(16).padStart(16,'0'));
assert.equal(enemies.length,20);
const results=[],failures=[];
const placements=new Set(),sixthPairs=new Set();
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
 assert.equal(s.run.reward,2);assert.equal(s.run.defeated.length,9);
 assert.equal(s.run.you.hp,s.run.you.max_hp);assert.equal(s.run.you.mp,s.run.you.max_mp);
 assert.notEqual(s.run.nodes[path[6]].enemy,s.run.nodes[path[7]].enemy,'No opponent rematch in the semifinal');
 assert.deepEqual(s.run.path,path);assert.deepEqual(booths,[2,4,6,8]);assert.deepEqual(shops,[2,4,6,8]);
 const record=s.record(),restored=Session.restore(record);
 assert.deepEqual(restored.run,s.run);
 return {seed,path,policy,rounds:s.run.rounds,hp:s.run.you.hp,reward:s.run.reward,guilds:booths,shops,record};
}
for(const seed of seeds){
 const run=new Session(seed).run,tree=tournamentTree(run);assert.equal(tree.rows.length,9);assert.equal(tree.rows.flat().length,19);
 assert.deepEqual(tree.rows[5].map(n=>n.id),run.sixthChoices);
 assert.deepEqual(run.sixthChoices.length,2);
 assert.deepEqual(tree.edges.filter(([node])=>node===9).map(([,to])=>to),run.sixthChoices);
 for(const [from,pair] of [[run.sixthChoices[0],[13,14]],[run.sixthChoices[1],[17,18]],[13,[15]],[14,[15]],[17,[16]],[18,[16]]])
  assert.deepEqual(tree.edges.filter(([node])=>node===from).map(([,to])=>to),pair,'Preview edges must match adjacent route choices');
 placements.add([13,14,17,18].map(id=>run.nodes[id].enemy).join(','));sixthPairs.add(run.sixthChoices.join(','));
 const paths=[];
 for(const a of [0,1])for(const b of [2+a*2,3+a*2])for(const c of [6,7])
 for(const d of run.sixthChoices)for(const e of d===run.sixthChoices[0]?[13,14]:[17,18])paths.push([a,b,c,8,9,d,e,e===13||e===14?15:16,19]);
 assert.equal(paths.length,32);
 let won=0;
 for(const path of paths){let result;
  for(const policy of [1,3,2,0,4]){result=execute(seed,path,policy);if(result)break;}
  if(result){results.push(result);won++;}else failures.push({seed,path});
 }
 console.log(`SEED ${seed}: ${won}/32 legal gold-crown paths; every successful record replayed`);
}
assert.ok(placements.size>1,'Seeded opponent placements must vary');assert.ok(sixthPairs.size>1,'Seeded sixth-bout choices must vary');
fs.mkdirSync(new URL('../tests/output/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../tests/output/all-routes.json',import.meta.url),JSON.stringify({seeds,pathsPerSeed:32,tested:32*seeds.length,passed:results.length,failures,results}));
assert.deepEqual(failures,[],'Every branch must have a legal gold-crown witness');
console.log(`PASS ${results.length} nine-bout tournaments / all 32 branches × 10 seeds / four visits to each guild / legal actions / full recovery / exact replay`);
