export const BACKGROUNDS = ['museum_gate','refund_counter','document_archive','appeal_office','terms_throne','border_checkpoint','forest_path','moon_bridge','last_train_platform','home_door'];
export const ENEMIES = ['exception_slime','refund_mimic','invalid_golem','reply_ghost','revision_king','permit_crab','echo_machine','infinity_hermit','last_train_crow','home_lock'];
export const SCENE_COUNT = ENEMIES.length;
const POSES = ['depart','withdraw','split','shred','stamp','collapse','fault'];
const TERMINALS = ['fault','go','menu','end'];
export const choiceGroups=scene=>scene.attributes?[scene.nouns,scene.attributes,scene.verbs]:[scene.nouns,scene.verbs];
export function selectionWords(scene,selection) {
  const groups=choiceGroups(scene),words=groups.map((group,i)=>selection[i]===null?undefined:group[selection[i]]);
  return {noun:words[0],verb:words.at(-1),attribute:scene.attributes?words[1]:undefined};
}
export const matchesPattern=(pattern,words)=>pattern.noun===words.noun&&pattern.verb===words.verb&&pattern.attribute===words.attribute;
export function formatStatement(scene,words) {
  const middle=words.attribute===undefined?'の「項目」':words.attribute===''?'':`の「${words.attribute}」`;
  return scene.template.replace('{noun}',words.noun??'ことば').replace('{attribute}',middle).replace('{verb}',words.verb??'つづき');
}
export function parseScript(script, data) {
  const out = []; let color = null, position = 0;
  const fail = msg => { throw new Error(`脚本エラー: ${msg}`); };
  const integer = (value, max) => /^(0|[1-9]\d*)$/.test(value) && Number(value) <= max;
  const pushText = value => { if (value) out.push({op:'text', value, color}); };
  for (const match of script.matchAll(/<([^<>]*)>/g)) {
    const before = script.slice(position, match.index);
    if (/[<>]/.test(before)) fail('不正なタグ');
    pushText(before); position = match.index + match[0].length;
    const tag = match[1];
    if (tag.startsWith('color=')) {
      if (color) fail('色の入れ子');
      const value = tag.slice(6);
      if (/^#[0-9a-fA-F]{6}$/.test(value)) color = value;
      else if (/^#0x[0-9a-fA-F]{1,8}$/.test(value)) color = '#' + (parseInt(value.slice(3),16) & 0xffffff).toString(16).padStart(6,'0');
      else fail('色の形式');
      continue;
    }
    if (tag === '/color') { if (!color) fail('対応しない閉じ色'); color = null; continue; }
    const equal = tag.indexOf('=');
    const op = equal < 0 ? tag : tag.slice(0,equal);
    const arg = equal < 0 ? undefined : tag.slice(equal+1);
    if (['Page','next_turn','fault','result','reset','end'].includes(op)) {
      if (arg !== undefined) fail(op);
    } else if (op === 'wait') { if (arg !== undefined && !integer(arg,5000)) fail('wait'); }
    else if (['go','menu','rules'].includes(op)) { if (!integer(arg, op === 'go' ? SCENE_COUNT : SCENE_COUNT-1)) fail(op); }
    else if (op === 'background') { if (!BACKGROUNDS.includes(arg)) fail('背景ID'); }
    else if (op === 'enemy') { if (![...ENEMIES,'none'].includes(arg)) fail('敵ID'); }
    else if (op === 'pose') { if (!POSES.includes(arg)) fail('演出ID'); }
    else if (op === 'sfx') { if (arg !== 'select') fail('効果音ID'); }
    else if (op === 'timer') { if (arg !== 'reply,3000') fail('timer'); }
    else if (op === 'damage') {
      const parts = (arg || '').split(',');
      if (parts.length !== 3 || parts[0] !== 'enemy' || parts[1] !== '100' || !Object.hasOwn(data.damageReasons, parts[2])) fail('damage');
    } else if (op === 'shake') {
      const parts = (arg || '').split(',');
      if (parts.length !== 2 || parts.some(v=>!/^\d+(\.\d+)?$/.test(v)) || Number(parts[0])>12 || Number(parts[1])>3) fail('shake');
    } else fail(`未知の命令 ${op}`);
    out.push({op,arg});
  }
  const last = script.slice(position);
  if (/[<>]/.test(last)) fail('閉じていないタグ');
  pushText(last);
  if (color) fail('閉じていない色');
  out.forEach((token,i)=>{if(TERMINALS.includes(token.op) && i!==out.length-1) fail('終端の後に命令');});
  return out;
}
export function validateData(data) {
  const counts = {total:0, defeated:0, failed:0, passed:0};
  if (data.scenes.length !== SCENE_COUNT) throw new Error('場面数');
  for (const [i,scene] of data.scenes.entries()) {
    if (scene.id !== i || scene.background !== BACKGROUNDS[i] || scene.enemy !== ENEMIES[i]) throw new Error('場面ID');
    const enter=parseScript(scene.onEnter,data);
    if(enter.at(-1).op!=='menu' || Number(enter.at(-1).arg)!==i) throw new Error('開始脚本');
    const pairs=new Set();
    for(const p of scene.patterns) {
      const key=JSON.stringify([p.noun,p.attribute,p.verb]);
      if(!scene.nouns.includes(p.noun)||!scene.verbs.includes(p.verb)||(scene.attributes?!scene.attributes.includes(p.attribute):p.attribute!==undefined)||pairs.has(key)) throw new Error('組合せ不整合');
      pairs.add(key); counts.total++;
      const tokens=parseScript(p.script,data), end=tokens.at(-1), damages=tokens.filter(t=>t.op==='damage');
      if(end.op==='fault') {
        if(tokens.at(-2).op!=='next_turn'||tokens.filter(t=>t.op==='next_turn').length!==1||damages.length) throw new Error('失敗脚本');
        counts.failed++;
      } else if(end.op==='go' && Number(end.arg)===i+1) {
        if(damages.length===1 && p.script.includes('100ダメージ')) counts.defeated++;
        else if(damages.length===0 && i===0 && p.noun==='同意' && p.verb==='する') counts.passed++;
        else throw new Error('成功脚本');
      } else throw new Error('反応の終端');
    }
    if(pairs.size!==choiceGroups(scene).reduce((n,group)=>n*group.length,1)) throw new Error('直積の欠落');
  }
  Object.values(data.actions).forEach(s=>parseScript(s,data));
  Object.values(data.endings).forEach(s=>{if(parseScript(s,data).at(-1).op!=='end') throw new Error('エンディング');});
  if(counts.passed!==1 || counts.total!==data.scenes.reduce((n,s)=>n+choiceGroups(s).reduce((m,group)=>m*group.length,1),0)) throw new Error('件数不一致');
  return counts;
}
export class GameClock {
  constructor() { this.time=0; this.active=true; this.jobs=[]; this.listeners=new Set(); }
  advance(ms) {
    if(!this.active) return;
    this.time+=ms;
    for(const listener of this.listeners) listener(this.time);
    const ready=this.jobs.filter(j=>j.at<=this.time); this.jobs=this.jobs.filter(j=>j.at>this.time);
    ready.forEach(j=>j.resolve(true));
  }
  wait(ms) { if(ms===0) return Promise.resolve(true); return new Promise(resolve=>this.jobs.push({at:this.time+ms,resolve})); }
  cancel() { this.jobs.splice(0).forEach(j=>j.resolve(false)); }
}
export class Game {
  constructor(data,clock,hooks={}) {
    validateData(data); this.data=data; this.clock=clock; this.hooks=hooks; this.epoch=0; this.executionId=0; this.manual=null;
    this.fresh();
  }
  fresh() { this.state={scene:null,hp:100,enemy:ENEMIES[0],background:BACKGROUNDS[0],rules:null,selection:[null,null],turn:1,failures:Array(SCENE_COUNT).fill(0),results:Array(SCENE_COUNT).fill(null),durations:Array(SCENE_COUNT).fill(null),sceneStartedAt:null,mode:'start',timer:null,reason:null}; }
  emit(kind,value) { this.hooks.event?.(kind,value,this.state); }
  cancel() { this.epoch++; this.clock.cancel(); if(this.manual){this.manual(false);this.manual=null;} this.emit('cancel'); }
  async start() { this.cancel(); this.fresh(); return this.run(this.data.actions.start); }
  clearSelection() {this.state.selection=this.state.scene<SCENE_COUNT&&this.state.scene!==null?choiceGroups(this.data.scenes[this.state.scene]).map(()=>null):[null,null];}
  choose(side,index) {
    if(this.state.mode!=='choice'||!Number.isInteger(side)) return;
    const options=choiceGroups(this.data.scenes[this.state.scene])[side];
    if(!options)return;
    if(!Number.isInteger(index)||index<0||index>=options.length) return;
    this.state.selection[side]=this.state.selection[side]===index?null:index;
    this.emit('sfx','select'); this.emit('selection');
  }
  async speak() {
    if(this.state.mode!=='choice'||this.state.selection.includes(null)) return false;
    const scene=this.data.scenes[this.state.scene],words=selectionWords(scene,this.state.selection);
    const pattern=scene.patterns.find(p=>matchesPattern(p,words));
    if(!pattern) throw new Error('未定義の発言');
    this.emit('attempt',{sceneId:scene.id,noun:pattern.noun,verb:pattern.verb,attribute:pattern.attribute});
    this.snapshot={hp:this.state.hp,enemy:this.state.enemy,background:this.state.background,rules:this.state.rules};
    this.state.reason=null; this.emit('clear'); this.emit('spoken',formatStatement(scene,words));
    // Explicit command data determines the visual result; no random damage or text guessing.
    this.emit('attack',{damage:parseScript(pattern.script,this.data).some(t=>t.op==='damage')?100:0});
    await this.run(pattern.script); return true;
  }
  continue() { if(!this.manual || this.state.mode!=='manual') return false; const resolve=this.manual; this.manual=null; this.state.mode='playing'; this.emit('state'); resolve(true); return true; }
  async enter(id) {
    if(!Number.isInteger(id)||id<0||id>SCENE_COUNT)throw new Error('場面ID');
    this.cancel(); this.state.scene=id; this.clearSelection();this.state.reason=null;this.state.timer=null;
    this.state.sceneStartedAt=id<SCENE_COUNT?this.clock.time:null;
    this.emit('clear'); this.emit('scene');
    if(id===SCENE_COUNT) {
      if(this.state.results.slice(1).some(x=>x!=='defeated')||!['defeated','passed'].includes(this.state.results[0])) throw new Error('結果不整合');
      return this.run(this.data.endings[this.state.results[0]]);
    }
    return this.run(this.data.scenes[id].onEnter);
  }
  async run(script) {
    const tokens=parseScript(script,this.data), epoch=++this.epoch, executionId=++this.executionId;
    const applied=new Set(); this.state.mode='playing';this.emit('state');
    for(let position=0;position<tokens.length;position++) {
      if(epoch!==this.epoch) return;
      const t=tokens[position]; this.position=position;
      const once=()=>{const key=`${executionId}:${position}`;if(applied.has(key)) return false;applied.add(key);return true;};
      if(t.op==='text') this.emit('text',t);
      else if(t.op==='Page'||(t.op==='wait'&&t.arg===undefined)) {
        this.state.mode='manual';this.emit('state');
        const ok=await new Promise(resolve=>{this.manual=resolve;});
        if(!ok||epoch!==this.epoch)return;
        if(t.op==='Page')this.emit('clear');
      } else if(t.op==='wait') {
        this.state.mode='timed';this.emit('state');
        if(!await this.clock.wait(Number(t.arg))||epoch!==this.epoch)return;
        this.state.mode='playing'; this.emit('state');
      } else if(t.op==='reset') {this.fresh();this.emit('reset');}
      else if(t.op==='background') {this.state.background=t.arg;this.emit('background');}
      else if(t.op==='enemy') {this.state.enemy=t.arg;this.state.hp=t.arg==='none'?null:100;this.emit('enemy');}
      else if(t.op==='rules') {this.state.rules=Number(t.arg);this.emit('rules');}
      else if(t.op==='menu') {this.state.mode='choice';this.clearSelection();this.emit('menu');return;}
      else if(t.op==='next_turn'&&once()) {this.state.failures[this.state.scene]++;this.state.turn++;}
      else if(t.op==='fault') {
        Object.assign(this.state,this.snapshot);this.clearSelection();this.state.reason=null;this.state.timer=null;this.state.mode='choice';
        this.emit('fault');this.emit('menu');return;
      } else if(t.op==='damage'&&once()) {
        if(this.state.hp!==100)throw new Error('ダメージの重複');
        this.state.hp=0;this.state.durations[this.state.scene]=Math.max(0,this.clock.time-this.state.sceneStartedAt);this.state.reason=this.data.damageReasons[t.arg.split(',')[2]];this.emit('damage');
      } else if(t.op==='timer') {this.state.timer={deadline:this.clock.time+3000};this.emit('timer');}
      else if(t.op==='pose')this.emit('pose',t.arg);
      else if(t.op==='shake')this.emit('shake',t.arg.split(',').map(Number));
      else if(t.op==='sfx')this.emit('sfx',t.arg);
      else if(t.op==='go') {
        if(this.state.scene!==null && this.state.scene<SCENE_COUNT) {
          this.state.results[this.state.scene]=this.state.hp===0?'defeated':'passed';
          if(this.state.hp!==0)this.state.durations[this.state.scene]=Math.max(0,this.clock.time-this.state.sceneStartedAt);
          if(this.state.hp!==0 && this.state.scene!==0)throw new Error('不正な通過');
        }
        return this.enter(Number(t.arg));
      } else if(t.op==='result') {this.emit('result');}
      else if(t.op==='end') {this.state.mode='end';this.emit('end');return;}
    }
  }
}
export function formatDuration(ms) {
  if(!Number.isFinite(ms)||ms<0)return '未計測';
  const seconds=Math.floor(ms/1000);
  return `${Math.floor(seconds/3600)}時間${Math.floor(seconds/60)%60}分${seconds%60}秒`;
}
export function resultShareUrl(state) {
  const defeated=state.results.filter(result=>result==='defeated').length;
  const failed=state.failures.reduce((sum,count)=>sum+count,0);
  const duration=state.durations.reduce((sum,ms)=>sum+(Number.isFinite(ms)?ms:0),0);
  const text=`利用規約RPGで無事帰宅！ ${defeated}体撃破／言い直し${failed}回。各戦の所要時間合計 ${formatDuration(duration)}。 #利用規約RPG #Qiitaアベントカレンダー`;
  const url=new URL('https://x.com/intent/tweet');
  url.searchParams.set('text',text);
  url.searchParams.set('url','https://qiita.com/DaisukeDaisuke/items/32cf05c0d4255401b1e7');
  return url.href;
}
