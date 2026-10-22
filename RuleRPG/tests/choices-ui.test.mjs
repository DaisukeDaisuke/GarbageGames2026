import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game,GameClock,SCENE_COUNT,choiceGroups,selectionWords,formatStatement} from '../source/core.mjs';
const root=new URL('../',import.meta.url);
const [spec,ui,template]=await Promise.all(['specification.md','source/ui.mjs','source/template.html'].map(f=>readFile(new URL(f,root),'utf8')));
const data=JSON.parse(spec.match(/```json\s*\n([\s\S]*?)\n```/)[1]);
// A DOM test double runs the production choice-rendering functions and click
// handlers. This verifies bindings and state; it does not verify CSS layout.
class Element {
  constructor(){this.children=[];this.dataset={};this.attributes={};this.hidden=false;this.disabled=false;this.events={};this.textContent='';const set=new Set();this.classList={toggle:(k,on)=>on?set.add(k):set.delete(k)};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(k,v){this.attributes[k]=v;}
  getAttribute(k){return this.attributes[k];}
  addEventListener(k,fn){this.events[k]=fn;}
  click(){if(!this.disabled)this.events.click?.({stopPropagation(){}});}
  focus(){}
}
function setup(){
  const elements=new Map([...template.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  const $=id=>{assert.ok(elements.has(id),`実テンプレートに${id}が存在する`);return elements.get(id);};
  const document={createElement:()=>new Element(),querySelectorAll:selector=>{assert.equal(selector,'.word');return ['nouns','attributes','verbs'].flatMap(id=>$(id).children);}};
  let views,pending;
  const clock=new GameClock(),game=new Game(data,clock,{event:(kind,value,s)=>{
    if(kind==='menu')views.buildMenu(s);if(kind==='selection')views.selectionUI(s);if(kind==='state')views.stateUI(s);
  }});
  const source=ui.slice(ui.indexOf('function stateUI('),ui.indexOf('function renderRules('));
  const handlers=["$('speak').addEventListener(","$('continue').addEventListener("].map(prefix=>ui.split('\n').find(line=>line.startsWith(prefix))).join('\n');
  const act=fn=>{pending=fn();},soundBank={unlock:async()=>{}};
  views=new Function('data','document','$','game','SCENE_COUNT','choiceGroups','selectionWords','formatStatement','act','soundBank',source+'\n'+handlers+'\nreturn {buildMenu,selectionUI,stateUI};')(data,document,$,game,SCENE_COUNT,choiceGroups,selectionWords,formatStatement,act,soundBank);
  const choose=(id,text)=>{const b=$(id).children.find(b=>b.textContent===text);assert.ok(b,`${id}に${text}ボタンが存在する`);b.click();};
  const finish=async()=>{
    for(let i=0;i<20;i++){await Promise.resolve();if(game.state.mode==='manual')$('continue').click();else if(game.state.mode==='choice')break;}
    await pending;
  };
  return {$,game,choose,finish};
}
for(const [noun,attribute] of [['私','攻撃力'],['君','守備力']])test(`実UI関数の3欄ボタンから${noun}・${attribute}・0ですを確定して第9戦へ進む`,async()=>{
  const r=setup();await r.game.enter(7);
  assert.equal(r.$('attributes-field').hidden,false);assert.equal(r.$('choice-hint').textContent,'みっつ選んで、言う。');
  assert.deepEqual(r.$('attributes').children.map(b=>b.textContent),['攻撃力','0','守備力','空欄']);
  assert.deepEqual(r.$('verbs').children.map(b=>b.dataset.side),[2,2,2,2]);
  r.choose('nouns',noun);r.choose('verbs','0です');assert.equal(r.$('speak').disabled,true);
  r.choose('attributes',attribute);assert.equal(r.$('speak').disabled,false);
  assert.equal(r.$('statement').textContent,`「${noun}」の「${attribute}」は「0です」`);
  r.$('speak').click();await r.finish();
  assert.equal(r.game.state.scene,8);assert.equal(r.game.state.results[7],'defeated');
  assert.equal(r.$('attributes-field').hidden,true);assert.equal(r.$('attributes').children.length,0);
  assert.equal(r.$('verbs').children[0].dataset.side,1);assert.equal(r.$('choice-hint').textContent,'ふたつ選んで、言う。');
});
test('実UI関数で空欄を選び直すと解除され、失敗後は三欄とも未選択に戻る',async()=>{
  const r=setup();await r.game.enter(7);r.choose('nouns','私');r.choose('attributes','空欄');r.choose('verbs','無限です');
  assert.equal(r.$('statement').textContent,'「私」は「無限です」');assert.equal(r.$('speak').disabled,false);
  r.choose('attributes','空欄');assert.equal(r.$('speak').disabled,true);r.choose('attributes','空欄');r.$('speak').click();await r.finish();
  assert.deepEqual(r.game.state.selection,[null,null,null]);assert.equal(r.$('speak').disabled,true);assert.equal(r.game.state.failures[7],1);
});
