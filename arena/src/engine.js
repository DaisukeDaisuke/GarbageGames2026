import DATA from './data.js';
export const {skills,enemies,items}=DATA;
export const Screen={Route:0,Battle:1,Booth:2,Shop:3,Discovery:4,Result:5,Closed:6};
export const VERSION='VOID-PIT-WEB-3';
export const EXTRA_ENEMIES=[
 {name:'EMBER WITCH',hp:58,spd:95,candidates:[[5],[6],[13]]},
 {name:'MOSS TROLL',hp:76,spd:50,candidates:[[4],[16],[8]]},
 {name:'ABYSS JELLY',hp:60,spd:105,candidates:[[7],[13],[11]]},
 {name:'STORM MAGE',hp:66,spd:145,candidates:[[18],[5],[12]]},
 {name:'THUNDER GRIFFIN',hp:78,spd:150,candidates:[[3],[9],[4]]},
 {name:'LUNAR ORACLE',hp:72,spd:85,candidates:[[17],[11],[8]]},
 {name:'BRASS CHIMERA',hp:88,spd:110,candidates:[[16],[15],[12]]},
 {name:'CRYSTAL SORCERESS',hp:84,spd:125,candidates:[[5],[6],[7]]},
 {name:'CRYSTAL BASILISK',hp:96,spd:115,candidates:[[3],[9],[11]]},
 {name:'ASTRAL DRAGON',hp:120,spd:120,candidates:[[17],[7],[13]]}
];
enemies.push(...EXTRA_ENEMIES);
export const totalBouts=r=>r.campaign===10?10:5;
export const serviceBouts=r=>r.campaign===10?[2,4,6,8]:[2,3];
export const serviceVisit=r=>serviceBouts(r).indexOf(r.bout)+1;
export const itemAvailable=(r,id)=>!items[id].second||(r.campaign===10?r.bout>=4:r.bout===3);
export const boutRows=r=>[[0,1],[2,3,4,5],[6,7],[8],[9],...(r.campaign===10?[[10,11,12],[13,14],[15,16],[17,18],[19]]:[])];
export const clone=x=>structuredClone(x);
export const seedText=x=>BigInt(x).toString(16).padStart(16,'0');
export class Lcg64{
 constructor(seed){this.state=BigInt(seed);}
 next(){return this.state=BigInt.asUintN(64,this.state*0x5d588b656c078965n+0x269ec3n);}
 percent(){return Number(((this.next()>>32n)*100n)>>32n);}
}
export const pending=()=>({skill:-1,power:0,magic:false});
export const fighter=()=>({hp:96,max_hp:96,mp:32,max_mp:32,spd:100,focus:false,guard:false,barrier:false,rest:false,rain_used:false,burn:0,bank:0,last:-1,pending:pending(),slots:[5,9,7]});
export function event(r,s){r.log.push(s);if(r.log.length>4)r.log.shift();}
const has=(f,id)=>f.slots.includes(id);
const direct=id=>skills[id].effects.some(e=>e[0]===0);
export function resetConditions(f){f.focus=f.guard=f.barrier=f.rest=false;f.burn=f.bank=0;f.pending=pending();}
export function newRun(seed,practice=true,campaign=10){
 const rng=new Lcg64(typeof seed==='string'?BigInt('0x'+seed):seed);
 const r={seed:seedText(rng.state),rng_state:'',practice,you:fighter(),enemy:fighter(),nodes:Array.from({length:10},()=>({enemy:0,slots:[]})),registered:Array(20).fill(false),owned:Array(10).fill(false),defeated:[],path:[],history:[],log:[],bout:0,node:-1,round:1,gold:0,armor:-1,charm:-1,preview_armor:-1,preview_charm:-1,rounds:0,taken:0,maximum_damage:0,observation:0,discovered:false,learned_here:false,charge_hint:false,guard_hint:false,charge_hint_round:0,guard_hint_round:0,screen:0,after_discovery:0,reward:0,won:false,forecast:{skill:0,stage:0}};
 const initial=[[5,3,4],[9,12,15],[8,14,7]];
 r.you.slots=initial.map(p=>p[Math.floor(rng.percent()*3/100)]);
 for(const id of [0,1,2,...r.you.slots])r.registered[id]=true;
 let pool=[0,1,4,5];const draw=()=>pool.splice(Math.floor(rng.percent()*pool.length/100),1)[0];
 for(let i=0;i<2;i++)r.nodes[i].enemy=draw();
 pool.push(2,3);pool.sort((a,b)=>a-b);
 for(let i=2;i<6;i++)r.nodes[i].enemy=draw();
 pool=[6,7];for(let i=6;i<8;i++)r.nodes[i].enemy=draw();
 r.nodes[8].enemy=8;r.nodes[9].enemy=9;
 for(const n of r.nodes)n.slots=enemies[n.enemy].candidates.map(p=>[...p].sort((a,b)=>a-b)[Math.floor(rng.percent()*p.length/100)]);
 if(campaign===10){r.campaign=10;for(let i=10;i<20;i++)r.nodes.push({enemy:i,slots:enemies[i].candidates.map(p=>p[Math.floor(rng.percent()*p.length/100)])});}
 r.rng_state=seedText(rng.state);return r;
}
export function chooseAction(r){
 const f=r.enemy;
 if(f.pending.power>0)return {skill:f.pending.skill,stage:1};
 if(f.rest)return {skill:0,stage:2};
 const conditions=[true,(r.round-1)%4===0,f.hp<=Math.floor(f.max_hp/3)&&!f.rain_used,r.you.pending.power>0,r.you.focus,r.you.burn>0,f.mp<=6,!f.focus&&f.last!==9,true];
 for(const [condition,id] of [[0,17],[1,16],[2,8],[3,12],[4,11],[5,6],[6,13],[7,9],[8,-1],[8,0]]){
  if(!conditions[condition])continue;
  if(id<0){for(const s of f.slots)if(direct(s)&&skills[s].mp<=f.mp)return {skill:s,stage:0};}
  else if((id===0||has(f,id))&&skills[id].mp<=f.mp)return {skill:id,stage:0};
 }
 return {skill:0,stage:0};
}
function effect(c,e){
 const [op,target,arg0,arg1]=e,u=c.user,v=c.opponent,t=target===0?u:v;
 if(op===0){
  const power=Math.floor(Math.max(0,arg0+c.add)*(u.focus?3:2)/2);u.focus=false;
  let dealt=power;
  if((arg1&1)&&v.barrier)dealt=0;
  else if(v.guard&&!(arg1&2)){dealt=Math.floor(dealt/2);v.bank=Math.min(12,v.bank+power-dealt);}
  c.damage=Math.min(v.hp,dealt);v.hp-=c.damage;
  if(c.player)c.run.maximum_damage=Math.max(c.run.maximum_damage,c.damage);else c.run.taken+=c.damage;
  event(c.run,`${c.player?'YOU':'ENEMY'} POWER ${power} / DAMAGE ${c.damage}`);
 }else if(op===1)t.hp=Math.min(t.max_hp,t.hp+arg0);
 else if(op===2){if(arg0===0)t.focus=true;if(arg0===1)t.burn=2;if(arg0===2)t.guard=true;if(arg0===3)t.barrier=true;}
 else if(op===3){if(arg0&1)t.focus=false;if(arg0&2)t.burn=0;}
 else if(op===4)u.mp=Math.min(u.max_mp,u.mp+arg0);
 else if(op===5){if((arg0===0&&v.guard)||(arg0===1&&v.burn>0)||(arg0===2&&v.pending.power>0))c.add+=arg1;}
 else if(op===6)u.hp=Math.min(u.max_hp,u.hp+Math.floor(c.damage/2));
 else if(op===7){c.add+=u.bank;u.bank=0;}
 else if(op===8){u.pending={skill:c.skill,power:(arg0<0?c.captured.power:arg0)+c.add,magic:arg0<0?c.captured.magic:arg1!==0};event(c.run,`${c.player?'YOU':'ENEMY'} CHARGE / POWER ${u.pending.power}`);if(arg0<0)event(c.run,'BORROWED '+skills[c.captured.skill].name);}
 else if(op===9)c.captured=clone(v.pending);
}
function phase(c,p){for(const e of skills[c.skill].effects)if(e[4]===p){if(c.opponent.hp===0&&e[0]!==6)break;effect(c,e);}}
function execute(c,a,enemy){
 if(a.stage===2){c.user.rest=false;event(c.run,enemy?'ENEMY REST':'YOU REST');return;}
 if(a.stage===1){const p=c.user.pending;c.user.pending=pending();c.user.rest=true;event(c.run,`${enemy?'ENEMY':'YOU'} ${skills[p.skill].name} RELEASE`);effect(c,[0,1,p.power,p.magic?1:0,1]);return;}
 if(enemy)c.user.mp-=skills[a.skill].mp;
 c.user.last=a.skill;if(a.skill===8)c.user.rain_used=true;
 event(c.run,`${enemy?'ENEMY':'YOU'} used ${skills[a.skill].name}`);
 phase(c,0);phase(c,1);phase(c,2);
}
function finishBout(r,won){
 r.won=won;
 if(r.duel||!won){r.screen=5;resetConditions(r.you);resetConditions(r.enemy);return;}
 const found=r.discovered&&!r.registered[19];
 event(r,`VICTORY / YOU HP ${r.you.hp} / ENEMY HP 0`);r.defeated.push(r.node);
 if(r.bout===totalBouts(r)-1){r.reward=r.history.every(id=>r.registered[id])?2:1;r.screen=5;}
 else{r.gold+=[60,80,100,120,120,140,140,160,180][r.bout];r.you.hp=Math.min(r.you.max_hp,r.you.hp+24);r.you.mp=Math.min(r.you.max_mp,r.you.mp+12);r.bout++;r.learned_here=false;r.screen=serviceBouts(r).includes(r.bout)?2:0;}
 resetConditions(r.you);resetConditions(r.enemy);
 if(found){r.registered[19]=true;event(r,'You learned REPRISE: borrow a charging strike.');if(r.screen!==5){r.after_discovery=r.screen;r.screen=4;}}
}
export function startBout(r,node){
 r.node=node;r.path.push(node);const n=r.nodes[node],d=enemies[n.enemy];
 r.enemy=fighter();r.enemy.hp=r.enemy.max_hp=d.hp;r.enemy.spd=d.spd;r.enemy.slots=[...n.slots];
 r.round=1;r.observation=0;r.discovered=false;r.charge_hint=r.guard_hint=false;r.charge_hint_round=r.guard_hint_round=0;r.screen=1;r.log=[];
 event(r,d.name+' enters the pit.');r.forecast=chooseAction(r);
}
export function validAction(r,id,next=false,who='you'){
 const u=r[who],v=r[who==='you'?'enemy':'you'];
 if(r.screen!==1)return '戦闘画面へ戻ってください。';
 if(u.pending.power>0||u.rest)return next?'':'発動・休息中です。nextで進めてください。';
 if(next)return '今は戦闘コマンドを選んでください。';
 if(!Number.isInteger(id)||id<0||id>=20)return 'その技名はありません。完全名で入力してください。';
 if(skills[id].policy===1&&!has(u,id))return 'この大技は装備していません。';
 if(u.mp<skills[id].mp)return 'MPが足りません。';
 if(id===9&&u.focus)return '既に集中しています。';
 if(id===19&&v.pending.power<=0)return '相手に発動前の予約がありません。';
 return '';
}
export function availableActions(r,who='you',hidden=false){
 const f=r[who];if(f.pending.power>0||f.rest)return [-1];
 return [...new Set(hidden?skills.map((_,i)=>i):[0,1,2,...f.slots])].filter(id=>!validAction(r,id,false,who));
}
export function actionFor(f,id){return f.pending.power>0?{skill:f.pending.skill,stage:1}:f.rest?{skill:0,stage:2}:{skill:id,stage:0};}
export function fight(r,id,next=false,options={}){
 const error=validAction(r,id,next);if(error)return error;
 const a=actionFor(r.you,id),b=clone(r.forecast);
 const you={run:r,user:r.you,opponent:r.enemy,skill:a.skill,add:0,damage:0,captured:pending(),player:true};
 const enemy={run:r,user:r.enemy,opponent:r.you,skill:b.skill,add:0,damage:0,captured:pending(),player:false};
 const observe=r.observation===r.round&&a.stage===0&&a.skill===0&&b.stage===2;r.observation=0;
 if(a.stage===0){r.you.mp-=skills[id].mp;r.history.push(id);if(r.history.length>6)r.history.shift();phase(you,4);phase(you,3);}
 // Both competitors capture reservations and set stances before speed ordering.
 if(b.stage===0){phase(enemy,4);phase(enemy,3);}
 r.rounds++;const first=r.you.spd>=r.enemy.spd;
 if(first)execute(you,a,false);else execute(enemy,b,true);
 if(r.you.hp>0&&r.enemy.hp>0){if(first)execute(enemy,b,true);else execute(you,a,false);}
 if(r.you.hp>0&&r.enemy.hp>0){
  if(r.you.burn>0){r.you.burn--;const d=Math.min(3,r.you.hp);r.you.hp-=d;r.taken+=d;event(r,'YOU BURN / DAMAGE '+d);}
  if(r.you.hp>0&&r.enemy.burn>0){r.enemy.burn--;r.enemy.hp=Math.max(0,r.enemy.hp-3);event(r,'ENEMY BURN / DAMAGE 3');}
 }
 if(r.you.hp>0&&observe)r.discovered=true;
 if(r.you.hp>0&&a.stage===0&&a.skill===1&&b.stage===1){r.observation=r.round+1;if(!r.guard_hint){r.guard_hint=true;r.guard_hint_round=r.round+1;}}
 r.you.guard=r.you.barrier=r.enemy.guard=r.enemy.barrier=false;
 if(r.you.hp===0||r.enemy.hp===0){finishBout(r,r.you.hp>0);return '';}
 if(r.round>=20){event(r,'TIME LIMIT / DEFEAT');finishBout(r,false);return '';}
 r.round++;r.forecast=options.nextForecast?options.nextForecast(r):chooseAction(r);
 if(r.enemy.pending.power>0&&!r.charge_hint){r.charge_hint=true;r.charge_hint_round=r.round;}
 return '';
}
export function routes(r){if(r.bout===1)return [2+r.path[0]*2,3+r.path[0]*2];return boutRows(r)[r.bout]||[];}
export function learnable(r){const c=new Set();for(const n of r.defeated)for(const id of r.nodes[n].slots)if(id>=3&&id<19)c.add(id);if(r.bout===2)c.add(10);if(r.campaign===10){if(r.bout>=4)c.add(19);if(r.bout>=6){c.add(7);c.add(16);}if(r.bout>=8){c.add(17);c.add(13);}}else if(r.bout===3)c.add(19);return [...c].filter(id=>!r.registered[id]).sort((a,b)=>a-b);}
export function stats(armor,charm){let result=[96,32,100];for(const id of [armor,charm])if(id>=0&&id<10)result=result.map((n,s)=>{const [mul,div,add]=items[id].stats[s];return Math.trunc(n*mul/div)+add;});return result.map((n,s)=>Math.max(s===0?1:0,Math.min(999,n)));}
export function operation(r,command,options={}){
 const a=command.split(/\s+/),verb=a[0],id=Number(a[1]),slot=Number(a[2]);
 const reject='この画面では受理できない操作です。';
 if(verb==='use'&&a.length===2)return fight(r,skills.findIndex(s=>s.name===a[1]),false,options);
 if(verb==='next'&&a.length===1)return fight(r,0,true,options);
 if(verb==='route'&&a.length===2&&r.screen===0&&routes(r).includes(id)){startBout(r,id);return '';}
 if(['learn','equip-skill'].includes(verb)&&a.length===3&&Number.isInteger(id)&&id>=3&&id<20&&Number.isInteger(slot)&&slot>=1&&slot<=3){
  if(r.screen===4){if(verb!=='equip-skill'||id!==19)return reject;r.you.slots[slot-1]=id;r.screen=r.after_discovery;return '';}
  if(r.screen!==2)return reject;
  if(verb==='learn'){if(r.learned_here||!learnable(r).includes(id))return reject;r.registered[id]=true;r.learned_here=true;}
  else if(!r.registered[id])return reject;
  r.you.slots[slot-1]=id;return '';
 }
 if(verb==='leave-booth'&&a.length===1){if(r.screen===4){r.screen=r.after_discovery;return '';}if(r.screen!==2)return reject;r.screen=3;r.preview_armor=r.armor;r.preview_charm=r.charm;return '';}
 if(['buy','equip-item'].includes(verb)&&a.length===2&&r.screen===3&&Number.isInteger(id)&&id>=-2&&id<10){
  if(verb==='buy'){if(id<0||r.owned[id]||!itemAvailable(r,id))return reject;if(r.gold<items[id].price)return 'Goldが足りません。';r.gold-=items[id].price;r.owned[id]=true;}
  else if(id>=0&&!r.owned[id])return reject;
  if(id===-1)r.preview_armor=-1;else if(id===-2)r.preview_charm=-1;else if(items[id].charm)r.preview_charm=id;else r.preview_armor=id;return '';
 }
 if(verb==='leave-shop'&&a.length===1&&r.screen===3){const s=stats(r.preview_armor,r.preview_charm);r.you.hp=Math.min(s[0],r.you.hp+Math.max(0,s[0]-r.you.max_hp));r.you.mp=Math.min(s[1],r.you.mp+Math.max(0,s[1]-r.you.max_mp));[r.you.max_hp,r.you.max_mp,r.you.spd]=s;r.armor=r.preview_armor;r.charm=r.preview_charm;r.screen=0;return '';}
 return reject;
}
export const score=r=>Math.max(0,(r.campaign===10?20000:10000)-120*r.rounds-10*r.taken+20*r.maximum_damage);
export class Session{
 constructor(seed,practice=true,campaign=10){this.run=newRun(seed,practice,campaign);this.operations=[];}
 commit(command,options={}){if(typeof command!=='string'||command.length>64)return '入力は64文字以内にしてください。';if(this.operations.length>=4096)return '操作記録の上限です。記録を書き出してください。';const error=operation(this.run,command,options);if(!error)this.operations.push(command);return error;}
 record(){return {version:this.run.campaign===10?VERSION:'VOID-PIT-WEB-2',seed:this.run.seed,practice:this.run.practice,operations:[...this.operations]};}
 static restore(record){if(!record||![VERSION,'VOID-PIT-WEB-2'].includes(record.version)||!(/^[\da-f]{16}$/i.test(record.seed))||typeof record.practice!=='boolean'||!Array.isArray(record.operations)||record.operations.length>4096)throw Error('記録の形式または版が一致しません。');const s=new Session(record.seed,record.practice,record.version===VERSION?10:5);for(const op of record.operations){const error=s.commit(op);if(error)throw Error('記録を再生できません：'+error);}return s;}
}
