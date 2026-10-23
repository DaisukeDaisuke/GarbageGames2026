// Recovery guidance observes committed mistakes; it never edits a device itself.
const AXES=['root','install','feature'];
const AXIS_NAMES={root:'管理者',install:'アプリ導入',feature:'設定編集'};
const SETTING_NAMES={theme:'配色',output:'出力先',export:'書き出し',schedule:'予定',content:'表示内容',profile:'プリセット'};
const byId=(state,id)=>state.run.attempts.find(a=>a.id===id);
const backups=(state,a)=>[state.run.backups[a.device_uid],state.run.portable_backup].filter(b=>b?.uid===a.device_uid);
// Delivery locks are final conditions. Keep a working permission until all
// contracted work that depends on it is finished, including initially open axes.
export function workDependencyAxes(a,content,inspect){
  const rows=inspect(a,content),g=a.job.goal||{};
  const pending={
    root:rows.some(r=>r.label==='管理アプリの起動'&&!r.ok),
    install:rows.some(r=>!r.ok&&(r.label.startsWith('アプリ：')||r.label.startsWith('削除：'))),
    feature:Object.keys(g.settings||{}).some(key=>rows.some(r=>r.label===SETTING_NAMES[key]&&!r.ok))
  };
  return AXES.filter(axis=>pending[axis]);
}
export function workUnlockAxes(a,content,inspect){
  return workDependencyAxes(a,content,inspect).filter(axis=>!a.device.security[axis]);
}
function isWorkingRow(a,row,content,inspect){
  const axis=AXES.find(axis=>row.label===AXIS_NAMES[axis]+'権限');
  return axis&&a.device.security[axis]&&a.job.goal.s?.[AXES.indexOf(axis)]===false&&workDependencyAxes(a,content,inspect).includes(axis);
}
export const RECOVERY_PATTERNS={
  'wrong-unlock':'施錠して返す権限を開放した',
  'required-permission-closed':'必要な権限を再施錠した',
  'incorrect-setting':'達成済みの依頼設定を変更した',
  'preserved-setting-changed':'保持する設定を変更した',
  'data-loss':'保持するデータを消去・変更した',
  'required-app-missing':'必要なアプリを削除した',
  'wrong-app-selected':'依頼のアプリを入れる前に別のアプリを追加した',
  'unwanted-app-added':'削除する約束のアプリを追加した',
  'wrong-os-version':'契約に合わないOS版へ更新した',
  'media-incompatible-os':'OS更新で手元の媒体が非対応になった',
  'forbidden-history':'禁止操作の履歴が残った',
  'boot-failure':'起動条件を壊した',
  'display-failure':'画面条件を壊した',
  'other-contract-regression':'達成済みの契約条件を壊した'
};

export function recoveryIncoming(state){return state.run.assistance?.queue?.[0]||null;}
export function recoveryHint(state){return state.run.assistance?.hints?.find(e=>e.attemptId===state.run.active_id)||null;}
export function recoveryInstruction(state,entry){
  const a=byId(state,entry.attemptId);if(!a)return '';
  if(a.runtime.pending)return '復旧処理中だ。終わるまで待とう。';
  if(entry.retry)return '今回は依頼を受け直して復帰する。\n購入済みの道具は残る。「依頼を受け直す」を押そう。';
  if(entry.targetMediaId&&!entry.operation)return a.runtime.media.length?'今の媒体を手で抜こう。\nそのあと、矢印の媒体に差し替える。':'矢印の媒体を端末へ差し込もう。\n差し込んだら復旧操作を案内する。';
  if(entry.kind==='install')return a.device.security.install?`依頼に必要な「${entry.app}」を導入しよう。\n「復旧操作へ」から、そのアプリを追加する。`:`「${entry.app}」を入れるため、アプリ導入権限を開こう。\n解除後に、導入するアプリを案内する。`;
  if(entry.kind==='remove')return `契約で削除する約束の「${entry.app}」を外そう。\n他のアプリやデータを消す必要はない。`;
  if(entry.kind==='axis')return `${AXIS_NAMES[entry.axis]}権限を「${entry.value?'開放':'施錠'}」へ戻そう。\n「復旧操作へ」から操作できる。`;
  if(entry.kind==='setting')return `${SETTING_NAMES[entry.key]||entry.key}を依頼の設定へ戻そう。\n「復旧操作へ」から順に操作できる。`;
  return '下の復旧操作を実行しよう。\n直ったら元の作業へ戻れる。';
}
export function recoveryNeeded(state,entry,content,inspect){
  const a=byId(state,entry.attemptId);if(!a)return false;
  if(entry.kind==='compatibility')return a.device.version===entry.version&&entry.axes.some(axis=>!a.device.security[axis]&&!content.pocs.some(p=>state.run.owned_pocs.includes(p.id)&&p.family===a.device.family&&p.versions.includes(a.device.version)&&p.axis===axis));
  const rows=inspect(a,content);
  return entry.labels.some(label=>rows.some(row=>row.label===label&&!row.ok&&!isWorkingRow(a,row,content,inspect)));
}
function access(state,a,axis,content){
  const candidates=content.pocs.filter(p=>state.run.owned_pocs.includes(p.id)&&p.axis===axis&&p.family===a.device.family&&p.versions.includes(a.device.version));
  const inserted=candidates.find(p=>a.runtime.media.some(m=>m.pocId===p.id));
  if(inserted)return {operation:{type:'poc',pocId:inserted.id},targetMediaId:inserted.id};
  if(candidates.length)return {targetMediaId:candidates[0].id};
  if(a.job.network!==false&&state.run.cash>=Math.ceil(a.job.reward*.35))return {operation:{type:'service',serviceId:'S01',axes:[axis]}};
  return {retry:true};
}
function refresh(state,entry,content){
  const a=byId(state,entry.attemptId);if(!a)return;
  delete entry.operation;delete entry.targetMediaId;
  entry.retry=['retry','compatibility'].includes(entry.kind);
  if(entry.kind==='axis'){
    if(entry.value)Object.assign(entry,access(state,a,entry.axis,content));
    else entry.operation={type:'lock',axis:entry.axis};
  }else if(entry.kind==='setting'){
    if(!a.device.security.feature)Object.assign(entry,access(state,a,'feature',content));
    else entry.operation={type:'setting',key:entry.key,value:entry.value};
  }else if(entry.kind==='install'){
    if(!a.device.security.install)Object.assign(entry,access(state,a,'install',content));
    else entry.operation={type:'install',app:entry.app};
  }else if(entry.kind==='remove'){
    if(!a.device.security.install)Object.assign(entry,access(state,a,'install',content));
    else entry.operation={type:'remove',app:entry.app};
  }
  else if(entry.kind==='restore')entry.operation={type:'restore',categories:entry.categories,portable:entry.portable};
  else if(entry.kind==='boot')entry.operation={type:'service',serviceId:'S02'};
  else if(entry.kind==='display')entry.operation={type:'service',serviceId:'S04'};
  if(entry.retry){delete entry.operation;delete entry.targetMediaId;}
}
function describe(state,a,row,content){
  const e={attemptId:a.id,jobId:a.job_id,key:row.label,kind:'retry',labels:[row.label],pattern:'other-contract-regression',title:'工房長からの復旧案内',retry:false};
  const axis=AXES.find(k=>row.label===AXIS_NAMES[k]+'権限'||k==='root'&&row.label==='管理アプリの起動');
  if(axis){
    e.kind='axis';e.axis=axis;e.value=row.label==='管理アプリの起動'||a.job.goal.s[AXES.indexOf(axis)];
    e.pattern=e.value?'required-permission-closed':'wrong-unlock';
    e.pages=[`今、${AXIS_NAMES[axis]}の状態を変えたな。\n……どうして分かったかは今は気にしなくていい。`,e.value?`この依頼では${AXIS_NAMES[axis]}権限を開放して返す。\n対応する媒体か正規窓口で開放し直そう。`:`この依頼では${AXIS_NAMES[axis]}権限を施錠して返す。\n再施錠すれば直せる。データを消す必要はない。`,'受話器を戻したら、矢印の復旧操作を進めよう。\n直ったことを確認してから元の案内へ戻す。'];
  }else if(Object.values(SETTING_NAMES).includes(row.label)){
    e.kind='setting';e.pattern='incorrect-setting';e.key=Object.keys(SETTING_NAMES).find(k=>SETTING_NAMES[k]===row.label);e.value=a.job.goal.settings[e.key];
    e.pages=[`今、${row.label}を変更したな。\n依頼の設定と違う状態になっている。`,`設定編集の権限を開き、${row.label}を依頼どおりに戻そう。\n他の設定やOSは変更しなくていい。`,'受話器を戻したら復旧操作を案内する。\n終わったら元のチュートリアルへ戻ろう。'];
  }else if(row.label.startsWith('データ保持：')){
    e.pattern='data-loss';
    const name=row.label.slice('データ保持：'.length),b=backups(state,a).find(b=>b.data[name]===a.snapshot.data[name]);
    if(b){e.kind='restore';e.categories=[name];e.portable=b===state.run.portable_backup;}
    else e.retry=true;
    e.pages=['残す約束のデータが消えている。\n検品はこのままでは通らない。',b?'この端末の退避がある。復元でデータを戻そう。\n別の端末の退避は使えない。':'一致する退避がないため、元のデータは戻せない。\n依頼を受け直して、受注時の端末からやり直そう。'];
  }else if(row.label.startsWith('保持：')){
    e.pattern='preserved-setting-changed';
    const key=Object.keys(SETTING_NAMES).find(k=>'保持：'+SETTING_NAMES[k]===row.label);
    const b=backups(state,a).find(b=>b.categories.includes('settings')&&b.setting_fingerprints[key]===a.snapshot.setting_fingerprints[key]);
    if(b){e.kind='restore';e.categories=['settings'];e.portable=b===state.run.portable_backup;}else e.retry=true;
    e.pages=['保持する約束の設定を変更したな。\n見た目だけでなく、保存内容も一致が必要だ。',b?'受注時の設定を退避してある。\n設定を復元してから検品しよう。':'元の設定の退避がない。\n依頼を受け直し、今度は保持する設定に触らず進めよう。'];
  }else if(row.label.startsWith('アプリ：')){
    e.kind='install';e.pattern='required-app-missing';e.app=row.label.slice('アプリ：'.length);e.pages=[`依頼に必要な「${e.app}」が入っていない。\n契約のアプリ名と、端末の一覧を見比べてみよう。`,`アプリ導入権限を開き、「${e.app}」を導入しよう。\nほかのアプリで置き換えることはできない。`,'受話器を戻したら、必要なアプリの導入まで案内する。\n最後に検品の表で契約の条件を確認しよう。'];
  }else if(row.label.startsWith('削除：')){
    e.kind='remove';e.pattern='unwanted-app-added';e.app=row.label.slice('削除：'.length);e.pages=[`${e.app}を追加したな。\nこの依頼では削除して返す約束だ。`,'アプリを削除すれば戻せる。\nデータの初期化はしないでくれ。'];
  }else if(row.label==='起動'&&a.job.network!==false){
    e.kind='boot';e.pattern='boot-failure';e.pages=['端末が起動しなくなっている。\nデータを残す正規修復で復旧しよう。'];
  }else if(row.label==='内蔵画面'){
    e.kind='display';e.pattern='display-failure';e.pages=['内蔵画面が依頼の条件を満たしていない。\n正規の画面交換で戻そう。'];
  }else{
    if(row.label==='OS版')e.pattern='wrong-os-version';
    else if(row.label.startsWith('禁止履歴：')||row.label==='消去前に有効な退避')e.pattern='forbidden-history';
    e.retry=true;e.pages=row.label==='禁止履歴：OS更新'?[
      'OSを更新したな。この依頼ではOS更新そのものが禁止されている。\n権限を開き直しても、更新した履歴は取り消せない。',
      'このままでは納品できない。受話器を戻して「依頼を受け直す」を押そう。\n受注時のOS版と中身の端末から、同じ仕事をやり直せる。',
      '次は「正規更新」や「オフライン更新」を使わず、契約に書かれた作業を進めよう。\n版を変える必要がある依頼かどうかは契約の表で確かめられる。'
    ]:[`${row.label}が契約の条件から外れたな。\nこの変更は元に戻しても履歴が残る場合がある。`,'今の端末では納品できない。\n依頼を受け直して、受注時の状態からやり直そう。'];
  }
  if(e.retry)e.pages.push('受け直しても、購入した道具と所持金はそのままだ。\n支払済みの費用は戻らず、報酬の二重取得もない。');
  refresh(state,e,content);return e;
}
export function syncRecovery(previous,state,content,inspect){
  const r=state.run;r.assistance||={queue:[],active:null,hints:[]};
  state.meta.assistance_seen_patterns||=[];
  if(r.status!=='active'){r.assistance={queue:[],active:null,hints:[]};return;}
  const help=r.assistance;
  help.hints||=[];
  help.queue=help.queue.filter(e=>recoveryNeeded(state,e,content,inspect));
  help.hints=help.hints.filter(e=>recoveryNeeded(state,e,content,inspect));
  const newlySeen=help.queue.filter(e=>state.meta.assistance_seen_patterns.includes(e.pattern));
  help.hints.push(...newlySeen);help.queue=help.queue.filter(e=>!newlySeen.includes(e));
  if(help.active&&!recoveryNeeded(state,help.active,content,inspect))help.active=null;
  for(const e of [...help.queue,...help.hints,help.active].filter(Boolean))refresh(state,e,content);
  if(previous.run.id!==r.id)return;
  for(const a of r.attempts){
    const old=previous.run.attempts.find(v=>v.id===a.id);
    if(!old||old.log.length===a.log.length)continue;
    const before=new Map(inspect(old,content).map(row=>[row.label,row]));
    const rows=inspect(a,content),recent=a.log.slice(old.log.length).map(e=>e.operation);
    const issues=rows.filter(row=>!row.ok&&(before.get(row.label)?.ok||isWorkingRow(old,row,content,inspect))&&!isWorkingRow(a,row,content,inspect)).map(row=>describe(state,a,row,content));
    const wrongInstall=recent.find(op=>op.type==='install'&&!(a.job.goal.apps||[]).includes(op.app)&&!(a.job.goal.remove||[]).includes(op.app));
    if(wrongInstall){
      for(const row of rows.filter(row=>!row.ok&&row.label.startsWith('アプリ：'))){
        if(issues.some(e=>e.key===row.label))continue;
        const e=describe(state,a,row,content);e.pattern='wrong-app-selected';
        e.pages=[`いま「${wrongInstall.app}」を入れたな。\n契約で頼まれている「${e.app}」はまだ入っていない。`,`別のアプリを試すのは構わないが、依頼のアプリの代わりにはならない。\n「${e.app}」も導入しよう。追加したアプリを消す必要はない。`,...e.pages.slice(1)];
        issues.push(e);
      }
    }
    if(old.device.version!==a.device.version&&!a.job.goal.version){
      const axes=AXES.filter((axis,i)=>a.job.goal.s?.[i]===true&&!a.device.security[axis]&&content.pocs.some(p=>r.owned_pocs.includes(p.id)&&p.axis===axis&&p.family===a.device.family&&p.versions.includes(old.device.version))&&!content.pocs.some(p=>r.owned_pocs.includes(p.id)&&p.axis===axis&&p.family===a.device.family&&p.versions.includes(a.device.version)));
      if(axes.length)issues.push({attemptId:a.id,jobId:a.job_id,key:'compatibility',kind:'compatibility',pattern:'media-incompatible-os',labels:[],axes,version:a.device.version,title:'工房長からの復旧案内',retry:true,pages:['OSを更新したな。\n手元の解除用媒体はその版に対応していない。','OSの版を戻すことはできない。\n今回は依頼を受け直して、対応する版から作業をやり直そう。','購入した道具は残るが、支払済みの費用は戻らない。\n次は更新前に、媒体の対応版を確認しよう。']});
    }
    issues.sort((a,b)=>Number(b.pattern==='forbidden-history')-Number(a.pattern==='forbidden-history'));
    for(const e of issues){
      if([...help.queue,...help.hints,help.active].some(x=>x&&x.attemptId===a.id&&x.key===e.key))continue;
      e.id=`${r.id}:recovery:${++r.serial}`;
      if(state.meta.assistance_seen_patterns.includes(e.pattern)||help.queue.some(x=>x.pattern===e.pattern)||help.active?.pattern===e.pattern)help.hints.push(e);
      else help.queue.push(e);
    }
  }
}
