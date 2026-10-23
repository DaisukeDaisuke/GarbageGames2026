import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame} from '../src/core.mjs';
import {exportSave,importSave} from '../src/storage.mjs';
import {STORY_EPISODES,storyPending,finishStory,promotionCall,storyShareUrl} from '../src/story.mjs';

const c=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url)));
function deliver(state,runId=state.run.id,practice=false){
  const serial=state.meta.history.length+1;
  state.meta.history.push({attempt_id:`${runId}:attempt:${serial}`,practice});
  return state;
}

test('first run unlocks exactly five episodes at deliveries 3–7',()=>{
  let state=createGame(c);
  assert.equal(STORY_EPISODES.length,38);
  for(let i=1;i<=7;i++){
    deliver(state);
    const event=storyPending(state);
    if(i<3){assert.equal(event,null,`delivery ${i}`);continue;}
    assert.equal(event.id,STORY_EPISODES[i-3].id,`delivery ${i}`);
    state=finishStory(state,event);
    assert.equal(storyPending(state),null,'one story per delivery');
  }
  assert.equal(state.meta.story.heard.length,5);
  assert.equal(storyPending(state),null,'later chapters need reemployment');
});

test('after reemployment the congratulations come first, then one episode every real delivery',()=>{
  let state=createGame(c,'8715312367912450');
  for(let i=1;i<=7;i++){
    deliver(state,1);
    const event=storyPending(state);
    if(event)state=finishStory(state,event);
  }
  state.run.id=2;
  const greeting=storyPending(state);
  assert.equal(greeting.id,'welcome-2');
  assert.match(greeting.pages.join(''),/おめでとう/);
  assert.match(greeting.pages.join(''),/準備金/);
  assert.deepEqual(storyPending(importSave(exportSave(state),c)),greeting);
  state=finishStory(state,greeting);
  assert.equal(storyPending(state),null);

  for(let i=1;i<=33;i++){
    if(i===6){
      state.run.id=3;
      const nextGreeting=storyPending(state);
      assert.equal(nextGreeting.id,'welcome-3');
      assert.notEqual(nextGreeting.pages[0],greeting.pages[0]);
      state=finishStory(state,nextGreeting);
      assert.equal(storyPending(state),null);
    }
    deliver(state);
    const event=storyPending(state);
    assert.equal(event?.id,STORY_EPISODES[4+i].id,`post-rehire delivery ${i}`);
    state=finishStory(state,event);
    state=importSave(exportSave(state),c);
    assert.equal(storyPending(state),null,'narrative may not repeat without a new delivery');
  }
  assert.deepEqual(state.meta.story.heard,STORY_EPISODES.map(e=>e.id));
  deliver(state);
  assert.equal(storyPending(state),null,'chapter 38 is the last');
  state.run.status='retired';
  assert.equal(storyPending(state),null);
});

test('practice deliveries do not advance the one-delivery story counter',()=>{
  let state=createGame(c);
  for(let i=0;i<7;i++){
    deliver(state,1);
    if(storyPending(state))state=finishStory(state,storyPending(state));
  }
  state.run.id=2;
  state=finishStory(state,storyPending(state));
  deliver(state,2,true);deliver(state,2,true);
  assert.equal(storyPending(state),null);
  deliver(state,2);
  assert.equal(storyPending(state)?.id,STORY_EPISODES[5].id);
  state=finishStory(state,storyPending(state));
  deliver(state,2,true);
  assert.equal(storyPending(state),null);
  deliver(state,2);
  assert.equal(storyPending(state).id,STORY_EPISODES[6].id);
});

test('old saves with already satisfied thresholds reveal only one chapter per new delivery',()=>{
  let state=createGame(c);state.run.id=3;
  for(let i=1;i<=46;i++)deliver(state,i<=7?1:2);
  state.meta.story={heard:[],greetedRuns:[3]};
  for(let i=0;i<STORY_EPISODES.length;i++){
    assert.equal(storyPending(state).id,STORY_EPISODES[i].id);
    state=finishStory(state,storyPending(state));
    assert.equal(storyPending(state),null);
    deliver(state,3);
  }
  assert.equal(storyPending(state),null);
});

test('the closing story is final, sharing is an optional property on the episode',()=>{
  const finale=STORY_EPISODES.at(-1);
  assert.equal(finale.id,'receiver');
  assert.equal(finale.after,33);
  const displayLock=STORY_EPISODES.find(e=>e.id==='display_lock');
  assert.equal(displayLock.after,18);
  assert.match(displayLock.pages.join(''),/展示用モード/);
  assert.match(displayLock.pages.join(''),/PoC/);
  assert.match(finale.pages.join(''),/クソアプリ2026/);
  assert.match(finale.pages.join(''),/退職するのも自由/);
  const share=storyShareUrl(finale);
  assert.ok(share);
  assert.equal(new URL(share).searchParams.get('text'),finale.tweet.text);
  assert.equal(new URL(share).searchParams.get('url'),finale.tweet.url);
  assert.equal(storyShareUrl({}),null);
  assert.equal(storyShareUrl({tweet:{}}),null);
  assert.equal(storyShareUrl(STORY_EPISODES.find(e=>e.id==='broker_hospitality')),null);
  assert.equal(storyShareUrl({tweet:{text:'感想',url:'javascript:alert(1)'}}),'https://twitter.com/intent/tweet?text='+encodeURIComponent('感想'));
  assert.equal(STORY_EPISODES.find(e=>e.id==='broker_hospitality').pages.join('').includes('現地集合'),true);
  assert.match(STORY_EPISODES.find(e=>e.id==='reply').pages.join(''),/送迎/);
  assert.match(STORY_EPISODES.find(e=>e.id==='reply').pages.join(''),/あいつの身が危ない/);
  assert.match(STORY_EPISODES.find(e=>e.id==='archive').pages[1],/思うことがたくさん/);
});

test('career guidance is the existing CALL06 and bizarre world events are absent from live dialogue',()=>{
  const event=c.events.find(e=>e.id==='CALL06');
  assert.equal(event.threshold,5);
  assert.match(event.pages.join(''),/転職先/);
  assert.match(event.pages.join(''),/パソコン.*人事/);
  assert.doesNotMatch(event.pages.join(''),/再就職|契約を更新|10SP/);
  assert.match(STORY_EPISODES.find(e=>e.id==='jobc').pages.join(''),/もう少し続けてみないか/);
  const text=[...STORY_EPISODES.flatMap(e=>e.pages),...c.events.flatMap(e=>e.pages)].join('');
  for(const old of ['第七埠頭','中央の認証局','再接続三十七年','渡り鳥','未来からの納品票','町から消えた喫茶店']){
    assert.equal(text.includes(old),false,old);
  }
});

test('later credit calls preserve unlock identity without restarting the first-run lessons',()=>{
  const state=createGame(c),event=c.events.find(e=>e.id==='CALL02');
  assert.equal(promotionCall(state,event),event);
  state.run.id=2;
  const repeat=promotionCall(state,event);
  assert.equal(repeat.id,event.id);
  assert.equal(repeat.rank,event.rank);
  assert.notDeepEqual(repeat.pages,event.pages);
  assert.match(repeat.pages.join(''),/KomaOS/);
});
