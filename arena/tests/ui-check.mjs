import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {newRun,Session,skills,items} from '../src/engine.js';
import {runTrial} from '../src/policies.js';
import {CHALLENGER_CHARACTERS,challengerAppearance} from '../src/arena/characters.js';
import {randomSeedText,tournamentTree,battlePresentation,skillSound} from '../src/ui-model.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const details=JSON.parse(read('src/details.json'));
const imageFiles=new Set(JSON.parse(read('docs/image-conversion.json')).images.map(image=>image.file));
const audioManifest=JSON.parse(read('src/audio.json')),audioSources=JSON.parse(read('docs/audio-sources.json'));
assert.deepEqual(Object.keys(audioManifest.sounds).sort(),['guard','heal','hit','magic','slash','ui','victory']);
for(const source of audioSources.sounds){const bytes=fs.readFileSync(new URL('../'+source.file,import.meta.url));assert.equal(audioManifest.sounds[source.cue],source.file);assert.ok(bytes.length>1000);assert.ok(bytes.toString('ascii',0,3)==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),source.sha256);}
assert.match(audioManifest.credit,/OtoLogic/);assert.match(audioManifest.credit,/CC BY 4.0/);
for(const [kind,list] of [['skills',skills],['items',items]]){
 assert.deepEqual(Object.keys(details[kind]).sort(),list.map(x=>x.name).sort());
 for(const x of list){assert.ok(details[kind][x.name].paragraphs.length>=4);const file=`assets/${kind}/${x.name}.jpg`;assert.ok(imageFiles.has(file));assert.ok(fs.statSync(new URL('../'+file,import.meta.url)).size>1000);}
}
assert.equal(randomSeedText(a=>{a[0]=0x12345678;a[1]=0x90abcdef;return a;}),'1234567890abcdef');
assert.equal(randomSeedText(()=>{throw Error();},()=>12345),'0000000000003039');
const tree=tournamentTree(newRun(1n));assert.equal(tree.rows.flat().length,10);assert.equal(tree.edges.length,15);
assert.ok(!tree.edges.some(([a,b])=>a===0&&b===4));
assert.equal(skillSound(0),'slash');assert.equal(skillSound(5),'magic');assert.equal(skillSound(1),'guard');assert.equal(skillSound(8),'heal');assert.equal(battlePresentation(newRun(1n),newRun(1n)),null);
console.log('PASS all 30 detailed JSON records and generated assets / route topology / sound routing');

// Run the actual UI handlers in Node with a small deterministic DOM adapter.
// It exposes document state and user events, without starting any browser.
const loadedImages=new Set();
const events=new Map(),nodes=new Map(),timers=[];let randomCalls=0,lastMarkup='';
class Element{
 constructor(id=''){this.id=id;this.value='';this.dataset={};this.open=false;this.hidden=true;this.isConnected=true;this.style={};this.scrollTop=0;this.disabled=false;this.listeners=new Map();this.classes=new Set();this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),toggle:(v,on)=>{if(on??!this.classes.has(v))this.classes.add(v);else this.classes.delete(v);},contains:v=>this.classes.has(v)};}
 set innerHTML(value){this.html=value;if(this.id==='app'){lastMarkup=value;for(const img of value.matchAll(/<img[^>]+src="([^"]+)"/g))loadedImages.add(img[1]);const match=value.match(/id="seed"[^>]*value="([^"]*)"/);if(match){const e=new Element('seed');e.value=match[1];nodes.set('seed',e);}else nodes.delete('seed');if(value.includes('class="arena"'))nodes.set('arena',new Element('arena'));else nodes.delete('arena');}}
 get innerHTML(){return this.html||'';}
 addEventListener(name,fn){this.listeners.set(name,fn);}
 setAttribute(name,value){this[name]=value;}
 querySelectorAll(selector){if(this.id==='app'&&selector==='.arena,.landing,.route-card'){return this.html.includes('class="landing"')?[new Element('landing')]:nodes.has('arena')?[nodes.get('arena')]:[];}return [];}
 querySelector(){return null;}
 closest(selector){return selector==='input'&&this.id==='seed'?this:null;}
 matches(selector){return selector==='#seed'&&this.id==='seed';}
 showModal(){this.open=true;}
 close(){this.open=false;}
 focus(){document.activeElement=this;}
 replaceChildren(...items){this.children=items;}
 contains(value){return this===value;}
 getBoundingClientRect(){return {left:10,top:10,right:300,bottom:300,width:290,height:290};}
 prepend(img){if(img.src)loadedImages.add(img.src);}
 insertAdjacentHTML(){}
 scrollBy(){}
 click(){}
}
for(const id of ['app','modal','modal-title','modal-body','modal-close','tooltip','notice','import-file'])nodes.set(id,new Element(id));
const document={body:new Element('body'),activeElement:null,querySelector:s=>nodes.get(s==='.arena'?'arena':s.slice(1))||null,createElement:()=>new Element(),addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}};
const played=[];
class TestAudio{constructor(src){this.src=src;}addEventListener(){}play(){played.push(this.src);return Promise.resolve();}pause(){}}
const storage=new Map();
const context=vm.createContext({document,window:{dragscroll:{reset(){}}},innerWidth:1440,innerHeight:900,structuredClone,Uint32Array,Date,Math,Map,Set,JSON,console,Audio:TestAudio,URL,URLSearchParams,Blob,
 crypto:{getRandomValues:a=>{randomCalls++;a[0]=0x10203040;a[1]=0x50607080+randomCalls;return a;}},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},matchMedia:()=>({matches:false}),setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
 ASSETS:new Proxy({},{get:(_,key)=>'image:'+key}),DETAILS:details,AUDIO:Object.fromEntries(['ui','slash','hit','guard','heal','magic','victory'].map(x=>[x,'audio:'+x])),AUDIO_CREDIT:'OtoLogic / CC BY 4.0',DRAGSCROLL_LICENSE:'MIT',SPECIFICATION:read('docs/specification.md'),LICENSE_TEXT:read('LICENSE'),WORKER_URL:'./qualifier-worker.test.js'});
const strip=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const bundled=process.env.ARENA_BUILT_APP?fs.readFileSync(process.env.ARENA_BUILT_APP,'utf8').replace(/^'use strict';\n\(\(\)=>\{\n/,'').replace(/\n\}\)\(\);\s*$/,''):'const DATA='+read('src/data.json')+';\n'+['engine.js','arena/strategies.js','policies.js','requirements.js','ui-model.js','views.js','arena/characters.js','arena/views.js','share.js','app.js'].map(name=>strip(read('src/'+name))).join('\n');
vm.runInContext(bundled,context);
const run=code=>vm.runInContext(code,context);
if(process.env.ARENA_BUILT_APP)console.log('INITIAL_RESOURCE_MODEL '+JSON.stringify({images:[...loadedImages],audio:played,markup:lastMarkup}));
const action=name=>run('handleAction('+JSON.stringify(name)+')');
const state=()=>JSON.parse(run('JSON.stringify({page,seedDraft,run:session?.run,operations:session?.operations})'));
assert.equal(randomCalls,1);assert.equal(nodes.get('seed').value,'1020304050607081');
nodes.get('seed').value='0000000000000001';for(const fn of events.get('input'))fn({target:nodes.get('seed')});
await action('ledger');assert.match(nodes.get('modal-body').innerHTML,/SKILL-20/);assert.match(nodes.get('modal-body').innerHTML,/ITEM-10/);run('closeModal()');await action('sound');await action('motion');
assert.equal(nodes.get('seed').value,'0000000000000001');assert.equal(randomCalls,1);
await action('start');assert.equal(state().page,'briefing');assert.equal(state().run.screen,0);assert.equal(state().run.round,1);assert.equal(state().operations.length,0);
assert.match(lastMarkup,/すること/);assert.match(lastMarkup,/TOURNAMENT TREE/);assert.equal((lastMarkup.match(/class="tree-node"/g)||[]).length,10);assert.match(lastMarkup,/id="tournament-progress" value="0" max="5"/);assert.match(lastMarkup,/max="20"/);
const beforeReading=JSON.stringify(state().run);await action('ledger');run('closeModal()');await action('help');run('closeModal()');assert.equal(JSON.stringify(state().run),beforeReading);
run("commit('route 0')");assert.equal(state().operations.length,0,'Briefing cannot accept battle or route commands');
await action('briefing-done');run("commit('route 0')");assert.equal(state().run.screen,1);assert.equal(nodes.get('app').classList.contains('readable-text'),false);
assert.match(lastMarkup,/data-spec="skill:0"/);assert.match(lastMarkup,/skills\/attack/);
await action('sound');assert.equal(run('audioOn'),true);
for(let i=0;i<3;i++)run("commit('use attack')");
assert.equal(state().page,'victory');assert.equal(state().run.bout,1);assert.match(lastMarkup,/<h2>VICTORY!<\/h2>/);assert.match(lastMarkup,/VICTORY-01/);assert.ok(played.includes(run('AUDIO.slash')));assert.ok(played.includes(run('AUDIO.victory')));
const afterWin=JSON.stringify(state().run),opCount=state().operations.length;run("commit('route 2')");assert.equal(state().operations.length,opCount);await action('victory-next');assert.equal(JSON.stringify(state().run),afterWin);assert.equal(state().page,'main');
console.log('PASS real UI handlers: stable random seed, manual seed preservation, briefing gate, no state changes while reading, held victory screen');

const trial=runTrial(0,1,'0000000000000001'),shopSession=new Session(trial.seed,true);
for(const op of trial.record.operations){shopSession.commit(op);if(shopSession.run.screen===3)break;}
assert.equal(shopSession.run.screen,3);
run('session=Session.restore('+JSON.stringify(shopSession.record())+');duel=null;page="main";render();');
assert.match(lastMarkup,/ギルドに到着！/);assert.match(lastMarkup,/class="guild-section armor"/);assert.match(lastMarkup,/class="guild-section charms"/);assert.equal((lastMarkup.match(/class="gear-shelf dragscroll"/g)||[]).length,3);
const shelfMarkup=key=>lastMarkup.match(new RegExp('<div id="shelf-'+key+'"[^>]*>([\\s\\S]*?)</section>'))[1];
assert.ok(lastMarkup.indexOf('id="shelf-purchased"')<lastMarkup.indexOf('id="shelf-armor"'));
assert.match(shelfMarkup('armor'),/is-unowned/);assert.match(shelfMarkup('purchased'),/何度でも/);
const gold=state().run.gold;await action('buy:1');assert.equal(nodes.get('modal').open,true);assert.match(nodes.get('modal-body').innerHTML,/items\/lead-plate/);await action('close');assert.equal(state().run.gold,gold);
await action('buy:1');await action('confirm-buy:1');assert.equal(state().run.gold,gold-140);assert.equal(state().run.preview_armor,1);assert.match(lastMarkup,/is-equipped/);
assert.match(shelfMarkup('purchased'),/is-owned is-equipped" data-item-id="1"/);assert.doesNotMatch(shelfMarkup('armor'),/data-item-id="1"/);assert.match(shelfMarkup('purchased'),/OWNED-01/);
await action('op:equip-item -1');assert.equal(state().run.preview_armor,-1);assert.equal(state().run.owned[1],true);assert.match(lastMarkup,/装備なし/);
for(let i=0;i<3;i++){await action('op:equip-item 1');await action('op:equip-item -1');}
assert.equal(state().run.gold,gold-140,'Re-equipping owned gear is free');assert.match(shelfMarkup('purchased'),/is-owned/);assert.doesNotMatch(shelfMarkup('purchased'),/is-unowned/);
await action('op:equip-item 1');await action('op:leave-shop');assert.equal(state().run.armor,1);assert.equal(state().run.you.max_hp,196);
console.log('PASS real UI handlers: separate guild shelves, image purchase dialog, cancel, purchase, unequip/re-equip, original stat commit');
run('session=new Session("0000000000000001",true);session.run.screen=3;session.run.bout=3;session.run.gold=500;duel=null;page="main";render();');
await action('confirm-buy:0');await action('confirm-buy:1');
const paidGold=state().run.gold;assert.equal(paidGold,500-items[0].price-items[1].price);
for(const id of [0,1,0,1]){await action('op:equip-item '+id);assert.equal(state().run.preview_armor,id);assert.equal(state().run.gold,paidGold);}
for(const id of [0,1]){assert.match(shelfMarkup('purchased'),new RegExp('data-item-id="'+id+'"'));assert.doesNotMatch(shelfMarkup('armor'),new RegExp('data-item-id="'+id+'"'));}

// Result sharing uses only an ordinary official intent link; no API or auto-post.
const shareCopies=[];
for(const [won,reward,isDuel] of [[true,2,false],[true,1,false],[false,0,false],[true,2,true],[false,2,true]]){
 run('session=Session.restore('+JSON.stringify(trial.record)+');session.run.screen=5;session.run.won='+won+';session.run.reward='+reward+';duel='+(isDuel?'clone(session.run);duel.duel=true':'null')+';page="main";render();');
 const anchor=lastMarkup.match(/<a class="share-x" href="([^"]+)"[^>]*>X<\/a>/);assert.ok(anchor);
 const url=new URL(anchor[1].replaceAll('&amp;','&'));assert.equal(url.origin,'https://twitter.com');assert.equal(url.pathname,'/intent/tweet');
 assert.equal(url.searchParams.get('url'),'https://qiita.com/DaisukeDaisuke/items/32cf05c0d4255401b1e7');
 const copy=url.searchParams.get('text');assert.match(copy,/SEED 0000000000000001/);assert.match(copy,won?/優勝|勝利/:/敗北/);shareCopies.push(copy);
 assert.match(anchor[0],/target="_blank"/);assert.match(anchor[0],/aria-label="結果をXに投稿する"/);
}
assert.match(shareCopies[0],/金冠/);assert.match(shareCopies[1],/銀杯/);assert.notEqual(shareCopies[0],shareCopies[1]);
run('duel=null;champion=Session.restore('+JSON.stringify(trial.record)+').run;trialResults=['+JSON.stringify(trial)+'];page="challengers";render();');
assert.match(lastMarkup,/algorithm-arena/);assert.match(lastMarkup,/value="1" max="50"/);assert.match(lastMarkup,/data-action="challenge:0:1"/);assert.equal((lastMarkup.match(/class="challenger-card"/g)||[]).length,5);
assert.equal(CHALLENGER_CHARACTERS.length,10);assert.equal(new Set(CHALLENGER_CHARACTERS.map(c=>c.id)).size,10);
const trialBefore=JSON.stringify(trial),appearance=challengerAppearance(trial);assert.deepEqual(challengerAppearance(trial),appearance);assert.equal(JSON.stringify(trial),trialBefore);
assert.match(lastMarkup,new RegExp('challengers/'+appearance.id));assert.doesNotMatch(lastMarkup,/hue-rotate/);
const identities=Array.from({length:200},(_,i)=>({seed:(i+1).toString(16).padStart(16,'0'),policy:i%5,trial:i%10+1,policyVersion:'1.0'}));
assert.equal(new Set(identities.map(x=>challengerAppearance(x).id)).size,10,'All ten human art variants are reachable');
await action('challenge:0:1');assert.equal(nodes.get('modal').open,true);await action('duel-start');assert.equal(run('duel.you.hp'),trial.snapshot.you.max_hp);assert.equal(run('duel.enemy.hp'),trial.snapshot.you.max_hp);assert.equal(run('duel.you.mp'),trial.snapshot.you.max_mp);assert.equal(run('duel.enemy.mp'),trial.snapshot.you.max_mp);
assert.match(lastMarkup,new RegExp('class="sprite enemy challenger" src="[^"]*challengers/'+appearance.id));
assert.ok(loadedImages.has(run('ASSETS["algorithm-arena"]')));
const championBeforeRematch=run('JSON.stringify(champion)');run('duel.you.hp=1;duel.you.mp=0;duel.enemy.hp=1;duel.enemy.mp=0;');await action('rematch');assert.equal(run('duel.you.hp'),trial.snapshot.you.max_hp);assert.equal(run('duel.enemy.mp'),trial.snapshot.you.max_mp);assert.equal(run('JSON.stringify(champion)'),championBeforeRematch);
await action('main');assert.equal(run('duel'),null);
console.log('PASS actual result X links / gold-silver copy / dedicated arena / ten stable human variants / challenger confirmation and full HP/MP');
run('session=new Session("0000000000000001",true);session.commit("route 0");session.run.you.hp=20;session.run.you.mp=0;session.run.you.spd=200;session.run.enemy.rest=true;session.run.forecast={skill:0,stage:2};duel=null;page="main";motion=false;render();');
assert.match(lastMarkup,/めいそう/);assert.match(lastMarkup,/HP\+15・MP\+6/);await action('use:2');assert.equal(state().run.you.hp,35);assert.equal(state().run.you.mp,6);assert.ok(played.includes(run('AUDIO.heal')));

run('session=new Session("0000000000000001",true);session.commit("route 0");duel=null;page="main";motion=true;render();');
const timerStart=timers.length;run("commit('use attack')");
assert.equal(nodes.get('arena').classList.contains('frame-shake'),true);
assert.equal(document.body.classList.contains('frame-shake'),false);
assert.equal(nodes.get('app').classList.contains('frame-shake'),false);
const duringAnimation=state().operations.length;run("commit('use attack')");assert.equal(state().operations.length,duringAnimation);
for(const fn of timers.slice(timerStart))fn();assert.equal(run('busy'),false);assert.ok(played.includes(run('AUDIO.hit')));
console.log('PASS combat frame shake only / repeated input blocked during animation');

// Exercise the attached dragscroll implementation itself, including reset cleanup.
const windowListeners=new Map(),shelfListeners=new Map();
const shelf={scrollLeft:200,scrollTop:0,hasAttribute:()=>false,addEventListener:(k,v)=>shelfListeners.set(k,v),removeEventListener:k=>shelfListeners.delete(k)};
const dragWindow={addEventListener:(k,v)=>windowListeners.set(k,v),removeEventListener:k=>windowListeners.delete(k)};
const dragContext=vm.createContext({window:dragWindow,document:{readyState:'complete',getElementsByClassName:()=>[shelf]}});
vm.runInContext(read('vendor/dragscroll/dragscroll.js'),dragContext);
shelfListeners.get('mousedown')({clientX:100,clientY:20,preventDefault(){}});windowListeners.get('mousemove')({clientX:40,clientY:20});assert.equal(shelf.scrollLeft,260);windowListeners.get('mouseup')();windowListeners.get('mousemove')({clientX:20,clientY:20});assert.equal(shelf.scrollLeft,260);vm.runInContext('dragscroll.reset()',dragContext);assert.equal(windowListeners.size,2);
console.log('PASS supplied dragscroll: horizontal drag, release, listener reset');
console.log('PASS all JavaScript UI checks (no browser launched)');
