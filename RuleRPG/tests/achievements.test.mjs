import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game,GameClock,formatDuration} from '../source/core.mjs';
import {AchievementJournal,ACHIEVEMENTS_KEY,attemptKey} from '../source/achievements.mjs';
const spec=await readFile(new URL('../specification.md',import.meta.url),'utf8');
const data=JSON.parse(spec.match(/```json\s*\n([\s\S]*?)\n```/)[1]);
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function storageRig(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
test('試した発言だけ保存し、重複・未定義を除外して再読込する',()=>{
  const storage=storageRig(),journal=new AchievementJournal(data,()=>storage);
  assert.equal(journal.keys.size,0);journal.record(1,'ラブレター','食べます');journal.record(1,'ラブレター','食べます');
  assert.equal(journal.record(8,'ない','ない'),false);
  const restored=new AchievementJournal(data,()=>storage);
  assert.equal(restored.keys.size,1);assert.ok(restored.has(1,'ラブレター','食べます'));assert.equal(restored.has(1,'ラブレター','抜きます'),false);
});
test('別タブの発言を消さずに統合する',()=>{
  const storage=storageRig(),a=new AchievementJournal(data,()=>storage),b=new AchievementJournal(data,()=>storage);
  a.record(1,'ラブレター','してください');b.record(1,'ラブレター','抜きます');a.reload();
  assert.equal(a.keys.size,2);assert.equal(b.keys.size,2);
});
test('ストレージ拒否でも記録を保持し、保存失敗を通知する',()=>{
  const notices=[],journal=new AchievementJournal(data,()=>{throw new Error('SecurityError');},error=>notices.push(error));
  assert.equal(journal.record(1,'ラブレター','していません'),true);assert.ok(journal.has(1,'ラブレター','していません'));assert.ok(notices.every(Boolean));
  const full=storageRig();full.setItem=()=>{throw new Error('QuotaExceededError');};
  const quota=new AchievementJournal(data,()=>full,error=>notices.push(error));quota.record(0,'帰宅','する');assert.ok(quota.has(0,'帰宅','する'));assert.equal(notices.at(-1),true);
});
test('壊れた保存データから復帰し、不正なキーを採用しない',()=>{
  const storage=storageRig();storage.setItem(ACHIEVEMENTS_KEY,'{broken');
  const journal=new AchievementJournal(data,()=>storage);journal.record(1,'ラブレター','食べます');assert.equal(new AchievementJournal(data,()=>storage).keys.size,1);
  storage.setItem(ACHIEVEMENTS_KEY,JSON.stringify({version:1,tried:[null,{},'evil',attemptKey(1,'ラブレター','食べます')]}));
  assert.equal(new AchievementJournal(data,()=>storage).keys.size,1);
});
test('選択だけでは実績を付けず、確定時に記録し、再開始でも残す',async()=>{
  const storage=storageRig(),journal=new AchievementJournal(data,()=>storage),clock=new GameClock();
  const game=new Game(data,clock,{event:(kind,value)=>{if(kind==='attempt')journal.record(value.sceneId,value.noun,value.verb);}});
  await game.start();game.choose(0,1);assert.equal(await game.speak(),false);assert.equal(journal.keys.size,0);
  game.choose(1,0);const pending=game.speak();assert.ok(journal.has(0,'テレポート','する'));await game.start();await pending;assert.equal(journal.keys.size,1);
});
test('各戦の読解・失敗時間を含め、HP0の時点で撃破時間を固定する',async()=>{
  const clock=new GameClock(),game=new Game(data,clock);await game.start();clock.advance(1500);
  game.choose(0,1);game.choose(1,0);const failed=game.speak();clock.advance(2500);game.continue();await failed;
  clock.active=false;clock.advance(60000);clock.active=true;
  game.choose(0,4);game.choose(1,0);const success=game.speak();clock.advance(1234);game.continue();await flush();
  assert.equal(game.state.hp,0);assert.equal(game.state.durations[0],5234);
  clock.advance(20000);game.continue();await success;assert.equal(game.state.durations[0],5234);
  clock.advance(3723000);game.choose(0,2);game.choose(1,2);const second=game.speak();game.continue();await flush();
  assert.equal(game.state.durations[1],3723000);assert.equal(formatDuration(game.state.durations[1]),'1時間2分3秒');
  await game.start();await second;assert.deepEqual(game.state.durations,Array(data.scenes.length).fill(null));
});
test('スライム通過時間を記録し、撃破扱いにしない',async()=>{
  const clock=new GameClock(),game=new Game(data,clock);await game.start();clock.advance(4000);game.choose(0,0);game.choose(1,0);const running=game.speak();clock.advance(1200);game.continue();await running;
  assert.equal(game.state.results[0],'passed');assert.equal(game.state.durations[0],5200);assert.equal(game.state.durations[1],null);
});
test('ゴーストの待機3秒を撃破時間へ含める',async()=>{
  const clock=new GameClock(),game=new Game(data,clock);await game.enter(3);game.state.results=['defeated','defeated','defeated',null,null];clock.advance(1000);
  game.choose(0,2);game.choose(1,3);const running=game.speak();clock.advance(2999);await flush();assert.equal(game.state.durations[3],null);
  clock.advance(1);await flush();assert.equal(game.state.durations[3],4000);game.continue();await running;
});
test('時間表示はゼロ・分・時間を省略せず、未計測をゼロに偽装しない',()=>{
  assert.equal(formatDuration(0),'0時間0分0秒');assert.equal(formatDuration(59999),'0時間0分59秒');assert.equal(formatDuration(60000),'0時間1分0秒');assert.equal(formatDuration(3600000),'1時間0分0秒');assert.equal(formatDuration(null),'未計測');
});
test('5戦版の記録を保持したまま、第10戦の発言も同じ保存先へ追加する',()=>{
  const storage=storageRig();storage.setItem(ACHIEVEMENTS_KEY,JSON.stringify({version:1,tried:[attemptKey(0,'帰宅','する'),attemptKey(1,'ラブレター','食べます')]}));
  const journal=new AchievementJournal(data,()=>storage);journal.record(9,'私','帰宅しました');
  const restored=new AchievementJournal(data,()=>storage);assert.equal(restored.keys.size,3);assert.ok(restored.has(0,'帰宅','する'));assert.ok(restored.has(1,'ラブレター','食べます'));assert.ok(restored.has(9,'私','帰宅しました'));
});
test('第8戦の旧二語記録を攻撃力へ移行し、守備力と空欄の記録を区別する',()=>{
  const storage=storageRig();storage.setItem(ACHIEVEMENTS_KEY,JSON.stringify({version:1,tried:[attemptKey(7,'私','0です'),attemptKey(1,'ラブレター','食べます')]}));
  const journal=new AchievementJournal(data,()=>storage);
  assert.ok(journal.has(7,'私','0です','攻撃力'));assert.equal(journal.has(7,'私','0です','守備力'),false);
  journal.record(7,'私','0です','守備力');journal.record(7,'私','0です','');
  const restored=new AchievementJournal(data,()=>storage);assert.equal(restored.keys.size,4);
  for(const attr of ['攻撃力','守備力',''])assert.ok(restored.has(7,'私','0です',attr));
  assert.ok(restored.has(1,'ラブレター','食べます'));
});
