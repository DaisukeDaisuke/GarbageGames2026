import {fingerprint} from './core.mjs';

const DEFAULT_KEY='jailbreakGame:v31';
function fail(message){throw new Error(message);}
function finiteMoney(value){return Number.isSafeInteger(value)&&value>=0;}
export function validateSave(state,content){
  if(!state||state.schema_version!==1)fail('この保存形式は読み込めません。元データは削除していません');
  if(state.content_version!==(content.version||'v3.1.0'))fail('ゲームデータの版が異なります。元の保存はそのまま残しています');
  if(!state.run||!state.meta||!/^\d{16}$/.test(state.seed))fail('保存データの基本情報が壊れています');
  const r=state.run,m=state.meta;
  if(!finiteMoney(r.cash)||!finiteMoney(r.start_cash)||!finiteMoney(r.eligible_reward_total)||!finiteMoney(m.sp_total_earned)||!finiteMoney(m.last_run_eligible_reward_total))fail('保存データの資金・SPが不正です');
  if(!Number.isSafeInteger(r.id)||r.id<1||!Number.isInteger(r.rank)||r.rank<1||r.rank>5)fail('契約の進行情報が不正です');
  for(const name of ['owned_pocs','owned_equipment','attempts','completed','main_completed','history','receipt_ids','skills','surrendered_poc_ids'])if(!Array.isArray(r[name]))fail(`保存項目 ${name} が不正です`);
  if(r.attempts.length>2||r.main_completed.length>12)fail('受付件数・進行件数が不正です');
  if(new Set(r.owned_pocs).size!==r.owned_pocs.length||r.owned_pocs.some(id=>!content.pocs.some(p=>p.id===id)))fail('所持媒体が不正です');
  if(r.owned_equipment.some(id=>!content.equipment.some(e=>e.id===id)))fail('所持機材が不正です');
  if(r.surrendered_poc_ids.some(id=>r.owned_pocs.includes(id)))fail('譲渡済み媒体が重複しています');
  const attemptIds=new Set(),mediaIds=new Set();
  for(const a of r.attempts){
    if(attemptIds.has(a.id))fail('受注IDが重複しています');attemptIds.add(a.id);
    if(!content.devices.some(d=>d.id===a.hardware_model_id))fail('保存された機種が見つかりません');
    if(a.job_id!=='SUPPORT_KOMA'&&!content.jobs.some(j=>j.id===a.job_id))fail('保存された案件が見つかりません');
    if(!a.device||!a.snapshot||!a.runtime||!Array.isArray(a.log)||!Array.isArray(a.runtime.media))fail('端末状態が壊れています');
    for(const media of a.runtime.media){
      const key=`${media.pocId}:${media.instance}`;
      if(mediaIds.has(key)||!r.owned_pocs.includes(media.pocId)||media.instance>=(r.copies[media.pocId]||1))fail('媒体実体の使用状況が不正です');mediaIds.add(key);
    }
    const p=a.runtime.pending;
    if(p&&(!p.id||!Number.isFinite(p.remaining)||p.remaining<0||p.remaining>2400||!p.info?.operation))fail('実行中の処理情報が壊れています');
  }
  return state;
}
function envelope(state){const data=JSON.stringify(state);return JSON.stringify({format:'jailbreak-workshop-save',version:1,checksum:fingerprint(data),data});}
function decode(text,content){
  let env;try{env=JSON.parse(text);}catch{fail('保存データを読み取れません');}
  if(env.format!=='jailbreak-workshop-save'||typeof env.data!=='string'||env.checksum!==fingerprint(env.data))fail('保存データの照合に失敗しました');
  let state;try{state=JSON.parse(env.data);}catch{fail('保存内容が壊れています');}
  return validateSave(state,content);
}
export function exportSave(state){return envelope(state);}
export function importSave(text,content){return decode(text,content);}
export function saveGame(state,storage=globalThis.localStorage,key=DEFAULT_KEY){
  if(!storage)fail('ブラウザの保存領域を使用できません');
  const current=storage.getItem(`${key}:head`)==='1'?'1':'0',next=current==='0'?'1':'0';
  const value=envelope(state);
  // Publishing the head is the commit point. A failed publication leaves the old
  // slot authoritative; the caller must not advance its in-memory game state.
  storage.setItem(`${key}:slot:${next}`,value);
  if(storage.getItem(`${key}:slot:${next}`)!==value)fail('保存データの書込みを確認できません');
  storage.setItem(`${key}:head`,next);
  return true;
}
export function loadGame(content,storage=globalThis.localStorage,key=DEFAULT_KEY){
  if(!storage)return {state:null,recovered:false,warning:'ブラウザの保存領域を使用できません'};
  try{
    const head=storage.getItem(`${key}:head`);
    if(head!=='0'&&head!=='1')return {state:null,recovered:false,warning:''};
    const order=[head,head==='0'?'1':'0'];let lastError='';
    for(let i=0;i<order.length;i++){
      const raw=storage.getItem(`${key}:slot:${order[i]}`);if(!raw)continue;
      try{const state=decode(raw,content);if(state.timer?.running)state.timer.reference=true;return {state,recovered:i>0,warning:i>0?'直前の正常な保存から復旧しました。元データは保持しています':''};}catch(e){lastError=e.message;}
    }
    return {state:null,recovered:false,warning:lastError||'保存データがありません'};
  }catch(e){return {state:null,recovered:false,warning:`保存領域を開けません：${e.message}`};}
}
