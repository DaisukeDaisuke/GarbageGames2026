const data=JSON.parse(document.getElementById('scenario').textContent);
const assets=JSON.parse(document.getElementById('assets').textContent);
const sounds=JSON.parse(document.getElementById('sounds').textContent);
const $=id=>document.getElementById(id);
const clock=new GameClock();
const journal=new AchievementJournal(data,()=>window.localStorage,failed=>{$('achievements-storage').hidden=!failed;});
let mapScene=0,mapAttribute=0;
let visible=true,lastTime=performance.now();
const soundBank=new SoundBank(sounds,{
  createContext:()=>new (window.AudioContext||window.webkitAudioContext)(),
  onError:error=>{$('audio-notice').hidden=!error;$('audio-notice').textContent=error?'音を再生できませんでした。「音 OFF → ON」で再試行できます。':'';}
});
const impact=new ImpactEffect(clock,frame=>{
  const number=$('damage-number');number.hidden=frame.done;number.textContent=frame.amount===0?'0 HP':`−${frame.amount} HP`;
  number.style.transform=`translate(-50%,-50%) translate(${frame.x}px,${frame.y}px) scale(${frame.scale})`;
  number.style.opacity=String(frame.opacity);
  $('hp-track').style.transform=`translateX(${frame.shake}px)`;
  $('hp-fill').style.width=`${frame.fill}%`;$('hp-lag').style.width=`${frame.trail}%`;
  $('hp-tint').style.opacity=String(frame.tint);
});
function showImpact(amount,before,after){
  const width=$('stage').getBoundingClientRect().width;
  impact.start(amount,before,after,{distance:Math.min(90,width*.16),reduced:window.matchMedia('(prefers-reduced-motion: reduce)').matches});
}
const sceneNames=data.scenes.map(scene=>scene.name);
const backgroundNames=data.scenes.map(scene=>scene.backgroundAlt);
data.scenes.forEach((scene,index)=>{
  const step=document.createElement('span');step.textContent=`${String(index+1).padStart(2,'0')} ${scene.place}`;$('progress').append(step);
});
function sound(kind){void soundBank.play(kind==='withdraw'?'depart':kind);}
function clearEffects(keepImpact=false){
  $('enemy-wrap').className='';$('battle').classList.remove('shake');$('stamp').hidden=true;$('timer').hidden=true;
  if(!keepImpact)impact.reset(game?.state.hp??100);
  $('demand').classList.remove('dropped');
  $('slices').replaceChildren();
}
function stateUI(s){
  const choosing=s.mode==='choice';
  $('choices').hidden=s.scene===SCENE_COUNT;
  document.querySelectorAll('.word').forEach(button=>button.disabled=!choosing);
  $('speak').disabled=!choosing||s.selection.includes(null);
  $('continue').hidden=s.mode!=='manual';
  $('turn').textContent=s.scene===SCENE_COUNT?'':`TURN ${String(s.turn).padStart(2,'0')}`;
  if(s.mode==='manual')$('continue').focus({preventScroll:true});
  $('battle').classList.toggle('idle',choosing);
}
function selectionUI(s){
  document.querySelectorAll('.word').forEach(button=>button.setAttribute('aria-pressed',String(s.selection[Number(button.dataset.side)]===Number(button.dataset.index))));
  if(s.scene===null||s.scene===SCENE_COUNT)return;
  const scene=data.scenes[s.scene];
  $('statement').textContent=formatStatement(scene,selectionWords(scene,s.selection));
  $('statement').classList.toggle('ready',!s.selection.includes(null));stateUI(s);
}
function buildMenu(s){
  const scene=data.scenes[s.scene];
  const ids=scene.attributes?['nouns','attributes','verbs']:['nouns','verbs'];
  $('attributes-field').hidden=!scene.attributes;$('attributes').replaceChildren();
  $('word-columns').classList.toggle('three-parts',!!scene.attributes);
  $('choice-hint').textContent=scene.attributes?'みっつ選んで、言う。':'ふたつ選んで、言う。';
  choiceGroups(scene).forEach((words,side)=>{
    const target=$(ids[side]);target.replaceChildren();
    words.forEach((word,index)=>{
      const button=document.createElement('button');button.type='button';button.className='word';button.textContent=word===''?'空欄':word;
      button.dataset.side=side;button.dataset.index=index;button.setAttribute('aria-pressed','false');
      button.addEventListener('click',()=>game.choose(side,index));target.append(button);
    });
  });selectionUI(s);
}
function renderRules(s){
  const scene=data.scenes[s.rules];$('rules').replaceChildren();$('rule-count').textContent=`全${scene.rules.length}条`;
  scene.rules.forEach((line,index)=>{
    // Document labels are separated, but every supplied word remains visible.
    const match=line.match(/^(【[^】]+】)(.*)$/);
    if(match){const label=document.createElement('div');label.className='rule-label';label.textContent=match[1];$('rules').append(label);}
    const row=document.createElement('div');row.className='rule';const number=document.createElement('span');number.className='rule-no';number.textContent=String(index+1).padStart(2,'0');
    const text=document.createElement('p');text.textContent=match?match[2]:line;row.append(number,text);$('rules').append(row);
  });
}
function enemyUI(s){
  const none=s.enemy==='none';$('enemy-wrap').hidden=none;$('enemy-hud').hidden=none;
  if(none)return;
  const index=ENEMIES.indexOf(s.enemy);$('enemy-image').src=assets[s.enemy];$('enemy-image').alt=sceneNames[index];
  $('golem-label').hidden=s.enemy!=='invalid_golem';$('enemy-name').textContent=sceneNames[index];
  $('demand').textContent=data.scenes[index].demand;
  $('hp-text').textContent=`HP ${s.hp} / 100`;
  $('hp-track').setAttribute('aria-valuenow',String(s.hp));
  if(!impact.current)impact.reset(s.hp);
}
function backgroundUI(s){$('background').src=assets[s.background];$('background').alt=backgroundNames[BACKGROUNDS.indexOf(s.background)];}
function pose(name){
  const wrap=$('enemy-wrap');wrap.className='';
  if(name==='split'){
    $('slices').replaceChildren();
    for(let i=0;i<2;i++){
      const strip=document.createElement('i');strip.style.left='0';strip.style.width='100%';
      strip.style.clipPath=i===0?'inset(0 50% 0 0)':'inset(0 0 0 50%)';
      strip.style.backgroundImage=`url("${assets[game.state.enemy]}")`;strip.style.setProperty('--split-direction',i===0?-1:1);strip.className='mimic-half';$('slices').append(strip);
    }wrap.className='shredding';
  }else if(name==='shred'){
    $('slices').replaceChildren();
    for(let i=0;i<12;i++){
      const strip=document.createElement('i');strip.style.left='0';strip.style.width='100%';
      strip.style.clipPath=`inset(0 ${100-(i+1)*100/12}% 0 ${i*100/12}%)`;
      strip.style.backgroundImage=`url("${assets[game.state.enemy]}")`;strip.style.animationDelay=`${i*.014}s`;$('slices').append(strip);
    }wrap.className='shredding';
  }else wrap.className=name==='stamp'?'stamp-pose':name==='fault'?'fault-pose':name;
  if(name==='stamp'||name==='collapse'){$('stamp').textContent=name==='stamp'?'撤回済':'未成立';$('stamp').hidden=false;}
  if(name==='depart'||name==='withdraw'){$('demand').classList.add('dropped');sound(name);}
  else if(['split','shred','stamp','collapse'].includes(name))sound('defeat');
}
function resultsUI(s){
  $('rules-panel').hidden=true;$('choices').hidden=true;$('results').hidden=false;$('results').replaceChildren();
  const title=document.createElement('h2');title.className='result-title';title.textContent=`${s.results.filter(r=>r==='defeated').length}体撃破`; $('results').append(title);
  sceneNames.forEach((name,index)=>{
    const row=document.createElement('div');row.className='result-row';
    const label=document.createElement('span');label.textContent=name;
    const result=document.createElement('b');const defeated=s.results[index]==='defeated';result.textContent=defeated?'撃破':'通過';
    const attempts=document.createElement('small');attempts.textContent=`失敗 ${s.failures[index]}回`;
    const time=document.createElement('span');time.className='result-time';time.textContent=`${defeated?'撃破':'通過'}まで ${formatDuration(s.durations[index])}${defeated?'':'（未撃破）'}`;
    row.append(label,result,attempts,time);$('results').append(row);
  });
  const note=document.createElement('p');note.className='result-time-note';note.textContent='各戦の開始からのプレイ時間。画面を離れていた時間と、マップ・仕様書などを開いていた時間は含みません。';$('results').append(note);
  const share=document.createElement('a');share.id='share-x';share.className='share-x';share.textContent='X';share.href=resultShareUrl(s);share.target='_blank';share.rel='noopener noreferrer';share.setAttribute('aria-label','結果をXで投稿する（新しいタブで開きます）');share.title='結果をXで投稿';$('results').append(share);
}
function renderMap() {
  const scene=data.scenes[mapScene];
  $('map-scene-title').textContent=scene.title;
  $('map-stages').replaceChildren();
  data.scenes.forEach((entry,index)=>{
    const button=document.createElement('button');button.type='button';button.textContent=`${String(index+1).padStart(2,'0')} ${entry.place}`;
    button.setAttribute('aria-pressed',String(index===mapScene));button.setAttribute('aria-label',entry.title+'の実績');
    button.addEventListener('click',()=>{mapScene=index;mapAttribute=0;renderMap();$('map-stages').children[index].focus({preventScroll:true});});$('map-stages').append(button);
  });
  $('map-attributes').hidden=!scene.attributes;$('map-attributes').replaceChildren();
  const attribute=scene.attributes?.[mapAttribute];
  scene.attributes?.forEach((word,index)=>{
    const button=document.createElement('button');button.type='button';button.textContent=word===''?'空欄':word;
    button.setAttribute('aria-pressed',String(index===mapAttribute));
    button.addEventListener('click',()=>{mapAttribute=index;renderMap();$('map-attributes').children[index].focus({preventScroll:true});});$('map-attributes').append(button);
  });
  const table=$('achievement-grid');table.replaceChildren();
  const caption=document.createElement('caption');caption.className='sr-only';caption.textContent=scene.title+'の発言一覧';table.append(caption);
  const head=document.createElement('thead'),header=document.createElement('tr'),corner=document.createElement('th');corner.textContent='ことば';corner.scope='col';header.append(corner);
  scene.verbs.forEach(verb=>{const th=document.createElement('th');th.scope='col';th.textContent=verb;header.append(th);});head.append(header);table.append(head);
  const body=document.createElement('tbody');
  scene.nouns.forEach(noun=>{
    const row=document.createElement('tr'),label=document.createElement('th');label.scope='row';label.textContent=noun;row.append(label);
    scene.verbs.forEach(verb=>{
      const cell=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='map-cell';
      const tried=journal.has(scene.id,noun,verb,attribute);button.classList.toggle('tried',tried);button.textContent=tried?'●':'·';
      const words={noun,verb,attribute},statement=formatStatement(scene,words);
      button.setAttribute('aria-label',`${statement}：${tried?'試した発言':'未探索'}`);button.setAttribute('aria-controls','map-reaction');
      const text=tried?parseScript(scene.patterns.find(p=>matchesPattern(p,words)).script,data).map(t=>t.op==='text'?t.value:t.op==='Page'?'\n\n':'').join(''):'まだ試していない発言です。';
      const preview=()=>{
        table.querySelectorAll('.inspected').forEach(el=>el.classList.remove('inspected'));button.classList.add('inspected');
        $('map-statement').textContent=statement;$('map-dialogue').textContent=text;
        $('map-reaction').classList.toggle('discovered',tried);
      };
      button.addEventListener('pointerenter',preview);button.addEventListener('focus',preview);button.addEventListener('click',preview);
      cell.append(button);row.append(cell);
    });body.append(row);
  });table.append(body);
  $('map-statement').textContent='言葉の足あと';$('map-dialogue').textContent='マスを選ぶと、ここに台詞が表示されます。';$('map-reaction').classList.remove('discovered');
}
function event(kind,value,s){
  if(kind==='reset'){
    clearEffects();$('welcome').hidden=true;$('play-area').hidden=false;$('rules-panel').hidden=false;$('results').hidden=true;$('restart').hidden=true;$('reason').hidden=true;$('fault-notice').hidden=true;
  }else if(kind==='scene'){
    clearEffects();$('reason').hidden=true;$('fault-notice').hidden=true;$('speaker').textContent='ものがたり';
    window.scrollTo({top:0,behavior:'instant'});
    [...$('progress').children].forEach((el,i)=>{el.classList.toggle('active',i===s.scene);el.classList.toggle('done',!!s.results[i]);el.setAttribute('aria-current',i===s.scene?'step':'false');});
    if(s.scene<SCENE_COUNT)sound('encounter');
  }else if(kind==='clear')$('dialogue-text').replaceChildren();
  else if(kind==='text'){const span=document.createElement('span');span.textContent=value.value;if(value.color)span.style.color=value.color;$('dialogue-text').append(span);}
  else if(kind==='background')backgroundUI(s);
  else if(kind==='enemy')enemyUI(s);
  else if(kind==='rules')renderRules(s);
  else if(kind==='menu')buildMenu(s);
  else if(kind==='selection')selectionUI(s);
  else if(kind==='attempt')journal.record(value.sceneId,value.noun,value.verb,value.attribute);
  else if(kind==='state')stateUI(s);
  else if(kind==='spoken'){$('speaker').textContent=value;$('fault-notice').hidden=true;$('reason').hidden=true;clearEffects();}
  else if(kind==='attack'){sound('sword');if(value.damage===0)showImpact(0,s.hp,s.hp);}
  else if(kind==='fault'){clearEffects(true);enemyUI(s);backgroundUI(s);$('fault-notice').hidden=false;pose('fault');sound('fault');}
  else if(kind==='damage'){
    showImpact(100,100,s.hp);enemyUI(s);$('reason').textContent=s.reason;$('reason').hidden=false;sound('damage');
  }else if(kind==='pose')pose(value);
  else if(kind==='shake'){
    const scale=$('stage').getBoundingClientRect().width/480;
    $('battle').style.setProperty('--shake-px',`${value[0]*scale}px`);$('battle').style.setProperty('--shake-time',`${value[1]}s`);$('battle').classList.add('shake');
  }else if(kind==='sfx')sound(value);
  else if(kind==='timer'){$('timer').hidden=false;updateTimer();}
  else if(kind==='result')resultsUI(s);
  else if(kind==='end'){$('restart').hidden=false;stateUI(s);$('restart').focus({preventScroll:true});}
  else if(kind==='cancel'){clearEffects();soundBank.stop();}
}
let game;
function fatal(error){
  game?.cancel();if(game)game.state.mode='error';$('fatal').hidden=false;$('fatal').textContent=`読み込みまたは設計データのエラー: ${error.message}。ページを再読み込みしてください。`;
  document.querySelectorAll('#start,#speak,#continue,.word,#restart').forEach(button=>button.disabled=true);
}
function act(fn){void soundBank.unlock();Promise.resolve().then(fn).catch(fatal);}
function updateTimer(){const timer=game?.state.timer;if(timer){const left=Math.max(0,timer.deadline-clock.time);$('timer').textContent=left>0?`受付済み · ${(left/1000).toFixed(1)}秒`:'3秒経過 · 異議成立';}}
function modalOpen(){return ['spec-dialog','audio-dialog','achievements-dialog'].some(id=>$(id).open);}
function updateActivity(){clock.active=!document.hidden&&visible&&!modalOpen();soundBank.setActive(clock.active);$('app').classList.toggle('paused',!clock.active);lastTime=performance.now();}
function frame(now){clock.advance(Math.max(0,now-lastTime));lastTime=now;requestAnimationFrame(frame);}
clock.listeners.add(updateTimer);
document.addEventListener('visibilitychange',updateActivity);
if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;updateActivity();}).observe($('app'));
requestAnimationFrame(frame);
$('sound').addEventListener('click',()=>{soundBank.setEnabled(!soundBank.enabled);$('sound').textContent=soundBank.enabled?'音 ON':'音 OFF';$('sound').setAttribute('aria-pressed',String(soundBank.enabled));$('audio-notice').hidden=true;sound('select');});
$('start').addEventListener('click',()=>act(()=>game.start()));
$('restart').addEventListener('click',()=>act(()=>game.start()));
$('speak').addEventListener('click',()=>act(()=>game.speak()));
$('continue').addEventListener('click',e=>{e.stopPropagation();void soundBank.unlock();game.continue();});
$('dialogue').addEventListener('click',e=>{if(!e.target.closest('button')){void soundBank.unlock();game.continue();}});
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!modalOpen()&&game?.state.mode==='manual') {e.preventDefault();e.stopPropagation();if(!e.repeat){void soundBank.unlock();game.continue();}}
});
$('achievements-open').addEventListener('click',()=>{
  journal.reload();mapScene=game?.state.scene<SCENE_COUNT&&game?.state.scene!==null?game.state.scene:0;
  mapAttribute=0;
  renderMap();$('achievements-dialog').showModal();updateActivity();
});
$('achievements-close').addEventListener('click',()=>$('achievements-dialog').close());
$('achievements-dialog').addEventListener('close',()=>{updateActivity();$('achievements-open').focus({preventScroll:true});});
$('achievements-dialog').addEventListener('click',e=>{if(e.target!==$('achievements-dialog'))return;const rect=$('achievements-dialog').getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)$('achievements-dialog').close();});
window.addEventListener('storage',e=>{if(e.key===ACHIEVEMENTS_KEY){journal.reload();if($('achievements-dialog').open)renderMap();}});
$('spec-text').textContent=JSON.parse($('specification').textContent);
$('spec-open').addEventListener('click',()=>{$('spec-dialog').showModal();updateActivity();});
$('spec-close').addEventListener('click',()=>$('spec-dialog').close());
$('spec-dialog').addEventListener('close',()=>{updateActivity();$('spec-open').focus({preventScroll:true});});
$('spec-dialog').addEventListener('click',e=>{if(e.target!==$('spec-dialog'))return;const rect=$('spec-dialog').getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)$('spec-dialog').close();});
Object.values(sounds).forEach(item=>{
  const row=document.createElement('li');row.textContent=`${item.label}：${item.file}`;$('audio-list').append(row);
});
$('audio-open').addEventListener('click',()=>{$('audio-dialog').showModal();updateActivity();});
$('audio-close').addEventListener('click',()=>$('audio-dialog').close());
$('audio-dialog').addEventListener('close',()=>{updateActivity();$('audio-open').focus({preventScroll:true});});
$('audio-dialog').addEventListener('click',e=>{if(e.target!==$('audio-dialog'))return;const rect=$('audio-dialog').getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)$('audio-dialog').close();});
try{
  game=new Game(data,clock,{event});
  document.documentElement.style.setProperty('--dialogue-frame',`url("${assets.dialogue_frame}")`);
  backgroundUI(game.state);enemyUI(game.state);$('enemy-hud').hidden=true;
  await Promise.all(Object.entries(assets).map(([id,src])=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve();img.onerror=()=>reject(new Error(`画像 ${id} を読み込めません`));img.src=src;})));
  $('start').disabled=false;$('start').textContent='冒険をはじめる →';
}catch(error){fatal(error);}
