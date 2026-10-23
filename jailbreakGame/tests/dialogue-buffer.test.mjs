import test from 'node:test';
import assert from 'node:assert/strict';
import {bufferedPoses} from '../src/dialogue-buffer.mjs';
test('phone portraits change every two messages and survive back navigation and save reload',()=>{
  const cache={},pool=['a','b','c','d','e'];let calls=0;
  const ids=bufferedPoses(cache,'repair',6,pool,()=>{calls++;return .4;});
  assert.equal(calls,3);assert.equal(ids[0],ids[1]);assert.equal(ids[2],ids[3]);assert.notEqual(ids[1],ids[2]);
  const restored=JSON.parse(JSON.stringify(cache));
  const reread=bufferedPoses(restored,'repair',6,pool,()=>{throw Error('must not roll on reread');});
  assert.deepEqual(reread,ids);for(const page of [5,4,3,2,1,0,1,2])assert.equal(reread[page],ids[page]);
});
