import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game,GameClock,parseScript,validateData,SCENE_COUNT,resultShareUrl,choiceGroups,formatStatement} from '../source/core.mjs';
const spec=await readFile(new URL('../specification.md',import.meta.url),'utf8');
const data=JSON.parse(spec.match(/```json\s*\n([\s\S]*?)\n```/)[1]);
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function rig(){const events=[];const clock=new GameClock();const game=new Game(data,clock,{event:(kind,value,state)=>events.push({kind,value,scene:state.scene,hp:state.hp})});return {game,clock,events};}
async function drain(r,promise){
  for(let i=0;i<30;i++){
    await flush();
    if(r.game.state.mode==='manual')r.game.continue();
    else if(r.game.state.mode==='timed')r.clock.advance(3000);
    else if(['choice','end'].includes(r.game.state.mode))break;
  }
  await promise;
}
function choosePattern(game,scene,pattern){
  const words=scene.attributes?[pattern.noun,pattern.attribute,pattern.verb]:[pattern.noun,pattern.verb];
  choiceGroups(scene).forEach((group,i)=>game.choose(i,group.indexOf(words[i])));
}
test('設計データ: 225通り = 成功13 + 失敗211 + 通過1',()=>assert.deepEqual(validateData(data),{total:225,defeated:13,failed:211,passed:1}));
for(const scene of data.scenes)for(const pattern of scene.patterns)test(`${scene.id} ${pattern.noun} / ${pattern.attribute??''} / ${pattern.verb}`,async()=>{
  const r=rig();await r.game.enter(scene.id);
  for(let i=0;i<scene.id;i++)r.game.state.results[i]='defeated';
  const start=r.events.length;
  choosePattern(r.game,scene,pattern);
  const promise=r.game.speak();await drain(r,promise);
  const reactions=r.events.slice(start).filter(e=>e.scene===scene.id);
  const expected=parseScript(pattern.script,data).filter(t=>t.op==='text').map(t=>t.value).join('');
  assert.equal(reactions.filter(e=>e.kind==='text').map(e=>e.value.value).join(''),expected);
  const damage=reactions.filter(e=>e.kind==='damage');
  const attacks=reactions.filter(e=>e.kind==='attack');
  assert.equal(attacks.length,1,'確定1回に攻撃通知は1回');
  assert.equal(attacks[0].value.damage,damage.length?100:0,'赤い表示も実際の固定ダメージと一致');
  if(pattern.script.endsWith('<fault>')){
    assert.equal(damage.length,0);assert.equal(r.game.state.scene,scene.id);assert.equal(r.game.state.hp,100);assert.equal(r.game.state.failures[scene.id],1);assert.equal(r.game.state.turn,2);assert.deepEqual(r.game.state.selection,choiceGroups(scene).map(()=>null));assert.equal(r.game.state.mode,'choice');
    choosePattern(r.game,scene,pattern);await drain(r,r.game.speak());assert.equal(r.game.state.hp,100);assert.equal(r.game.state.failures[scene.id],2);
  }else{
    const defeated=pattern.script.includes('<damage=');assert.equal(damage.length,defeated?1:0);assert.equal(r.game.state.results[scene.id],defeated?'defeated':'passed');assert.equal(r.game.state.scene,scene.id+1);
  }
});
test('選択解除、片側未選択、連続確定は安全',async()=>{
  const r=rig();await r.game.start();assert.deepEqual(r.game.state.selection,[null,null]);
  r.game.choose(0,0);assert.equal(await r.game.speak(),false);r.game.choose(0,0);assert.deepEqual(r.game.state.selection,[null,null]);
  r.game.choose(0,1);r.game.choose(1,0);const running=r.game.speak();assert.equal(await r.game.speak(),false);
  assert.equal(r.game.state.mode,'manual');assert.equal(r.game.continue(),true);assert.equal(r.game.continue(),false);await running;assert.equal(r.game.state.failures[0],1);
});
test('Pageはひとつの停止点だけ進める',async()=>{
  const r=rig();await r.game.start();r.game.choose(0,4);r.game.choose(1,0);const running=r.game.speak();
  assert.equal(r.game.state.hp,100);r.game.continue();assert.equal(r.game.continue(),false);await flush();assert.equal(r.game.state.hp,0);assert.equal(r.game.state.mode,'manual');r.game.continue();await running;assert.equal(r.game.state.scene,1);
});
test('ゴースト: 同じ時計で3秒、非表示時停止、先行入力を無視',async()=>{
  const r=rig();await r.game.enter(3);r.game.state.results=['defeated','defeated','defeated',null,null];r.game.choose(0,2);r.game.choose(1,3);const running=r.game.speak();
  assert.equal(r.game.state.timer.deadline,3000);assert.equal(r.game.continue(),false);r.clock.advance(1200);r.clock.active=false;r.clock.advance(9000);assert.equal(r.clock.time,1200);assert.equal(r.game.state.hp,100);
  r.clock.active=true;r.clock.advance(1799);await flush();assert.equal(r.game.state.hp,100);r.clock.advance(1);await flush();assert.equal(r.game.state.hp,0);assert.equal(r.game.state.mode,'manual');
  r.game.continue();await running;assert.equal(r.game.state.scene,4);assert.equal(r.events.filter(e=>e.kind==='damage').length,1);
});
test('再開始は未完了の時計と待機を破棄する',async()=>{
  const r=rig();await r.game.enter(3);r.game.choose(0,2);r.game.choose(1,3);const old=r.game.speak();await r.game.start();r.clock.advance(10000);await old;assert.equal(r.game.state.scene,0);assert.equal(r.game.state.hp,100);assert.equal(r.events.filter(e=>e.kind==='damage').length,0);
  r.game.choose(0,4);r.game.choose(1,0);const manual=r.game.speak();await r.game.start();await manual;assert.equal(r.game.continue(),false);
});
for(const passed of [false,true])test(`${passed?9:10}体撃破エンディングを全戦通して確認`,async()=>{
  const r=rig();await r.game.start();
  const route=passed?[[0,0],[2,2],[1,2],[2,3],[3,3],[0,0],[1,2],[0,2,3],[2,2],[2,2]]:[[4,0],[2,2],[1,2],[2,3],[1,3],[0,0],[1,2],[2,0,3],[2,2],[2,2]];
  for(const selections of route){selections.forEach((index,side)=>r.game.choose(side,index));await drain(r,r.game.speak());}
  assert.equal(r.game.state.mode,'end');assert.equal(r.game.state.results.filter(v=>v==='defeated').length,passed?9:10);
  assert.ok(r.events.some(e=>e.kind==='text'&&e.value.value.includes(passed?'9体撃破':'10体撃破')));
  assert.equal(r.game.state.scene,SCENE_COUNT);assert.equal(r.game.state.background,'home_door');assert.equal(r.game.state.enemy,'none');
  assert.equal(r.game.state.durations.length,10);assert.ok(r.game.state.durations.every(Number.isFinite));
  const share=new URL(resultShareUrl(r.game.state));assert.equal(share.origin,'https://x.com');assert.equal(share.pathname,'/intent/tweet');assert.equal(share.searchParams.get('url'),'https://qiita.com/DaisukeDaisuke/items/32cf05c0d4255401b1e7');assert.ok(share.searchParams.get('text').includes(`${passed?9:10}体撃破`));assert.ok(share.searchParams.get('text').includes('#Qiitaアベントカレンダー'));
  await r.game.start();assert.deepEqual(r.game.state.results,Array(SCENE_COUNT).fill(null));assert.deepEqual(r.game.state.failures,Array(SCENE_COUNT).fill(0));assert.equal(r.game.state.turn,1);
});
test('旧式color互換と不正タグ拒否',()=>{
  assert.equal(parseScript('<color=#0x1111111>色</color>',data)[0].color,'#111111');
  for(const s of ['<unknown>','<background=no>','<enemy=no>','<pose=no>','<sfx=no>','<rules=10>','<menu=10>','<go=11>','<wait=5001>','<wait=-1>','<wait=1.5>','<shake=13,1>','<shake=1,4>','<damage=enemy,50,scope_exit>','<damage=enemy,100,no>','<color=red>x</color>','<color=#123456>x','<color=#123456><color=#123456>x</color></color>','<fault>text','<go=1><wait>','<wait'])assert.throws(()=>parseScript(s,data),undefined,s);
});
test('共有文は結果と各戦の時間を使い、ローカルのURLを投稿しない',()=>{
  const url=new URL(resultShareUrl({results:Array(10).fill('defeated'),failures:[2,3,0,0,0,0,0,0,0,0],durations:[3600000,62000,...Array(8).fill(0)]}));
  assert.match(url.searchParams.get('text'),/言い直し5回/);assert.match(url.searchParams.get('text'),/1時間1分2秒/);
  assert.equal(url.searchParams.get('url'),'https://qiita.com/DaisukeDaisuke/items/32cf05c0d4255401b1e7');
});
test('第8戦は中央未選択なら確定できず、選択した空欄は反応を実行する',async()=>{
  const r=rig();await r.game.enter(7);assert.deepEqual(r.game.state.selection,[null,null,null]);
  r.game.choose(0,2);r.game.choose(2,0);assert.equal(await r.game.speak(),false);
  r.game.choose(1,3);await drain(r,r.game.speak());
  assert.equal(r.game.state.scene,7);assert.equal(r.game.state.failures[7],1);assert.deepEqual(r.game.state.selection,[null,null,null]);
  assert.ok(r.events.some(e=>e.kind==='spoken'&&e.value==='「私」は「無限です」'));
});
test('第8戦の二つの正解は両方ともHP0を記録し、第9戦の二語入力へ戻る',async()=>{
  for(const words of [['私','攻撃力'],['君','守備力']]){
    const r=rig();await r.game.enter(7);r.clock.advance(3456);
    const scene=data.scenes[7],p=scene.patterns.find(p=>p.noun===words[0]&&p.attribute===words[1]&&p.verb==='0です');
    choosePattern(r.game,scene,p);await drain(r,r.game.speak());
    assert.equal(r.game.state.results[7],'defeated');assert.equal(r.game.state.durations[7],3456);assert.equal(r.game.state.scene,8);assert.deepEqual(r.game.state.selection,[null,null]);
    assert.equal(r.events.filter(e=>e.kind==='damage').length,1);
    assert.equal(formatStatement(scene,p),`「${words[0]}」の「${words[1]}」は「0です」`);
  }
});
test('第8戦の第三項目欠落・重複・未定義項目を検出する',()=>{
  for(const change of [s=>s.patterns.pop(),s=>s.patterns.push(s.patterns[0]),s=>{s.patterns[0].attribute='未定義の項目';}]){
    const bad=structuredClone(data);change(bad.scenes[7]);assert.throws(()=>validateData(bad));
  }
});
