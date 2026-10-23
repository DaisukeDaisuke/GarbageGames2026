import {bootRepairLesson,bootRepairStatus} from './boot-repair.mjs';
import {workDependencyAxes} from './recovery.mjs';
import {inspect} from './core.mjs';
const seen=(state,id)=>(state.meta.workshop_lessons||[]).includes(id);
const presetPending=a=>!!a?.job.preset&&Object.entries(a.job.goal.settings||{}).some(([key,value])=>a.device.settings[key]!==value||value==='custom'&&a.device.setting_fingerprints[key]===a.snapshot.setting_fingerprints[key]);
export function presetLesson(state){
  const a=state.run.attempts.find(a=>a.id===state.run.active_id),g=state.run.workshop_guidance||{};
  if(!presetPending(a)||!a.device.operational)return null;
  if(!seen(state,'preset-prepare')&&g.presetAttempt!==a.id)return {id:'preset-prepare',attemptId:a.id,pages:[
    'この依頼には変更後のプリセットが添付されている。プリセット転写器なら、その設定をまとめて端末へ写せる。管理者権限を開く作業とは別だ。',
    state.run.owned_equipment.includes('M13')?'プリセット転写器はもう用意できているな。使い方を続けて説明する。':'まず右の「機材」からプリセット転写器を用意してくれ。手元に届いたら、使い方をもう一度電話する。'
  ]};
  if(state.run.owned_equipment.includes('M13')&&!seen(state,'preset-use')&&(g.presetAttempt===a.id||seen(state,'preset-prepare')))return {id:'preset-use',attemptId:a.id,pages:[
    'プリセット転写器が手元にあるな。端末が起動していることも確認できた。作業台の転写器を押し、「プリセット転写」を実行しよう。',
    '写すのはこの依頼に添付された設定だけだ。権限を開いたり、OSを更新したりする必要はない。転写が終わったら検品で設定と返却条件を確認しよう。'
  ]};
  return null;
}
export function profileLesson(state,content){
  const a=state.run.attempts.find(a=>a.id===state.run.active_id),g=state.run.workshop_guidance||{};
  if(!a?.device.operational||a.job.preset||!Object.hasOwn(a.job.goal.settings||{},'profile')||!inspect(a,content).some(row=>row.label==='プリセット'&&!row.ok))return null;
  const media=content.pocs.find(p=>p.axis==='feature'&&p.family===a.device.family&&p.versions.includes(a.device.version)&&!state.run.surrendered_poc_ids.includes(p.id));
  if(!media)return null;
  if(!seen(state,'profile-prepare'))return {id:'profile-prepare',attemptId:a.id,mediaId:media.id,pages:[
    '今回直すのは表示のプリセットだ。端末が起動していることを確認したら、設定編集の入口を開いて、依頼に添付された並びを設定しよう。',
    a.device.security.feature?'設定編集の入口はすでに開いている。解除用の道具を買い足す必要はない。続けて操作を説明する。':state.run.owned_pocs.includes(media.id)?`${media.name}はもう手元にあるな。続けて使い方を説明する。`:`右のPoCメニューで「${media.name}」を用意してくれ。手元に届いたら、端末で起動するところからもう一度電話で説明する。`
  ]};
  if(!seen(state,'profile-use')&&(g.profileAttempt===a.id||seen(state,'profile-prepare'))&&(a.device.security.feature||state.run.owned_pocs.includes(media.id)))return {id:'profile-use',attemptId:a.id,mediaId:media.id,pages:[
    a.device.security.feature?'設定編集は開放されている。そのまま端末の画面を押して「設定」を開こう。':`${media.name}を端末に差し込もう。それから端末画面を押し、「媒体」の「設定編集権限を解除」を実行する。差すだけでは起動しないので、実行まで進めるんだ。`,
    '解除できたら端末の「設定」を開き、「プリセット」を依頼の値へ変更しよう。ほかの設定には触れなくていい。',
    'プリセットの変更が終わるまでは設定編集を開けておく。変更後は契約の返却条件に合わせて再施錠し、検品して返却しよう。'
  ]};
  return null;
}
export function careerGuideStatus(state){
  if(state.run.status!=='active'||state.run.main_completed.length<5||!state.run.completed_calls.includes('CALL06'))return null;
  return {phase:'career-personnel',hint:'五件の仕事を終えた。次の進路を選ぶ準備をしよう。\n工房パソコンの「人事」を開いて、転職先を確認してくれ。'};
}
export function needsUsbAdapter(state,content){
  const a=state.run.attempts.find(a=>a.id===state.run.active_id);
  if(!a||a.runtime.adapter)return false;
  const model=content.devices.find(d=>d.id===a.hardware_model_id);
  if(!model?.ports.some(p=>p.type==='USB-C')||model.ports.some(p=>p.type==='USB-A'))return false;
  return content.pocs.some(p=>p.family===a.device.family&&p.versions.includes(a.device.version)&&p.media==='USB-A');
}
export function workshopGuideStatus(state){
  const repair=bootRepairStatus(state);if(repair)return repair;
  const g=state.run.workshop_guidance||{},a=state.run.attempts.find(a=>a.id===state.run.active_id);
  if(a&&g.profileAttempt===a.id){
    const value=a.job.goal.settings?.profile,complete=a.log.some(e=>e.operation.type==='setting'&&e.operation.key==='profile'&&e.operation.value===value)&&a.device.settings.profile===value;
    if(!complete){
      if(!a.device.security.feature&&!state.run.owned_pocs.includes(g.profileMedia))return {phase:'profile-buy',itemId:g.profileMedia,hint:'右のPoCメニューで設定編集用の媒体を用意しよう。\n手元に届いたら、使い方を電話で説明する。'};
      if(!seen(state,'profile-use'))return {phase:'profile-call',hint:'プリセットを変更する準備ができた。\n電話を取って操作の続きを聞こう。'};
      if(a.runtime.pending)return {phase:'profile-working',hint:'端末で処理中だ。完了するまで待とう。'};
      if(!a.device.security.feature){
        if(!a.runtime.media.some(m=>m.pocId===g.profileMedia))return {phase:'profile-insert',itemId:g.profileMedia,hint:'設定編集用の媒体を端末へ差し込もう。\n差込口の形が違う場合は、対応する変換器を使う。'};
        return {phase:'profile-execute',operation:{type:'poc',pocId:g.profileMedia},hint:'端末の画面を押し、「媒体」から\n「設定編集権限を解除」を実行しよう。'};
      }
      return {phase:'profile-edit',operation:{type:'setting',key:'profile',value},hint:'端末画面の「設定」を開き、\n「プリセット」を依頼どおりの値へ変更しよう。'};
    }
  }
  if(a&&g.presetAttempt===a.id&&presetPending(a)&&a.device.operational){
    if(!state.run.owned_equipment.includes('M13'))return {phase:'preset-buy',itemId:'M13',hint:'右の「機材」からプリセット転写器を用意しよう。\n手元に届いたら使い方を電話で説明する。'};
    if(!seen(state,'preset-use'))return {phase:'preset-call',hint:'プリセット転写器が届いた。電話を取ってくれ。\n起動した端末への転写手順を説明する。'};
    if(a.runtime.pending)return {phase:'preset-working',hint:'プリセットを転写している。終わるまで待とう。'};
    return {phase:'preset-apply',itemId:'M13',operation:{type:'preset'},hint:'作業台のプリセット転写器を使おう。\n転写が終わったら検品で返却条件を確認する。'};
  }
  if(g.grantRank&&state.run.chapter_grants[g.grantRank]===false){return {phase:state.run.book_pending.includes(g.grantRank)?'grant-catalog':'grant-select',rank:g.grantRank};}
  if(a&&g.adapterAttempt===a.id&&!a.runtime.adapter)return {phase:state.run.owned_equipment.includes('M03')?'connect-adapter':'buy-adapter',itemId:'M03'};
  if(a&&g.typeCAttempt===a.id&&g.typeCMedia&&!a.runtime.media.some(m=>m.pocId===g.typeCMedia)&&!a.device.security[g.typeCAxis])return {phase:state.run.owned_pocs.includes(g.typeCMedia)?'insert-type-c':'buy-type-c',itemId:g.typeCMedia};
  return careerGuideStatus(state)||{phase:'done'};
}
export function workshopLesson(state,content){
  const r=state.run,g=r.workshop_guidance||{},a=r.attempts.find(a=>a.id===r.active_id);
  if(g.salePocId&&!seen(state,'sale')){
    const p=content.pocs.find(p=>p.id===g.salePocId);
    return {id:'sale',pocId:p.id,pages:[
      'USBを売る前に聞いてくれ。メーカーへの売却は道具の利用権ごと譲る取引だ。売却して得る準備金はその道具の価格の1.5倍。報奨金を受け取れるのは同じ道具につき一度だけだ。',
      '売ったUSBは手元からなくなり、複製も使えなくなる。この担当期間は買い戻せない。実際に依頼を解決して納品した道具だけが、売却の対象になる。',
      p.id==='P01'?'青い管理者用USBは工房からの貸与品なので売れない。緑のアプリ導入制限解除USBも、アプリを入れられる状態にする大事な道具だ。手放すと、通信禁止の依頼などでは作業を進められなくなる。':`${p.name}を売れば、その解除方法を失う。管理者用もアプリ導入制限解除用も、必要な一本を手放すと作業が行き詰まる。正規窓口は有料で通信禁止なら使えない。今の依頼と次の仕事に必要な道具は残すんだ。`,
      '説明だけで勝手に売ることはしない。手元に残すか、条件を読んで売却を確定するか、自分で選んでくれ。'
    ]};
  }
  const repair=bootRepairLesson(state)||(a?.job.preset&&!a.device.operational&&g.bootAttempt!==a.id?bootRepairLesson(state,true):null);if(repair)return repair;
  if(r.tutorial?.independentActive)return null;
  const preset=presetLesson(state);if(preset)return preset;
  const profile=profileLesson(state,content);if(profile)return profile;
  if(!['done','career-personnel'].includes(workshopGuideStatus(state).phase))return null;
  const rank=Object.keys(r.chapter_grants).find(k=>r.chapter_grants[k]===false);
  if(rank&&!seen(state,'supplies'))return {id:'supplies',rank:Number(rank),pages:[
    '仕事が認められて、新しい取引先の道具を仕入れられるようになった。右のPoCメニューに追加の商品一覧を届けてある。まず「追加商品を見る」を押そう。',
    `仕入れを助けるため、工房から準備金$${content.events.find(e=>e.rank===Number(rank))?.grant||200}か、新しく扱える解除媒体一本を支給する。どちらか一方を一度だけ選べる。売却の報奨金とは別の支援だ。`,
    '商品一覧を開いたら「仕入れ支援を受け取る」を押して選ぼう。必要な媒体を持っているなら準備金、持っていないなら媒体そのものを選べばいい。'
  ]};
  if(!seen(state,'usb-c-adapter')&&needsUsbAdapter(state,content))return {id:'usb-c-adapter',attemptId:a.id,pages:[
    '今度の差込口は小さな楕円形のUSB Type-Cだ。これまでの四角いUSB Type-Aとは形が違う。そのままでは差し込めない。',
    state.run.owned_equipment.includes('M03')?'USB変換器はもう持っているな。作業台の変換器をクリックし、この端末に装着しよう。':'右の「機材」を開き、「USB変換器」を購入しよう。一度買えば繰り返し使える。購入ボタンまで矢印で案内する。',
    '購入後は作業台の変換器をクリックして装着する。それから、対応するUSBを端末のType-C口へ差そう。変換できるのは形だけだ。OS名と対応版はUSBの表示を確かめるんだ。'
  ]};
  const model=a&&content.devices.find(d=>d.id===a.hardware_model_id);
  if(a?.job.preset)return null;
  const p=a&&content.pocs.find(p=>p.family===a.device.family&&p.versions.includes(a.device.version)&&p.media==='USB-C'&&!a.device.security[p.axis]&&(a.job.goal.s[['root','install','feature'].indexOf(p.axis)]===true||workDependencyAxes(a,content,inspect).includes(p.axis))&&!r.surrendered_poc_ids.includes(p.id));
  if(!seen(state,'usb-c')&&p&&model.ports.some(p=>p.type==='USB-C'))return {id:'usb-c',attemptId:a.id,mediaId:p.id,axis:p.axis,pages:[
    `この小さな楕円形の差込口はUSB Type-Cだ。四角いType-Aとは形が違う。今回は${a.device.family} ${a.device.version}に対応した媒体が必要だ。形だけでなく、OS名と対応版も確かめよう。`,
    `${p.name}を使おう。これはType-Cなのでそのまま差せる。右のPoCメニューで対応媒体を用意し、矢印の先の差込口へ持っていこう。`,
    'Type-A媒体をType-C端子につなぐ仕事では機材のUSB変換器を使う。そのときは購入と装着も教える。変換器が変えられるのは端子の形だけでOSの対応は変わらない。'
  ]};
  return null;
}
export function requestSaleLesson(state,pocId){const next=structuredClone(state);next.run.workshop_guidance||={};next.run.workshop_guidance.salePocId=pocId;return next;}
export function finishWorkshopLesson(state,event){
  const next=structuredClone(state);next.meta.workshop_lessons||=[];
  if(!next.meta.workshop_lessons.includes(event.id))next.meta.workshop_lessons.push(event.id);
  next.run.workshop_guidance||={};const g=next.run.workshop_guidance;
  if(event.id.startsWith('boot-')){g.bootAttempt=event.attemptId;g.bootOffline=event.offline;g.bootLogStart=next.run.attempts.find(a=>a.id===event.attemptId)?.log.length||0;}
  if(event.id==='usb-c-adapter')g.adapterAttempt=event.attemptId;
  if(event.id==='usb-c'){g.typeCAttempt=event.attemptId;g.typeCMedia=event.mediaId;g.typeCAxis=event.axis;}
  if(event.id==='supplies')g.grantRank=event.rank;
  if(event.id==='sale')delete g.salePocId;
  if(event.id==='preset-prepare'||event.id==='preset-use')g.presetAttempt=event.attemptId;
  if(event.id==='profile-prepare'||event.id==='profile-use'){g.profileAttempt=event.attemptId;g.profileMedia=event.mediaId;}
  return next;
}
