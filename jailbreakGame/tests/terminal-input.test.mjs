import test from 'node:test';
import assert from 'node:assert/strict';
import {Room} from '../src/room.mjs';
import {Physical,socketGeometry} from '../src/physical.mjs';
import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url),'utf8'));
const surfaces=JSON.parse(readFileSync(new URL('../assets/surfaces.json',import.meta.url),'utf8'));
test('focused computer and device views remove all workshop click targets underneath',()=>{
  for(const mode of ['pc','device','dock','overview']){
    const s={ctx:{restore(){}},hits:[{id:'room-pc',x:1,y:2,w:3,h:4},{id:'device-screen',x:2,y:3,w:4,h:5}]};
    const room=new Room(s,{sockets:[]},{});room.mode=mode;room.startHit=0;room.transform={x:0,y:0,scale:1};room.end();
    assert.equal(s.hits.length,mode==='overview'?2:0);
  }
});
test('the reported DVD socket is on the screen bezel, not floating below the machine',()=>{
  const model=c.devices.find(d=>d.id==='H_B_016'),b={x:0,y:0,w:193,h:141};
  const g=socketGeometry(model,model.ports[0],0,b,surfaces[model.id].ports[0]);
  assert.ok(g.x>75&&g.x<82);assert.ok(g.y>87&&g.y<93);
  assert.equal(socketGeometry(model,model.ports[0],4,b,surfaces[model.id].ports[0]).visible,false);
});
test('the cube status background follows its sloping screen instead of painting a box on the bezel',()=>{
  const calls=[],ctx={beginPath(){},moveTo(...p){calls.push(p)},lineTo(...p){calls.push(p)},closePath(){},fill(){}};
  const physical=new Physical({ctx,rect(){assert.fail('must draw the calibrated polygon')}},{},surfaces);
  physical.screenBackground(c.devices.find(d=>d.id==='H_A_003'),{x:20,y:30,w:173,h:170},'#000');
  assert.equal(calls.length,4);assert.ok(calls[0][1]<calls[1][1]);assert.ok(calls[3][1]<calls[2][1]);
});
test('USB targets match the sockets already painted in the reported devices',()=>{
  for(const [id,w,h,expected] of [['H_D_016',112,204,[86,194]],['H_A_003',173,170,[112.5,132]]]){
    const model=c.devices.find(d=>d.id===id),calibration=surfaces[id].ports[0];
    const g=socketGeometry(model,model.ports[0],0,{x:0,y:0,w,h},calibration);
    assert.ok(Math.abs(g.x-expected[0])<1);assert.ok(Math.abs(g.y-expected[1])<1);
    assert.equal(calibration.art_socket,true);
    assert.equal(socketGeometry(model,model.ports[0],4,{x:0,y:0,w,h},calibration).visible,false);
  }
});
