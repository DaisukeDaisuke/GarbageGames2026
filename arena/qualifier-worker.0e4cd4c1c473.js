const DATA={"skills":[{"name":"attack","japanese":"通常攻撃","description":"物理12","mp":0,"policy":0,"effects":[[0,1,12,0,1]]},{"name":"guard","japanese":"防御","description":"直接攻撃を半減、MP+4。軽減分を最大12蓄積","mp":0,"policy":0,"effects":[[2,0,2,0,3],[4,0,4,0,2]]},{"name":"wait","japanese":"めいそう","description":"防御せずHP+15・MP+6。MP消費0","mp":0,"policy":0,"effects":[[1,0,15,0,2],[4,0,6,0,2]]},{"name":"pierce","japanese":"貫き","description":"物理14、Guard無視","mp":2,"policy":0,"effects":[[0,1,14,2,1]]},{"name":"smash","japanese":"強打","description":"物理22、相手Guard時は基礎-6","mp":3,"policy":0,"effects":[[5,0,0,-6,0],[0,1,22,0,1]]},{"name":"fire","japanese":"火炎","description":"魔法12、Burn: この回から2回、各3ダメージ","mp":3,"policy":0,"effects":[[0,1,12,1,1],[2,1,1,0,2]]},{"name":"flare","japanese":"追い炎","description":"魔法12、相手Burn中は+14","mp":4,"policy":0,"effects":[[5,0,1,14,0],[0,1,12,1,1]]},{"name":"drain","japanese":"吸収","description":"魔法14、実ダメージの半分を回復","mp":4,"policy":0,"effects":[[0,1,14,1,1],[6,0,0,0,2]]},{"name":"healing-rain","japanese":"癒しの雨","description":"自分HP12、相手HP6回復。繰り返し使用可能","mp":4,"policy":0,"effects":[[1,0,12,0,2],[1,1,6,0,2]]},{"name":"focus","japanese":"集中","description":"次の直接攻撃を1.5倍。溜め開始では消費しない","mp":4,"policy":0,"effects":[[2,0,0,0,2]]},{"name":"barrier","japanese":"魔法障壁","description":"この回の魔法直接ダメージを0にする","mp":3,"policy":0,"effects":[[2,0,3,0,3]]},{"name":"purge","japanese":"浄化","description":"魔法10、相手のFocusとBurnを解除","mp":3,"policy":0,"effects":[[0,1,10,1,1],[3,1,3,0,2]]},{"name":"counter","japanese":"迎撃","description":"物理10、実行時に相手が発動前の予約を持つなら+18","mp":3,"policy":0,"effects":[[5,0,2,18,0],[0,1,10,0,1]]},{"name":"siphon","japanese":"魔力吸収","description":"魔法8、自分MP+5。相手MPは減らさない","mp":2,"policy":0,"effects":[[0,1,8,1,1],[4,0,5,0,2]]},{"name":"mend","japanese":"手当て","description":"自分HP12回復、Burn解除","mp":3,"policy":0,"effects":[[1,0,12,0,2],[3,0,2,0,2]]},{"name":"bank-shot","japanese":"蓄勢撃","description":"物理14+Bank、Bankを消費","mp":3,"policy":0,"effects":[[7,0,0,0,0],[0,1,14,0,1]]},{"name":"quake","japanese":"地鳴り","description":"物理36。溜め→発動→休息","mp":6,"policy":1,"effects":[[8,0,36,0,0]]},{"name":"eclipse","japanese":"蝕","description":"魔法48。溜め→発動→休息","mp":8,"policy":1,"effects":[[8,0,48,1,0]]},{"name":"feint","japanese":"牽制","description":"物理8、攻撃後に自分Focus付与","mp":2,"policy":0,"effects":[[0,1,8,0,1],[2,0,0,0,2]]},{"name":"reprise","japanese":"借り技","description":"入力時の相手の発動前予約を捕捉しBankを加える。自分の溜め→発動→休息。Focusは発動時に適用","mp":10,"policy":0,"effects":[[9,0,0,0,4],[7,0,0,0,0],[8,0,-1,0,0]]}],"enemies":[{"name":"IRON HOUND","hp":36,"spd":110,"candidates":[[3],[4,18],[9,12]]},{"name":"HEX MAGE","hp":34,"spd":80,"candidates":[[5],[6,11],[8,13]]},{"name":"STONE GOLEM","hp":48,"spd":40,"candidates":[[4,15],[16],[9,8]]},{"name":"ASH WISP","hp":36,"spd":120,"candidates":[[5],[6,18],[8,13]]},{"name":"SHADE","hp":40,"spd":130,"candidates":[[18,3],[11,4],[12,13]]},{"name":"IRON MONK","hp":44,"spd":90,"candidates":[[3],[9,18],[12,8]]},{"name":"BONE ARCHER","hp":42,"spd":120,"candidates":[[3],[18,4],[13,12]]},{"name":"FROST WITCH","hp":42,"spd":80,"candidates":[[11],[5,3],[8]]},{"name":"BLADE DANCER","hp":54,"spd":140,"candidates":[[18],[12,3],[4,5]]},{"name":"VOID KNIGHT","hp":84,"spd":90,"candidates":[[17],[11,3],[13,8]]}],"items":[{"name":"iron-coat","japanese":"鉄の外套","description":"体力を厚くする。少し遅くなる","price":80,"charm":0,"second":0,"stats":[[1,1,32],[1,1,0],[1,1,-20]]},{"name":"lead-plate","japanese":"鉛の鎧","description":"体力を大きく増やす。素早さ0","price":140,"charm":0,"second":0,"stats":[[1,1,100],[1,1,0],[0,1,0]]},{"name":"pilgrim-robe","japanese":"巡礼の衣","description":"体力と魔力を伸ばす。速さはそのまま","price":100,"charm":0,"second":0,"stats":[[1,1,12],[1,1,16],[1,1,0]]},{"name":"wing-boots","japanese":"翼の靴","description":"防具込みの素早さを2倍。0は増えない","price":100,"charm":1,"second":0,"stats":[[1,1,0],[1,1,0],[2,1,0]]},{"name":"mana-ring","japanese":"魔力の指輪","description":"他の能力を落とさず魔力+12","price":60,"charm":1,"second":0,"stats":[[1,1,0],[1,1,12],[1,1,0]]},{"name":"quick-pin","japanese":"先駆けの留め金","description":"防具込みの素早さ+100","price":100,"charm":1,"second":1,"stats":[[1,1,0],[1,1,0],[1,1,100]]},{"name":"duelist-jacket","japanese":"決闘士の上着","description":"体力を削り素早さ+50","price":90,"charm":0,"second":0,"stats":[[1,1,-16],[1,1,0],[1,1,50]]},{"name":"reservoir-robe","japanese":"貯魔の法衣","description":"体力を削り基礎魔力2倍","price":120,"charm":0,"second":0,"stats":[[1,1,-24],[2,1,0],[1,1,0]]},{"name":"heart-knot","japanese":"命結びのお守り","description":"魔力を4減らし体力+24","price":60,"charm":1,"second":0,"stats":[[1,1,24],[1,1,-4],[1,1,0]]},{"name":"glass-prism","japanese":"硝子の魔晶","description":"防具込みの体力3/4、魔力+24、素早さ+20","price":100,"charm":1,"second":0,"stats":[[3,4,0],[1,1,24],[1,1,20]]}]}
;
const {skills,enemies,items}=DATA;
const Screen={Route:0,Battle:1,Booth:2,Shop:3,Discovery:4,Result:5,Closed:6};
const VERSION='VOID-PIT-WEB-2';
const clone=x=>structuredClone(x);
const seedText=x=>BigInt(x).toString(16).padStart(16,'0');
class Lcg64{
 constructor(seed){this.state=BigInt(seed);}
 next(){return this.state=BigInt.asUintN(64,this.state*0x5d588b656c078965n+0x269ec3n);}
 percent(){return Number(((this.next()>>32n)*100n)>>32n);}
}
const pending=()=>({skill:-1,power:0,magic:false});
const fighter=()=>({hp:96,max_hp:96,mp:32,max_mp:32,spd:100,focus:false,guard:false,barrier:false,rest:false,rain_used:false,burn:0,bank:0,last:-1,pending:pending(),slots:[5,9,7]});
function event(r,s){r.log.push(s);if(r.log.length>4)r.log.shift();}
const has=(f,id)=>f.slots.includes(id);
const direct=id=>skills[id].effects.some(e=>e[0]===0);
function resetConditions(f){f.focus=f.guard=f.barrier=f.rest=false;f.burn=f.bank=0;f.pending=pending();}
function newRun(seed,practice=true){
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
 r.rng_state=seedText(rng.state);return r;
}
function chooseAction(r){
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
 if(r.bout===4){r.reward=r.history.every(id=>r.registered[id])?2:1;r.screen=5;}
 else{r.gold+=[60,80,100,120][r.bout];r.you.hp=Math.min(r.you.max_hp,r.you.hp+24);r.you.mp=Math.min(r.you.max_mp,r.you.mp+12);r.bout++;r.learned_here=false;r.screen=[2,3].includes(r.bout)?2:0;}
 resetConditions(r.you);resetConditions(r.enemy);
 if(found){r.registered[19]=true;event(r,'You learned REPRISE: borrow a charging strike.');if(r.screen!==5){r.after_discovery=r.screen;r.screen=4;}}
}
function startBout(r,node){
 r.node=node;r.path.push(node);const n=r.nodes[node],d=enemies[n.enemy];
 r.enemy=fighter();r.enemy.hp=r.enemy.max_hp=d.hp;r.enemy.spd=d.spd;r.enemy.slots=[...n.slots];
 r.round=1;r.observation=0;r.discovered=false;r.charge_hint=r.guard_hint=false;r.charge_hint_round=r.guard_hint_round=0;r.screen=1;r.log=[];
 event(r,d.name+' enters the pit.');r.forecast=chooseAction(r);
}
function validAction(r,id,next=false,who='you'){
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
function availableActions(r,who='you',hidden=false){
 const f=r[who];if(f.pending.power>0||f.rest)return [-1];
 return [...new Set(hidden?skills.map((_,i)=>i):[0,1,2,...f.slots])].filter(id=>!validAction(r,id,false,who));
}
function actionFor(f,id){return f.pending.power>0?{skill:f.pending.skill,stage:1}:f.rest?{skill:0,stage:2}:{skill:id,stage:0};}
function fight(r,id,next=false,options={}){
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
function routes(r){if(r.bout===0)return [0,1];if(r.bout===1)return [2+r.path[0]*2,3+r.path[0]*2];if(r.bout===2)return [6,7];return [r.bout===3?8:9];}
function learnable(r){const c=new Set();for(const n of r.defeated)for(const id of r.nodes[n].slots)if(id>=3&&id<19)c.add(id);if(r.bout===2)c.add(10);if(r.bout===3)c.add(19);return [...c].filter(id=>!r.registered[id]).sort((a,b)=>a-b);}
function stats(armor,charm){let result=[96,32,100];for(const id of [armor,charm])if(id>=0&&id<10)result=result.map((n,s)=>{const [mul,div,add]=items[id].stats[s];return Math.trunc(n*mul/div)+add;});return result.map((n,s)=>Math.max(s===0?1:0,Math.min(999,n)));}
function operation(r,command,options={}){
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
  if(verb==='buy'){if(id<0||r.owned[id]||(items[id].second&&r.bout!==3))return reject;if(r.gold<items[id].price)return 'Goldが足りません。';r.gold-=items[id].price;r.owned[id]=true;}
  else if(id>=0&&!r.owned[id])return reject;
  if(id===-1)r.preview_armor=-1;else if(id===-2)r.preview_charm=-1;else if(items[id].charm)r.preview_charm=id;else r.preview_armor=id;return '';
 }
 if(verb==='leave-shop'&&a.length===1&&r.screen===3){const s=stats(r.preview_armor,r.preview_charm);r.you.hp=Math.min(s[0],r.you.hp+Math.max(0,s[0]-r.you.max_hp));r.you.mp=Math.min(s[1],r.you.mp+Math.max(0,s[1]-r.you.max_mp));[r.you.max_hp,r.you.max_mp,r.you.spd]=s;r.armor=r.preview_armor;r.charm=r.preview_charm;r.screen=0;return '';}
 return reject;
}
const score=r=>Math.max(0,10000-120*r.rounds-10*r.taken+20*r.maximum_damage);
class Session{
 constructor(seed,practice=true){this.run=newRun(seed,practice);this.operations=[];}
 commit(command,options={}){if(typeof command!=='string'||command.length>64)return '入力は64文字以内にしてください。';if(this.operations.length>=4096)return '操作記録の上限です。記録を書き出してください。';const error=operation(this.run,command,options);if(!error)this.operations.push(command);return error;}
 record(){return {version:VERSION,seed:this.run.seed,practice:this.run.practice,operations:[...this.operations]};}
 static restore(record){if(!record||record.version!==VERSION||!(/^[\da-f]{16}$/i.test(record.seed))||typeof record.practice!=='boolean'||!Array.isArray(record.operations)||record.operations.length>4096)throw Error('記録の形式または版が一致しません。');const s=new Session(record.seed,record.practice);for(const op of record.operations){const error=s.commit(op);if(error)throw Error('記録を再生できません：'+error);}return s;}
}
// GPT6 Pro extension point: pure decisions; the engine remains authoritative.
const STRATEGY_VERSION='1.1';
const STRATEGIES=[
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
function chooseBattleAction(r,index,rng){
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
function chooseTournamentOperation(r,index,rng,trial){
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
// Replay and tournament orchestration. Decision logic lives in arena/strategies.js.
const POLICY_VERSION=STRATEGY_VERSION;
const POLICIES=STRATEGIES;
const policyAction=chooseBattleAction;
function runTrial(index,trial,seed){
 const policySeed=seedText(BigInt('0x'+seed)^BigInt((index+1)*100003+trial*7919));const rng=new Lcg64(BigInt('0x'+policySeed));
 const s=new Session(seed,true);let count=0,stalled=0,last='';
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
const TRIAL_SEEDS=Array.from({length:10},(_,i)=>seedText(BigInt(i+1)));
function opponentForecast(r,index,rng){
 const view=clone(r);[view.you,view.enemy]=[view.enemy,view.you];view.forecast=chooseAction(view);view.duel=true;
 const id=policyAction(view,index,rng);return actionFor(r.enemy,id);
}
function createDuel(player,challenger){
 const original=Session.restore(challenger.record).run;
 if(!original.won||original.screen!==5||challenger.policyVersion!==POLICY_VERSION)throw Error('優勝記録を確認できません。');
 const r=clone(player);r.enemy=clone(original.you);r.duel=true;r.screen=1;r.round=1;r.log=[];r.won=false;
 for(const fighter of [r.you,r.enemy]){fighter.hp=fighter.max_hp;fighter.mp=fighter.max_mp;}
 r.opponentMetadata={registered:clone(original.registered),owned:clone(original.owned),armor:original.armor,charm:original.charm};
 const rng=new Lcg64(BigInt('0x'+challenger.policySeed));r.forecast=opponentForecast(r,challenger.policy,rng);r.policy_rng=seedText(rng.state);return r;
}
function duelForecast(r,index){const rng=new Lcg64(BigInt('0x'+r.policy_rng));const a=opponentForecast(r,index,rng);r.policy_rng=seedText(rng.state);return a;}

let started=false;onmessage=()=>{if(started)return;started=true;let i=0;const jobs=POLICIES.flatMap((_,p)=>TRIAL_SEEDS.map((s,t)=>[p,t+1,s]));const tick=()=>{if(i>=jobs.length){close();return;}try{postMessage(runTrial(...jobs[i++]));setTimeout(tick,0);}catch(error){postMessage({error:error.message});close();}};tick();};