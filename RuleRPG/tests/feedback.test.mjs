import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GameClock} from '../source/core.mjs';
import {ImpactEffect,impactFrame} from '../source/impact.mjs';
import {SoundBank} from '../source/sound.mjs';

test('HPは振動後に赤い残量を減らし、最後は通常表示に戻る',()=>{
  const config={before:100,after:0,angle:0,distance:80};
  assert.equal(impactFrame(90,config).fill,100);
  assert.notEqual(impactFrame(90,config).shake,0);
  const start=impactFrame(180,config);assert.equal(start.shake,0);assert.equal(start.fill,0);assert.equal(start.trail,100);
  const halfway=impactFrame(480,config);assert.ok(halfway.trail>0&&halfway.trail<100);
  assert.equal(impactFrame(780,config).trail,0);
  assert.equal(impactFrame(1200,config).opacity,0);assert.equal(impactFrame(1200,config).done,true);
});
test('0ダメージは数字と赤色の反応だけでHPを減らさない',()=>{
  for(let t=0;t<=1400;t+=10){const f=impactFrame(t,{before:100,after:100,angle:1,distance:80});assert.equal(f.fill,100);assert.equal(f.trail,100);}
  assert.ok(impactFrame(200,{before:100,after:100,angle:1,distance:80}).tint>0);
});
test('数字は上下左右へ飛び、フェードアウトする。ランダム値はHPに影響しない',()=>{
  const frames=[0,Math.PI/2,Math.PI,Math.PI*1.5].map(angle=>impactFrame(900,{before:100,after:0,angle,distance:80}));
  assert.ok(frames[0].x>0&&frames[2].x<0);assert.ok(frames[1].y>0&&frames[3].y<0);
  for(const f of frames){assert.equal(f.fill,0);assert.equal(f.trail,0);assert.ok(f.opacity>0&&f.opacity<1);}
});
test('非表示・モーダル中は演出が止まり、再開・キャンセル・次の発言を正しく処理',()=>{
  const clock=new GameClock(),frames=[],effect=new ImpactEffect(clock,f=>frames.push(f),{random:()=>.4});
  effect.start(100,100,0);clock.advance(300);const frozen=frames.at(-1);clock.active=false;clock.advance(5000);assert.equal(frames.at(-1),frozen);
  clock.active=true;clock.advance(300);assert.ok(frames.at(-1).trail<frozen.trail);
  effect.reset(100);clock.advance(5000);assert.equal(frames.at(-1).fill,100);assert.equal(frames.at(-1).done,true);
  effect.start(0,100,100);clock.advance(1200);assert.equal(effect.current,null);assert.equal(frames.at(-1).amount,0);
});
test('動きを減らす設定では飛行・拡大・振動を止める',()=>{
  const f=impactFrame(70,{before:100,after:0,angle:2,distance:80,reduced:true});
  assert.equal(f.x,0);assert.equal(f.y,0);assert.equal(f.scale,1);assert.equal(f.shake,0);
});
function audioRig({deferred=false,rejectDecode=false}={}) {
  const played=[],errors=[],jobs=[];
  const context={state:'suspended',destination:{},resume(){this.state='running';return Promise.resolve();},
    decodeAudioData(bytes){assert.ok(bytes.byteLength>0);if(rejectDecode)return Promise.reject(new Error('decode'));if(deferred)return new Promise(resolve=>jobs.push(()=>resolve({duration:1})));return Promise.resolve({duration:1});},
    createGain(){return {gain:{value:0},connect(){return this;},disconnect(){}};},
    createBufferSource(){return {connect(){return this;},disconnect(){},start(){played.push(this);},stop(){this.stopped=true;this.onended?.();}};}};
  const bank=new SoundBank({sword:{src:'data:audio/mpeg;base64,AQID',volume:.6}},{createContext:()=>context,onError:error=>errors.push(error)});
  return {bank,context,played,errors,jobs};
}
test('音は初期ON、開始操作内で再生許可を取得し、OFFで即停止',async()=>{
  const r=audioRig();assert.equal(r.bank.enabled,true);const ready=r.bank.unlock();assert.equal(r.context.state,'running');await ready;
  assert.equal(await r.bank.play('sword'),true);assert.equal(r.played.length,1);
  r.bank.setEnabled(false);assert.equal(r.played[0].stopped,true);assert.equal(await r.bank.play('sword'),false);
  r.bank.setEnabled(true);assert.equal(await r.bank.play('sword'),true);
});
test('音源のデコード待ち中にミュート・中断すると遅れて音が出ない',async()=>{
  for(const action of ['mute','inactive','stop']){
    const r=audioRig({deferred:true}),pending=r.bank.play('sword');
    if(action==='mute')r.bank.setEnabled(false);else if(action==='inactive')r.bank.setActive(false);else r.bank.stop();
    r.jobs.forEach(done=>done());assert.equal(await pending,false);assert.equal(r.played.length,0);
  }
});
test('音源読み込み失敗は通知し、ゲームを落とさない',async()=>{
  const r=audioRig({rejectDecode:true});assert.equal(await r.bank.play('sword'),false);assert.ok(r.errors.at(-1) instanceof Error);
});
test('完成HTMLに全7音源の実バイトとクレジットが含まれる',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const manifest=JSON.parse(await readFile(new URL('../audio/manifest.json',import.meta.url),'utf8'));
  const sounds=JSON.parse(html.match(/<script id="sounds" type="application\/json">([^<]*)<\/script>/)[1]);
  assert.equal(Object.keys(sounds).length,7);
  for(const [key,item] of Object.entries(manifest.sounds)){
    const original=await readFile(new URL('../audio/'+item.file,import.meta.url));
    assert.deepEqual(Buffer.from(sounds[key].src.split(',')[1],'base64'),original);
  }
  assert.ok(html.includes('https://otologic.jp/'));assert.ok(html.includes('https://creativecommons.org/licenses/by/4.0/'));
  assert.ok(html.includes('音 ON'));assert.ok(!html.includes('/*__SOUNDS__*/'));
});
