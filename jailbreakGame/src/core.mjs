// The game model is independent of rendering, timers, the DOM and persistence.
import {syncRecovery,recoveryNeeded,workUnlockAxes} from './recovery.mjs';
import {SECOND_JOB,graduationPending,tutorialRetirementBlocked} from './tutorial.mjs';
export const AXES = ['root', 'install', 'feature'];
export const GRADES = ['E', 'D', 'C', 'B', 'A'];
export const DEFAULT_SETTINGS = {theme:'standard',output:'internal',export:'off',schedule:'locked',content:'stock',profile:'factory'};
export const MAIN_JOB_LIMIT = 5;
const TRAINING_JOBS = ['JOB_E_001','JOB_E_002'];
const CARRY_EQUIPMENT = ['M02','M03','M04','M05','M06','M07','M09','M10','M13','M16'];
const MATERIALS = {KomaOS:100,MiraOS:160,FolioOS:240,ReelOS:340,HearthOS:460};
const AXIS_NAMES = {root:'管理者',install:'アプリ導入',feature:'設定編集'};
const SETTING_NAMES = {theme:'配色',output:'出力先',export:'書き出し',schedule:'予定',content:'表示内容',profile:'プリセット'};
const FORBID_NAMES = {erase:'データ消去',update:'OS更新',root:'管理者権限の解除',network:'外部通信',reimage:'OS再適用',appInstall:'アプリ追加',beforeBackupViolation:'退避前の消去'};
const clone = value => structuredClone(value);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const unique = xs => [...new Set(xs)];
const add = (xs,x) => { if(!xs.includes(x)) xs.push(x); };
const remove = (xs,x) => {const i=xs.indexOf(x);if(i>=0)xs.splice(i,1);};
const find = (xs,id) => xs.find(x=>x.id===id);
export function fingerprint(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  let h=2166136261; for (let i=0;i<s.length;i++) h=Math.imul(h^s.charCodeAt(i),16777619);
  return (h>>>0).toString(16).padStart(8,'0');
}
function id(state,kind){state.run.serial++;return `${state.run.id}:${kind}:${state.run.serial}`;}
function hasSkill(state,skill){return state.run.skills.includes(skill);}
export function carryLimits(skills){return {pocs:skills.includes('A4')?4:skills.includes('A1')?2:0,equipment:skills.includes('A5')?4:skills.includes('A2')?2:0};}
export function preparationLimit(state){return hasSkill(state,'B4')?4:hasSkill(state,'B1')?2:0;}
export function startingRank(skills){return [5,4,3,2].find(rank=>skills.includes('R'+rank))||1;}
export function progressLabel(state){const training=TRAINING_JOBS.filter(id=>state.run.completed.includes(id)).length;return state.run.id===1&&training<2?`研修 ${training}/2台`:`納品 ${Math.min(MAIN_JOB_LIMIT,state.run.main_completed.length)}/${MAIN_JOB_LIMIT}件`;}
function trainingJob(state,job){return state.run.id===1&&TRAINING_JOBS.includes(job.id);}
function prepareForAttempt(state,content){
  const a=currentAttempt(state),limit=preparationLimit(state);if(!a||!limit)return;
  const desired=AXES.filter((axis,i)=>a.job.goal.s?.[i]===true||(axis==='install'&&(a.job.goal.apps?.length||a.job.goal.remove?.length))||(axis==='feature'&&Object.keys(a.job.goal.settings||{}).length));
  state.run.prepared=content.pocs.filter(p=>state.run.owned_pocs.includes(p.id)&&p.family===a.device.family&&(limit>2||p.versions.includes(a.device.version))&&!state.run.surrendered_poc_ids.includes(p.id)).sort((p,q)=>Number(q.versions.includes(a.device.version))-Number(p.versions.includes(a.device.version))||Number(desired.includes(q.axis))-Number(desired.includes(p.axis))||p.id.localeCompare(q.id)).slice(0,limit).map(p=>p.id);
}
function migrateProgress(state){
  const r=state.run;if(r.progress_version===2)return;
  r.progress_start_rank=startingRank(r.skills||[]);r.progress_version=2;
  r.main_completed=unique(r.main_completed||[]).filter(id=>!(r.id===1&&TRAINING_JOBS.includes(id))).slice(0,MAIN_JOB_LIMIT);
  if(r.id>1)r.pending_calls=r.pending_calls.filter(id=>id!=='CALL01');
  // Keep accepted devices intact; their eligibility is recomputed on delivery.
}
function hasEquipment(state,equipment){return state.run.owned_equipment.includes(equipment);}
function getDevice(content,attempt){const device=find(content.devices,attempt.hardware_model_id);requireThat(device,'機種定義が見つかりません');return device;}
function getJob(content,jobId){const job=find(content.jobs,jobId);requireThat(job,`案件 ${jobId} が見つかりません`);return job;}
function getAttempt(state,attemptId){const a=state.run.attempts.find(x=>x.id===(attemptId||state.run.active_id));requireThat(a,'先に依頼を受注してください');return a;}
export function currentAttempt(state){return state.run.attempts.find(x=>x.id===state.run.active_id)||null;}
export function previewContract(content,job){return makeAttempt({run:{id:0,serial:0}},job,true);}
function plainDevice(job,uid){
  const initial=job.initial||{}, settings={...DEFAULT_SETTINGS,...initial.settings};
  return {uid,family:job.family,version:job.version,operational:initial.operational!==false,display:initial.display!==false,
    security:Object.fromEntries(AXES.map((axis,i)=>[axis,!!initial.s?.[i]])),settings,
    setting_fingerprints:Object.fromEntries(Object.entries(settings).map(([k,v])=>[k,fingerprint(`${job.id}:${k}:initial:${v}`)])),
    apps:[...(initial.apps||[])],data:Object.fromEntries((job.data||[]).map(name=>[name,fingerprint(`${job.id}:${name}:customer-record`)])),
    history:{erase:0,update:0,root:0,network:0,reimage:0,appInstall:0,beforeBackupViolation:0}};
}
function makeAttempt(state,job,practice=false){
  const attemptId=id(state,'attempt'),uid=id(state,'device'),device=plainDevice(job,uid);
  return {id:attemptId,job_id:job.id,device_uid:uid,hardware_model_id:job.hardware_model_id,job:clone(job),snapshot:clone(device),device,
    runtime:{media:[],port:0,dock:false,adapter:false,pending:null,queue:[]},provenance:{axes:{},apps:{},removed:{},settings:{}},
    log:[],used_equipment:[],spent:0,invested:0,practice,started_order:state.run.serial,portable_used:false,restored_after_erase:false};
}
function makeRun(state,content,seed,number,pocIds=[],equipmentIds=[]){
  const start=400+Math.floor((state.meta.last_run_eligible_reward_total||0)/2);
  const rank=number===1?1:startingRank(state.meta.skill_allocations);
  return {id:number,seed,serial:0,rank,poc_rank:rank,equipment_rank:rank,progress_start_rank:rank,progress_version:2,cash:start,start_cash:start,eligible_reward_total:0,
    completed:[],main_completed:[],attempts:[],active_id:null,owned_pocs:unique(['P01',...pocIds]),owned_equipment:unique(['M01',...equipmentIds]),
    copies:{},surrendered_poc_ids:[],receipt_ids:[],pending_calls:[],completed_calls:(content.events||[]).filter(e=>e.rank&&e.rank<=rank||number>1&&e.id==='CALL01').map(e=>e.id),assistance:{queue:[],active:null,hints:[]},book_pending:[],chapter_grants:{},inbox:[],read:[],inbox_revision:0,inbox_policy_version:2,
    skills:[...state.meta.skill_allocations],backups:{},portable_backup:null,status:'active',retirement:null,carry_candidates:[],
    prepared:[],nominated:false,reserved:[],reservation_used:false,reports:[],handover:false,roamer:false,history:[],support_total:0,intro:{stage:number===1?0:4,complete:number!==1}};
}
export function createGame(content,seed='0000000000000001'){
  const normalized=String(seed).replace(/[^0-9]/g,'').slice(-16).padStart(16,'0');
  const state={schema_version:1,content_version:content.version||'v3.1.0',seed:normalized,
    meta:{sp_total_earned:0,sp_awarded_models:[],skill_allocations:[],surrendered_poc_ids:[],proven_owned_item_ids:[],learned_intro_ids:[],
      last_run_eligible_reward_total:0,seen_ending_ids:[],assistance_seen_patterns:[],history:[],recipes:[],boss_memory:{previous_ending_id:null,previous_job_ids:[]}},run:null};
  state.run=makeRun(state,content,normalized,1);state.run.inbox=chooseInbox(state,content);return state;
}
function completedAny(state,jobId){return state.run.completed.includes(jobId)||state.meta.learned_intro_ids.includes(jobId);}
function prerequisitesMet(state,job){
  if(job.id==='JOB_E_001')return true;
  if(job.rank===1&&state.run.id===1){const next=['JOB_E_001','JOB_E_002','JOB_E_003'].find(x=>!state.run.completed.includes(x));if(next)return job.id===next;}
  const prerequisites=job.prerequisites||[];
  if(prerequisites.some(p=>!completedAny(state,typeof p==='string'?p:p.id)))return false;
  if(job.n===2&&job.grade!=='E'&&!completedAny(state,`JOB_${job.grade}_001`))return false;
  const needed=job.priorGradeCount||0;
  if(needed&&state.meta.history.filter(x=>x.grade===job.grade&&!x.practice).length<needed)return false;
  return true;
}
export function availableJobs(state,content){
  if(state.run.status!=='active')return [];
  return content.jobs.filter(j=>j.rank<=state.run.rank&&!state.run.completed.includes(j.id)&&!state.run.attempts.some(a=>a.job_id===j.id)&&prerequisitesMet(state,j));
}
function randomOrder(state,job){return parseInt(fingerprint(`${state.seed}:${state.run.id}:${state.run.inbox_revision}:${job.id}`),16);}
function affordableJob(state,job,content){
  const budget=state.run.cash-state.run.attempts.reduce((sum,a)=>sum+(a.runtime.pending?.info.cost||0),0);
  return planRoutes(state,job,content,{quick:true}).some(p=>p.valid&&p.upfront<=budget);
}
function retainInbox(state,content,fill=false){
  const available=new Map(availableJobs(state,content).map(j=>[j.id,j]));
  const retained=unique(state.run.inbox).filter(id=>available.has(id)&&affordableJob(state,available.get(id),content));
  // Catalogue/grant unlocks may add newly feasible work, but keep the existing
  // offer order and the delivery's seed/revision. Opening the PC never fills.
  if(fill){
    const candidates=chooseInbox(state,content),familiar=candidates.filter(id=>available.get(id)?.rank<state.run.rank).slice(0,2);
    const current=unique([...retained,...candidates]).filter(id=>available.get(id)?.rank===state.run.rank).slice(0,3);
    state.run.inbox=unique([...current,...familiar,...retained,...candidates]).slice(0,6);
  }else state.run.inbox=retained;
}
function chooseInbox(state,content){
  const pool=availableJobs(state,content).filter(j=>affordableJob(state,j,content)),rank=state.run.rank;
  const nextIntro=state.run.id===1?['JOB_E_001','JOB_E_002','JOB_E_003'].find(x=>!state.run.completed.includes(x)):null;
  if(nextIntro&&rank===1)return pool.filter(j=>j.id===nextIntro).map(j=>j.id);
  const history=state.run.history, last=history.at(-1)?.decision_family;
  const usedGrades=new Set(history.map(x=>x.decision_family));
  const score=j=>{
    let n=j.rank===rank?1000:0;
    if(!state.meta.sp_awarded_models.includes(j.hardware_model_id))n+=50;
    if(state.meta.boss_memory.previous_job_ids?.includes(j.id))n-=30;
    if(j.decision_family===last)n-=80;
    if(!usedGrades.has(j.decision_family))n+=70;
    if(j.evaluation&&hasSkill(state,'F1')&&!state.run.history.some(h=>h.grade===j.grade&&h.evaluation))n+=10000;
    if(hasSkill(state,'A3')&&j.grade==='C'&&j.network===false&&j.keep?.length)n+=9000;
    return n;
  };
  pool.sort((a,b)=>score(b)-score(a)||randomOrder(state,a)-randomOrder(state,b));
  const familiar=[];
  if(rank>1){const koma=pool.find(j=>j.family==='KomaOS'&&j.rank<rank);if(koma)familiar.push(koma);const lower=pool.find(j=>j.rank<rank&&!familiar.includes(j)&&j.family!=='KomaOS');if(lower)familiar.push(lower);}
  const selected=[],families=new Set();
  for(const j of pool){if(selected.length>=5-familiar.length)break;if(!familiar.includes(j)&&!families.has(j.decision_family)){selected.push(j);families.add(j.decision_family);}}
  for(const j of pool){if(selected.length>=6-familiar.length)break;if(!familiar.includes(j)&&!selected.includes(j))selected.push(j);}
  selected.push(...familiar);
  const intro=pool.find(j=>j.rank===rank&&j.n===1&&!completedAny(state,j.id));
  if(intro&&!selected.includes(intro))selected[selected.length-familiar.length>0?selected.length-familiar.length-1:0]=intro;
  for(const reserved of state.run.reserved){const j=pool.find(x=>x.id===reserved);if(j&&!selected.includes(j))selected.unshift(j);}
  return unique(selected.map(j=>j.id)).slice(0,6);
}
function currentSource(attempt,axis){return attempt.provenance.axes[axis]||{axis,method:'initial',pocId:null,unlocked:false};}
function setAxis(attempt,axis,value,source){
  if(value&&!attempt.device.security[axis]){if(axis==='root')attempt.device.history.root++;attempt.provenance.axes[axis]={axis,...source,unlocked:true};}
  if(!value)delete attempt.provenance.axes[axis];
  attempt.device.security[axis]=value;
}
function usefulSources(attempt){
  const g=attempt.job.goal||{},d=attempt.device,s=attempt.snapshot,sources=[];
  for(let i=0;i<AXES.length;i++)if(g.s?.[i]===true&&d.security[AXES[i]])sources.push(currentSource(attempt,AXES[i]));
  for(const name of g.apps||[])if(!s.apps.includes(name)&&d.apps.includes(name)&&attempt.provenance.apps[name])sources.push(attempt.provenance.apps[name]);
  for(const name of g.remove||[])if(s.apps.includes(name)&&!d.apps.includes(name)&&attempt.provenance.removed[name])sources.push(attempt.provenance.removed[name]);
  for(const [key,value] of Object.entries(g.settings||{}))if(d.settings[key]===value&&attempt.provenance.settings[key])sources.push(attempt.provenance.settings[key]);
  return sources.filter(Boolean);
}
export function inspect(attempt,content){
  const rows=[],g=attempt.job.goal||{},d=attempt.device,s=attempt.snapshot;
  const row=(label,expected,actual,ok)=>rows.push({label,expected:String(expected),actual:String(actual),ok:!!ok});
  row('起動','正常',d.operational?'正常':'起動不能',d.operational);
  AXES.forEach((axis,i)=>{if(g.s?.[i]!==null&&g.s?.[i]!==undefined)row(`${AXIS_NAMES[axis]}権限`,g.s[i]?'開放':'施錠',d.security[axis]?'開放':'施錠',d.security[axis]===g.s[i]);});
  if(g.version){const versions=Array.isArray(g.version)?g.version:[g.version];row('OS版',versions.join(' または '),d.version,versions.includes(d.version));}
  if(g.display!==undefined)row('内蔵画面',g.display?'正常':'不良',d.display?'正常':'不良',g.display===d.display);
  for(const app of g.apps||[])row(`アプリ：${app}`,'あり',d.apps.includes(app)?'あり':'なし',d.apps.includes(app));
  for(const app of g.remove||[])row(`削除：${app}`,'なし',d.apps.includes(app)?'残っています':'なし',!d.apps.includes(app));
  if(g.apps?.includes('管理アプリ'))row('管理アプリの起動','利用可',d.security.root&&d.operational?'利用可':'管理者権限が必要',d.security.root&&d.operational);
  for(const [key,value] of Object.entries(g.settings||{})){
    const correct=d.settings[key]===value&&(value!=='custom'||d.setting_fingerprints[key]===fingerprint(`${attempt.job.id}:${key}:target:${value}`));
    row(SETTING_NAMES[key]||key,value,d.settings[key],correct);
  }
  for(const key of g.keepSettings||[])row(`保持：${SETTING_NAMES[key]||key}`,'受注時と一致',d.settings[key],d.settings[key]===s.settings[key]&&d.setting_fingerprints[key]===s.setting_fingerprints[key]);
  for(const name of attempt.job.keep??attempt.job.data??[])row(`データ保持：${name}`,'指紋一致',d.data[name]===s.data[name]?'一致':'消失・変更',!!s.data[name]&&d.data[name]===s.data[name]);
  for(const name of g.empty||[])row(`データ削除：${name}`,'空',d.data[name]?'残っています':'空',!d.data[name]);
  for(const f of attempt.job.forbid||[])row(`禁止履歴：${FORBID_NAMES[f]||f}`,'0回',`${d.history[f]||0}回`,(d.history[f]||0)===0);
  if(attempt.job.beforeBackup)row('消去前に有効な退避','違反なし',d.history.beforeBackupViolation?'退避前に消去しました':'違反なし',!d.history.beforeBackupViolation);
  return rows;
}
function checkOperational(attempt){requireThat(attempt.device.operational,'端末が起動していません。先に修復が必要です');}
function checkScreen(attempt){checkOperational(attempt);requireThat(attempt.device.display||attempt.runtime.dock,'画面が映りません。外部画面ドックか画面交換が必要です');}
function useEquipment(state,attempt,id){requireThat(hasEquipment(state,id),`${id} を購入してください`);add(attempt.used_equipment,id);}
function updateVersion(attempt,content){
  const d=attempt.device,sequence=d.family==='KomaOS'?['1.0','1.1','2.0']:['1.0','1.1'];
  const next=sequence[sequence.indexOf(d.version)+1];
  requireThat(next,'更新できる次の版がありません');
  requireThat(getDevice(content,attempt).versions.includes(next),`この機種は ${next} に対応していません`);
  return next;
}
function backupCategories(attempt,categories){
  const cats=categories||['data','apps'];requireThat(Array.isArray(cats)&&cats.length>0,'保存対象を選んでください');
  const allowed=new Set(['data','apps','settings',...(attempt.job.data||[])]);
  requireThat(cats.every(c=>allowed.has(c)),'その保存カテゴリは存在しません');return unique(cats);
}
function backupFor(state,attempt,portable){return portable?state.run.portable_backup:state.run.backups[attempt.device_uid];}
function validBackup(state,attempt){
  return [state.run.backups[attempt.device_uid],state.run.portable_backup].some(b=>b?.uid===attempt.device_uid&&(attempt.job.keep||[]).every(k=>b.data?.[k]===attempt.snapshot.data[k]));
}
function mediaOccupied(state,pocId,instance,except){
  return state.run.attempts.some(a=>a.id!==except&&a.runtime.media.some(m=>m.pocId===pocId&&m.instance===instance));
}
function checkPoc(content,state,attempt,poc,portIndex=attempt.runtime.port){
  const model=getDevice(content,attempt),port=model.ports[portIndex];requireThat(port,'差込口がありません');
  const shapesMatch=port.type===poc.media||(attempt.runtime.adapter&&['USB-A','USB-C'].includes(port.type)&&['USB-A','USB-C'].includes(poc.media));
  requireThat(shapesMatch,`${poc.media} は ${port.type} に差せません。USB-A/Cのみ M03 で変換できます`);
  requireThat(poc.family===attempt.device.family&&poc.versions.includes(attempt.device.version),`${attempt.device.family} ${attempt.device.version} ／ この媒体は ${poc.family} ${poc.versions.join('・')} 用です`);
}
function operationInfo(state,attempt,operation,content){
  const op=clone(operation),d=attempt.device;
  let cost=0,duration=160,summary='',equipment=null;
  requireThat(op&&typeof op.type==='string','処理が指定されていません');
  switch(op.type){
    case 'poc': {
      checkScreen(attempt);requireThat(attempt.runtime.media.length>0,'先に媒体を端末へ差してください');
      const media=op.pocId?attempt.runtime.media.find(m=>m.pocId===op.pocId):attempt.runtime.media[0];requireThat(media,'挿入していない媒体です');
      const p=find(content.pocs,media.pocId);requireThat(p&&state.run.owned_pocs.includes(p.id),'媒体の利用権がありません');
      requireThat(!state.run.surrendered_poc_ids.includes(p.id),'提出済みの媒体です');checkPoc(content,state,attempt,p);
      requireThat(!d.security[p.axis],`${AXIS_NAMES[p.axis]}は適用済みです`);
      op.pocId=p.id;summary=`${p.id}：${AXIS_NAMES[p.axis]}権限を開きます`;duration=p.duration|| (p.versions.includes('1.0')?1200:1500);break;
    }
    case 'service': {
      const service=op.serviceId;
      if(service!=='S04')requireThat(attempt.job.network!==false,'契約で外部通信が禁止されています');
      if(service==='S01'){
        checkOperational(attempt);op.axes=unique(op.axes||[]).filter(a=>AXES.includes(a)&&!d.security[a]);requireThat(op.axes.length>0,'解除する未開放の権限を選んでください');
        cost=Math.ceil(attempt.job.reward*({1:.35,2:.60,3:.75}[op.axes.length]));summary=`正規解除：${op.axes.map(a=>AXIS_NAMES[a]).join('・')}`;duration=1200;
      }else if(service==='S02'){requireThat(!d.operational,'すでに起動可能です');cost=Math.ceil(attempt.job.reward*.25);summary='データを保ったまま正規修復';duration=1800;
      }else if(service==='S03'){checkOperational(attempt);op.version=updateVersion(attempt,content);summary=`OSを ${op.version} へ更新・3権限を再施錠`;duration=2000;
      }else if(service==='S04'){requireThat(!d.display,'画面は正常です');cost=Math.ceil(attempt.job.reward*.25);summary='内蔵画面を交換';duration=1200;
      }else throw new Error('その正規サービスはありません');break;
    }
    case 'install':case 'remove':{
      checkScreen(attempt);requireThat(d.security.install,'アプリ導入権限を開いてください');
      const apps=content.apps.map(a=>typeof a==='string'?a:(a.name||a.id));requireThat(apps.includes(op.app),'未登録のアプリです');
      requireThat(op.type==='install'?!d.apps.includes(op.app):d.apps.includes(op.app),op.type==='install'?'導入済みです':'そのアプリはありません');summary=`${op.app}を${op.type==='install'?'導入':'削除'}`;duration=450;break;
    }
    case 'setting':{
      checkScreen(attempt);requireThat(d.security.feature,'設定編集権限を開いてください');
      requireThat(getDevice(content,attempt).features.includes(op.key),'この機種にはその設定がありません');
      const values={theme:['standard','custom'],output:['internal','external'],export:['off','local'],schedule:['locked','custom'],content:['stock','custom'],profile:['factory','custom']};
      requireThat(values[op.key]?.includes(op.value),'その設定値は選べません');summary=`${SETTING_NAMES[op.key]}を ${op.value} へ変更`;break;
    }
    case 'lock':checkScreen(attempt);requireThat(op.axis==='all'||AXES.includes(op.axis),'権限が不明です');summary=`${op.axis==='all'?'3つの':AXIS_NAMES[op.axis]}権限を再施錠`;break;
    case 'dock':checkOperational(attempt);equipment='M02';summary='外部画面ドックへ画面を中継';break;
    case 'adapter':requireThat(getDevice(content,attempt).ports.some(p=>['USB-A','USB-C'].includes(p.type)),'USB端子がありません');equipment='M03';summary='USB-A/C変換器を装着';break;
    case 'backup':case 'rescue':case 'restore':{
      op.categories=backupCategories(attempt,op.categories);
      if(op.portable){requireThat(hasSkill(state,'A3'),'携帯保全設備の技能が必要です');requireThat(!op.categories.includes('settings'),'携帯保全設備はデータとアプリだけを扱います');}
      else equipment=op.type==='rescue'?'M06':'M04';
      if(op.type==='backup')checkOperational(attempt);
      if(op.type==='rescue')requireThat(attempt.job.readable!==false,'この端末のデータは読み取れません');
      if(op.type==='restore'){
        checkOperational(attempt);const b=backupFor(state,attempt,op.portable);
        requireThat(b&&b.uid===attempt.device_uid&&b.family===d.family,'この端末のバックアップがありません');
        const sequence=d.family==='KomaOS'?['1.0','1.1','2.0']:['1.0','1.1'];requireThat(sequence.indexOf(d.version)>=sequence.indexOf(b.version),'古い版への復元はできません');
        for(const c of op.categories){if(c==='data')requireThat(b.categories.includes('data'),'全データの退避を作っていません');else if(c==='apps'||c==='settings')requireThat(b.categories.includes(c),`${c} は退避されていません`);else requireThat(Object.hasOwn(b.data,c),`${c} は退避されていません`);}
      }
      duration=op.type==='rescue'?1800:1200;summary=`${op.type==='restore'?'復元':op.type==='rescue'?'読取専用救出':'バックアップ'}：${op.categories.join('・')}`;break;
    }
    case 'reimage':equipment='M05';cost=op.development?(MATERIALS[d.family]||0):0;duration=2400;summary=`同じ版の${op.development?'開発用':'標準'}イメージで初期化・復旧`;break;
    case 'update':checkOperational(attempt);requireThat(op.offline,'オンライン更新は正規更新を選んでください');equipment='M09';op.version=updateVersion(attempt,content);duration=2000;summary=`通信せず OS ${op.version} へ更新・3権限を再施錠`;break;
    case 'preset':checkOperational(attempt);requireThat(attempt.job.preset,'転写用プリセットが添付されていません');equipment='M13';summary='契約の転写プリセットだけを適用';duration=700;break;
    case 'diagnose':equipment='M07';summary='互換性と不足条件を診断';duration=350;break;
    case 'test':checkOperational(attempt);equipment='M10';summary='端末の機能を試運転';duration=500;break;
    default:throw new Error('不明な処理です');
  }
  if(equipment)requireThat(hasEquipment(state,equipment),`${equipment} を購入してください`);
  if(hasSkill(state,'C4'))duration=Math.ceil(duration*.75);
  return {operation:op,cost,duration,summary,equipment};
}
function mutateOperation(state,attempt,info,content,operationId){
  const op=info.operation,d=attempt.device,source={method:op.type,operationId};
  const workAxes=workUnlockAxes(attempt,content,inspect);
  if(info.equipment)add(attempt.used_equipment,info.equipment);
  const unlock=(axis,pocId)=>setAxis(attempt,axis,true,{...source,pocId:pocId||null});
  const changeSetting=(key,value,provenance)=>{d.settings[key]=value;d.setting_fingerprints[key]=fingerprint(`${attempt.job.id}:${key}:target:${value}`);attempt.provenance.settings[key]=clone(provenance);};
  const update=()=>{d.version=op.version;d.history.update++;for(const axis of AXES)setAxis(attempt,axis,false,source);};
  switch(op.type){
    case 'poc':{const p=find(content.pocs,op.pocId);unlock(p.axis,p.id);break;}
    case 'service':{
      if(op.serviceId!=='S04')d.history.network++;
      if(op.serviceId==='S01')for(const axis of op.axes)unlock(axis);
      if(op.serviceId==='S02')d.operational=true;
      if(op.serviceId==='S03')update();
      if(op.serviceId==='S04')d.display=true;
      break;
    }
    case 'install':add(d.apps,op.app);d.history.appInstall++;attempt.provenance.apps[op.app]=clone(currentSource(attempt,'install'));delete attempt.provenance.removed[op.app];break;
    case 'remove':remove(d.apps,op.app);attempt.provenance.removed[op.app]=clone(currentSource(attempt,'install'));delete attempt.provenance.apps[op.app];break;
    case 'setting':changeSetting(op.key,op.value,currentSource(attempt,'feature'));break;
    case 'lock':for(const axis of op.axis==='all'?AXES:[op.axis])setAxis(attempt,axis,false,source);break;
    case 'dock':attempt.runtime.dock=true;break;
    case 'adapter':attempt.runtime.adapter=true;break;
    case 'backup':case 'rescue':{
      const cats=op.categories,b={uid:attempt.device_uid,family:d.family,version:d.version,categories:cats,data:{},apps:[],settings:{},setting_fingerprints:{},provenance:clone(attempt.provenance),created_after_erase:d.history.erase};
      if(cats.includes('data'))b.data=clone(d.data);else for(const c of cats)if(Object.hasOwn(d.data,c))b.data[c]=d.data[c];
      if(cats.includes('apps'))b.apps=[...d.apps];if(cats.includes('settings')){b.settings=clone(d.settings);b.setting_fingerprints=clone(d.setting_fingerprints);}
      if(op.portable)state.run.portable_backup=b;else state.run.backups[attempt.device_uid]=b;
      if(op.portable)attempt.portable_used=true;break;
    }
    case 'restore':{
      const b=backupFor(state,attempt,op.portable),cats=op.categories;
      if(cats.includes('data'))d.data=clone(b.data);else for(const c of cats)if(c!=='apps'&&c!=='settings')d.data[c]=b.data[c];
      if(cats.includes('apps')){d.apps=[...b.apps];attempt.provenance.apps=clone(b.provenance.apps);attempt.provenance.removed=clone(b.provenance.removed);}
      if(cats.includes('settings')){d.settings=clone(b.settings);d.setting_fingerprints=clone(b.setting_fingerprints);attempt.provenance.settings=clone(b.provenance.settings);}
      if(d.history.erase>b.created_after_erase)attempt.restored_after_erase=true;if(op.portable)attempt.portable_used=true;break;
    }
    case 'reimage':{
      if(attempt.job.beforeBackup&&!validBackup(state,attempt))d.history.beforeBackupViolation++;
      d.history.erase++;d.history.reimage++;d.operational=true;d.data={};d.apps=[];d.settings=clone(DEFAULT_SETTINGS);
      d.setting_fingerprints=Object.fromEntries(Object.entries(d.settings).map(([k,v])=>[k,fingerprint(`factory:${k}:${v}`)]));
      attempt.provenance.apps={};attempt.provenance.removed={};attempt.provenance.settings={};
      for(const axis of AXES)setAxis(attempt,axis,false,source);
      if(op.development)for(const axis of AXES)unlock(axis);break;
    }
    case 'update':update();break;
    case 'preset':for(const [k,v] of Object.entries(attempt.job.goal.settings||{}))changeSetting(k,v,{method:'preset',axis:null,unlocked:false});break;
    case 'diagnose':case 'test':break;
  }
  state.run.cash-=info.cost;attempt.spent+=info.cost;
  attempt.log.push({id:operationId,operation:clone(op),cost:info.cost,summary:info.summary,version:d.version,work_unlock_axes:workAxes.filter(axis=>d.security[axis])});
}
export function quoteOperation(state,operation,content,attemptId){
  const a=getAttempt(state,attemptId);requireThat(!a.runtime.pending,'現在の処理が終わるまでお待ちください');
  const info=operationInfo(state,a,operation,content),trial=clone(state),ta=getAttempt(trial,a.id);
  mutateOperation(trial,ta,info,content,'preview');
  const stages=[info.summary];let totalDuration=info.duration;
  if(operation.type==='poc'&&!operation.pocId&&a.runtime.media.length>1){
    requireThat(hasSkill(state,'B3'),'複合媒体の技能が必要です');
    for(const m of a.runtime.media.slice(1)){
      const child=operationInfo(trial,ta,{type:'poc',pocId:m.pocId},content);
      mutateOperation(trial,ta,child,content,'preview-'+m.pocId);stages.push(child.summary);totalDuration+=child.duration;
    }
  }
  const warnings=[];
  for(const f of a.job.forbid||[])if((ta.device.history[f]||0)>(a.device.history[f]||0))warnings.push(`「${FORBID_NAMES[f]||f}禁止」に違反し、この依頼は納品できなくなります`);
  if(ta.device.history.beforeBackupViolation>a.device.history.beforeBackupViolation)warnings.push('契約の「消去より前に退避」に違反します');
  if(operation.type==='reimage')warnings.push('端末のデータ・アプリ・設定が消去されます。復元には実際の退避が必要です');
  if(operation.type==='restore'&&(operation.categories||[]).includes('settings'))warnings.push('退避時の設定で現在の設定を上書きします');
  if(operation.portable&&['backup','rescue'].includes(operation.type)&&state.run.portable_backup?.uid&&state.run.portable_backup.uid!==a.device_uid)warnings.push('携帯保全ケース内の別端末の退避を上書きします');
  if(operation.type==='service'&&operation.serviceId==='S03'||operation.type==='update')warnings.push(`OS ${info.operation.version} へ進めると戻せません。3権限が閉じ、旧版PoCが使えなくなる場合があります`);
  const reserved=state.run.attempts.reduce((n,x)=>n+(x.runtime.pending?.info.cost||0),0);
  return {...info,stages,totalDuration,warnings,affordable:info.cost<=state.run.cash-reserved,availableCash:state.run.cash-reserved};
}

export function endingOptions(state,content){
  const completed=state.run.main_completed.length,os=new Set(state.run.history.filter(h=>!h.practice).map(h=>h.family));
  const submittedFamilies=new Set(state.meta.surrendered_poc_ids.map(p=>find(content.pocs,p)?.family).filter(Boolean));
  const conditions={
    END_FREE:[true,'いつでも退職できます',0],
    END_TRAINING:[completed>=MAIN_JOB_LIMIT,'主案件を5件納品',0],
    END_WHITE:[completed>=MAIN_JOB_LIMIT&&hasSkill(state,'F1')&&['C','B','A'].every(g=>state.run.reports.some(r=>r.grade===g)),'委託評価の窓口・5件納品・C/B/Aの評価報告3件',0],
    END_INDEPENDENT:[os.size>=2&&state.run.cash>=1500,'異なる2系統の納品と開業費 $1,500',1500],
    END_RESEARCH:[submittedFamilies.size>=2,'異なる2系統のメーカー提出実績',0],
    END_SUCCESSOR:[completed>=MAIN_JOB_LIMIT&&state.run.handover,'5件納品と異なる判断2件の引継ぎ確認',0],
    END_ROAMER:[hasSkill(state,'A3')&&state.run.roamer,'携帯保全設備で通信禁止・データ保持案件を救出／復元',0]
  };
  return (content.endings||Object.keys(conditions).map(id=>({id,name:id}))).filter(e=>e.enabled!==false&&conditions[e.id]).map(e=>({ ...e,available:conditions[e.id][0],reason:conditions[e.id][1],cost:conditions[e.id][2]}));
}
function finalizeRetirement(state,content){
  const r=state.run,request=r.retirement;
  if(!request||r.status==='retired'||r.attempts.some(a=>a.runtime.pending))return;
  const option=endingOptions(state,content).find(e=>e.id===request.endingId);
  requireThat(option?.available,'この進路の条件を満たしていません');
  r.cash-=option.cost;
  state.meta.last_run_eligible_reward_total=r.eligible_reward_total;
  r.carry_candidates=unique(state.meta.proven_owned_item_ids.filter(item=>r.owned_pocs.includes(item)||r.owned_equipment.includes(item))).filter(item=>!r.surrendered_poc_ids.includes(item));
  state.meta.boss_memory={previous_ending_id:request.endingId,previous_job_ids:[...r.completed],previous_family:r.history.at(-1)?.family||null};
  add(state.meta.seen_ending_ids,request.endingId);r.status='retired';r.retirement={...request,settled:true,eligible_reward_total:r.eligible_reward_total,next_start_cash:400+Math.floor(r.eligible_reward_total/2)};
  r.attempts=[];r.active_id=null;r.backups={};r.portable_backup=null;r.prepared=[];
}
function stageOperation(state,action,content){
  const a=getAttempt(state,action.attemptId),quote=quoteOperation(state,action.operation,content,a.id);
  requireThat(quote.affordable,`資金が足りません。必要 $${quote.cost} ／使用可能 $${quote.availableCash}`);
  requireThat(!quote.warnings.length||action.confirmed,'確認が必要です：'+quote.warnings.join('。'));
  requireThat(!state.run.retirement,'退職の精算を待っています');
  if(!hasSkill(state,'D3'))requireThat(!state.run.attempts.some(other=>other.id!==a.id&&other.runtime.pending),'別の端末を処理中です。双卓の技能が必要です');
  const operationId=id(state,'operation'),chain=[];
  if(action.operation.type==='poc'&&!action.operation.pocId&&a.runtime.media.length>1){
    requireThat(hasSkill(state,'B3'),'複合媒体の技能が必要です');
    for(const media of a.runtime.media.slice(1)){
      const p=find(content.pocs,media.pocId);checkPoc(content,state,a,p);requireThat(!a.device.security[p.axis],`${p.id} は適用済みです`);chain.push(p.id);
    }
  }
  a.runtime.pending={id:operationId,remaining:quote.duration,total:quote.duration,info:{operation:quote.operation,cost:quote.cost,duration:quote.duration,summary:quote.summary,equipment:quote.equipment},chain};
}
function processTick(state,ms,content){
  requireThat(Number.isFinite(ms)&&ms>=0,'経過時間が不正です');
  const ready=[];
  for(const a of state.run.attempts){if(a.runtime.pending){a.runtime.pending.remaining=Math.max(0,a.runtime.pending.remaining-ms);if(!a.runtime.pending.remaining)ready.push(a);}}
  for(const a of ready){
    const pending=a.runtime.pending;a.runtime.pending=null;
    if(!state.run.receipt_ids.includes(pending.id)){
      operationInfo(state,a,pending.info.operation,content);
      requireThat(state.run.cash>=pending.info.cost,'予約していた処理費用が不足しています');
      mutateOperation(state,a,pending.info,content,pending.id);add(state.run.receipt_ids,pending.id);
      if(pending.recipeStep!==undefined&&a.runtime.recipe?.index===pending.recipeStep)a.runtime.recipe.index++;
    }
    if(pending.chain.length&&!state.run.retirement){
      const [pocId,...chain]=pending.chain;
      const info=operationInfo(state,a,{type:'poc',pocId},content);
      a.runtime.pending={id:id(state,'operation'),remaining:info.duration,total:info.duration,info,chain};
    }else if(a.runtime.queue.length&&hasSkill(state,'B2')){
      a.runtime.media=[];
      a.runtime.queue=a.runtime.queue.filter(p=>state.run.owned_pocs.includes(p)&&!state.run.surrendered_poc_ids.includes(p));
    }
    if(a.runtime.recipe?.auto&&!a.runtime.pending&&!state.run.retirement)advanceRecipe(state,a,content);
  }
  finalizeRetirement(state,content);
}
function advanceRecipe(state,a,content){
  const recipe=a.runtime.recipe,operation=recipe?.operations[recipe.index];
  if(!operation){if(recipe)recipe.auto=false;return;}
  try{
    const q=quoteOperation(state,operation,content,a.id);
    if(q.warnings.length||q.cost||['reimage','update'].includes(operation.type)||operation.serviceId==='S03'){
      recipe.paused='この工程は費用・消去・版変更の確認が必要です';return;
    }
    stageOperation(state,{attemptId:a.id,operation,confirmed:false},content);
    a.runtime.pending.recipeStep=recipe.index;recipe.paused=null;
  }catch(e){recipe.paused=e.message;}
}
function callEvent(state,content,callId){
  const event=find(content.events||[],callId);requireThat(event,'電話記録がありません');
  if(state.run.completed_calls.includes(callId))return;
  requireThat(state.run.pending_calls.includes(callId),'まだこの電話は来ていません');
  add(state.run.completed_calls,callId);remove(state.run.pending_calls,callId);
  if(event.rank){const oldRank=state.run.rank;state.run.rank=Math.max(oldRank,event.rank);add(state.run.book_pending,event.rank);state.run.chapter_grants[event.rank]=false;if(state.run.rank>oldRank)retainInbox(state,content,true);}
}
function scheduleCalls(state,content){
  const r=state.run,t=r.tutorial;
  const buffered=graduationPending(state)||!!t?.independentActive;
  if(buffered){r.tutorial||={briefingPage:0,briefed:false};r.tutorial.deferredCalls||=[];for(const id of r.pending_calls)add(r.tutorial.deferredCalls,id);r.pending_calls=[];}
  for(const event of content.events||[]){
    if(event.id==='CALL01'){if(r.id===1&&r.completed.includes('JOB_E_001')&&!r.completed_calls.includes(event.id))add(buffered?r.tutorial.deferredCalls:r.pending_calls,event.id);continue;}
    const threshold=event.rank?Math.max(1,event.rank-(r.progress_start_rank||1)):MAIN_JOB_LIMIT;
    if(event.rank&&event.rank<=(r.progress_start_rank||1))continue;
    if(r.main_completed.length>=threshold&&!r.completed_calls.includes(event.id))add(buffered?r.tutorial.deferredCalls:r.pending_calls,event.id);
  }
  if(!buffered&&t?.deferredCalls){for(const id of t.deferredCalls)if(!r.completed_calls.includes(id))add(r.pending_calls,id);t.deferredCalls=[];}
}
function deliverAttempt(state,attempt,content){
  requireThat(!attempt.runtime.pending,'処理が終わるまで納品できません');
  const rows=inspect(attempt,content);requireThat(rows.every(r=>r.ok),'未達条件があります：'+rows.filter(r=>!r.ok).map(r=>r.label).join('・'));
  const receipt=`${attempt.id}:deliver`;if(state.run.receipt_ids.includes(receipt))return;
  const sources=usefulSources(attempt),usedPocs=unique(sources.map(s=>s.pocId).filter(Boolean));
  const effectiveAxes=unique(sources.filter(s=>s.axis&&s.unlocked&&!attempt.snapshot.security[s.axis]).map(s=>s.axis));
  const real=!attempt.practice&&!state.run.completed.includes(attempt.job_id);
  let reward=real?attempt.job.reward:0,sp=0,support=0;
  if(attempt.job_id==='SUPPORT_KOMA'){
    const costs=availableJobs(state,content).flatMap(j=>planRoutes(state,j,content,{quick:true}).filter(p=>p.valid).map(p=>p.upfront));
    if(costs.length&&!Object.values(state.run.chapter_grants).includes(false))support=Math.min(120,Math.max(0,Math.min(...costs)-state.run.cash));
    state.run.cash+=support;state.run.support_total+=support;
  }
  if(real){
    state.run.cash+=reward;state.run.eligible_reward_total+=reward;add(state.run.completed,attempt.job_id);
    if(!trainingJob(state,attempt.job)&&state.run.main_completed.length<MAIN_JOB_LIMIT)add(state.run.main_completed,attempt.job_id);
    if(effectiveAxes.length&&!state.meta.sp_awarded_models.includes(attempt.hardware_model_id)){
      sp=getDevice(content,attempt).skill_point_reward;state.meta.sp_total_earned+=sp;add(state.meta.sp_awarded_models,attempt.hardware_model_id);
    }
    for(const item of [...usedPocs,...attempt.used_equipment])if(state.run.owned_pocs.includes(item)||state.run.owned_equipment.includes(item))add(state.meta.proven_owned_item_ids,item);
    add(state.meta.learned_intro_ids,attempt.job_id);
  }
  const record={attempt_id:attempt.id,job_id:attempt.job_id,hardware_model_id:attempt.hardware_model_id,title:attempt.job.title,grade:attempt.job.grade,family:attempt.device.family,
    decision_family:attempt.job.decision_family,decision_signature:attempt.job.decision_signature,version:attempt.device.version,practice:!real,reward,sp,support,spent:attempt.spent,invested:attempt.invested,
    used_pocs:usedPocs,used_equipment:[...attempt.used_equipment],evaluation:!!attempt.job.evaluation&&hasSkill(state,'F1'),snapshot:attempt.snapshot,final:clone(attempt.device),log:clone(attempt.log),checks:rows};
  state.run.history.push(record);if(real)state.meta.history.push(record);
  if(real&&state.run.id===1){
    state.run.tutorial||={briefingPage:0,briefed:false};
    if(attempt.job_id===SECOND_JOB&&!state.run.tutorial.graduationHeard)state.run.tutorial.graduationPending=true;
    if(state.run.tutorial.independentActive){state.run.tutorial.independentActive=false;state.run.tutorial.independentCompleted=attempt.job_id;}
  }
  if(real&&hasSkill(state,'A3')&&attempt.job.network===false&&attempt.job.keep?.length&&attempt.portable_used&&attempt.restored_after_erase)state.run.roamer=true;
  add(state.run.receipt_ids,receipt);state.run.attempts=state.run.attempts.filter(a=>a.id!==attempt.id);delete state.run.backups[attempt.device_uid];
  state.run.active_id=state.run.attempts[0]?.id||null;
  scheduleCalls(state,content);
  if(real){state.run.inbox_revision++;state.run.inbox=chooseInbox(state,content);}
  else if(support>0)retainInbox(state,content,true);
}
function validateAllocations(ids,content,total){
  requireThat(Array.isArray(ids)&&unique(ids).length===ids.length,'技能の選択が不正です');
  let cost=0;
  for(const skillId of ids){
    const skill=find(content.skills,skillId);requireThat(skill,'未知の技能です');cost+=skill.cost;
    if(skillId==='F1')requireThat(['A2','B2','C2','D2'].filter(k=>ids.includes(k)).length>=2,'中央技能には第2層の技能が2つ必要です');
    else requireThat((skill.requires||[]).every(k=>ids.includes(k)),`${skillId} の前提技能が足りません`);
  }
  requireThat(cost<=total,`SPが足りません。必要 ${cost} SP ／合計 ${total} SP`);return cost;
}
export function dispatch(previous,action,content){
  requireThat(previous&&previous.run&&action&&typeof action.type==='string','操作が不正です');
  if(action.transactionId&&previous.run.receipt_ids.includes(action.transactionId))return previous;
  const state=clone(previous),r=state.run;migrateProgress(state);
  const activeOnly=!['tick','allocate','rehire','retire','read','call','recoveryScan'].includes(action.type);
  if(activeOnly)requireThat(r.status==='active','退職後は新人として応募してください');
  switch(action.type){
    case 'recoveryScan':{
      // Older saves have no assistance queue. Reconstruct regressions only for
      // devices with committed work, using their real acceptance snapshot.
      const baseline=clone(state);
      for(const a of baseline.run.attempts){
        if(!a.log.length)continue;
        a.device=clone(a.snapshot);a.log=[];
      }
      syncRecovery(baseline,state,content,inspect);break;
    }
    case 'recoveryCall':{
      r.assistance||={queue:[],active:null,hints:[]};
      if(r.assistance.active?.id===action.id)break;
      requireThat(!r.assistance.active,'進行中の復旧案内を先に終えてください');
      const entry=[...r.assistance.queue,...r.assistance.hints||[]].find(e=>e.id===action.id);
      requireThat(entry&&recoveryNeeded(state,entry,content,inspect),'この復旧案内は解決済みです');
      r.assistance.queue=r.assistance.queue.filter(e=>e.id!==entry.id);r.assistance.hints=(r.assistance.hints||[]).filter(e=>e.id!==entry.id);r.assistance.active=entry;r.active_id=entry.attemptId;
      state.meta.assistance_seen_patterns||=[];add(state.meta.assistance_seen_patterns,entry.pattern);break;
    }
    case 'recoveryComplete':{
      const entry=r.assistance?.active;
      if(entry)requireThat(!recoveryNeeded(state,entry,content,inspect),'復旧操作がまだ完了していません');
      if(r.assistance)r.assistance.active=null;break;
    }
    case 'recoveryRetry':{
      const entry=r.assistance?.active;
      requireThat(entry?.retry,'受け直しが必要な復旧案内を開いてください');
      const a=getAttempt(state,entry.attemptId);requireThat(!a.runtime.pending,'現在の処理が終わるまでお待ちください');
      const abandoned=dispatch(state,{type:'abandon',attemptId:a.id},content);
      return dispatch(abandoned,{type:'accept',jobId:a.job_id,transactionId:action.transactionId},content);
    }
    case 'tutorialBriefingNext':{
      requireThat(r.id===1&&r.attempts.some(a=>a.job_id==='JOB_E_001'),'最初の端末が届いてから説明します');
      r.tutorial||={briefingPage:0,briefed:false};
      if(!r.tutorial.briefed){r.tutorial.briefingPage=Math.min(6,r.tutorial.briefingPage+1);r.tutorial.briefed=r.tutorial.briefingPage===6;}
      break;
    }
    case 'tutorialGraduationCall':{
      if(r.tutorial?.graduationHeard)break;
      requireThat(graduationPending(state),'二台目を返却してから説明します');
      r.tutorial||={briefingPage:0,briefed:true};
      r.tutorial.graduationPending=false;r.tutorial.graduationHeard=true;r.tutorial.independentActive=true;
      scheduleCalls(state,content);break;
    }
    case 'introNext':{
      r.intro||={stage:0,complete:false};
      if(!r.intro.complete){r.intro.stage=Math.min(4,r.intro.stage+1);r.intro.complete=r.intro.stage===4;}
      break;
    }
    case 'accept': {
      const job=getJob(content,action.jobId);requireThat(job.rank<=r.rank,'このグレードはまだ解放されていません');
      requireThat(prerequisitesMet(state,job),'この依頼の前提案件が未完了です');
      requireThat(!r.attempts.some(a=>a.job_id===job.id),'すでに受注しています');
      requireThat(r.attempts.length<(hasSkill(state,'D3')||hasEquipment(state,'M12')?2:1),'受付が満杯です。現在の案件を返却するか破棄してください');
      const practice=r.completed.includes(job.id);const mainEligible=!practice&&!trainingJob(state,job)&&r.main_completed.length<MAIN_JOB_LIMIT;
      const a=makeAttempt(state,job,practice);a.mainEligible=mainEligible;r.attempts.push(a);r.active_id=a.id;add(r.read,job.id);remove(r.inbox,job.id);remove(r.reserved,job.id);prepareForAttempt(state,content);break;
    }
    case 'select':getAttempt(state,action.attemptId);r.active_id=action.attemptId;prepareForAttempt(state,content);break;
    case 'read':getJob(content,action.jobId);add(r.read,action.jobId);break;
    case 'buy':{
      const p=find(content.pocs,action.id),e=find(content.equipment,action.id),item=p||e;requireThat(item,'商品がありません');
      const owned=p?r.owned_pocs:r.owned_equipment;if(owned.includes(item.id))break;
      requireThat(item.rank<=(p?r.poc_rank:r.equipment_rank),'先にこのランクのカタログを開いてください');
      requireThat(!r.surrendered_poc_ids.includes(item.id),'今周回に譲渡したPoCは買い直せません');
      const available=r.cash-r.attempts.reduce((n,a)=>n+(a.runtime.pending?.info.cost||0),0);requireThat(available>=item.price,'資金が足りません');
      r.cash-=item.price;add(owned,item.id);const a=currentAttempt(state);if(a)a.invested+=item.price;
      add(r.receipt_ids,id(state,'purchase'));prepareForAttempt(state,content);break;
    }
    case 'insert':{
      const a=getAttempt(state,action.attemptId);requireThat(!a.runtime.pending,'処理中の媒体は取り替えられません');requireThat(a.runtime.media.length===0,'先に今の媒体を取り出してください');
      const ids=unique(action.pocIds||[action.pocId]);requireThat(ids.length>0&&ids.length<=3,'媒体は1〜3個です');
      if(ids.length>1)requireThat(hasSkill(state,'B3'),'複合媒体の技能が必要です');
      const pocs=ids.map(pid=>find(content.pocs,pid));requireThat(pocs.every(Boolean),'そのPoCはありません');
      requireThat(unique(pocs.map(p=>p.axis)).length===pocs.length,'同じ権限の重複モジュールはまとめられません');
      requireThat(unique(pocs.map(p=>`${p.media}:${p.family}`)).length===1,'形状とOSが同じPoCだけをまとめられます');
      const portIndex=action.portIndex||0,instance=action.instance||0;
      for(const p of pocs){
        requireThat(r.owned_pocs.includes(p.id)&&!r.surrendered_poc_ids.includes(p.id),'この媒体を所有していません');
        requireThat(instance<(r.copies[p.id]||1),'その複製媒体はありません');requireThat(!mediaOccupied(state,p.id,instance,a.id),'この媒体は別の端末で使用中です');
        checkPoc(content,state,a,p,portIndex);
      }
      a.runtime.port=portIndex;a.runtime.media=pocs.map(p=>({pocId:p.id,instance,media_instance_id:`${r.id}:${p.id}:${instance}`}));
      if(a.runtime.queue[0]===ids[0])a.runtime.queue.shift();break;
    }
    case 'eject':{const a=getAttempt(state,action.attemptId);requireThat(!a.runtime.pending,'処理中は取り外せません');a.runtime.media=[];break;}
    case 'start':stageOperation(state,action,content);break;
    case 'tick':processTick(state,action.ms,content);break;
    case 'deliver':deliverAttempt(state,getAttempt(state,action.attemptId),content);break;
    case 'abandon':{const a=getAttempt(state,action.attemptId);requireThat(!a.runtime.pending,'現在の処理が終わるまでお待ちください');r.attempts=r.attempts.filter(x=>x.id!==a.id);delete r.backups[a.device_uid];r.active_id=r.attempts[0]?.id||null;if(!a.practice&&availableJobs(state,content).some(j=>j.id===a.job_id)&&affordableJob(state,a.job,content))r.inbox=unique([a.job_id,...r.inbox]).slice(0,6);break;}
    case 'shuffle':break;
    case 'mailboxRefresh':if(r.inbox_policy_version!==2){r.inbox_policy_version=2;r.inbox=chooseInbox(state,content);}else retainInbox(state,content);scheduleCalls(state,content);break;
    case 'call':callEvent(state,content,action.id);break;
    case 'openCatalog':{
      const rank=action.rank;requireThat(Number.isInteger(rank)&&rank>0&&rank<=r.rank,'カタログが届いていません');
      const oldPocRank=r.poc_rank,oldEquipmentRank=r.equipment_rank;
      if(action.kind==='poc'||action.kind==='both')r.poc_rank=Math.max(r.poc_rank,rank);
      if(action.kind==='equipment'||action.kind==='both')r.equipment_rank=Math.max(r.equipment_rank,rank);
      if(r.poc_rank>=rank&&r.equipment_rank>=rank)remove(r.book_pending,rank);if(r.poc_rank>oldPocRank||r.equipment_rank>oldEquipmentRank)retainInbox(state,content,true);break;
    }
    case 'grant':{
      const rank=action.rank;requireThat(Object.hasOwn(r.chapter_grants,rank)&&r.chapter_grants[rank]===false,'この章の支給は受取済みか未解放です');
      if(action.choice==='cash'){const event=(content.events||[]).find(e=>e.rank===rank);r.cash+=event?.grant||[0,0,200,400,600,800][rank];}
      else{const p=find(content.pocs,action.choice);requireThat(p&&p.rank===rank&&!r.owned_pocs.includes(p.id)&&!r.surrendered_poc_ids.includes(p.id),'このPoCは支給対象ではありません');add(r.owned_pocs,p.id);}
      r.chapter_grants[rank]=action.choice;add(r.receipt_ids,`${r.id}:grant:${rank}`);retainInbox(state,content,true);prepareForAttempt(state,content);break;
    }
    case 'surrender':{
      const p=find(content.pocs,action.pocId);requireThat(p&&p.id!=='P01','貸与品は提出できません');
      requireThat(r.owned_pocs.includes(p.id),'このPoCを所有していません');requireThat(!state.meta.surrendered_poc_ids.includes(p.id),'メーカー報奨金は生涯一度だけです');
      requireThat(r.history.some(h=>!h.practice&&h.used_pocs.includes(p.id)),'当周の合格納品へ実質的に寄与した記録が必要です');
      requireThat(!r.attempts.some(a=>a.runtime.pending&&(a.runtime.media.some(m=>m.pocId===p.id)||a.runtime.pending.chain.includes(p.id))),'使用中の処理が終わるまで提出できません');
      const reward=Math.ceil(p.price*1.5);r.cash+=reward;r.eligible_reward_total+=reward;remove(r.owned_pocs,p.id);delete r.copies[p.id];add(r.surrendered_poc_ids,p.id);add(state.meta.surrendered_poc_ids,p.id);
      for(const a of r.attempts){a.runtime.media=a.runtime.media.filter(m=>m.pocId!==p.id);a.runtime.queue=a.runtime.queue.filter(m=>m!==p.id);}r.prepared=r.prepared.filter(x=>x!==p.id);
      add(r.receipt_ids,`${r.id}:surrender:${p.id}`);break;
    }
    case 'retire':{
      requireThat(!tutorialRetirementBlocked(state),'研修中は退職できません。工房長の説明を聞き、二台目を返却してください');
      if(r.status==='retired')break;const endingId=action.endingId||'END_FREE';const option=endingOptions(state,content).find(e=>e.id===endingId);requireThat(option?.available,'この進路の条件を満たしていません');
      const reserved=r.attempts.reduce((n,a)=>n+(a.runtime.pending?.info.cost||0),0);requireThat(r.cash-reserved>=option.cost,'処理予約分を除く開業費が足りません');
      r.retirement={endingId,requested:true,settled:false};finalizeRetirement(state,content);break;
    }
    case 'allocate':requireThat(r.status==='retired','技能は退職画面で振り替えます');validateAllocations(action.ids,content,state.meta.sp_total_earned);state.meta.skill_allocations=[...action.ids];break;
    case 'rehire':{
      requireThat(r.status==='retired'&&r.retirement?.settled,'先に退職精算を完了してください');validateAllocations(state.meta.skill_allocations,content,state.meta.sp_total_earned);
      const pocs=unique(action.pocIds||[action.pocId].filter(Boolean)),equipment=unique(action.equipmentIds||[action.equipmentId].filter(Boolean)),limits=carryLimits(state.meta.skill_allocations);
      requireThat(pocs.length<=limits.pocs&&pocs.every(id=>r.carry_candidates.includes(id)&&id!=='P01'&&find(content.pocs,id)),'買い取れる媒体の数・候補を確認してください');
      requireThat(equipment.length<=limits.equipment&&equipment.every(id=>r.carry_candidates.includes(id)&&CARRY_EQUIPMENT.includes(id)),'買い取れる機材の数・候補を確認してください');
      const next=makeRun(state,content,state.seed,r.id+1,pocs,equipment);state.run=next;next.inbox=chooseInbox(state,content);break;
    }
    case 'support':{
      requireThat(!Object.values(r.chapter_grants).includes(false),'先に未受取の章支給を選んでください');
      requireThat(r.attempts.length<(hasSkill(state,'D3')||hasEquipment(state,'M12')?2:1),'受付が満杯です。先に案件を整理してください');
      requireThat(!r.attempts.some(a=>a.job_id==='SUPPORT_KOMA'),'支援用の端末はすでに受け取っています');
      const job={...clone(getJob(content,'JOB_E_001')),id:'SUPPORT_KOMA',title:'工房支援：練習用端末',reward:0,prerequisites:[],data:[],keep:[],goal:{s:[true,null,null]},decision_family:'unlock_only'};
      const a=makeAttempt(state,job,true);a.mainEligible=false;r.attempts.push(a);r.active_id=a.id;break;
    }
    case 'duplicate':{
      requireThat(hasEquipment(state,'M08')||hasSkill(state,'D4'),'メディア複製器か予備媒体製作の技能が必要です');requireThat(r.owned_pocs.includes(action.pocId),'所持PoCだけを複製できます');requireThat(!r.surrendered_poc_ids.includes(action.pocId),'提出済み媒体は複製できません');r.copies[action.pocId]=2;break;
    }
    case 'prepare':requireThat(hasSkill(state,'B1'),'適合媒体の取り置き技能が必要です');requireThat(unique(action.pocIds||[]).length<=preparationLimit(state)&&(action.pocIds||[]).every(x=>r.owned_pocs.includes(x)),`取り置きは所有媒体${preparationLimit(state)}枚までです`);r.prepared=unique(action.pocIds||[]);break;
    case 'queue':{
      requireThat(hasSkill(state,'B2'),'実行予約の技能が必要です');const a=getAttempt(state,action.attemptId),ids=unique(action.pocIds||[]);requireThat(ids.length<=3,'予約は3本までです');
      for(const pid of ids){const p=find(content.pocs,pid);requireThat(p&&r.owned_pocs.includes(pid),'所有媒体だけを予約できます');checkPoc(content,state,a,p);}a.runtime.queue=ids;break;
    }
    case 'nominate':requireThat(hasSkill(state,'D1')&&!r.nominated,'指名は技能を持つ契約につき一度だけです');requireThat(availableJobs(state,content).some(j=>j.id===action.jobId&&j.rank===r.rank),'この依頼は現在指名できません');r.nominated=true;r.inbox=unique([action.jobId,...r.inbox]).slice(0,6);break;
    case 'reserve':{
      requireThat(hasSkill(state,'D2')&&!r.reservation_used,'先行予約は技能を持つ契約につき一度だけです');const ids=action.jobIds||[];requireThat(ids.length===2&&ids[0]!==ids[1],'異なる依頼を2件選んでください');
      requireThat(ids.every(x=>availableJobs(state,content).some(j=>j.id===x)),'受付できる依頼から2件を選んでください');r.reserved=[...ids].reverse();r.reservation_used=true;r.inbox=unique([...r.reserved,...r.inbox]).slice(0,6);break;
    }
    case 'report':{
      requireThat(hasSkill(state,'F1'),'委託評価の窓口が必要です');const h=r.history.find(h=>h.job_id===action.jobId&&h.evaluation&&!h.practice);requireThat(h,'合格した評価案件がありません');
      requireThat(action.version===h.version&&action.conclusion==='pass','対象版と検品の結論を確認してください');if(!r.reports.some(x=>x.grade===h.grade))r.reports.push({job_id:h.job_id,grade:h.grade,version:h.version,conclusion:'pass'});break;
    }
    case 'handover':{
      requireThat(r.main_completed.length>=MAIN_JOB_LIMIT,'契約を修了してから引継ぎます');const hs=(action.jobIds||[]).map(j=>r.history.find(h=>h.job_id===j&&!h.practice));
      requireThat(hs.length===2&&hs.every(Boolean)&&hs[0].decision_family!==hs[1].decision_family,'判断内容が異なる合格案件を2つ選んでください');
      requireThat(action.answer==='contract','後輩へは契約の禁止操作を確認することを伝えてください');r.handover=true;break;
    }
    case 'saveRecipe':{
      requireThat(hasEquipment(state,'M11'),'作業記録台が必要です');const h=r.history.find(h=>h.job_id===action.jobId&&!h.practice)||r.history.at(-1);requireThat(h&&!h.practice,'合格した作業記録がありません');
      const recipe={id:`recipe:${h.job_id}`,title:h.title,job_id:h.job_id,family:h.family,version:h.snapshot.version,signature:h.decision_signature,initial_fingerprint:fingerprint(h.snapshot),start_state:{...clone(h.snapshot),uid:null},operations:h.log.map(x=>x.operation),required_pocs:unique([...h.used_pocs,...h.log.map(x=>x.operation.pocId).filter(Boolean)]),required_equipment:h.used_equipment};
      state.meta.recipes=state.meta.recipes.filter(x=>x.id!==recipe.id);state.meta.recipes.push(recipe);break;
    }
    case 'replayRecipe':{
      requireThat(hasEquipment(state,'M11'),'作業記録台が必要です');const recipe=find(state.meta.recipes,action.recipeId),a=getAttempt(state,action.attemptId);requireThat(recipe,'工程記録がありません');
      requireThat(recipe.family===a.device.family&&recipe.version===a.device.version&&recipe.signature===a.job.decision_signature,'このOS版・契約には工程記録を適用できません');
      requireThat(!recipe.start_state||fingerprint(recipe.start_state)===fingerprint({...a.device,uid:null}),'現在の端末は記録の開始状態と異なります');
      requireThat(recipe.required_pocs.every(p=>r.owned_pocs.includes(p))&&recipe.required_equipment.every(e=>hasEquipment(state,e)),'工程記録に必要な道具が不足しています');a.runtime.recipe={id:recipe.id,operations:clone(recipe.operations),index:0};break;
    }
    case 'recipeStep':{
      const a=getAttempt(state,action.attemptId),recipe=a.runtime.recipe;
      requireThat(hasEquipment(state,'M11')&&recipe,'照合済みの工程記録を開いてください');
      const operation=recipe.operations[recipe.index];requireThat(operation,'すべての記録工程が終わりました');
      stageOperation(state,{attemptId:a.id,operation,confirmed:!!action.confirmed},content);
      a.runtime.pending.recipeStep=recipe.index;break;
    }
    case 'recipeAuto':{
      const a=getAttempt(state,action.attemptId);requireThat(hasEquipment(state,'M15')&&a.runtime.recipe,'M15と照合済み工程記録が必要です');
      a.runtime.recipe.auto=!!action.enabled;
      if(action.enabled&&!a.runtime.pending)advanceRecipe(state,a,content);break;
    }
    default:throw new Error(`不明な操作：${action.type}`);
  }
  if(action.transactionId)add(state.run.receipt_ids,action.transactionId);
  syncRecovery(previous,state,content,inspect);
  return state;
}

function tokenActions(token){
  if(/^P\d{2}$/.test(token))return {pocId:token};
  if(token.startsWith('S:'))return {operation:{type:'service',serviceId:'S01',axes:token.slice(2).split('+')}};
  if(token.startsWith('+'))return {operation:{type:'install',app:token.slice(1)}};
  if(token.startsWith('-'))return {operation:{type:'remove',app:token.slice(1)}};
  if(token.startsWith('L:'))return {operation:{type:'lock',axis:token.slice(2)}};
  if(/^[BQR]:/.test(token))return {equipment:token[0]==='Q'?'M06':'M04',operation:{type:({B:'backup',Q:'rescue',R:'restore'})[token[0]],categories:token.slice(2).split(',')}};
  if(token==='X'||token==='X+')return {equipment:'M05',operation:{type:'reimage',development:token==='X+'}};
  if(token==='U')return {operation:{type:'service',serviceId:'S03'}};
  if(token==='O')return {equipment:'M09',operation:{type:'update',offline:true}};
  if(token==='fix')return {operation:{type:'service',serviceId:'S02'}};
  if(token==='screen')return {operation:{type:'service',serviceId:'S04'}};
  if(token==='dock')return {equipment:'M02',operation:{type:'dock'}};
  if(token==='adapter')return {equipment:'M03',operation:{type:'adapter'}};
  if(token==='preset')return {equipment:'M13',operation:{type:'preset'}};
  if(token.includes('=')){const [key,value]=token.split('=');return {operation:{type:'setting',key,value}};}
  throw new Error(`未知の工程：${token}`);
}
// Routes are development fixtures and optional planning candidates, never acceptance rules.
export function executeRoute(previous,jobOrId,route,content,options={}){
  let state=clone(previous);const job=typeof jobOrId==='string'?getJob(content,jobOrId):jobOrId;
  if(!state.run.attempts.some(a=>a.job_id===job.id)){
    const a=makeAttempt(state,job,false);a.mainEligible=!trainingJob(state,job)&&state.run.main_completed.length<MAIN_JOB_LIMIT;state.run.attempts.push(a);state.run.active_id=a.id;
  }else state.run.active_id=state.run.attempts.find(a=>a.job_id===job.id).id;
  const trace=[],initialCash=state.run.cash;
  const perform=action=>{state=dispatch(state,action,content);trace.push(action);};
  const buy=itemId=>{if(!state.run.owned_pocs.includes(itemId)&&!state.run.owned_equipment.includes(itemId))perform({type:'buy',id:itemId});};
  for(const token of route.trim().split(/\s+/).filter(Boolean)){
    const step=tokenActions(token);
    if(options.current){
      const a=currentAttempt(state),d=a.device,p=step.pocId?find(content.pocs,step.pocId):null,o=step.operation;
      if(p&&d.security[p.axis])continue;
      if(o?.type==='install'&&d.apps.includes(o.app)||o?.type==='remove'&&!d.apps.includes(o.app))continue;
      if(o?.type==='lock'&&(o.axis==='all'?AXES.every(k=>!d.security[k]):!d.security[o.axis]))continue;
      if(o?.type==='setting'&&d.settings[o.key]===o.value&&(o.value!=='custom'||d.setting_fingerprints[o.key]===fingerprint(`${job.id}:${o.key}:target:${o.value}`)))continue;
      if(o?.serviceId==='S02'&&d.operational||o?.serviceId==='S04'&&d.display)continue;
      if((o?.type==='update'||o?.serviceId==='S03')&&[job.goal.version].flat().includes(d.version))continue;
    }
    if(step.pocId){
      buy(step.pocId);if(currentAttempt(state).runtime.media.length)perform({type:'eject'});
      perform({type:'insert',pocId:step.pocId});perform({type:'start',operation:{type:'poc'},confirmed:true});
    }else{
      if(step.equipment){
        const portable=options.portable&&hasSkill(state,'A3')&&['backup','restore','rescue'].includes(step.operation.type)&&!step.operation.categories.includes('settings');
        if(portable)step.operation.portable=true;else buy(step.equipment);
      }
      perform({type:'start',operation:step.operation,confirmed:true});
    }
    while(currentAttempt(state).runtime.pending)perform({type:'tick',ms:2400});
  }
  const a=currentAttempt(state);if(a.runtime.media.length)perform({type:'eject'});
  return {state,attempt:currentAttempt(state),upfront:initialCash-state.run.cash,steps:trace,operations:trace.filter(x=>x.type!=='tick').length,checks:inspect(currentAttempt(state),content)};
}
export function planRoutes(state,jobOrId,content,options={}){
  const job=typeof jobOrId==='string'?getJob(content,jobOrId):jobOrId;
  return (job.routes||[]).map((route,index)=>{
    const trial=clone(state);trial.run.cash=1000000000;if(!options.current){trial.run.attempts=[];trial.run.active_id=null;}trial.run.retirement=null;
    try{
      const result=executeRoute(trial,job,route,content,{portable:hasSkill(state,'A3'),current:!!options.current});
      const valid=result.checks.every(r=>r.ok);
      return {index,route,valid,upfront:result.upfront,operations:result.operations,steps:result.steps,minimumGuaranteed:false,reason:valid?'検証済み経路。最小保証なし':result.checks.filter(r=>!r.ok).map(r=>r.label).join('・')};
    }catch(error){return {index,route,valid:false,upfront:Infinity,operations:Infinity,steps:[],minimumGuaranteed:false,reason:error.message};}
  }).sort((a,b)=>a.upfront-b.upfront||a.operations-b.operations);
}
