const active=state=>state.run.attempts.find(a=>a.id===state.run.active_id);
const categories=['data','apps','settings'];
export function bootRepairLesson(state,repeat=false){
  const a=active(state);if(!a||(a.device.operational&&!(repeat&&bootRepairStatus(state))))return null;
  const online=a.job.network!==false,id=online?'boot-online':'boot-offline';
  if(!repeat&&(state.meta.workshop_lessons||[]).includes(id))return null;
  return {id,attemptId:a.id,offline:!online,pages:online?[
    'その端末は届いた時点でOSが起動しない。画面だけの故障とは違う。USBを差しても解除プログラムは動かないし、外部画面ドックでも起動は直らない。まず修復が必要だ。',
    `この契約は外部通信が使える。工房のパソコンで「正規修復」を手配しよう。料金は報酬の25％、今回は$${Math.ceil(a.job.reward*.25)}。機材の追加購入は不要でデータ・アプリ・設定とOS版を残して起動を直せる。`,
    a.job.forbid.includes('erase')?'この依頼はデータ消去禁止だ。リカバリー装置による初期化は使わない。データをあとで戻しても、消した履歴は消せないからな。':'リカバリー装置でも起動は直るが、データ・アプリ・設定を消してしまう。残す物があるなら、先に救出してから復元する準備が必要だ。今回は消さずに直す正規修復を使おう。',
    '受話器を戻したら、矢印の工房パソコンを押す。「端末の修理」から「正規修復の見積り」へ進み、費用を確認して実行しよう。起動が直ったら、契約に書かれた権限解除などの作業へ戻るんだ。'
  ]:[
    'この端末はOSが起動せず、契約で外部通信も禁止されている。正規修復は使えない。工房の機材で中身を救出してから起動を直そう。外部画面ドックや解除用USBだけでは復旧できない。',
    '最初は「読取専用救出機」。起動していない端末から、データ・アプリ・設定を取り出して保存する。通常のバックアップ装置では起動不能の端末から新しく退避できない。必要な機材を持っていなければ、右の機材メニューで購入しよう。',
    '救出した後に「リカバリー装置」の標準イメージを使う。同じOS版で起動を直すが、中身は一度消える。救出前に実行してはいけない。開発用イメージは権限まで変えるので今回は標準を使う。',
    '最後に「バックアップ装置」で救出したこの端末のデータ・アプリ・設定を復元する。起動しただけでは返せない。ここまで矢印で案内するので復元後に依頼の残りの作業を進めよう。'
  ]};
}
export function bootRepairStatus(state){
  const a=active(state),g=state.run.workshop_guidance||{};
  if(!a||g.bootAttempt!==a.id)return null;
  const restored=a.log.slice(g.bootLogStart||0).some(e=>e.operation.type==='restore'&&categories.every(k=>e.operation.categories.includes(k)));
  if(a.device.operational&&(!g.bootOffline||restored))return null;
  if(a.runtime.pending)return {phase:'boot-working',hint:'処理中だ。終わるまで待とう。'};
  if(!g.bootOffline)return a.device.operational?null:{phase:'boot-service',operation:{type:'service',serviceId:'S02'},hint:`工房のパソコンで「端末の修理」を開こう。\n正規修復は$${Math.ceil(a.job.reward*.25)}。中身を残して起動を直す。`};
  const buy=(id,hint)=>({phase:'boot-buy',itemId:id,hint});
  if(!a.device.operational){
    if(a.job.forbid.some(f=>['erase','reimage'].includes(f)))return {phase:'boot-blocked',hint:'この契約は初期化も禁止されている。\nリカバリー装置では直せないため、契約を確認しよう。'};
    const b=state.run.backups[a.device_uid];
    if(!b||!categories.every(k=>b.categories.includes(k))){
      if(!state.run.owned_equipment.includes('M06'))return buy('M06','まず読取専用救出機を買おう。\n起動不能の端末から、中身を消さずに救出する機材だ。');
      return {phase:'boot-rescue',itemId:'M06',operation:{type:'rescue',categories},hint:'読取専用救出機を使い、データ・アプリ・設定を救出しよう。\n救出が終わるまで初期化してはいけない。'};
    }
    if(!state.run.owned_equipment.includes('M05'))return buy('M05','中身は救出済みだ。次はリカバリー装置を買おう。\n同じOS版を入れ直して起動を直す。');
    return {phase:'boot-reimage',itemId:'M05',operation:{type:'reimage',development:false},hint:'救出できた。リカバリー装置の「標準イメージ」で復旧しよう。\n中身は消えるが、この端末の救出データから戻せる。'};
  }
  if(!state.run.owned_equipment.includes('M04'))return buy('M04','起動は直ったが、中身はまだ戻っていない。\nバックアップ装置を買い、救出した内容を復元しよう。');
  return {phase:'boot-restore',itemId:'M04',operation:{type:'restore',categories},hint:'バックアップ装置で救出した中身を復元しよう。\nその後は契約に残っている権限やアプリの作業を進める。'};
}
