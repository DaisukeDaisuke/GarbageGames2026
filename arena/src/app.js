import {skills,enemies,items,clone,Session,Screen,score,routes,learnable,stats,validAction,operation,totalBouts,serviceBouts} from './engine.js';
import {POLICIES,TRIAL_SEEDS,runTrial,createDuel,duelForecast} from './policies.js';
import {REQUIREMENTS} from './requirements.js';
import {randomSeedText,battlePresentation,skillSound} from './ui-model.js';
import {createViews} from './views.js';
import {createArenaViews} from './arena/views.js';
import {resultShareUrl} from './share.js';
import {challengerAppearance} from './arena/characters.js';
const $=s=>document.querySelector(s),app=$('#app'),modal=$('#modal'),tooltip=$('#tooltip');
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='void-pit-arena-v2';
let session=null,duel=null,champion=null,selectedChallenger=null,page='home',busy=false,animationTimer,noticeTimer,returnFocus=null,worker=null,trialResults=[],trialStarted=false,trialFailure='',audioOn=true,motion=true;
let seedDraft=randomSeedText(),victory=null;
const liveAudio=new Set();
const selections={};
const active=()=>duel||session?.run;
const asset=id=>ASSETS[id];
const enemyAsset=id=>enemies[id].name.toLowerCase().replaceAll(' ','-');
function specification(k){
 if(k.startsWith('skill:')){const id=Number(k.split(':')[1]),s=skills[id],d=DETAILS.skills[s.name];return ['SKILL-'+String(id+1).padStart(2,'0'),s.japanese+'の詳細。開発者の技概要についての指摘に対応しました。',d.paragraphs.join('\n\n')];}
 if(k.startsWith('item:')){const id=Number(k.split(':')[1]),t=items[id],d=DETAILS.items[t.name];return ['ITEM-'+String(id+1).padStart(2,'0'),t.japanese+'の能力を数値で説明します。',d.paragraphs.join('\n\n')];}
 return REQUIREMENTS[k];
}
const button=(label,action,spec='help',cls='',extra='')=>`<button type="button" class="${cls}" data-action="${action}" data-spec="${spec}" ${extra}>${label}</button>`;
const note=k=>{const spec=specification(k);return `<div class="annotation"><button type="button" class="spec-mark" data-show-spec="${k}" aria-label="${spec[0]} の仕様">${spec[0]} · 仕様</button><span>${spec[1]}</span></div>`;};
const views=createViews({asset,esc,button,note,summary});
const arenaViews=createArenaViews({asset,esc,button,note,summary});
function notify(message,error=false){clearTimeout(noticeTimer);$('#notice').textContent=(error?'ERROR-01　':'')+message;noticeTimer=setTimeout(()=>$('#notice').textContent='',5500);}
function playSound(kind='ui'){
 if(!audioOn||!AUDIO[kind])return;
 try{const sound=new Audio(AUDIO[kind]);sound.volume=kind==='victory'?.55:.38;liveAudio.add(sound);sound.addEventListener('ended',()=>liveAudio.delete(sound),{once:true});sound.play().catch(()=>liveAudio.delete(sound));if(liveAudio.size>10){const oldest=liveAudio.values().next().value;oldest.pause();liveAudio.delete(oldest);}}catch{}
}
function persist(){if(!session)return;try{localStorage.setItem(key,JSON.stringify(session.record()));}catch{notify('ブラウザー内へ保存できません。「記録」から書き出してください。');}}
function hasSave(){try{return !!localStorage.getItem(key);}catch{return false;}}
function randomSeed(){return randomSeedText();}
function showModal(title,html,text=null){returnFocus=document.activeElement;tooltip.hidden=true;$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;if(text!==null){const pre=document.createElement('pre');pre.textContent=text;$('#modal-body').replaceChildren(pre);}if(!modal.open)modal.showModal();$('#modal-body').scrollTop=0;$('#modal-close').focus({preventScroll:true});}
function closeModal(){modal.close();tooltip.hidden=true;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});else app.querySelector('button')?.focus({preventScroll:true});}
$('#modal-close').addEventListener('click',closeModal);
modal.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
modal.addEventListener('click',e=>{if(e.target!==modal)return;const b=modal.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeModal();});
function tooltipFor(el){const spec=specification(el.dataset.spec);if(!spec)return;tooltip.innerHTML=`<strong>${spec[0]} / 設計意図</strong>${spec[2].split('\n\n').map(p=>`<p>${esc(p)}</p>`).join('')}<small>説明を置く仕様：修正方針を明示するための説明です。開発者の指摘を受けて対応しました。</small>`;tooltip.classList.toggle('readable-text',page!=='main'||active()?.screen!==1);tooltip.hidden=false;const b=el.getBoundingClientRect(),t=tooltip.getBoundingClientRect();tooltip.style.left=Math.max(10,Math.min(innerWidth-t.width-10,b.left))+'px';tooltip.style.top=Math.max(10,b.top>t.height+15?b.top-t.height-10:Math.min(innerHeight-t.height-10,b.bottom+10))+'px';}
document.addEventListener('pointerover',e=>{const t=e.target.closest('[data-spec]');if(t&&e.pointerType!=='touch')tooltipFor(t);});
document.addEventListener('pointerout',e=>{if(e.target.closest('[data-spec]')&&!tooltip.contains(e.relatedTarget))tooltip.hidden=true;});
tooltip.addEventListener('pointerleave',()=>tooltip.hidden=true);
document.addEventListener('focusin',e=>{if(e.target.matches('[data-spec]'))tooltipFor(e.target);});
document.addEventListener('focusout',()=>tooltip.hidden=true);
document.addEventListener('scroll',e=>{if(e.target!==tooltip&&!tooltip.contains(e.target))tooltip.hidden=true;},true);
function header(){return `<header class="topbar"><div class="brand" data-spec="decor" tabindex="0"><div class="brand-mark"><span>V</span></div><div><strong>VOID PIT</strong><small>BORROWED CROWN / UI仕様書つき闘技場</small></div></div><nav class="toolbar" aria-label="情報メニュー">${button('遊び方','help','help')}${session?button('技・状態','status','state'):''}${button('記録','records','save')}${button(audioOn?'音 ON':'音 OFF','sound','settings','optional')}${button('仕様書','spec','document')}</nav></header>`;}
function footer(){return `<footer class="footer"><div data-spec="decor" tabindex="0">VOID PIT: BORROWED CROWN <span class="gold"> / </span> UI仕様書つき闘技場</div><div class="footer-links">${button('仕様書','spec','document')}${button('UI台帳','ledger','help')}${button(motion?'動き：通常':'動き：控えめ','motion','settings')}${button(audioOn?'音：ON':'音：OFF','sound','settings')}${button('クレジット','credits','help')}</div></footer>`;}
function home(){return `<section class="landing" data-spec="background"><img fetchpriority="high" decoding="async" class="hero-knight" src="${asset('void-knight')}" alt="黒紫の重装をまとったVOID KNIGHT"><span class="landing-badge">UI REQUIREMENTS ATTACHED</span><div class="landing-copy"><span class="eyebrow">A COMMAND BATTLE / FIVE BOUTS</span><h1>VOID PIT</h1><div class="subtitle">BORROWED CROWN</div><h2>その一手にも、仕様があります。</h2><p class="intro">敵の次の行動を読み、5つの戦いを勝ち抜く。<br>すべての操作に、設計上の理由が添付されています。</p><div class="start-block">${button('闘技場に入る　↗','start','start','primary')}${note('start')}<div class="seed-field"><label for="seed">SEED</label><input id="seed" aria-label="大会seed（16桁の16進数）" value="${esc(seedDraft)}" maxlength="16" spellcheck="false" data-spec="seed">${button('↻','random','seed','','aria-label="新しいseedを選ぶ"')}</div>${note('seed')}<div class="file-actions">${hasSave()?button('続きから','resume','save'):''}${button('記録を読み込む','import','save')}</div></div></div></section><div class="manifest-strip"><div><strong>01 / 手動コマンドバトル</strong><p>手動選択です。自動戦闘はありません。自動選択は禁止です。</p></div><div><strong>02 / 技の装備は3枠</strong><p>3枠です。6枠ではありません。必ず3枠を使用します。</p></div><div><strong>03 / すべてのUIに仕様</strong><p>説明です。操作代行はありません。説明の説明もあります。</p></div></div>${note('background')}`;}
function runline(r){return `<div class="runline"><div class="stages" data-spec="progress" tabindex="0">${Array.from({length:totalBouts(r)},(_,i)=>`${i?'<span class="stage-line"></span>':''}<span class="stage ${i===r.bout?'active':i<r.bout?'done':''}"><i>${i<r.bout?'✓':String(i+1).padStart(2,'0')}</i><span class="stage-label">${i===totalBouts(r)-1?'決勝':i===totalBouts(r)-2?'準決勝':`第${i+1}戦`}</span></span>`).join('')}</div><div class="run-meta"><span class="seed-line mono">SEED ${r.seed}　/　</span><span class="gold">${r.gold} G</span>${duel?' / 追加対戦':''}</div></div>`;}
function states(f){const list=[];if(f.focus)list.push('FOCUS ×1.5');if(f.burn)list.push('BURN '+f.burn);if(f.bank)list.push('BANK '+f.bank);if(f.pending.power)list.push('CHARGE '+f.pending.power);if(f.rest)list.push('REST');return `<div class="state-tags" data-spec="state" tabindex="0">${list.length?list.map(x=>`<span class="${x.startsWith('BURN')?'danger':''}">${x}</span>`).join(''):'<span>状態：通常</span>'}</div>`;}
function hud(f,name,enemy=false){return `<div class="fighter-hud ${enemy?'enemy-hud':''}"><div class="fighter-name">${name}<small data-spec="spd" tabindex="0">SPD ${f.spd}</small></div><div data-spec="hp" tabindex="0"><div class="gauge-label"><span>HP</span><span>${f.hp} / ${f.max_hp}</span></div><div class="gauge" role="meter" aria-label="${name} HP" aria-valuenow="${f.hp}" aria-valuemin="0" aria-valuemax="${f.max_hp}"><span style="width:${f.hp/f.max_hp*100}%"></span></div></div><div data-spec="mp" tabindex="0"><div class="gauge-label"><span>MP</span><span>${f.mp} / ${f.max_mp}</span></div><div class="gauge mp"><span style="width:${f.mp/Math.max(1,f.max_mp)*100}%"></span></div></div>${states(f)}${note(enemy?'mp':'hp')}</div>`;}
function forecastText(r){const a=r.forecast;return a.stage===2?'休息 / REST':`${skills[a.skill].japanese} <small class="mono">${skills[a.skill].name}</small> ${a.stage===1?' / 発動':skills[a.skill].effects.some(e=>e[0]===8)?' / 溜め':''}`;}
function auditPanel(r){return `<section class="audit-panel"><span class="eyebrow">INTERFACE SPECIFICATION</span><span class="stamp">対応済み</span><h2>仕様に従って、<br>手動で選択してください。</h2><div class="audit-item"><strong>ACT-01 / 操作方針</strong><p>手動選択です。自動戦闘はありません。必ずプレイヤーが選びます。</p></div><div class="audit-item"><strong>SLOT-03 / 選択肢の整理</strong><p>技は3枠です。6枠ではありません。6枠への拡張は禁止です。</p></div><div class="audit-item"><strong>INPUT-01 / 入力経路の整合性</strong><p>入力経路に依存しない一貫した選択を提供します。自動入力は禁止です。</p></div>${note('help')}</section><section class="log-panel"><span class="eyebrow">BATTLE LOG / 行動記録</span><div class="log-lines" aria-live="polite">${r.log.map(s=>`<div>${esc(s)}</div>`).join('')}</div>${note('log')}<div class="recent"><span class="eyebrow">RECENT / 最近の6件</span><div class="recent-tags">${r.history.map(id=>`<span>${skills[id].name}</span>`).join('')||'<small class="muted">まだ記録はありません。</small>'}</div>${note('audit')}</div></section>`;}
function actionCard(r,id,index){
 const s=skills[id],k='skill:'+id,error=validAction(r,id);
 return `<div class="action-card ${index>=3?'equipped':''}">${button(`<div class="action-art">${views.image('skills',s.name,s.japanese+'のイメージ')}</div><span class="action-title"><strong>${s.japanese}</strong><small>${s.mp} MP</small></span><span class="action-effect">${s.description}</span><span class="key">${index>=3?`SLOT ${index-2} / ${s.name}`:s.name}</span>`,'use:'+id,k,'',error?`disabled title="${esc(error)}"`:'')}${note(k)}</div>`;
}
function battle(r){const name=duel?'CHALLENGER':enemies[r.nodes[r.node].enemy].name,art=duel?challengerAppearance(selectedChallenger).asset:enemyAsset(r.nodes[r.node].enemy);return `<div class="battle-grid"><main class="battle-main"><section class="arena" aria-label="闘技場"><div class="fighters-hud">${hud(r.you,'YOU')}${hud(r.enemy,name,true)}</div><div class="round-medallion">ROUND<strong>${String(r.round).padStart(2,'0')}</strong>/ 20</div><img class="sprite player" src="${asset('player')}" alt="あなたの闘士"><img class="sprite enemy ${duel?'challenger':''}" src="${asset(art)}" alt="${name}"><div class="sprite-label">${note('player')}</div><div class="sprite-label enemy-label">${note('art')}</div><div class="bg-note">${note('background')}</div></section><div class="forecast" data-spec="forecast" tabindex="0"><div><span class="eyebrow">ENEMY'S NEXT / 次の行動</span><strong>${forecastText(r)}</strong><div class="forecast-effect">${r.forecast.stage===2?'このラウンドは行動を休みます。':r.forecast.stage===1?`予約威力 ${r.enemy.pending.power} / ${r.enemy.pending.magic?'魔法':'物理'}`:skills[r.forecast.skill].description}</div></div>${note('forecast')}</div><div class="command-head"><strong>行動を選択</strong>${note('slots')}</div>${r.you.pending.power>0||r.you.rest?`<div class="next-action"><span class="eyebrow">${r.you.rest?'REST':'RELEASE'} / 予約された行動</span>${button(r.you.rest?'休息を進める →':'予約を発動する →','next','next','primary')}${note('next')}</div>`:`<div class="actions">${[0,1,2,...r.you.slots].map((id,i)=>actionCard(r,id,i)).join('')}</div>`}<form id="command-form" class="command-input"><input id="command" aria-label="完全名コマンド入力" placeholder="技の完全名を入力…" maxlength="64" autocomplete="off" spellcheck="false" list="commands" data-spec="input"><datalist id="commands">${[...new Set([0,1,2,...r.you.slots])].map(id=>`<option value="${skills[id].name}"></option>`).join('')}</datalist><button type="submit" data-spec="input">実行 ↵</button></form>${note('input')}${duel?note('duel'):''}</main><aside class="sidebar">${auditPanel(r)}</aside></div>`;}
function summary(r){return `<div class="summary-bar" data-spec="state" tabindex="0"><span>HP <strong>${r.you.hp}/${r.you.max_hp}</strong></span><span>MP <strong>${r.you.mp}/${r.you.max_mp}</strong></span><span>SPD <strong>${r.you.spd}</strong></span><span>所持金 <strong>${r.gold} G</strong></span><span>防具：${r.armor<0?'なし':items[r.armor].japanese}</span><span>装飾品：${r.charm<0?'なし':items[r.charm].japanese}</span></div>`;}
function routePage(r){return `<main class="route-page"><div class="section-head"><div><span class="eyebrow">CHOOSE YOUR PATH / BOUT ${r.bout+1}</span><h2>次の対戦相手を選ぶ</h2></div>${note('route')}</div>${summary(r)}<div class="route-grid">${routes(r).map((n,i)=>{const node=r.nodes[n],e=enemies[node.enemy];return `<article class="route-card"><img src="${asset(enemyAsset(node.enemy))}" alt="${e.name}"><div class="route-copy"><span class="eyebrow">ROUTE ${String(i+1).padStart(2,'0')}</span><h3>${e.name}</h3><div class="route-stats">HP ${e.hp}　/　SPD ${e.spd}</div><ul>${node.slots.map(id=>`<li>${skills[id].japanese} <small>${skills[id].name}</small></li>`).join('')}</ul>${note('art')}</div>${button('この相手と戦う　→','op:route '+n,'route','primary')}${note('route')}</article>`;}).join('')}</div>${r.bout>0?`<details><summary>前の試合の記録 / 自動戦闘はありません。</summary><div class="log-lines">${r.log.map(x=>`<div>${esc(x)}</div>`).join('')}</div></details>`:''}</main>`;}
function slotsView(r){return views.slots(r);}
function boothPage(r){return views.booth(r);}
function shopPage(r){return views.shop(r);}
function resultPage(r){const won=r.won,tier=r.reward===2?'金冠':'銀杯';return `<main class="result-page"><div class="result-grid"><div class="result-art"><img src="${asset(won?'player':'void-knight')}" alt="${won?'優勝したあなたの闘士':'VOID KNIGHT'}">${won&&!duel?'<span class="crown" aria-label="冠">♛</span>':''}</div><div class="result-copy"><span class="eyebrow">${duel?'CHALLENGER MATCH':'TOURNAMENT RESULT'}</span><h2>${won?duel?'挑戦者に勝利':'借りものの王冠':'闘技場に散る'}</h2><p>${duel?(won?'追加対戦に勝利しました。':'追加対戦に敗れました。')+'本編の優勝記録はそのままです。':won?`${tier}を獲得しました。大会監査が完了しました。`:`第${r.bout+1}戦で敗退しました。${r.round>=20?'20ラウンドの制限に達しました。':''}`}</p><div class="metrics"><div><small>${duel?'ROUND':'SCORE'}</small><strong>${duel?r.round:score(r).toLocaleString()}</strong></div><div><small>残り HP</small><strong>${r.you.hp}</strong></div><div><small>残り MP</small><strong>${r.you.mp}</strong></div></div>${duel?`${button('同じ状態から再戦','rematch','retry','primary')}${button('挑戦者一覧へ','challengers','back')}`:won?`${button('挑戦者と戦う　→','challengers','duel','primary')}${note('duel')}`:button('同じseedで再挑戦','retry','retry','primary')}<div class="file-actions">${button('記録を書き出す','export','save')}${!duel?button('新しい大会へ','home','retry'):''}</div><a class="share-x" href="${esc(resultShareUrl(r))}" target="_blank" rel="noopener noreferrer" aria-label="結果をXに投稿する" title="結果をXに投稿する">X</a>${note('result')}<div class="recent"><span class="eyebrow">RECENT / 最近の6件</span><div class="recent-tags">${r.history.map(id=>`<span>${skills[id].name}</span>`).join('')}</div>${note('audit')}</div></div></div></main>`;}
function challengerPage(){return arenaViews.challengers(champion,trialResults,selections,trialFailure);}
function render(){
 const shelfOffsets=new Map([...app.querySelectorAll('.gear-shelf')].map(shelf=>[shelf.id,shelf.scrollLeft]));
 tooltip.hidden=true;document.body.classList.toggle('no-motion',!motion);
 const r=active(),inBattle=page==='main'&&r?.screen===1;
 app.classList.toggle('readable-text',!inBattle);
 $('#notice').classList.toggle('readable-text',!inBattle);
 let content=page==='home'?home():page==='briefing'?views.briefing(r):page==='victory'?views.victory(r,victory):page==='challengers'?challengerPage():r?.screen===1?battle(r):r?.screen===0?routePage(r):r?.screen===2||r?.screen===4?boothPage(r):r?.screen===3?shopPage(r):resultPage(r);
 app.innerHTML=`<div class="shell">${header()}${!['home','briefing','challengers'].includes(page)?runline(r):''}${content}${footer()}</div>`;
 const seedInput=$('#seed');if(seedInput)seedInput.value=seedDraft;
 for(const scene of app.querySelectorAll('.arena,.landing,.route-card')){
  const img=document.createElement('img');img.className='scene-background';img.src=asset(duel?'algorithm-arena':'arena-background');img.alt='';img.setAttribute('aria-hidden','true');scene.prepend(img);
 }
 for(const shelf of app.querySelectorAll('.gear-shelf')){
  shelf.scrollLeft=shelfOffsets.get(shelf.id)||0;
  shelf.addEventListener('mousedown',e=>{if(e.target.closest('button,input,select,a'))e.stopImmediatePropagation();});
 }
 window.dragscroll?.reset();
}
function begin(seed){if(!/^[\da-f]{16}$/i.test(seed)){notify('seedは16桁の16進数で入力してください。',true);return;}clearTimeout(animationTimer);seedDraft=seed.toLowerCase();session=new Session(seedDraft,true);duel=null;champion=null;selectedChallenger=null;victory=null;page='briefing';busy=false;persist();render();}
function commit(command){
 if(busy||page!=='main')return;
 const r=active(),old=clone(r),wasBattle=r.screen===1;
 const error=duel?operation(r,command,{nextForecast:x=>duelForecast(x,selectedChallenger.policy)}):session.commit(command);
 if(error){notify(error+' 代わりの技は選びません。',true);return;}
 if(!duel){persist();if(r.screen===5&&r.won)champion=clone(r);}
 const win=wasBattle?battlePresentation(old,r):null;
 const finish=()=>{busy=false;app.classList.remove('is-resolving');if(win){victory=win;page='victory';playSound('victory');}render();};
 if(!wasBattle){playSound('ui');finish();return;}
 const id=command==='next'?old.you.pending.skill:skills.findIndex(s=>s.name===command.split(' ')[1]);
 const stage=old.you.pending.power>0?1:old.you.rest?2:0;
 playSound(skillSound(id,stage));
 const visual=$('.arena'),attacks=stage===1||(stage===0&&skills[id]?.effects.some(e=>e[0]===0)),enemyAttacks=old.forecast.stage===1||(old.forecast.stage===0&&skills[old.forecast.skill].effects.some(e=>e[0]===0));
 if(motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  busy=true;app.classList.add('is-resolving');
  if(visual){
   if(attacks)visual.classList.add('attack-player');if(enemyAttacks)visual.classList.add('attack-enemy');
   if(attacks||enemyAttacks)visual.classList.add('frame-shake');
   setTimeout(()=>{if(!visual.isConnected)return;visual.classList.remove('attack-player','attack-enemy');
    if(r.enemy.hp<old.enemy.hp){visual.classList.add('hit-enemy');visual.insertAdjacentHTML('beforeend',`<span class="damage-float">−${old.enemy.hp-r.enemy.hp}</span>`);playSound('hit');}
    if(r.you.hp<old.you.hp){visual.classList.add('hit-player');visual.insertAdjacentHTML('beforeend',`<span class="damage-float you">−${old.you.hp-r.you.hp}</span>`);}
    if(r.enemy.hp===0)visual.classList.add('defeated');
   },150);
  }
  animationTimer=setTimeout(finish,680);
 }else finish();
}
function chooseSlot(id,learning=true){showModal('装備する枠を選ぶ',views.chooseSlot(session.run,id,learning?'learn':'equip-skill'));}
function saveFile(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function startTrials(){if(trialStarted)return;trialStarted=true;let fallbackStarted=false;
 const receive=result=>{if(!trialResults.some(x=>x.policy===result.policy&&x.trial===result.trial))trialResults.push(result);if(page==='challengers'&&!modal.open)render();};
 const fallback=()=>{if(fallbackStarted)return;fallbackStarted=true;worker?.terminate();const tasks=POLICIES.flatMap((_,policy)=>TRIAL_SEEDS.map((seed,i)=>({policy,seed,trial:i+1})));let i=0;const tick=()=>{while(i<tasks.length&&trialResults.some(x=>x.policy===tasks[i].policy&&x.trial===tasks[i].trial))i++;if(i>=tasks.length)return;try{const t=tasks[i++];receive(runTrial(t.policy,t.trial,t.seed));setTimeout(tick,20);}catch(e){trialFailure='予選を停止しました：'+e.message;if(page==='challengers')render();}};setTimeout(tick,20);};
 try{worker=new Worker(WORKER_URL);worker.onmessage=e=>{if(e.data.error){fallback();return;}receive(e.data);};worker.onerror=e=>{e.preventDefault();fallback();};worker.postMessage('start');}catch{fallback();}
}
function profile(r,label,appearance=null){r={...r,you:{...r.you,hp:r.you.max_hp,mp:r.you.max_mp}};return `<div>${appearance?`<img class="profile-portrait" src="${asset(appearance.asset)}" alt="${esc(appearance.name)}">`:''}<h3>${label}</h3><p>HP ${r.you.hp} / ${r.you.max_hp}<br>MP ${r.you.mp} / ${r.you.max_mp}<br>SPD ${r.you.spd}</p><h3>装備技3枠</h3><p>${r.you.slots.map(id=>skills[id].japanese).join(' / ')}</p><p>防具：${r.armor<0?'なし':items[r.armor].japanese}<br>装飾品：${r.charm<0?'なし':items[r.charm].japanese}</p><details><summary>登録済み技・所有品</summary><p>${r.registered.map((b,id)=>b?skills[id].name:'').filter(Boolean).join(', ')}</p><p>${r.owned.map((b,id)=>b?items[id].japanese:'').filter(Boolean).join(', ')||'所有品なし'}</p></details></div>`;}
function showHelp(){const r=session?.run||{campaign:10};showModal('遊び方',`<h3>敵の予告を見て、行動を選ぶ</h3><p>全${totalBouts(r)}戦。敵の次の行動が先に確定します。SPDが高い側から行動し、同値ならあなたが先行します。各試合20ラウンド以内に倒してください。</p><h3>基本行動と、装備技3枠</h3><p>通常攻撃はMP不要。防御は直接ダメージを半減してMP+4、軽減分をBankへ最大12蓄積します。めいそうはMP消費0でHP+15・MP+6。最大値を超えて回復しません。技の条件を満たさない入力ではラウンドは進みません。</p><h3>溜め → 発動 → 休息</h3><p>溜め技を選んだ次は「予約を発動する」、その次は「休息を進める」を押します。敵の大技には防御や魔法障壁を使う判断ができます。</p><h3>大会の合間</h3><p>決勝以外の勝利後はHP+24・MP+12。第${serviceBouts(r).join('・第')}戦の後にギルドとショップが開きます。買った装備は「この装備で確定」で反映します。</p><h3>キーボード</h3><p>A：通常攻撃 / G：防御 / W：めいそう / 1・2・3：装備技 / N：発動・休息。文字入力中と説明画面ではショートカットは動きません。各「仕様」印はタッチでも開けます。</p>${note('help')}`);}
function showStatus(){const r=active();if(!r)return;const ids=[...new Set([0,1,2,...r.you.slots,...r.registered.map((b,i)=>b?i:-1).filter(i=>i>=0)])];showModal('技・状態',`${summary(r)}${slotsView(r)}${states(r.you)}<h3>習得済み技</h3><table><thead><tr><th>技</th><th>MP</th><th>効果</th></tr></thead><tbody>${ids.map(id=>`<tr><td>${skills[id].japanese}<br><small class="mono">${skills[id].name}</small></td><td>${skills[id].mp}</td><td>${skills[id].description}</td></tr>`).join('')}</tbody></table><h3>現在の敵の装備技</h3><p>${r.screen===1?r.enemy.slots.map(id=>`${skills[id].japanese} (${skills[id].name})`).join(' / '):'戦闘開始後に表示します。'}</p>${note('state')}`);}
async function handleAction(action){
 if(action==='spec'){showModal('仕様書','',SPECIFICATION);return;}
 if(action==='help'){showHelp();return;}
 if(action==='ledger'){const entries=[...Object.entries(REQUIREMENTS),...skills.map((_,id)=>['skill:'+id,specification('skill:'+id)]),...items.map((_,id)=>['item:'+id,specification('item:'+id)])];showModal('UI台帳',`<table><thead><tr><th>要件ID / 部品</th><th>常時表示・存在理由</th></tr></thead><tbody>${entries.map(([k,v])=>`<tr><td>${v[0]}<br>${k}</td><td>${esc(v[1])}${v[2].split('\n\n').map(p=>`<p>${esc(p)}</p>`).join('')}</td></tr>`).join('')}</tbody></table>`);return;}
 if(action==='credits'){showModal('クレジット',`<h3>VOID PIT: BORROWED CROWN</h3><p>原作：Arena-cli。ゲームデータ・ルールは添付ソースから移植。Web実装：ChatGPT / Codex。</p><p>敵10種、プレイヤー、追加闘技場の人間キャラ10種、通常・専用背景、会話枠、全技・全装備：内蔵画像生成ツールによる32bit風素材。</p><h3>効果音</h3><p>OtoLogic（<a href="https://otologic.jp/" target="_blank" rel="noopener">https://otologic.jp/</a>）</p><p>${esc(AUDIO_CREDIT)}</p><p><a href="https://otologic.jp/free/se/game-rpg01.html" target="_blank" rel="noopener">使用素材の配布ページ</a> / <a href="https://otologic.jp/free/license.html" target="_blank" rel="noopener">OtoLogic利用規約</a> / <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a></p><h3>ドラッグスクロール</h3><pre>${esc(DRAGSCROLL_LICENSE)}</pre><h3>原作ライセンス</h3><pre>${esc(LICENSE_TEXT)}</pre>`);return;}
 if(action==='sound'){audioOn=!audioOn;if(!audioOn){for(const sound of liveAudio)sound.pause();liveAudio.clear();}else playSound();render();return;}
 if(action==='motion'){motion=!motion;render();return;}
 if(action==='random'){seedDraft=randomSeed();$('#seed').value=seedDraft;playSound();return;}
 if(action==='start'){begin($('#seed').value.trim());return;}
 if(action==='briefing-done'){if(page==='briefing'){page='main';playSound();render();}return;}
 if(action==='victory-next'){if(page==='victory'){victory=null;page='main';playSound();render();}return;}
 if(action.startsWith('shelf:')){const [,kind,direction]=action.split(':');const shelf=$('#shelf-'+kind);shelf?.scrollBy({left:Number(direction)*shelf.clientWidth*.8,behavior:motion?'smooth':'instant'});return;}
 if(action==='status'){showStatus();return;}
 if(action==='records'){showModal('大会の記録',`<p>確定済みの操作列を保存します。読み込むと同じ大会を再生して復元します。</p>${note('save')}<div class="file-actions">${session?button('記録を書き出す','export','save'):''}${button('記録を読み込む','import','save')}${hasSave()?button('保存された大会を再開','resume','save'):''}</div>`);return;}
 if(action==='export'){if(session)saveFile(session.record(),`void-pit-${session.run.seed}.json`);return;}
 if(action==='import'){$('#import-file').click();return;}
 if(action==='resume'){try{session=Session.restore(JSON.parse(localStorage.getItem(key)));duel=null;page='main';champion=session.run.won&&session.run.screen===5?clone(session.run):null;if(modal.open)closeModal();render();}catch(e){notify('再開できません：'+e.message,true);}return;}
 if(action==='home'){duel=null;victory=null;seedDraft=randomSeed();page='home';render();return;}
 if(action==='retry'){begin(session.run.seed);return;}
 if(action==='main'){duel=null;page='main';render();return;}
 if(action==='challengers'){if(!champion){notify('本編で優勝すると開きます。');return;}duel=null;page='challengers';render();startTrials();return;}
 if(action==='rematch'){duel=createDuel(champion,selectedChallenger);page='main';render();return;}
 if(action==='equipment'){const r=session.run;showModal('習得済み技を装備',`<p>装備を外しても登録済み技は失いません。</p><div class="skill-gallery">${skills.map((s,id)=>id>=3&&r.registered[id]?views.skillCard(id,'equip:'+id,'装備先を選ぶ'):'').join('')}</div>${note('slots')}`);return;}
 if(action.startsWith('learn:')){chooseSlot(+action.split(':')[1],session.run.screen!==4);return;}
 if(action.startsWith('equip:')){chooseSlot(+action.split(':')[1],false);return;}
 if(action.startsWith('slot:')){const [,verb,id,slot]=action.split(':');closeModal();commit(`${verb} ${id} ${slot}`);return;}
 if(action.startsWith('buy:')){const id=+action.split(':')[1];showModal('購入を確認',views.purchase(session.run,id));return;}
 if(action.startsWith('confirm-buy:')){const id=+action.split(':')[1];closeModal();commit('buy '+id);return;}
 if(action==='close'){closeModal();return;}
 if(action.startsWith('challenge:')){const [,p,t]=action.split(':');const record=trialResults.find(x=>x.policy===+p&&x.trial===+t&&x.status==='winner');if(!record)return;selectedChallenger=record;showModal('優勝時の状態を確認',`${note('duel')}<div class="side-by-side">${profile(champion,'あなた')}${profile(Session.restore(record.record).run,POLICIES[+p].name,challengerAppearance(record))}</div><p>予選試行 #${t} / seed ${record.seed} / 方針版 ${record.policyVersion}</p><div class="file-actions">${button('この状態で対戦開始','duel-start','duel','primary')}${button('優勝記録を書き出す','export-challenger','save')}${button('戻る','close','back')}</div>`);return;}
 if(action==='duel-start'){closeModal();duel=createDuel(champion,selectedChallenger);page='main';render();return;}
 if(action==='export-challenger'){saveFile(selectedChallenger.record,`challenger-${selectedChallenger.policy}-${selectedChallenger.trial}.json`);return;}
 if(action==='next'){commit('next');return;}
 if(action.startsWith('use:')){commit('use '+skills[+action.split(':')[1]].name);return;}
 if(action.startsWith('op:'))commit(action.slice(3));
}
function showSpecification(k){
 const spec=specification(k);if(!spec)return;
 let art='';if(k.startsWith('skill:')){const id=+k.split(':')[1];art=views.skillCard(id,null,'');}
 else if(k.startsWith('item:')){const id=+k.split(':')[1];art=`<div class="illustrated-card detail-hero is-equipped">${views.image('items',items[id].name,items[id].japanese)}<div class="illustrated-copy"><h3>${items[id].japanese}</h3></div></div>`;}
 showModal(spec[0]+' / 設計意図',art+`<p>${esc(spec[1])}</p>`+spec[2].split('\n\n').map(p=>`<p>${esc(p)}</p>`).join(''));
}
let dragGesture=null,suppressDragClick=false;
document.addEventListener('mousedown',e=>{const shelf=e.target.closest('.gear-shelf');if(shelf&&!e.target.closest('button,input,select,a')){dragGesture={x:e.clientX,y:e.clientY,shelf};suppressDragClick=false;}});
document.addEventListener('mousemove',e=>{if(dragGesture&&Math.hypot(e.clientX-dragGesture.x,e.clientY-dragGesture.y)>6)suppressDragClick=true;});
document.addEventListener('mouseup',()=>{dragGesture=null;setTimeout(()=>suppressDragClick=false,0);});
document.addEventListener('click',e=>{
 if(suppressDragClick&&e.target.closest('.gear-shelf')){e.preventDefault();e.stopImmediatePropagation();suppressDragClick=false;return;}
 const spec=e.target.closest('[data-show-spec]');if(spec){showSpecification(spec.dataset.showSpec);return;}
 const b=e.target.closest('[data-action]');if(b&&!b.disabled)handleAction(b.dataset.action).catch(err=>notify(err.message,true));
},true);
document.addEventListener('input',e=>{if(e.target.id==='seed')seedDraft=e.target.value;});
document.addEventListener('submit',e=>{if(e.target.id!=='command-form')return;e.preventDefault();const field=$('#command'),raw=field.value.trim().toLowerCase();if(!raw)return;const r=active();if(['help','status','skills','book','recent','?'].includes(raw)){showStatus();return;}const id=/^[1-3]$/.test(raw)?r.you.slots[Number(raw)-1]:null;commit(raw==='next'?'next':'use '+(id===null?raw:skills[id].name));});
document.addEventListener('change',e=>{if(e.target.matches('[data-policy-select]'))selections[e.target.dataset.policySelect]=+e.target.value;if(e.target.matches('[data-policy-select]'))render();});
document.addEventListener('keydown',e=>{const shelf=e.target.closest('.gear-shelf');if(shelf&&e.target===shelf&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();shelf.scrollBy({left:(e.key==='ArrowRight'?1:-1)*shelf.clientWidth*.7,behavior:motion?'smooth':'instant'});}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){tooltip.hidden=true;return;}if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||modal.open||page!=='main'||active()?.screen!==1||e.target.closest('input,textarea,select,button,[contenteditable]'))return;const id={a:0,g:1,w:2,'1':active().you.slots[0],'2':active().you.slots[1],'3':active().you.slots[2]}[e.key.toLowerCase()];if(id!==undefined){e.preventDefault();commit('use '+skills[id].name);}else if(e.key.toLowerCase()==='n'){e.preventDefault();commit('next');}});
$('#import-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>1024*1024)throw Error('記録ファイルが大きすぎます。');const s=Session.restore(JSON.parse(await f.text()));clearTimeout(animationTimer);busy=false;session=s;duel=null;page='main';champion=s.run.screen===5&&s.run.won?clone(s.run):null;if(modal.open)closeModal();persist();render();notify('記録を再生して復元しました。');}catch(err){notify('読込失敗：'+err.message,true);}e.target.value='';});
render();
