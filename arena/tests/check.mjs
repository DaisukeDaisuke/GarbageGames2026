import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {skills,clone,newRun,Lcg64,operation,chooseAction,availableActions,Session,routes,stats,totalBouts,serviceBouts} from '../src/engine.js';
import {runTrial,createDuel,duelForecast,TRIAL_SEEDS} from '../src/policies.js';
const command=id=>id<0?'next':'use '+skills[id].name;
const use=(r,op)=>assert.equal(operation(r,op),'',op);
const finalFixture=()=>{const r=newRun(1n,true,5);r.bout=4;use(r,'route 9');r.you.slots=[9,10,19];r.registered[9]=r.registered[10]=true;return r;};
const rng=new Lcg64(1n);assert.deepEqual(Array.from({length:5},()=>rng.percent()),[36,88,24,24,45]);
assert.deepEqual(stats(1,3),[196,32,0]);assert.deepEqual(stats(7,9),[54,88,120]);
let r=finalFixture(),before=clone(r);assert.ok(operation(r,'use eclipse'));assert.ok(operation(r,'use reprise'));assert.deepEqual(r,before);
use(r,'use wait');use(r,'use guard');assert.equal(r.you.hp,72);assert.equal(r.you.bank,12);
r=finalFixture();use(r,'use wait');use(r,'use barrier');assert.equal(r.you.hp,96);
r=finalFixture();r.you.hp=40;r.enemy.hp=5;use(r,'use drain');assert.equal(r.you.hp,42);assert.equal(r.maximum_damage,5);
r=finalFixture();use(r,'use fire');assert.equal(r.enemy.hp,69);use(r,'use flare');assert.equal(r.enemy.hp,40);
r=finalFixture();r.enemy.mp=0;r.enemy.hp=r.enemy.max_hp=999;r.forecast=chooseAction(r);use(r,'use fire');for(let i=0;i<5;i++)use(r,'use guard');assert.equal(r.history[0],5);use(r,'use guard');assert.ok(!r.history.includes(5));
r=finalFixture();r.you.slots[0]=17;use(r,'use eclipse');const h=clone(r.history);use(r,'next');assert.deepEqual(r.history,h);use(r,'next');assert.deepEqual(r.history,h);
r=finalFixture();for(const id of ['wait','guard','attack','focus','reprise'])use(r,'use '+id);assert.equal(r.you.pending.power,60);use(r,'next');assert.equal(r.maximum_damage,72);assert.equal(r.reward,1);assert.ok(r.registered[19]);
r=finalFixture();r.you.mp=1;before=clone(r);assert.ok(operation(r,'use fire'));assert.deepEqual(r,before);
// Meditation is always available, costs no MP, obeys speed/death and caps.
r=finalFixture();r.you.hp=20;r.you.mp=0;r.you.focus=true;r.enemy.rest=true;r.forecast={skill:0,stage:2};
assert.ok(availableActions(r).includes(2));use(r,'use wait');assert.equal(r.you.hp,35);assert.equal(r.you.mp,6);assert.equal(r.you.focus,true);
r=finalFixture();r.you.hp=95;r.you.mp=31;r.enemy.rest=true;r.forecast={skill:0,stage:2};use(r,'use wait');assert.equal(r.you.hp,96);assert.equal(r.you.mp,32);
r=finalFixture();r.you.hp=20;r.you.mp=0;r.you.burn=2;r.forecast={skill:0,stage:0};use(r,'use wait');assert.equal(r.you.hp,20);assert.equal(r.you.mp,6);assert.equal(r.you.burn,1);assert.equal(r.you.bank,0);
r=finalFixture();r.you.hp=10;r.you.mp=0;r.you.spd=1;r.forecast={skill:0,stage:0};use(r,'use wait');assert.equal(r.you.hp,0);assert.equal(r.you.mp,0);assert.equal(r.screen,5);
const fresh=new Session('0000000000000001');assert.equal(fresh.record().version,'VOID-PIT-WEB-5');assert.equal(totalBouts(fresh.run),9);assert.deepEqual(serviceBouts(fresh.run),[2,4,6,8]);assert.throws(()=>Session.restore({...fresh.record(),version:'VOID-PIT-WEB-1'}));
const v4=JSON.parse(fs.readFileSync(new URL('./fixtures/v4-record.json',import.meta.url),'utf8'));const restoredV4=Session.restore(v4.record);
assert.equal(restoredV4.record().version,'VOID-PIT-WEB-4');assert.deepEqual(restoredV4.run.path,v4.path);assert.equal(restoredV4.run.reward,2);
assert.deepEqual(newRun(1n).nodes.slice(0,10),newRun(1n,true,9,true).nodes.slice(0,10),'First four bouts and original opponents stay unchanged');
const previous=new Session('0000000000000001',true,10);assert.equal(previous.record().version,'VOID-PIT-WEB-3');assert.deepEqual(Session.restore(previous.record()).run,previous.run);
const legacy=new Session('0000000000000001',true,5);assert.equal(legacy.record().version,'VOID-PIT-WEB-2');assert.deepEqual(Session.restore(legacy.record()).run,legacy.run);
for(const [bout,hp,max,expected] of [[3,10,196,10],[4,10,196,110],[5,10,196,110],[8,193,196,196]]){
 r=newRun(1n);r.bout=bout;r.you.hp=hp;r.you.max_hp=max;use(r,'route '+routes(r)[0]);assert.equal(r.you.hp,expected,`Bout ${bout+1} start recovery`);
}
r=newRun(1n);r.duel=true;r.bout=4;r.you.hp=10;use(r,'route '+routes(r)[0]);assert.equal(r.you.hp,10,'Challenger battle does not use campaign recovery');
r=newRun(1n,true,10);r.bout=4;r.you.hp=10;use(r,'route '+routes(r)[0]);assert.equal(r.you.hp,10,'Previous ten-bout record keeps its original rules');
console.log('PASS LCG / defense / effects / reservations / BUG-01 / BUG-02 / meditation HP+15 MP+6 / caps / lethal turn order / record version');
const witnesses=[];
for(let policy=0;policy<5;policy++){
 const results=TRIAL_SEEDS.map((seed,i)=>runTrial(policy,i+1,seed,process.env.ARENA_ORACLE?5:9));
 assert.ok(results.every(x=>['winner','defeat'].includes(x.status)));
 const winners=results.filter(x=>x.status==='winner');witnesses.push(...winners);
 for(const x of winners)assert.deepEqual(Session.restore(x.record).run,x.snapshot);
 console.log(`PASS policy ${policy}: ${winners.length}/10 actual tournament wins, all records replayed`);
}
assert.ok(witnesses.length);
const player=witnesses[0].snapshot,opponent=witnesses.at(-1),savedPlayer=clone(player),savedOpponent=clone(opponent);r=createDuel(player,opponent);
assert.deepEqual(r.you,{...player.you,hp:player.you.max_hp,mp:player.you.max_mp});assert.deepEqual(r.enemy,{...opponent.snapshot.you,hp:opponent.snapshot.you.max_hp,mp:opponent.snapshot.you.max_mp});assert.deepEqual(player,savedPlayer);assert.deepEqual(opponent,savedOpponent);
const initial=clone(r),forecast=clone(r.forecast);operation(r,'use missing');assert.deepEqual(r.forecast,forecast);
use(r,command(availableActions(r)[0]));assert.deepEqual(createDuel(player,opponent),initial);
// The enemy's Borrow effect must use the same pre-speed capture as the player.
r=finalFixture();r.duel=true;r.you.pending={skill:17,power:48,magic:true};r.enemy.slots=[19,0,1];r.forecast={skill:19,stage:0};r.you.spd=200;use(r,'next');assert.equal(r.enemy.pending.power,48);
console.log('PASS duel full HP/MP / preserved builds and original records / rematch / forecast lock / symmetric reservation capture');
if(process.env.ARENA_ORACLE){
 const lines=[],expected=[];let actions=0;
 const add=(s,op)=>{lines.push(op);const ok=!operation(s,op);expected.push({ok:ok?1:0,state:clone(s)});actions++;};
 for(let seed=0;seed<128;seed++){let s=newRun(BigInt(seed),true,5);lines.push('seed '+s.seed);expected.push({ok:1,state:clone(s)});const pick=new Lcg64(BigInt(seed+41));for(let n=0;n<100&&s.screen!==5;n++){
  let op;if(s.screen===0)op='route '+routes(s)[0];else if(s.screen===1){if(n%11===0)add(s,'use missing');const ids=availableActions(s,'you',true);op=command(ids[Math.floor(pick.percent()*ids.length/100)]);}else if(s.screen===2||s.screen===4)op='leave-booth';else op='leave-shop';add(s,op);
 }}
 for(const w of witnesses){let s=newRun(w.seed,true,5);lines.push('seed '+s.seed);expected.push({ok:1,state:clone(s)});for(const op of w.record.operations)add(s,op);}
 const out=spawnSync(process.env.ARENA_ORACLE,[],{input:lines.join('\n')+'\n',encoding:'utf8',maxBuffer:128*1024*1024});assert.equal(out.status,0,out.stderr);
 const actual=out.stdout.trim().split('\n').map(JSON.parse);assert.equal(actual.length,expected.length);
 const numeric=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='boolean'?+v:v));
 for(let i=0;i<actual.length;i++)assert.deepEqual(numeric(expected[i]),actual[i],`C++ parity at operation ${i}: ${lines[i]}`);
 console.log(`PASS C++ parity with explicit meditation data patch: ${actual.length} complete states (${actions} operations), all fields including logs/history/ownership`);
}
fs.mkdirSync(new URL('../tests/output/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../tests/output/witnesses.json',import.meta.url),JSON.stringify(witnesses));
console.log('PASS all checks');
