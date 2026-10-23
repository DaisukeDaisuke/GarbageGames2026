export const FIRST_JOB='JOB_E_001';
export const SECOND_JOB='JOB_E_002';
export function learnedRepair(state,jobId){return state.run.completed.includes(jobId)||(state.meta.learned_intro_ids||[]).includes(jobId);}
export const GRADUATION_CALL={id:'TUTORIAL_GRADUATION',portrait:'smile',pages:[
  '二台とも返却までできたな。ここまで慣れればもう工房の見習いだ。道具を選んで画面をつなぎ契約の条件を検品する。その流れはつかめたはずだ。',
  '次の一件は私から手順を指示しない。パソコンで依頼を選んで内容を読もう。今度は自分で最後まで進めてみてくれ。道具はそのまま使える。',
  'その一件を返すまではこちらから普段の電話はかけない。行き詰まった時は別だ。異変に気づいたらこちらから連絡する。同じことで困ったら受話器を取って何度でも相談してくれ。では任せたぞ。'
]};
export const WRONG_PURCHASE_CALL={id:'TUTORIAL_WRONG_PURCHASE',portrait:'think',pages:[
  'おっと。ブローカーから今の依頼に合わない道具を買おうとしたみたいだな。今回は私が発注を止めた。代金は引かれていないぞ。',
  '脱獄用のPoCや修理機材はOSの版や作業内容が合わなくても購入できてしまう。機種が合っていても解除する権限が違えば使えない。商品名だけで判断しないことだ。',
  '私は事前に契約書を読んでいる。必要経費が報酬を上回り純利益がマイナスになる依頼は私側で引き受けている。ただし君が間違って買った道具の代金まで補填するわけにはいかない。',
  '所持金が尽きれば必要な機材を買えず作業を続けられなくなる。実質ゲームオーバーだ。今回必要なのはKomaOS 2.0の管理者制限解除PoCだ。契約書とOSの版をよく確かめてくれ。'
]};
export function wrongPurchaseInFreeTutorial(state,itemId){
  const r=state.run;
  return r.id===1&&!!r.tutorial?.independentActive&&itemId!=='P04';
}
export function wrongPurchaseCallPending(state){return !!state.run.tutorial?.wrongPurchaseCallPending;}
export function queueWrongPurchaseCall(state){
  const next=structuredClone(state);
  next.run.tutorial.wrongPurchaseCallPending=true;
  return next;
}
export function finishWrongPurchaseCall(state){
  const next=structuredClone(state);
  next.run.tutorial.wrongPurchaseCallPending=false;
  next.run.tutorial.wrongPurchaseCallHeard=true;
  return next;
}
export function graduationPending(state){
  const r=state.run;
  return r.id===1&&!r.tutorial?.graduationHeard&&!!(r.tutorial?.graduationPending||(r.completed.includes(SECOND_JOB)&&r.completed.length===2));
}
export function tutorialRetirementBlocked(state){
  return state.run.id===1&&state.run.status==='active'&&![FIRST_JOB,SECOND_JOB].every(id=>learnedRepair(state,id));
}
export const REPAIR_PAGES=[
  '一台目が届いたな。これは KomaOS 1.0 で動く文書端末だ。OSは端末を動かす基本ソフト。この依頼は「古い原稿を残したまま管理者メニューを使えるようにする」だけだ。',
  '今は管理者権限が施錠されている。\n解除するにはKomaOS用の解除プログラムを端末に読ませる必要がある。原稿を消す必要はないぞ。',
  '青い「管理者用USB」は今作業台に用意した。\nこのUSBに解除プログラムが入っている。端末へ差し込んで使う道具だ。支給品なので購入費用はかからない。',
  '青いUSBを端末の正面左下にある四角い差込口へドラッグしよう。USBの形とKomaOSの対応版が合っている必要がある。今回は初期USBがどちらも合っている。',
  '差しただけでは解除されない。端末をクリックして近づこう。「媒体」画面の「管理者権限を解除」を実行する。管理者が「開放」になれば成功だ。アプリの導入・OS更新・初期化は今回の作業と関係ない。触らずそのままにしておこう。',
  '終わったらUSBを手で抜こう。検品は作業が終わったら開放する。\nこの依頼にかかる初期費用は無料。報酬は$180だ。\n最初の一台は作業に合わせて案内するからやってみよう。'
];
export function initialMediaVisible(state){
  const r=state.run;
  return r.id!==1||r.completed.includes(FIRST_JOB)||state.meta.learned_intro_ids.includes(FIRST_JOB)||!!r.tutorial?.briefed||(r.tutorial?.briefingPage??0)>=2||r.attempts.some(a=>a.runtime.media.length||a.log.length);
}
export function tutorialStatus(state){
  const r=state.run;
  if(r.id!==1)return {phase:'done'};
  if(graduationPending(state))return {phase:'graduation-call'};
  if(learnedRepair(state,SECOND_JOB))return {phase:'done'};
  if(r.completed.includes(FIRST_JOB)){
    if(r.pending_calls.includes('CALL01'))return {phase:'followup-call'};
    if(r.completed.includes(SECOND_JOB)||r.completed.length>1)return {phase:'done'};
    const second=r.attempts.find(a=>a.job_id===SECOND_JOB);
    if(!second)return {phase:r.attempts.length?'done':'next-order'};
    if(!r.owned_pocs.includes('P02'))return {phase:'buy-poc',attempt:second,itemId:'P02'};
    if(!r.owned_equipment.includes('M02'))return {phase:'buy-equipment',attempt:second,itemId:'M02'};
    if(!second.device.display&&!second.runtime.dock)return {phase:second.runtime.pending?'second-docking':'second-dock',attempt:second,itemId:'M02'};
    const phase=second.runtime.pending?'second-processing':second.device.security.root?'second-relock':!second.device.security.install?(second.runtime.media.length?(second.runtime.media[0].pocId==='P02'?'second-execute':'second-wrong-media'):'second-insert'):second.runtime.media.length?'second-eject':'second-inspect';
    return {phase,attempt:second};
  }
  if(state.meta.learned_intro_ids.includes(FIRST_JOB))return {phase:'done'};
  if((r.intro?.stage??4)<4)return {phase:'welcome'};
  const a=r.attempts.find(a=>a.job_id===FIRST_JOB);
  if(!a)return {phase:r.attempts.length?'done':'contract'};
  if(!r.tutorial?.briefed)return {phase:'briefing',attempt:a,page:r.tutorial?.briefingPage||0};
  const phase=a.runtime.pending?'processing':!a.device.security.root?(a.runtime.media.length?'execute':'insert'):a.runtime.media.length?'eject':'inspect';
  return {phase,attempt:a};
}
export const REPAIR_HINTS={
  'followup-call':'入金は左上の所持金に反映された。\n次の仕事を説明する。電話を取ってくれ。',
  'next-order':'パソコンで届いた依頼を見よう。\n一覧から2件目を選んで契約を読むんだ。',
  'buy-poc':'今回はアプリ導入制限を外す。\n右のPoCから対応するUSBを買おう。',
  'buy-equipment':'契約書には内蔵画面が壊れていると書いてある。\n操作には外部画面が必要だ。右の機材でドックを買おう。',
  'second-dock':'作業台の外部画面ドックをクリックして接続しよう。\n内蔵画面は壊れたままでも外部画面で端末を操作できる。',
  'second-docking':'外部画面を接続している。\n映るようになるまで少し待とう。',
  'second-insert':'外部画面で操作できるようになった。\n緑のアプリ導入制限解除USBを差して制限を解除しよう。',
  'graduation-call':'二台目も返却できたな。\nここまでの仕事について話そう。電話を取ってくれ。',
  'second-execute':'そのUSBでアプリ導入制限を解除。\n管理者制限は施錠のままにしておこう。',
  'second-wrong-media':'そのUSBは管理者用だ。手で抜いて\nアプリ導入制限解除USBに差し替えよう。',
  'second-processing':'アプリ導入制限を解除している。\n終わるまでUSBを抜かずに待とう。',
  'second-relock':'管理者も開放されている。\n「管理者を再施錠」で直せるぞ。',
  'second-eject':'解除できたな。USBを手で抜こう。\n次は検品で文書と権限を確認する。',
  'second-inspect':'検品の表で成功条件を確認しよう。\n合格なら返却と入金を一度に済ませる。',
  briefing:'端末が届いたぞ。電話を取ってくれ。何を直すのかここから説明する。',
  insert:'青い管理者用USBを端末正面左下の四角い差込口へドラッグ。KomaOSに解除プログラムを渡すためだ。',
  execute:'USBを読める状態になった。端末をクリックして「媒体」画面の「管理者権限を解除」を実行しよう。',
  processing:'解除プログラムを実行中だ。そのまま少し待とう。原稿は消さずに管理者権限だけを開く。',
  eject:'管理者権限が開放された。これで依頼の修理は完了だ。端末に刺さっているUSBをクリックするか外へドラッグして手で抜こう。OSを操作する必要はない。',
  inspect:'最後は「検品」。管理者が開放されて原稿が残っていれば合格だ。そのまま返却して報酬を受け取ろう。'
};
