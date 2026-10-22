import {POLICIES,TRIAL_SEEDS} from '../policies.js';
import {challengerAppearance} from './characters.js';
// Presentation-only extension point. No tournament state is mutated here.
export function createArenaViews({asset,esc,button,note,summary}){
 function challengers(champion,trialResults,selections,trialFailure){
  const total=POLICIES.length*TRIAL_SEEDS.length;
  return `<main class="challenger-page"><section class="algorithm-hero"><img src="${asset('algorithm-arena')}" alt="星空に浮かぶ、5つの門を持つ専用闘技場" decoding="async"><div class="algorithm-hero-copy"><span class="eyebrow">ALGORITHM ARENA / FIVE POLICIES</span><h2>優勝者たちの闘技場</h2><p>5つの戦い方。50の大会。<br>勝ち残った相手に、あなたの構成で挑む。</p>${button('本編の結果へ','main','back')}</div></section><p class="muted">優勝した構成を引き継ぎ、両者のHP・MPを満タンにして戦います。</p>${summary({...champion,you:{...champion.you,hp:champion.you.max_hp,mp:champion.you.max_mp}})}${note('duel')}<progress class="algorithm-progress" value="${trialResults.length}" max="${total}" aria-label="優勝者の予選進捗"></progress><div class="section-head"><span class="mono">予選 ${trialResults.length} / ${total}　優勝 ${trialResults.filter(x=>x.status==='winner').length} 名</span>${note('trial')}</div>${trialFailure?`<p role="alert">${esc(trialFailure)}</p>`:''}<div class="challenger-grid">${POLICIES.map((p,index)=>card(p,index,trialResults,selections)).join('')}</div></main>`;
 }
 function card(p,index,trialResults,selections){
  const results=trialResults.filter(x=>x.policy===index),winners=results.filter(x=>x.status==='winner').sort((a,b)=>b.score-a.score||a.trial-b.trial),chosen=winners.find(x=>x.trial===selections[index])||winners[0];
  const appearance=chosen?challengerAppearance(chosen):null;
  return `<article class="challenger-card">${appearance?`<img loading="lazy" class="portrait" src="${asset(appearance.asset)}" alt="${appearance.name}の姿の挑戦者"><span class="character-label">${appearance.name}</span>`:'<div class="portrait awaiting-challenger" aria-hidden="true">?</div>'}<span class="eyebrow">${p.tag}</span><h3>${p.name}</h3><div class="trial-score">${winners.length} / ${results.length} 勝</div><p>${p.description}</p>${chosen?`<p>対戦開始時 HP ${chosen.snapshot.you.max_hp}/${chosen.snapshot.you.max_hp} · MP ${chosen.snapshot.you.max_mp}/${chosen.snapshot.you.max_mp} · SPD ${chosen.snapshot.you.spd}</p><label class="muted"><small>代表・他の優勝者</small><select data-policy-select="${index}" aria-label="${p.name}の優勝者を選択">${winners.map(w=>`<option value="${w.trial}" ${chosen===w?'selected':''}>試行 ${w.trial} / SCORE ${w.score}${w===winners[0]?' / 代表':''}</option>`).join('')}</select></label>${button('構成を確認して対戦','challenge:'+index+':'+chosen.trial,'duel','primary')}`:`<p>${results.length===TRIAL_SEEDS.length?'予選敗退 0/10':'予選を実行しています…'}</p>`}<details><summary>試行結果</summary><p>${results.map(x=>`#${x.trial}: ${x.status==='winner'?'優勝':x.status==='defeat'?'敗退':esc(x.reason)}`).join(' / ')||'実行待ち'}</p></details>${note('trial')}</article>`;
 }
 return {challengers};
}
