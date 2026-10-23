import test from 'node:test';
import assert from 'node:assert/strict';
import {endingUnlocked,ENDING_CREDITS} from '../src/ending.mjs';
import {STORY_EPISODES,finishStory} from '../src/story.mjs';
import {createGame} from '../src/core.mjs';
import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url),'utf8'));
test('credits unlock only after the final story is finished and do not mutate progress',()=>{
  const state=createGame(c),snapshot=structuredClone(state);
  assert.equal(endingUnlocked(state),false);assert.deepEqual(state,snapshot);
  const earlier=finishStory(state,STORY_EPISODES.at(-2));assert.equal(endingUnlocked(earlier),false);
  const finished=finishStory(earlier,STORY_EPISODES.at(-1));assert.equal(endingUnlocked(finished),true);
  assert.deepEqual(finished.run,state.run);
  assert.equal(endingUnlocked(JSON.parse(JSON.stringify(finished))),true);
});
test('six photographs follow the requested credit order',()=>{
  assert.deepEqual(ENDING_CREDITS.map(c=>c.title),['Developer','Story','Music','Director','Publisher','Hosting','SpecialThanks']);
  assert.deepEqual(ENDING_CREDITS[1].lines,['GPT6 Chat xhigh','DaisukeDasiuke']);
  assert.deepEqual(ENDING_CREDITS.filter(c=>c.photo).map(c=>c.photo),[1,2,3,4,5,6]);
  assert.deepEqual(ENDING_CREDITS.at(-1).lines,['You']);
});
