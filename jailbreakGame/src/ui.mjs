import {FIRST_JOB,SECOND_JOB,REPAIR_PAGES,REPAIR_HINTS,tutorialStatus,GRADUATION_CALL,WRONG_PURCHASE_CALL,graduationPending,tutorialRetirementBlocked,wrongPurchaseInFreeTutorial,wrongPurchaseCallPending,queueWrongPurchaseCall,finishWrongPurchaseCall} from './tutorial.mjs';
import {bootRepairLesson,bootRepairStatus} from './boot-repair.mjs';
import {bufferedPoses} from './dialogue-buffer.mjs';
import {scrollMetrics} from './scroll-layout.mjs';
import {workshopLesson,workshopGuideStatus,requestSaleLesson,finishWorkshopLesson} from './workshop-guides.mjs';
import {recoveryIncoming,recoveryHint,recoveryInstruction} from './recovery.mjs';
import {STORY_EPISODES,storyPending,finishStory,promotionCall,storyShareUrl} from './story.mjs';
import {conditionTable,shortDialogue,shortDialogueHeight,dialogueLines,shortDialogueBusy,clearShortDialogue} from './tutorial-ui.mjs';
import {createDisplay} from './display.mjs';
import {Surface,Sound,C} from './draw.mjs';
import {Physical,DIRECTIONS,artKey} from './physical.mjs';
import {Room} from './room.mjs';
import {Phone} from './phone.mjs';
import {createGame,dispatch,currentAttempt,inspect,previewContract,quoteOperation,planRoutes,availableJobs,endingOptions,fingerprint,AXES,carryLimits,preparationLimit,progressLabel,startingRank} from './core.mjs';
import {loadGame,saveGame,exportSave,importSave} from './storage.mjs';
import {simulatePlan,planningChoices} from './planning.mjs';
import {createEnding,endingUnlocked} from './ending.mjs';

const canvas=document.querySelector('#game'),s=new Surface(canvas),sound=new Sound();
const status=document.querySelector('#status'),input=document.querySelector('#text-input');
const money=n=>'$'+Math.floor(n).toLocaleString('en-US');
const names={root:'管理者',install:'アプリ導入',feature:'設定編集',theme:'配色',output:'出力先',export:'書き出し',schedule:'予定',content:'表示内容',profile:'プリセット'};
const values={theme:['standard','custom'],output:['internal','external'],export:['off','local'],schedule:['locked','custom'],content:['stock','custom'],profile:['factory','custom']};
const valueNames={standard:'標準',custom:'依頼どおり',internal:'内蔵',external:'外部',off:'禁止',local:'ローカル',locked:'固定',stock:'標準',factory:'工場出荷'};
let content,game,physical,room,phone,lastRing=0,terminalMode=false,selectedInstance=0,screen='workshop',modal=null,toast=null,scrolls={},drag=null,selected=null,combo=[],deviceTab='media',catalogTab='poc',recordsTab='history',mailTab='inbox',serviceAxes=['root'];
let backupCats=['data','apps'],portable=false,inspectOpen=false,zoom=1,artLoading=new Set(),lastTime=performance.now(),lastAnnounce=0,saveFault=false,booted=false,callPage=0;
let draftSkills=[],carryPocs=[],carryEquipment=[],reservations=[],handoverJobs=[],timer={running:false,elapsed:0,splits:[],label:'自由計測',start:null},lastSave=0;
let planActions=[],planGroup='operation',planBase=null,planResult=null,planChoices=[],storageBlocked=false;
let shopOpen=false,shopProgress=0,shopRendering=false;
let dialogueFrame,compactFrame,portraitFrames,display;
let rewardFlash=null,handoffUntil=0,cashBounds=null,lastRecoveryRing=null,lastIncomingKey=null,ringNotBefore=0,contractTransition=null;
let retirementCallPending=false,guideScrollKey='';
let lastPCScreen='mail',personnelKey='';
let endingDebugUnlocked=false;
const creditsEnding=createEnding({onOpen:()=>sound.stop(),onClose:()=>{lastTime=performance.now();ringNotBefore=lastTime+900;canvas.focus();}});
window.unlockKatagiriEnding=()=>{endingDebugUnlocked=true;if(booted)openSettings();creditsEnding.open();return true;};
const phonePoses=['phone-0','phone-1','phone-2','boss_phone_think','boss_phone_happy'];
const guidePoses=['boss_explain','boss_guide_point','boss_guide_fold','boss_guide_nod'];
const RETIREMENT_PAGES=['退職届を書けば、この工房を離れられる。未納品の依頼は私が引き継いで処理し、その報酬も私が受け取る。君が納品した仕事は工房の実績として残る。ただし、私が引き継いだ仕事の報酬・SP・納品件数は君たちの実績には加わらない。','ただ、今は研修用に預かった二台を返すところまで責任を持って覚えてほしい。途中で辞められると、引き継ぐ新人にも作業を教えられないからな。今回の退職届は預からない。二台を終えたら、改めて自分で進路を選んでくれ。'];
function poseBuffer(key,count,pool){game.view||={};game.view.portraits||={};return bufferedPoses(game.view.portraits,`${game.run.id}:${key}`,count,pool);}
function rememberTerminal(){
  if(!['mail','personnel','records','settings','planner','device'].includes(screen))return;
  if(screen!=='device')lastPCScreen=screen;
  game.view||={};game.view.terminal={run:game.run.id,lastPCScreen,mailTab,recordsTab,scrolls:{...scrolls},personnelKey,draftSkills:[...draftSkills],carryPocs:[...carryPocs],carryEquipment:[...carryEquipment]};
  save(game);
}
function returnToWorkshop(){rememberTerminal();modal=null;screen='workshop';}
function closeModal(){
  if(modal?.recovery)return;
  const origin=modal?.returnView;modal=null;input.blur();
  if(origin){({screen,deviceTab,mailTab,recordsTab,scrolls,lastPCScreen}=origin);s.focus=-1;}
  else if(screen==='phone')screen='workshop';
}
function backFromTerminal(){if(modal)closeModal();else returnToWorkshop();}
const WORKSHOP_HINTS={
  'buy-type-c':'右のPoCから、OS名と版が合うType-C媒体を用意しよう。\n前のKomaOS用USBとは別の道具が必要だ。',
  'insert-type-c':'対応するType-C媒体をクリックして選び、\n端末の楕円形の差込口へ差し込もう。',
  'buy-adapter':'この端末はUSB Type-Cだ。右の機材から\nUSB変換器を購入しよう。形を合わせるための道具だ。',
  'connect-adapter':'作業台のUSB変換器をクリックして装着しよう。\n装着後は対応するUSBを端末へ差し込める。',
  'grant-catalog':'右のPoCメニューを開いて\n「追加商品を見る」を押そう。新しい仕入れ先の道具が届いている。',
  'grant-select':'「仕入れ支援を受け取る」を押そう。\n工房からの準備金か、解除媒体一本を選べる。'
};
function activeGuide(){const t=tutorialStatus(game);return t.phase==='done'?workshopGuideStatus(game):t;}
function storyReady(){
  if(modal?.kind==='story')return modal.event;
  if(modal||shopOpen||shortDialogueBusy()||wrongPurchaseCallPending(game)||retirementCallPending||graduationPending(game)||(game.run.intro?.stage??4)<4||game.run.pending_calls.length||game.run.assistance?.active||recoveryIncoming(game)||tutorialStatus(game).phase!=='done'||game.run.attempts.some(a=>a.runtime.pending))return null;
  return storyPending(game);
}
function lessonReady(){
  if(wrongPurchaseCallPending(game)||retirementCallPending||graduationPending(game)||(game.run.intro?.stage??4)<4||game.run.pending_calls.length||game.run.assistance?.active||recoveryIncoming(game)||!['done'].includes(tutorialStatus(game).phase))return null;
  if(modal?.kind==='workshop-guide')return modal.event;
  if(modal||shopOpen||shortDialogueBusy())return null;
  return workshopLesson(game,content);
}
function requestSale(item){
  if(!(game.meta.workshop_lessons||[]).includes('sale')){const next=requestSaleLesson(game,item.id);if(save(next)){game=next;shopOpen=false;returnToWorkshop();lastIncomingKey=null;message('売却の前に、工房長から説明があります。電話を取ってください。');}return;}
  saleConfirmation(item);
}
function saleConfirmation(item){
  if(item.id==='P01'){info('貸与された管理者用USB',['このUSBは工房の貸与品なので売却できません。引き続き作業に使ってください。']);return;}
  confirm('この解除媒体を売却しますか？',[`${item.name}。売却して得る準備金は ${money(Math.ceil(item.price*1.5))}。報奨金は一度限りです。`,`${names[item.axis]}の解除に使う道具です。手放すと、その解除方法を失います。必要なUSBを残さないと、通信禁止の依頼などで作業が行き詰まります。`,'この担当期間は買い戻せず、複製も使えなくなります。今回の納品に役立てた記録が必要です。'],()=>act({type:'surrender',pocId:item.id},'利用権を譲り、準備金を受け取りました'),'売却を確定する',true);
}
function retirementRequest(ending){
  if(tutorialRetirementBlocked(game)){modal=null;shopOpen=false;screen='workshop';retirementCallPending=true;lastIncomingKey=null;message('工房長から電話です。退職について説明があります。');return;}
  confirm(ending.name,[ending.description,ending.quote,'未納品の依頼は工房長が引き継いで処理し、その報酬も工房長が受け取ります。'],()=>{if(act({type:'retire',endingId:ending.id})){draftSkills=[...game.meta.skill_allocations];scrolls={};}},'退職届を出す');
}
function recoveryReady(){const entry=recoveryIncoming(game);return !bootRepairStatus(game)&&!game.run.assistance?.active&&entry&&!modal&&!shopOpen&&(!shortDialogueBusy()||lastRecoveryRing===entry.id)&&screen!=='phone'&&(game.run.intro?.stage??4)>=4&&tutorialStatus(game).phase!=='briefing'&&!game.run.pending_calls.length;}
function phoneIncoming(){return wrongPurchaseCallPending(game)||!!lessonReady()||retirementCallPending||graduationPending(game)||(game.run.intro?.stage??4)<4||game.run.pending_calls.length>0||tutorialStatus(game).phase==='briefing'||!!recoveryReady()||!!storyReady();}
function recoveryCall(entry){if(!entry)return;const active=game.run.assistance?.active;if(!active&&!act({type:'recoveryCall',id:entry.id}))return;callPage=0;screen='phone';shopOpen=false;modal={kind:'recovery',event:game.run.assistance.active};sound.stop();}
function recoveryAction(){const e=game.run.assistance?.active;if(!e)return;if(e.retry){confirm('この依頼を受け直す',['端末を受注時の状態に戻します。購入した道具は残ります。支払済みの費用は戻りません。'],()=>{if(act({type:'recoveryRetry'},'端末を受注時の状態に戻しました。')){screen='workshop';physical.view=0;selected=null;combo=[];}},'受け直す');}else if(e.operation)operation(e.operation);}
function inspectionVisible(){return game.run.completed.includes(FIRST_JOB)||game.run.id!==1||['done','inspect'].includes(tutorialStatus(game).phase);}
function deliverDevice(){const a=attempt();if(!a)return;const amount=a.practice?0:a.job.reward;if(act({type:'deliver'},`返却完了。所持金に ${money(amount)} 入金しました。`)){modal=null;rewardFlash={amount,until:performance.now()+6500};}}
function unlockSound(){const first=!sound.ready;sound.unlock();if(first&&phoneIncoming()){sound.play('phone');lastRing=performance.now();}}
function setVolume(v){sound.volume=Math.max(0,Math.min(1,v));sound.stop();try{localStorage.setItem('jailbreakGame:volume',String(sound.volume));}catch{}sound.play('tap');openSettings();}
function openSettings(){shopOpen=false;modal={kind:'choices',title:'設定',body:`音量 ${Math.round(sound.volume*100)}%`,items:[{label:'音量を下げる −10%',fn:()=>setVolume(sound.volume-.1)},{label:'音量を上げる ＋10%',fn:()=>setVolume(sound.volume+.1)},{label:sound.volume?'消音にする':'音を出す',fn:()=>setVolume(sound.volume?0:.3)},...(endingDebugUnlocked||endingUnlocked(game)?[{label:'エンディングを見る',fn:()=>creditsEnding.open()}]:[]),{label:'初めからやり直す',fn:()=>confirm('進捗状況を初期化しますか？',['所持金・依頼・育成・周回記録を初期化し、最初の電話からやり直します。音量設定は残ります。'],restartGame,'初めからやり直す',true)}]};}
function restartGame(){const next=createGame(content,randomSeed());if(!save(next))return;game=next;retirementCallPending=false;guideScrollKey='';if(contractTransition)clearTimeout(contractTransition);contractTransition=null;lastIncomingKey=null;lastRecoveryRing=null;ringNotBefore=0;callPage=0;modal=null;screen='workshop';shopOpen=false;shopProgress=0;selected=null;combo=[];drag=null;scrolls={};room.layout={};physical.view=0;phone.lift=0;phone.dragTarget=null;rewardFlash=null;handoffUntil=0;timer={running:false,elapsed:0,splits:[],label:'自由計測',start:null};try{localStorage.removeItem('jailbreakGame:timer');saveGame(next);}catch{}sound.stop();sound.play('phone');lastRing=performance.now();message('電話が鳴っています。受話器を取ってください。');}
const introPages=[
  '片桐工房へようこそ。今日からこの作業台を使ってくれ。ここでは持ち主が使えなくなった端末の制限を外して直して返す。最初の一台は私が順番に案内しよう。',
  '左に置いたのが依頼を受け取るパソコンだ。最初の依頼はこちらで開いておく。まだメールを探さなくていいぞ。',
  '道具は使う場面で順に用意する。\nまずは依頼を受けて届いた端末の状態を確認しよう。\n最初から道具を買う必要はない。',
  'では契約を開くぞ。\n細かい内容は今は気にしなくていい。私が確認してある。\n最初は「原稿を残して管理者メニューを開く」仕事だ。'
];
const get=(xs,id)=>xs.find(x=>x.id===id),attempt=()=>currentAttempt(game),has=id=>game.run.skills.includes(id),eq=id=>game.run.owned_equipment.includes(id);
function randomSeed(){const a=new Uint32Array(2);crypto.getRandomValues(a);return ((BigInt(a[0])<<32n|BigInt(a[1]))%10000000000000000n).toString().padStart(16,'0');}
function announce(message){status.textContent=s.format(message);}
function message(text,error=false){toast={text,until:performance.now()+4500,error};announce(text);if(error)sound.play('error');}
function error(e){message(e.message||String(e),true);}
function save(next){if(storageBlocked){error(new Error('保存復旧の選択を先に行ってください'));return false;}try{saveGame(next);saveFault=false;return true;}catch(e){saveFault=true;modal={title:'保存できませんでした',body:['今回の操作は確定していません。保存先の空き容量やブラウザの保存設定を確認してください。',String(e.message||e)],actions:[{label:'もう一度保存',fn:()=>{if(save(next)){game=next;modal=null;message('保存しました');}}},{label:'現在の記録を出力',fn:()=>download('jailbreak-save.json',exportSave(game))}]};return false;}}
function act(action,notice){try{const next=dispatch(game,action,content);if(action.type==='call')next.meta.learned_call_ids=[...new Set([...(next.meta.learned_call_ids||[]),action.id])];if(!save(next))return false;game=next;if(['deliver','buy','surrender','grant'].includes(action.type)){sound.play('cash');if(action.type==='deliver')ringNotBefore=performance.now()+900;}else if(action.type==='insert'||action.type==='eject')sound.play(action.type);if(notice)message(notice);if(action.type==='deliver'){selected=null;combo=[];screen='workshop';}return true;}catch(e){error(e);return false;}}
function navigate(next){screen=next;modal=null;inspectOpen=false;s.focus=-1;if(next==='mail')act({type:'mailboxRefresh'});if(['mail','personnel','records','settings','planner'].includes(next))lastPCScreen=next;if(next==='personnel'&&personnelKey!==`${game.run.id}:${game.run.status}`){personnelKey=`${game.run.id}:${game.run.status}`;draftSkills=[...game.meta.skill_allocations];carryPocs=[];carryEquipment=[];}}
function info(title,body,actions=[]){modal={title,body:Array.isArray(body)?body:[body],actions,scroll:0};s.focus=-1;}
function confirm(title,body,fn,label='実行する',danger=false){info(title,body,[{label,fn:()=>{modal=null;fn();},danger}]);}
function operation(op){try{const quote=quoteOperation(game,op,content);if(screen==='workshop'){screen='device';physical.view=0;}confirm(quote.summary,[`費用 ${money(quote.cost)}　処理 ${(quote.totalDuration/1000).toFixed(1)} 秒`,...(quote.stages.length>1?quote.stages.map((v,i)=>`${i+1}. ${v}`):[]),...(quote.warnings||[]).map(w=>'注意：'+(typeof w==='string'?w:w.message)), tutorialStatus(game).attempt?.job_id===FIRST_JOB?'今回の依頼に関係のないOS更新や初期化は不要です。':'実行前に契約の成功条件を確認してください。'],()=>{if(act({type:'start',operation:op,confirmed:true}))screen='workshop';},quote.cost?`${money(quote.cost)} で実行`:'実行する',!!quote.warnings?.length);modal.operation=op;}catch(e){error(e);}}
function download(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function requestText(title,value,callback){input.value=value;input.type='text';input.setAttribute('aria-label',title);modal={title,body:['入力して Enter で確定します。'],input:true,actions:[{label:'確定',fn:()=>{const value=input.value;input.blur();modal=null;callback(value);}}]};input.focus();input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();modal.actions[0].fn();}if(e.key==='Escape'){input.blur();modal=null;}};}
function footerTop(){return terminalMode?s.H-8:s.H-20;}
function headBottom(){return shopRendering?10:terminalMode?82:(s.narrow?108:112);}
function B(label,x,y,w,fn,opt={}){return s.button(label,x,y,w,s.btnH,fn,opt);}
function panel(x,y,w,h,dark=false){s.rect(x,y,w,h,dark?'#163e42':C.paper,dark?'#54736a':C.line,8);}
function title(label,x,y,sub=''){s.text(label,x,y,s.font*1.35,C.ink,700);if(sub)s.text(sub,x,y+s.font*1.9,s.small,C.muted);return y+s.font*(sub?3.6:2.1);}
function chip(text,x,y,color=C.green){const w=s.measure(text,s.small)+24;s.rect(x,y,w,s.small+16,color,null,4);s.text(text,x+12,y+7,s.small,C.cream,600);return w;}
function listRegion(key,x,y,w,h,draw){
  const viewH=Math.max(45,Math.floor(h)),offset=Math.max(0,Math.round(scrolls[key]||0));let height=0;
  s.clip(x,y,w-34,viewH,()=>{height=draw(y-offset)||0;});
  const metrics=scrollMetrics(height,viewH,offset),{max}=metrics;scrolls[key]=metrics.offset;s.regions.push({key,x,y,w,h:viewH,max});
  if(metrics.overflow){
    const trackH=Math.max(20,viewH-88),thumb=Math.min(trackH,Math.max(25,trackH*viewH/Math.max(height,1)));
    s.rect(x+w-21,y+44,12,trackH,'#c3ccba',null,5);
    s.rect(x+w-21,y+44+metrics.offset/max*(trackH-thumb),12,thumb,C.green,null,5);
    s.button('▲',x+w-32,y,32,38,()=>scrolls[key]=Math.max(0,metrics.offset-viewH*.7),{small:true,padding:2,disabled:metrics.offset===0});
    s.button('▼',x+w-32,y+viewH-38,32,38,()=>scrolls[key]=Math.min(max,metrics.offset+viewH*.7),{small:true,padding:2,disabled:metrics.atBottom});
  }
}
function section(label,x,y,w,body,buttons=[]){const columns=Math.max(1,Math.min(buttons.length,Math.floor((w-36)/170))),rows=Math.ceil(buttons.length/columns),titleH=s.wrap(label,x+18,y+15,w-36,s.font,C.ink,1.4,4,true),bodyY=y+titleH+30,bodyH=s.wrap(body,x+18,bodyY,w-36,s.small,C.muted,1.5,20,true),h=titleH+bodyH+60+rows*(s.btnH+10);panel(x,y,w,h);s.wrap(label,x+18,y+15,w-36,s.font,C.ink,1.4,4);s.wrap(body,x+18,bodyY,w-36,s.small,C.muted,1.5,20);if(buttons.length){const gap=10,bw=(w-36-gap*(columns-1))/columns;buttons.forEach((b,i)=>B(b.label,x+18+(i%columns)*(bw+gap),bodyY+bodyH+16+Math.floor(i/columns)*(s.btnH+gap),bw,b.fn,b));}return h+16;}
function loadModel(model){const key=artKey(model).key;if(s.images.has(key)||artLoading.has(key))return;artLoading.add(key);s.load(key,`./assets/${key}.webp`).catch(()=>message('端末画像を読めません。ページを再読み込みしてください。',true));}
function deviceThumb(model,x,y,w,h){loadModel(model);const key=artKey(model),frame=physical.frames[key.key]?.[key.row*8],im=s.images.get(key.key);if(im&&frame){const scale=Math.min(w/frame.w,h/frame.h);s.ctx.drawImage(im,frame.x,frame.y,frame.w,frame.h,x+(w-frame.w*scale)/2,y+(h-frame.h*scale)/2,frame.w*scale,frame.h*scale);}else s.atlas(model.art.sheet,model.art.index,5,4,x,y,w,h);}
function checkRows(a,x,y,w){return conditionTable(s,inspect(a,content),x,y,w);}
function accept(job){if(act({type:'accept',jobId:job.id})){modal=null;screen='workshop';physical.view=0;selected=null;combo=[];deviceTab='media';if(tutorialStatus(game).phase==='briefing'){sound.play('phone');lastRing=performance.now();message('端末が届きました。電話で修理内容を聞きましょう。');}}}
function jobDetail(job){
  const returnView=screen!=='mail'?{screen:screen==='phone'?'workshop':screen,deviceTab,mailTab,recordsTab,scrolls:{...scrolls},lastPCScreen}:null;
  if(contractTransition)clearTimeout(contractTransition);contractTransition=null;
  shopOpen=false;screen='mail';
  const routes=planRoutes(game,job,content),valid=routes.filter(p=>p.valid),cost=valid.length?Math.min(...valid.map(p=>p.upfront)):null;
  modal={title:job.title,kind:'contract',returnView,job,cost,routes,scroll:0,actions:[{label:game.run.attempts.some(a=>a.job_id===job.id)?'受注中':game.run.attempts.length>=(game.run.skills.includes('D3')||eq('M12')?2:1)?'受注枠が満杯':'受注する',fn:()=>accept(job),disabled:game.run.attempts.some(a=>a.job_id===job.id)||game.run.attempts.length>=(game.run.skills.includes('D3')||eq('M12')?2:1)||game.run.status!=='active'}]};act({type:'read',jobId:job.id});
}
function openCalls(){
  if(wrongPurchaseCallPending(game)){screen='phone';shopOpen=false;callPage=0;modal={kind:'wrong-purchase',event:WRONG_PURCHASE_CALL};sound.stop();return;}
  const lesson=lessonReady();if(lesson){screen='phone';shopOpen=false;callPage=0;modal={kind:'workshop-guide',event:lesson};sound.stop();return;}
  if(retirementCallPending){screen='phone';shopOpen=false;callPage=0;modal={kind:'retirement-guide',event:{id:'retirement-guide',pages:RETIREMENT_PAGES}};sound.stop();return;}
  if(graduationPending(game)){screen='phone';shopOpen=false;callPage=0;modal={kind:'graduation',event:GRADUATION_CALL};sound.stop();return;}
  if((game.run.intro?.stage??4)<4){screen='phone';shopOpen=false;callPage=game.run.intro.stage;modal={kind:'intro'};sound.stop();return;}
  if(tutorialStatus(game).phase==='briefing'){screen='phone';shopOpen=false;callPage=game.run.tutorial?.briefingPage||0;modal={kind:'repair',title:'最初の修理'};sound.stop();return;}
  if(screen==='phone'){modal=null;screen='workshop';sound.stop();return;}
  const pending=game.run.pending_calls[0];
  if(!pending){const entry=game.run.assistance?.active||recoveryIncoming(game)||recoveryHint(game);if(entry){recoveryCall(entry);return;}}
  const story=storyReady();if(!pending&&story){callPage=0;screen='phone';shopOpen=false;modal={kind:'story',event:story};sound.stop();return;}
  if(!pending){const repair=bootRepairLesson(game,true);if(repair){callPage=0;screen='phone';shopOpen=false;modal={kind:'workshop-guide',event:repair};sound.stop();return;}}
  const id=pending||game.run.completed_calls.at(-1);
  if(!id){screen='phone';info('電話','今は着信がありません。',[{label:'受話器を戻す',fn:()=>{modal=null;screen='workshop';}}]);return;}
  screen='phone';shopOpen=false;callPage=0;modal={title:pending?'工房長からの電話':'電話の記録',kind:'call',event:promotionCall(game,get(content.events,id)),scroll:0};sound.stop();
}
function openGrant(rank){const event=content.events.find(e=>e.rank===rank);modal={title:'工房の仕入れ支援',kind:'grant',rank,event,scroll:0};}
function purchaseReason(id){if(activeGuide().phase==='boot-buy'&&activeGuide().itemId===id)return activeGuide().hint;return id==='P02'?'今回の依頼はアプリ導入制限の解除。支給された管理者用USBでは解除する権限が違うため、KomaOS 1.1対応のアプリ導入制限解除USBが必要だ。':id==='M02'?'画面が故障した端末も、外部画面ドックにつなげば操作できる。今回の端末は内蔵画面が壊れているため、解除プログラムを操作する外部画面が必要だ。購入後、作業台のドックをクリックして接続しよう。買ったドックは繰り返し使える。':id==='M03'?'Type-Cの差込口へ四角いUSB-A媒体をつなぐための変換器だ。買ったら作業台でクリックして装着しよう。OS名や対応版は変えられない。':get(content.pocs,id)?.media==='USB-C'?'この端末のOSと版に対応したType-C媒体だ。KomaOS用のUSBでは使えない。購入後はそのまま楕円形の差込口へ差して、端末から解除プログラムを実行しよう。':'';}
function buy(item){const guided=activeGuide().itemId===item.id;confirm(item.name,[...(guided?[purchaseReason(item.id)]:[]),item.description,`価格 ${money(item.price)} ／ 所持金 ${money(game.run.cash)}`,item.limits||`${item.family} ${item.versions?.join(' / ')}　${item.media}`],()=>{
  if(wrongPurchaseCallPending(game)){shopOpen=false;screen='workshop';message('先に工房長からの電話を取ってください。');return;}
  if(wrongPurchaseInFreeTutorial(game,item.id)){
    if(game.run.tutorial.wrongPurchaseCallHeard){message('今の依頼に必要のない商品です。購入を取り消しました。');return;}
    const next=queueWrongPurchaseCall(game);
    if(!save(next))return;
    game=next;shopOpen=false;screen='workshop';lastIncomingKey='wrong-purchase';lastRing=performance.now();
    sound.play('phone');message('購入を取り消しました。工房長から電話です。受話器を取ってください。');return;
  }
  if(act({type:'buy',id:item.id},`${item.name} を購入しました`)&&guided){shopOpen=false;screen='workshop';}
},'購入する');modal.purchase=true;}
function insert(port){if(!selected){message('机の媒体を選んでから、対応する差込口を押してください。');return;}const ids=combo.length?combo:[selected];if(act({type:'insert',pocIds:ids,portIndex:port,instance:selectedInstance})){physical.animation={start:performance.now(),port,ids};selected=null;combo=[];}}
function mailbox(){
  const g=s.gap,x=g,y=headBottom()+g,w=s.W-2*g,h=footerTop()-y-g,capacity=has('D3')||eq('M12')?2:1;
  panel(x,y,w,h);let yy=title('受信トレイ',x+g,y+g,`受注中 ${game.run.attempts.length}/${capacity}件 ／ 納品すると新しい依頼が届きます`);
  if(tutorialStatus(game).phase==='next-order')yy+=s.wrap('工房長：今回はアプリを入れられる状態にする仕事だ。「契約を読む」から内容を確認しよう。',x+g,yy,w-g*2,s.font,C.green,1.5)+20;
  const options=[['inbox','届いた依頼'],['active','受注中'],['archive','過去の依頼']],bw=Math.min(240,(w-g*4)/3);
  options.forEach(([key,label],i)=>B(label,x+g+i*(bw+8),yy,bw,()=>mailTab=key,{style:mailTab===key?'primary':'light',small:s.narrow}));yy+=s.btnH+16;
  let jobs=mailTab==='archive'?content.jobs.filter(j=>game.run.completed.includes(j.id)):mailTab==='active'?[]:game.run.inbox.map(id=>get(content.jobs,id)).filter(Boolean);
  listRegion('mail-'+mailTab,x+g,yy,w-g*2,h-(yy-y)-g,cy=>{
    const start=cy,ix=x+g,iw=w-g*2-40;
    if(mailTab!=='archive')for(const a of game.run.attempts){
      cy+=section('受注中：'+a.job.title,ix,cy,iw,`報酬 ${money(a.job.reward)} ／ ${a.runtime.pending?'作業中':a.id===game.run.active_id?'作業台にあります':'保留中'}`,[
        {label:'作業台へ戻す',fn:()=>{if(act({type:'select',attemptId:a.id}))returnToWorkshop();},style:'primary'},
        {label:'契約を確認',fn:()=>jobDetail(a.job)}
      ]);
    }
    for(const j of jobs){
      const model=get(content.devices,j.hardware_model_id),ch=s.narrow?215:232,tw=s.narrow?80:172;
      panel(ix,cy,iw,ch);deviceThumb(model,ix+15,cy+20,tw,tw);
      const tx=ix+tw+30,textW=iw-tw-50;chip(`${j.grade}　${money(j.reward)}`,tx,cy+14);
      s.wrap(j.title,tx,cy+58,textW,s.font,C.ink,1.5,2);
      s.text(s.ellipsis(`${j.family} ${j.version} ／ ${model.name}`,textW,s.small),tx,cy+58+s.font*3.2,s.small,C.muted);
      B('契約を読む',tx,cy+ch-s.btnH-12,Math.min(260,textW),()=>jobDetail(j),{style:'primary',small:s.narrow});cy+=ch+16;
    }
    if(!jobs.length&&!game.run.attempts.length)cy+=s.wrap('届いた依頼はありません。着信や工房からの仕入れ支援を確認してください。',ix,cy,iw)+30;
    return cy-start;
  });
}
function deviceScreen(){const a=attempt();if(!a){screen='workshop';return;}const model=get(content.devices,a.hardware_model_id),g=s.gap,x=g,y=headBottom()+g,w=s.W-2*g,h=footerTop()-y-g;panel(x,y,w,h);let cy=title(model.name,x+g,y+g,`${a.device.family} ${a.device.version}　${a.device.operational?'起動中':'起動不能'}　${a.device.display?'内蔵画面正常':a.runtime.dock?'外部画面中継':'画面不良'}`);
  const tabs=[['media','媒体'],['apps','アプリ'],['settings','設定'],['service','正規'],['data','保全'],['inspect','検品']];const tw=(w-g*2-5*7)/6;tabs.forEach(([id,label],i)=>id==='inspect'&&!inspectionVisible()?null:B(label,x+g+i*(tw+7),cy,tw,()=>{deviceTab=id;},{style:deviceTab===id?'primary':'light',small:s.narrow,id:'device-tab-'+id}));cy+=s.btnH+20;
  listRegion('device-'+deviceTab,x+g,cy,w-g*2,h-(cy-y)-g,start=>{let yy=start;const ix=x+g,iw=w-g*2-40;
    if(deviceTab==='media'){
      yy+=section('3つの独立した権限',ix,yy,iw,AXES.map(k=>`${names[k]}：${a.device.security[k]?'開放':'施錠'}`).join('　'),[{label:'作業台で差し込む',fn:()=>screen='workshop',style:'primary'}]);
      if(a.runtime.media.length){const phase=activeGuide().phase,key=game.run.id+':'+a.id+':'+phase;if(['execute','second-execute','profile-execute'].includes(phase)&&guideScrollKey!==key){guideScrollKey=key;const targetY=Math.max(0,yy-start);requestAnimationFrame(()=>{scrolls['device-media']=targetY;});}yy+=section('端末から起動',ix,yy,iw,a.runtime.media.map(m=>get(content.pocs,m.pocId).name).join('\n'),[{label:executeLabel(a),fn:()=>operation({type:'poc'}),style:'gold'}]);}
      for(const id of game.run.owned_pocs){const p=get(content.pocs,id);if(p.family!==a.device.family)continue;yy+=section(p.name,ix,yy,iw,`${p.family} ${p.versions.join(' / ')} ／ ${p.media} ／ ${p.description}`,[{label:'選ぶ',fn:()=>{selected=id;combo=[];screen='workshop';},style:'primary'},...(has('B1')?[{label:game.run.prepared.includes(id)?'取り置き解除':'取り置く',fn:()=>act({type:'prepare',pocIds:game.run.prepared.includes(id)?game.run.prepared.filter(p=>p!==id):[...game.run.prepared,id].slice(-preparationLimit(game))})}]:[]),...(has('B2')?[{label:'次に予約',fn:()=>act({type:'queue',pocIds:[...new Set([...a.runtime.queue,id])].slice(-3)})}]:[]),...(has('B3')?[{label:combo.includes(id)?'複合から外す':'複合へ追加',fn:()=>{combo=combo.includes(id)?combo.filter(i=>i!==id):[...combo,id].slice(-3);selected=combo[0]||null;}}]:[])]);}
      if(has('B1'))yy+=section(`適合媒体を${preparationLimit(game)}枚取り置き`,ix,yy,iw,'受注・端末切替時に、OS名と版が合う所有媒体を自動で先頭へ並べます。\n'+(game.run.prepared.map(id=>get(content.pocs,id)?.name||id).join('・')||'対応する所有媒体はありません'),[{label:'現在の選択を取り置く',fn:()=>act({type:'prepare',pocIds:combo.length?combo.slice(0,preparationLimit(game)):selected?[selected]:[]})}]);
      if(has('B2'))yy+=section('実行予約',ix,yy,iw,a.runtime.queue.join(' → ')||'未予約。挿入は1本ずつ自分で行います。',[{label:'選択した媒体を予約',fn:()=>act({type:'queue',pocIds:combo.length?combo:selected?[selected]:[]})}]);
    }
    if(deviceTab==='apps'){for(const app of content.apps){const name=typeof app==='string'?app:app.name;yy+=section(name,ix,yy,iw,a.device.apps.includes(name)?'この端末に導入済み':'未導入',[{label:a.device.apps.includes(name)?'削除する':'導入する',fn:()=>operation({type:a.device.apps.includes(name)?'remove':'install',app:name}),style:'primary'}]);}}
    if(deviceTab==='settings'){
      for(const key of model.features){
        const guideKey=game.run.id+':'+a.id+':profile-edit';
        if(key==='profile'&&activeGuide().phase==='profile-edit'&&guideScrollKey!==guideKey){guideScrollKey=guideKey;const offset=Math.max(0,yy-start);requestAnimationFrame(()=>{scrolls['device-settings']=offset;});}
        yy+=section(names[key],ix,yy,iw,`現在：${valueNames[a.device.settings[key]]||a.device.settings[key]}`,values[key].map(v=>({label:valueNames[v],fn:()=>operation({type:'setting',key,value:v}),style:a.device.settings[key]===v?'gold':'light',id:'setting-'+key+'-'+v})));
      }
      for(const axis of [...AXES,'all'])yy+=section(axis==='all'?'すべて施錠':names[axis],ix,yy,iw,axis==='all'?'管理者・アプリ導入・設定編集をすべて閉じます。':a.device.security[axis]?'開放されています':'施錠されています',[{label:'再施錠',fn:()=>operation({type:'lock',axis})}]);
    }
    if(deviceTab==='service'){
      if(!a.device.operational)yy+=section('起動不能の端末を修復',ix,yy,iw,a.job.network===false?'この契約は外部通信禁止です。読取専用救出機 → リカバリー装置 → バックアップ装置の順で復旧します。工房長に電話すると手順を聞けます。':`正規修復ならデータ・アプリ・設定・OS版を残せます。料金は ${money(Math.ceil(a.job.reward*.25))}。新しい機材は不要です。`,a.job.network===false?[]:[{label:'正規修復の見積り',fn:()=>operation({type:'service',serviceId:'S02'}),style:'gold',id:'boot-fix'}]);
      yy+=s.wrap('通信禁止の契約では正規解除・正規修復・正規更新を利用できません。実行前に費用と影響を表示します。',ix,yy,iw,s.small,C.muted)+20;
      const aw=(iw-16)/3;AXES.forEach((axis,i)=>B(`${serviceAxes.includes(axis)?'✓ ':''}${names[axis]}`,ix+i*(aw+8),yy,aw,()=>serviceAxes=serviceAxes.includes(axis)?serviceAxes.filter(a=>a!==axis):[...serviceAxes,axis],{style:serviceAxes.includes(axis)?'gold':'light',small:s.narrow}));yy+=s.btnH+16;
      yy+=section('S01 正規解除',ix,yy,iw,'選択した権限だけ解除。報酬の35% / 60% / 75%を支払います。',[{label:'見積りを確認',fn:()=>operation({type:'service',serviceId:'S01',axes:serviceAxes}),style:'primary'}]);
      for(const [id,name,desc] of [['S02','正規修復','起動不能をデータを保ったまま修復。報酬の25%。'],['S03','正規更新','次の対応OS版へ無料更新。3権限は再施錠されます。'],['S04','画面交換','内蔵画面を修理。報酬の25%。外部通信なし。']])yy+=section(name,ix,yy,iw,desc,[{label:'見積りを確認',fn:()=>operation({type:'service',serviceId:id})}]);
    }
    if(deviceTab==='data'){
      const cats=['data','apps','settings',...(a.job.data||[])];s.text('退避・復元する対象',ix,yy,s.font,C.ink,700);yy+=s.font*1.7;
      const cw=Math.min(250,(iw-8)/2);cats.forEach((cat,i)=>{B(`${backupCats.includes(cat)?'✓ ':''}${({data:'全データ',apps:'アプリ',settings:'設定'})[cat]||cat}`,ix+(i%2)*(cw+8),yy+Math.floor(i/2)*(s.btnH+8),cw,()=>backupCats=backupCats.includes(cat)?backupCats.filter(c=>c!==cat):[...backupCats,cat],{style:backupCats.includes(cat)?'gold':'light',small:s.narrow});});yy+=Math.ceil(cats.length/2)*(s.btnH+8)+16;
      if(has('A3')){B(portable?'✓ 携帯保全設備':'携帯保全設備を使う',ix,yy,iw,()=>portable=!portable,{style:portable?'gold':'light'});yy+=s.btnH+16;}
      yy+=section('退避と復元',ix,yy,iw,'端末ごとのデータ指紋・元OS版・設定を保持します。選択していない対象は変更しません。',[{label:'退避',fn:()=>operation({type:'backup',categories:backupCats,portable})},{label:'救出',fn:()=>operation({type:'rescue',categories:backupCats,portable})},{label:'復元',fn:()=>operation({type:'restore',categories:backupCats,portable})}]);
      const ops=[['外部画面ドック','内蔵画面を修理せず、操作画面を中継します。',{type:'dock'}],['USB変換器','USB-AとUSB-Cの形状を変換。OS互換は変わりません。',{type:'adapter'}],['標準イメージ','同じOS版で初期化・起動復旧。データ・アプリ・設定を消去。',{type:'reimage',development:false}],['開発用イメージ','初期化・起動復旧・3権限開放。材料費が必要です。',{type:'reimage',development:true}],['オフライン更新','外部通信なし。次の対応版へ更新し3権限を再施錠。',{type:'update',offline:true}],['プリセット転写','依頼に添付されたプリセットだけを適用します。',{type:'preset'}],['診断','現在の互換と契約条件を診断します。',{type:'diagnose'}],['試運転','起動と機能を確認します。',{type:'test'}]];
      for(const [name,desc,op] of ops)yy+=section(name,ix,yy,iw,desc,[{label:'使う',fn:()=>operation(op)}]);
    }
    if(deviceTab==='inspect'){
      yy=checkRows(a,ix,yy,iw);const ok=inspect(a,content).every(r=>r.ok);yy+=18;B(ok?`合格・返却して ${money(a.practice?0:a.job.reward)}`:'未達条件があります',ix,yy,iw,deliverDevice,{style:'primary',disabled:!ok||!!a.runtime.pending});yy+=s.btnH+20;
      B('依頼を破棄して受け直す',ix,yy,iw,()=>confirm('依頼を破棄します',['端末は受注時の状態へ戻ります。すでに支払った費用は戻りません。購入した道具は残ります。'],()=>act({type:'abandon'}),'破棄する',true),{style:'danger'});yy+=s.btnH+20;
    }
    if(a.runtime.pending){s.text('処理中…',ix,yy,s.font,C.green,700);yy+=60;}return yy-start;
  });
}
function catalog(){const g=s.gap,x=g,y=headBottom()+g,w=s.W-2*g,h=footerTop()-y-g;panel(x,y,w,h);let yy=title('工房カタログ',x+g,y+g,'媒体は形状・OS名・版・解除する権限まで確認');const tabs=[['poc','PoC媒体'],['equipment','機材'],['manufacturer','メーカー提出']];const bw=(w-g*2-16)/3;tabs.forEach(([id,label],i)=>id==='inspect'&&!inspectionVisible()?null:B(label,x+g+i*(bw+8),yy,bw,()=>catalogTab=id,{style:catalogTab===id?'primary':'light',small:s.narrow}));yy+=s.btnH+16;
  listRegion('catalog-'+catalogTab,x+g,yy,w-g*2,h-(yy-y)-g,cy=>{const start=cy,ix=x+g,iw=w-g*2-40;
    for(const rank of game.run.book_pending)cy+=section(`信用 ${'EDCBA'[rank-1]} の追加商品`,ix,cy,iw,'工房長が追加の道具を手配しました。商品一覧に追加します。',[{label:'追加商品を見る',fn:()=>act({type:'openCatalog',rank,kind:'both'},'商品が追加されました'),style:'gold',id:'open-catalog-'+rank}]);
    for(const [rank,value] of Object.entries(game.run.chapter_grants))if(value===false)cy+=section('工房からの仕入れ支援',ix,cy,iw,'準備金か、新しく扱える解除媒体を1本受け取れます。',[{label:'仕入れ支援を受け取る',fn:()=>openGrant(Number(rank)),style:'gold',id:'grant-'+rank}]);
    const guide=activeGuide(),recommended=guide.itemId;
    if((['buy-poc','buy-type-c'].includes(guide.phase)&&catalogTab==='poc')||(['buy-equipment','buy-adapter','boot-buy'].includes(guide.phase)&&catalogTab==='equipment'))cy+=section('工房長の購入案内',ix,cy,iw,purchaseReason(recommended));
    const list=[...(catalogTab==='equipment'?content.equipment:content.pocs)].sort((a,b)=>Number(b.id===recommended)-Number(a.id===recommended));
    for(const item of list){if(item.id==='M01')continue;const owned=(catalogTab==='equipment'?game.run.owned_equipment:game.run.owned_pocs).includes(item.id);if(catalogTab==='manufacturer'&&!owned)continue;
      const locked=item.rank>(catalogTab==='equipment'?game.run.equipment_rank:game.run.poc_rank),guideSpace=item.id===recommended?135:0,h=(s.narrow?224:196)+guideSpace,thumb=s.narrow?68:140;panel(ix,cy,iw,h);if(item.art)s.atlas(item.art.sheet,item.art.index,4,4,ix+12,cy+20,thumb,thumb);else physical.media(item.media,ix+12+thumb/2,cy+30+thumb/2,thumb,0,'',false,item.id);
      const tx=ix+thumb+30,ww=iw-thumb-48;s.text(`${item.media||'工房機材'}　${owned?'所有済み':money(item.price)}`,tx,cy+14,s.small,owned?C.green:C.muted,700);s.wrap(item.name,tx,cy+49,ww,s.font,C.ink,1.4,2);s.wrap(item.description,tx,cy+49+s.font*2.9,ww,s.small,C.muted,1.4,2);
      const buttonY=cy+h-s.btnH-12-guideSpace;
      if(catalogTab==='manufacturer'){B(item.id==='P01'?'貸与品の説明':'売却について確認',tx,buttonY,Math.min(340,ww),()=>requestSale(item),{disabled:game.meta.surrendered_poc_ids.includes(item.id),style:'gold',small:s.narrow});}
      else B(locked?'カタログ未解放':owned?'説明を見る':'購入する',tx,buttonY,Math.min(320,ww),()=>owned?info(item.name,[item.description,item.limits||`${item.media} ／ ${item.family} ${item.versions?.join(' / ')}`],item.id.startsWith('P')&&(eq('M08')||has('D4'))?[{label:'複製する',fn:()=>act({type:'duplicate',pocId:item.id},'2本目の媒体を用意しました')}]:[]):buy(item),{style:owned?'light':'primary',disabled:locked,small:s.narrow,id:'buy-'+item.id});cy+=h+16;
    }return cy-start;
  });
}
function personnel(){
  if(personnelKey!==`${game.run.id}:${game.run.status}`){personnelKey=`${game.run.id}:${game.run.status}`;draftSkills=[...game.meta.skill_allocations];carryPocs=[];carryEquipment=[];}
  const g=s.gap,x=g,y=headBottom()+g,w=s.W-2*g,h=footerTop()-y-g;panel(x,y,w,h);let yy=title('人事・次の担当者',x+g,y+g,`契約 ${game.run.id} ／ 生涯獲得 ${game.meta.sp_total_earned} SP`);
  listRegion('personnel-'+game.run.status,x+g,yy,w-g*2,h-(yy-y)-g,cy=>{const start=cy,ix=x+g,iw=w-g*2-40;
    if(game.run.status==='active'){
      cy+=section('退職届を書いて工房を離れる',ix,cy,iw,`次の新人への軍資金は $400 + 当周の対象報酬 ${money(game.run.eligible_reward_total)} の50%。現在の所持金は合算しません。処理中なら完了後に精算します。`);
      for(const e of endingOptions(game,content))cy+=section(e.name,ix,cy,iw,e.available?e.condition:e.reason||e.condition,[{label:e.available?'この進路を選ぶ':'条件未達',fn:()=>retirementRequest(e),disabled:!e.available,style:e.id==='END_FREE'?'light':'primary'}]);
    }else{
      const ending=get(content.endings,game.run.retirement.endingId);cy+=section(ending.name,ix,cy,iw,ending.quote+'\n'+ending.description);
      const used=draftSkills.reduce((n,id)=>n+(get(content.skills,id)?.cost||0),0);cy+=section(`技能パネル　${used} / ${game.meta.sp_total_earned} SP`,ix,cy,iw,'道具の買い取り・作業・記録・取引・信用の技能を選びます。退職中は無料で振り替えできます。前提を含めて選び、確定してください。',[{label:'全解除',fn:()=>draftSkills=[]},{label:'技能を確定',fn:()=>{if(act({type:'allocate',ids:draftSkills},'次の新人の技能を保存しました')){const limits=carryLimits(draftSkills);carryPocs=carryPocs.slice(0,limits.pocs);carryEquipment=carryEquipment.slice(0,limits.equipment);}},style:'primary'}]);
      for(const skill of content.skills)cy+=section(`${draftSkills.includes(skill.id)?'✓ ':''}${skill.name}　${skill.cost} SP`,ix,cy,iw,skill.description+(skill.requires.length?`\n前提：${skill.requires.join('・')}`:''),[{label:draftSkills.includes(skill.id)?'外す':'選ぶ',fn:()=>draftSkills=draftSkills.includes(skill.id)?draftSkills.filter(x=>x!==skill.id):[...draftSkills,skill.id],style:draftSkills.includes(skill.id)?'gold':'light'}]);
      const candidates=game.run.carry_candidates||[],limits=carryLimits(game.meta.skill_allocations);
      if(limits.pocs||limits.equipment)cy+=section('工房長から道具を買い取る',ix,cy,iw,`技能で買い取りを手配できます。解除媒体 ${carryPocs.length}/${limits.pocs}本、機材 ${carryEquipment.length}/${limits.equipment}台を選択中。`);
      for(const id of candidates){const item=get(content.pocs,id)||get(content.equipment,id);if(!item||id==='P01'||id==='M01')continue;const poc=id.startsWith('P'),limit=poc?limits.pocs:limits.equipment,selection=poc?carryPocs:carryEquipment,chosen=selection.includes(id);if(!limit)continue;cy+=section(item.name,ix,cy,iw,poc?'工房長から買い取り、次の担当者が使う解除媒体':'工房長から買い取り、次の担当者が使う機材',[{label:chosen?'選択を外す':'買い取りに選ぶ',fn:()=>{const next=chosen?selection.filter(v=>v!==id):[...selection,id];if(poc)carryPocs=next;else carryEquipment=next;},disabled:!chosen&&selection.length>=limit,style:chosen?'gold':'light'}]);}
      cy+=section('新人として応募',ix,cy,iw,`軍資金 ${money(400+Math.floor(game.meta.last_run_eligible_reward_total/2))}。信用${'EDCBA'[startingRank(game.meta.skill_allocations)-1]}から、通常の依頼五件を担当します。`,[{label:'次の契約を始める',fn:()=>{if(act({type:'rehire',pocIds:carryPocs,equipmentIds:carryEquipment})){if(contractTransition)clearTimeout(contractTransition);contractTransition=null;screen='workshop';modal=null;shopOpen=false;scrolls={};carryPocs=[];carryEquipment=[];selected=null;combo=[];drag=null;physical.view=0;physical.animation=null;room.layout={};callPage=0;retirementCallPending=false;lastIncomingKey=null;lastRecoveryRing=null;ringNotBefore=0;rewardFlash=null;guideScrollKey='';clearShortDialogue();sound.stop();}},style:'primary'}]);
    }return cy-start;
  });
}
function timerNow(){return timer.elapsed+(timer.running?Math.max(0,performance.timeOrigin+performance.now()-timer.start):0);}
function timerText(ms){const t=Math.floor(ms/10);return `${Math.floor(t/6000).toString().padStart(2,'0')}:${Math.floor(t/100)%60<10?'0':''}${Math.floor(t/100)%60}.${(t%100).toString().padStart(2,'0')}`;}
function saveTimer(){try{localStorage.setItem('jailbreakGame:timer',JSON.stringify(timer));}catch(e){error(e);}}
function records(){const g=s.gap,x=g,y=headBottom()+g,w=s.W-2*g,h=footerTop()-y-g;panel(x,y,w,h);let yy=title('工房の記録',x+g,y+g,'過去の仕事・自由計測・機種台帳');const tabs=[['history','納品履歴'],['timer','RTA計測'],['models','機種台帳'],['other','会話・技能']];const bw=(w-g*2-24)/4;tabs.forEach(([id,label],i)=>id==='inspect'&&!inspectionVisible()?null:B(label,x+g+i*(bw+8),yy,bw,()=>recordsTab=id,{style:recordsTab===id?'primary':'light',small:s.narrow}));yy+=s.btnH+16;
  listRegion('records-'+recordsTab,x+g,yy,w-g*2,h-(yy-y)-g,cy=>{const start=cy,ix=x+g,iw=w-g*2-40;
    if(recordsTab==='history'){
      if(!game.meta.history.length)cy+=section('まだ記録がありません',ix,cy,iw,'端末を検品して返却すると、実行工程・費用・報酬・獲得SPがここに残ります。');
      for(const rec of [...game.meta.history].reverse())cy+=section(`${rec.grade}　${rec.title}`,ix,cy,iw,`報酬 ${money(rec.reward)} ／ 消耗費 ${money(rec.spent)} ／ 投資 ${money(rec.invested)} ／ ${rec.sp} SP`,[{label:'工程を見る',fn:()=>info(rec.title,rec.log.map(l=>l.summary||display.operation(l.operation)))},...(eq('M11')?[{label:'工程を保存',fn:()=>act({type:'saveRecipe',jobId:rec.job_id},'工程記録を保存しました')}]:[])]);
    }
    if(recordsTab==='timer'){
      s.text(timerText(timerNow()),ix,cy,s.narrow?42:82,C.green,700);cy+=s.narrow?75:125;s.text(timer.label+(timer.reference?' ／ 参考記録（中断・再読込あり）':''),ix,cy,s.font);cy+=s.font*2;
      const tw=(iw-16)/3;B(timer.running?'停止':'開始',ix,cy,tw,()=>{if(timer.running){timer.elapsed=timerNow();timer.running=false;timer.reference=true;timer.endState=timerSnapshot();}else{timer.start=performance.timeOrigin+performance.now();timer.running=true;timer.seed=game.seed;timer.fingerprint=fingerprint({meta:game.meta,run:game.run});timer.environment=navigator.userAgent;timer.startState=timerSnapshot();}saveTimer();},{style:'primary'});B('スプリット',ix+tw+8,cy,tw,()=>{timer.splits.push({label:`${game.run.main_completed.length}件納品`,ms:timerNow()});saveTimer();},{disabled:!timer.running});B('リセット',ix+(tw+8)*2,cy,tw,()=>confirm('計測をリセット',['計測履歴だけを消します。ゲームの進行・資金・SPは変わりません。'],()=>{timer={running:false,elapsed:0,splits:[],label:'自由計測',start:null};saveTimer();}));cy+=s.btnH+20;
      cy+=section('自分で決める計測',ix,cy,iw,'好きな時点で開始・停止できます。退職で計測は止まりません。記録を比較する場合はSEED、開始状態、技能、支給、ブラウザ条件を合わせてください。',[{label:'区分名を編集',fn:()=>requestText('計測の区分',timer.label,v=>{timer.label=v.slice(0,80);saveTimer();})},{label:'記録を書き出す',fn:()=>download('jailbreak-rta.json',JSON.stringify({...timer,elapsed:timerNow(),content_version:content.version},null,2))}]);
      for(const t of timer.splits){s.text(`${timerText(t.ms)}　${t.label}`,ix,cy,s.font);cy+=s.font*2;}
    }
    if(recordsTab==='models'){for(const model of content.devices){const unlocked=game.meta.sp_awarded_models.includes(model.id),height=s.narrow?140:170;panel(ix,cy,iw,height);deviceThumb(model,ix+10,cy+8,height-25,height-25);const tx=ix+height;chip(unlocked?'SP獲得済み':'未獲得',tx,cy+14,unlocked?C.green:C.muted);s.text(model.name,tx,cy+60,s.font,C.ink,700);s.text(`${model.family} ／ ${model.skill_point_reward} SP`,tx,cy+100,s.small,C.muted);cy+=height+12;}}
    if(recordsTab==='other'){
      const stories=STORY_EPISODES.filter(e=>(game.meta.story?.heard||[]).includes(e.id));
      for(const story of stories)cy+=section(story.title,ix,cy,iw,'工房長と話した、工房にまつわる記録。',[{label:'会話を読み返す',fn:()=>info(story.title,story.pages)}]);
      if(has('C1'))cy+=section('次便を読む',ix,cy,iw,'次の更新で提示されるメール候補を、受け取らずに確認します。',[{label:'候補メールを読む',fn:showNextMail}]);
      if(has('C2'))cy+=section('工程の仮置き',ix,cy,iw,'現在の端末へ購入・挿入・工程を並べ、費用・終了状態・禁止履歴を試算します。',[{label:'工程を仮置きする',fn:openPlanner,disabled:!attempt()||!!attempt()?.runtime.pending}]);
      if(has('C3')&&attempt())cy+=section('脳内工程：候補比較',ix,cy,iw,'現在の所持品と端末状態から確認済み経路を再検査します。完全探索ではないため最小保証なし。',[{label:'費用と操作数で比較',fn:()=>{const ps=planRoutes(game,attempt().job,content,{current:true}).filter(p=>p.valid),cost=ps[0],steps=[...ps].sort((a,b)=>a.operations-b.operations)[0],chosen=[...new Set([cost,steps].filter(Boolean))];info('達成経路の候補（最小保証なし）',chosen.length?chosen.map(p=>`${display.route(p.route)}\n追加費用 ${money(p.upfront)} ／ ${p.operations} 操作\n${p.upfront>game.run.cash?'現在の資金では不足':'現在の資金で実行可能'}`):'この状態から達成を確認できる候補はありません。工程の仮置きで別の順番を検討できます。');}}]);
      const replay=attempt()?.runtime.recipe;
      if(replay){const next=replay.operations[replay.index];cy+=section(`照合済み工程 ${replay.index} / ${replay.operations.length}`,ix,cy,iw,next?`${display.operation(next)}\n${replay.paused||'必要な媒体を実物へ差してから実行してください。'}`:'工程が完了しました。無料検品で契約を確認してください。',[
        {label:next?'次の工程を確認':'検品する',fn:next?recipeStep:openInspection,disabled:!!attempt()?.runtime.pending},
        ...(eq('M15')&&next?[{label:replay.auto?'自動進行を止める':'M15で順次実行',fn:()=>replay.auto?act({type:'recipeAuto',enabled:false}):confirm('照合済み工程を順次実行します',['所定の処理時間を保ちます。媒体が未挿入の工程、費用・消去・版変更・警告のある工程では停止して確認します。'],()=>act({type:'recipeAuto',enabled:true}))}]:[])
      ]);}
      for(const recipe of game.meta.recipes)cy+=section(recipe.title,ix,cy,iw,recipe.operations.map(o=>o.type).join(' → '),[{label:'適用条件を確認',fn:()=>act({type:'replayRecipe',recipeId:recipe.id},'開始条件を照合しました。必要な媒体を机で差してください。')}]);
      if(has('F1'))for(const rec of game.run.history.filter(h=>h.evaluation))cy+=section('評価報告：'+rec.title,ix,cy,iw,`${rec.family} ${rec.version} ／ 無料検品：全条件合格`,[{label:'この版の合格を報告',fn:()=>act({type:'report',jobId:rec.job_id,version:rec.version,conclusion:'pass'},'評価報告を記録しました')}]);
      if(game.run.main_completed.length>=12){cy+=section('後輩への引継ぎ',ix,cy,iw,'判断内容の異なる合格案件を2つ選び、引継ぎをまとめます。');for(const rec of game.run.history.filter(h=>!h.practice))cy+=section(rec.title,ix,cy,iw,rec.decision_family,[{label:handoverJobs.includes(rec.job_id)?'選択中':'選ぶ',fn:()=>handoverJobs=handoverJobs.includes(rec.job_id)?handoverJobs.filter(j=>j!==rec.job_id):[...handoverJobs,rec.job_id].slice(-2),style:handoverJobs.includes(rec.job_id)?'gold':'light'}]);cy+=section('まず何を確認するか',ix,cy,iw,'後輩へ渡す手順の前提を選びます。',[{label:'契約の禁止操作',fn:()=>act({type:'handover',jobIds:handoverJobs,answer:'contract'},'後輩への引継ぎを完了しました')},{label:'同じPoCを毎回使う',fn:()=>message('OS版や禁止操作が異なるため、毎回同じ工程にはできません。',true)}]);}
      if(has('D1')||has('D2')){cy+=section('取引の技能',ix,cy,iw,'現在の章の依頼から、指名または2件の先行予約ができます。');for(const job of availableJobs(game,content).filter(j=>j.rank===game.run.rank)){cy+=section(job.title,ix,cy,iw,job.body,[...(has('D1')?[{label:'指名',fn:()=>act({type:'nominate',jobId:job.id},'受信トレイへ指名しました')}]:[]),...(has('D2')?[{label:reservations.includes(job.id)?'選択中':'予約候補',fn:()=>reservations=reservations.includes(job.id)?reservations.filter(j=>j!==job.id):[...reservations,job.id].slice(-2)}]:[])]);}if(has('D2')){B('2件の予約を確定',ix,cy,iw,()=>act({type:'reserve',jobIds:reservations},'2件を予約しました'),{style:'primary'});cy+=s.btnH+20;}}
      if(cy===start)cy+=section('記録機材・技能',ix,cy,iw,'作業記録台や取引・評価の技能を得ると、工程記録・指名・評価報告を使えます。');
    }return cy-start;
  });
}
function settings(){const g=s.gap,x=g,y=headBottom()+g,w=s.W-2*g,h=footerTop()-y-g;panel(x,y,w,h);let yy=title('設定と記録の管理',x+g,y+g);
  listRegion('settings',x+g,yy,w-g*2,h-(yy-y)-g,cy=>{const start=cy,ix=x+g,iw=w-g*2-40;
    cy+=section('操作',ix,cy,iw,'媒体をドラッグして対応する口へ運ぶか、媒体→差込口の順に押します。左右キーは端末を45度回転。TabとEnterでも操作できます。画面内はホイールか縦ドラッグでスクロールします。',[{label:'全画面',fn:()=>document.fullscreenElement?document.exitFullscreen():canvas.requestFullscreen().catch(error)},{label:sound.volume?'効果音 ON':'効果音 OFF',fn:()=>{sound.volume=sound.volume?0:.3;sound.stop();try{localStorage.setItem('jailbreakGame:volume',String(sound.volume));}catch{}}}]);
    cy+=section('SEED　'+game.seed,ix,cy,iw,'16桁のSEEDは依頼の並び順を決めます。アカウントではありません。変更は新規記録を作成し、現在の記録を置き換えます。',[{label:'SEEDを指定して新規開始',fn:()=>requestText('16桁のSEED',randomSeed(),v=>{if(!/^\d{16}$/.test(v)){error(new Error('16桁の数字を入力してください'));return;}confirm('新しい記録を作成', ['現在のSP・納品履歴・所持品を置き換えます。必要なら先に保存データを書き出してください。'],()=>{const next=createGame(content,v);if(save(next)){game=next;screen='workshop';scrolls={};}},'新規開始',true);})}]);
    cy+=section('保存データ',ix,cy,iw,'操作確定時にブラウザへ自動保存します。2つの保存領域とコミット記録で書込み途中の終了から回復します。',[{label:'書き出す',fn:()=>download('jailbreak-save.json',exportSave(game))},{label:'読み込む',fn:()=>document.querySelector('#file-import').click()}]);
    cy+=section('工房の支援',ix,cy,iw,'資金不足で必要な工程に進めない場合は貸与媒体を使った練習端末を処理します。検品後に不足分を最大$120補助します。仕入れ支援が未受取なら先に選びます。',[{label:'支援作業を受ける',fn:()=>{if(act({type:'support'}))screen='workshop';}}]);
    cy+=section('効果音：OtoLogic',ix,cy,iw,'OtoLogic (https://otologic.jp/)\nCC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)\nSNES RPG01 / サイバー03 / 黒電話 着信音01 / レジ ドロワー01。音源は無改変、ファイル名のみ変更。ゲーム内で再生音量を調整しています。',[{label:'OtoLogic',fn:()=>window.open('https://otologic.jp/','_blank','noopener')},{label:'ライセンス',fn:()=>window.open('https://creativecommons.org/licenses/by/4.0/deed.ja','_blank','noopener')}]);
    cy+=section('このゲームについて',ix,cy,iw,'脱獄RTA（物理）v3.1。OS・PoC・端末・依頼は架空です。画像は画像生成で制作し、画面の文字と操作判定はCanvasで描画しています。',[{label:'実装仕様書',fn:async()=>{try{const text=await fetch('./data/specification.txt').then(r=>{if(!r.ok)throw new Error('仕様書を読めません');return r.text();});info('実装仕様書 v3.1',text);}catch(e){error(e);}}}]);
    return cy-start;
  });
}
function modalRender(){const m=modal;if(!m)return;if(m.kind==='story'||m.kind==='intro'||m.kind==='call'||m.kind==='repair'||m.kind==='recovery'||m.kind==='graduation'||m.kind==='retirement-guide'||m.kind==='workshop-guide'||m.kind==='wrong-purchase'){dialogueRender();return;}if(terminalMode){s.hits.splice(s.planeHitStart);s.regions.splice(s.planeRegionStart);}else{s.hits=[];s.regions=[];}if(screen!=='phone')s.rect(0,0,s.W,s.H,'#071d28c9');const onPhone=screen==='phone'&&!terminalMode,w=onPhone?(s.narrow?s.W-100:s.W*.46):Math.min(s.W-s.gap*2,s.narrow?900:1320),x=onPhone?s.W-w-90/s.scale:(s.W-w)/2,y=onPhone?s.H*.15:terminalMode?10:s.narrow?20:70,h=onPhone?s.H*.73:s.H-2*y,g=s.gap;panel(x,y,w,h);s.text(s.ellipsis(m.title,w-g*2-80,s.font*1.25),x+g,y+g,s.font*1.25,C.ink,700);B('×',x+w-g-60,y+g-8,60,closeModal,{style:'light',disabled:!!m.recovery,id:'modal-close'});const guided=m.kind==='contract'&&((m.job.id===FIRST_JOB&&tutorialStatus(game).phase==='contract')||(m.job.id==='JOB_E_002'&&tutorialStatus(game).phase==='next-order')),guideH=guided?Math.max(s.narrow?220:260,shortDialogueHeight(s,m.job.id===SECOND_JOB?'契約書によると内蔵画面が壊れている。外部画面ドックで操作し、アプリ導入制限を外す仕事だ。管理者は施錠のまま、文書も残す。「受注する」を押そう。':'細かい契約書は今は気にしなくていい、こちらで見てある。原稿を残して管理者メニューを開く仕事だ。下の「受注する」を押そう。',w-g*2)+22):0;const top=y+g+Math.max(s.btnH+12,s.font*2.2),actionY=y+h-g-s.btnH-(m.purchase?125:0),bottom=actionY-15-guideH;
  listRegion('modal-'+m.title,x+g,top,w-g*2,bottom-top,cy=>{const start=cy,ix=x+g,iw=w-g*2-40;
    if(m.kind==='contract'){const j=m.job;s.text(`${j.from}　／　報酬 ${money(j.reward)}`,ix,cy,s.small,C.green,700);cy+=s.font*1.6;cy+=s.wrap(j.body.replace(/。(?=.)/g,'。\n'),ix,cy,iw,s.font,C.ink,1.9)+25;s.text('返却時の条件',ix,cy,s.font,C.ink,700);cy+=s.font*1.8;const a=game.run.attempts.find(a=>a.job_id===j.id)||previewContract(content,j);cy=checkRows(a,ix,cy,iw);cy+=15;s.text(j.network===false?'外部通信禁止':'外部通信は利用可能',ix,cy,s.small,j.network===false?C.red:C.green,700);cy+=s.font*1.8;
      if(m.cost!==undefined&&!guided){cy+=s.wrap(m.cost===null?'必要な道具と費用を見積もれません。':'想定純利益 '+money(m.job.reward-m.cost)+'（報酬 '+money(m.job.reward)+' − 準備・作業費 '+money(m.cost)+'）',ix,cy,iw,s.small,C.muted)+16;}
      if(has('C2')||has('C3'))for(const p of (m.routes||[]).filter(p=>p.valid).slice(0,2)){if(!p.valid)continue;cy+=s.wrap(`候補 ${p.index+1} ／ ${money(p.upfront)} ／ ${p.operations}操作\n${display.route(p.route)}\n${p.reason}`,ix,cy,iw,s.small,C.green,1.7)+20;}
    }else if(m.kind==='call'){const ev=m.event,pw=s.narrow?80:160; s.atlas('portraits',ev.portrait==='smile'?2:ev.portrait==='explain'?1:0,3,1,ix,cy,pw,pw*1.4);cy+=s.wrap(ev.pages[callPage],ix+pw+15,cy,iw-pw-15,s.font,C.ink,1.9)+30;cy=Math.max(cy,start+pw*1.4+15);s.text(`${callPage+1} / ${ev.pages.length}`,ix,cy,s.small,C.muted);cy+=40;
    }else if(m.kind==='grant'){cy+=s.wrap(`工房からの仕入れ支援です。準備金 ${money(m.event.grant)} か、新しく扱える解除媒体を1本選んでください。今回受け取れるのは一方だけです。`,ix,cy,iw)+20;B(`${money(m.event.grant)} を受け取る`,ix,cy,iw,()=>{if(act({type:'grant',rank:m.rank,choice:'cash'}))modal=null;},{style:'gold'});cy+=s.btnH+18;for(const p of content.pocs.filter(p=>p.rank===m.rank&&!game.run.owned_pocs.includes(p.id)&&!game.run.surrendered_poc_ids.includes(p.id))){B(p.name,ix,cy,iw,()=>{if(act({type:'grant',rank:m.rank,choice:p.id}))modal=null;},{small:s.narrow});cy+=s.btnH+12;}
    }else if(m.kind==='inspection'){cy=checkRows(attempt(),ix,cy,iw);}else if(m.kind==='choices'){if(m.body)cy+=s.wrap(m.body,ix,cy,iw,s.small)+18;for(const item of m.items){B(item.label,ix,cy,iw,item.fn,{small:true});cy+=s.btnH+12;}}else{for(const body of m.body||[])cy+=s.wrap(body,ix,cy,iw,s.font,C.ink,1.8)+22;if(m.input){panel(ix,cy,iw,s.btnH);s.text(input.value+'▏',ix+12,cy+12,s.font,C.green);cy+=s.btnH+20;}}
    return cy-start;
  });
  if(guided)shortDialogue(s,compactFrame,portraitFrames[1],m.job.id==='JOB_E_002'?'契約書によると内蔵画面が壊れている。外部画面ドックで操作し、アプリ導入制限を外す仕事だ。管理者は施錠のまま、文書も残す。「受注する」を押そう。':'細かい契約書は今は気にしなくていい、こちらで見てある。原稿を残して管理者メニューを開く仕事だ。下の「受注する」を押そう。',{x:x+g,y:bottom+12,w:w-g*2,h:guideH-22,pose:'boss_manual'});
  let actions=m.actions||[];if(m.kind==='call')actions=[{label:callPage<m.event.pages.length-1?'続きを聞く':'電話を終える',fn:()=>{if(callPage<m.event.pages.length-1)callPage++;else if(act({type:'call',id:m.event.id})){modal=null;screen='workshop';}}}];const bw=(w-g*2-8*(actions.length-1))/Math.max(actions.length,1);actions.forEach((a,i)=>B(a.label,x+g+i*(bw+8),actionY,bw,a.fn,{style:a.danger?'danger':'primary',disabled:a.disabled}));
}
function useEquipment(item){
  const id=item.id;
  if(id==='portable'){info('携帯保全ケース','同じ端末のデータ・アプリを1台分だけ保存します。OS・権限は保存しません。',['backup','rescue','restore'].map(type=>({label:{backup:'退避',rescue:'読取専用救出',restore:'復元'}[type],fn:()=>operation({type,categories:['data','apps'],portable:true})})));return;}
  if(id==='M02'&&attempt()?.runtime.dock){openDeviceScreen();return;}
  if(id==='M01'){modal=null;if(attempt()){screen='device';deviceTab='media';physical.view=0;}return;}
  if(id==='M08'){modal={title:'複製する媒体を選ぶ',kind:'choices',items:game.run.owned_pocs.map(pocId=>({label:pocId,fn:()=>act({type:'duplicate',pocId},'2本目の媒体を机へ置きました')}))};return;}
  if(id==='M11'||id==='M15'){recordsTab='other';navigate('records');return;}
  if(id==='M12'){navigate('mail');return;}
  if(id==='M14'){openMediaShelf();return;}
  if(id==='M16'){openInspection();return;}
  const bootGuide=bootRepairStatus(game);if(bootGuide?.itemId===id&&bootGuide.operation){operation(bootGuide.operation);return;}
  const op={M02:{type:'dock'},M03:{type:'adapter'},M05:{type:'reimage',development:false},M09:{type:'update',offline:true},M13:{type:'preset'},M07:{type:'diagnose'},M10:{type:'test'}}[id];
  if(id==='M04'||id==='M06'){info(item.name,'対象を選んだ後、この機材から実行します。',[{label:'データ・アプリ・設定を退避',fn:()=>{modal=null;operation({type:id==='M06'?'rescue':'backup',categories:['data','apps','settings']});}},{label:'対象を選ぶ',fn:()=>{modal=null;screen='device';deviceTab='data';physical.view=0;}}]);return;}
  if(id==='M05'){info(item.name,'データ・アプリ・設定を消去して、同じOS版を再適用します。',[{label:'標準イメージ',fn:()=>operation(op)},{label:'開発用イメージ',fn:()=>operation({type:'reimage',development:true})}]);return;}
  if(op)operation(op);
}
function persistLayout(){const next=structuredClone(game);next.view={...next.view,layout:structuredClone(room.layout)};if(save(next))game=next;else room.layout=game.view?.layout||{};}
function timerSnapshot(){return {run:game.run.id,completed:game.run.main_completed.length,rank:game.run.rank,ending:game.run.retirement?.endingId||null,cash:game.run.cash,pocs:[...game.run.owned_pocs],equipment:[...game.run.owned_equipment],sp:game.meta.sp_total_earned,skills:[...game.run.skills]};}
function openRecovery(warning){
  info('保存データを確認してください',[warning,'壊れた保存は上書きしていません。保存ファイルを読み込むか、元の内容を書き出してから新規開始できます。'],[
    {label:'元の保存を書き出す',fn:()=>{const raw={};for(const suffix of ['head','slot:0','slot:1'])try{raw[suffix]=localStorage.getItem('jailbreakGame:v31:'+suffix);}catch(e){raw[suffix]=e.message;}download('jailbreak-recovery.json',JSON.stringify(raw,null,2));}},
    {label:'保存ファイルを読む',fn:()=>document.querySelector('#file-import').click()},
    {label:'新規開始を選ぶ',fn:()=>confirm('新規記録で置き換えます',['元の保存が必要な場合は先に書き出してください。'],()=>{storageBlocked=false;saveFault=false;const next=createGame(content,randomSeed());if(save(next)){game=next;screen='workshop';}},'新規開始',true)}
  ]);modal.recovery=true;
}
function openMediaShelf(group=null){
  const groups=[...new Set(game.run.owned_pocs.map(id=>{const p=get(content.pocs,id);return `${p.media} / ${p.family}`;}))];
  modal={title:group||'収納棚：形状・OSで絞り込む',kind:'choices',items:group?game.run.owned_pocs.map(id=>get(content.pocs,id)).filter(p=>`${p.media} / ${p.family}`===group).map(p=>({label:`${p.name} ／ ${p.media}`,fn:()=>{selected=p.id;selectedInstance=0;combo=[];modal=null;screen='workshop';}})):groups.map(label=>({label,fn:()=>openMediaShelf(label)}))};
}
function refreshPlan(){planResult=simulatePlan(planBase,planActions,content);planChoices=planningChoices(planResult.state,content,planGroup);}
function openPlanner(){if(!has('C2'))return;if(!attempt()||attempt().runtime.pending){message('処理中でない端末を作業台に置いてください。');return;}planBase=structuredClone(game);planActions=[];planGroup='operation';refreshPlan();navigate('planner');}
function planner(){
  const g=s.gap,x=g,y=headBottom()+g,w=s.W-g*2,h=footerTop()-y-g;panel(x,y,w,h);
  let yy=title('工程の仮置き',x+g,y+g,'実物・資金・保存には反映しない試算');
  if(!planResult)return;
  listRegion('planner',x+g,yy,w-g*2,h-(yy-y)-g,cy=>{const start=cy,ix=x+g,iw=w-g*2-40;
    cy+=section(`追加費用 ${money(planResult.cost)} ／ ${planActions.length} 操作`,ix,cy,iw,planResult.error||'同じ状態遷移で試算しています。購入は開放済み商品・現在の予算内です。',[
      {label:'最後の工程を外す',fn:()=>{planActions.pop();refreshPlan();},disabled:!planActions.length},
      {label:'現在の実物からやり直す',fn:()=>{planBase=structuredClone(game);planActions=[];refreshPlan();}}
    ]);
    for(const [i,step] of planResult.steps.entries()){cy+=s.wrap(`${i+1}. ${step.summary}${step.warnings.length?'\n注意：'+step.warnings.join(' / '):''}`,ix,cy,iw,s.small,step.warnings.length?C.red:C.ink,1.5)+10;}
    cy=checkRows(currentAttempt(planResult.state),ix,cy+12,iw)+20;
    const groups=[['buy','購入を追加'],['media','挿入・取出'],['operation','工程を追加']],bw=(iw-16)/3;
    groups.forEach(([id,label],i)=>B(label,ix+i*(bw+8),cy,bw,()=>{planGroup=id;refreshPlan();},{small:true,style:planGroup===id?'primary':'light'}));cy+=s.btnH+18;
    for(const choice of planChoices){B(choice.label,ix,cy,iw,()=>{planActions.push(choice.action);refreshPlan();message('試算へ追加しました。上部で終了状態を確認できます。');},{small:true,disabled:!!planResult.error});cy+=s.btnH+10;}
    return cy-start;
  });
}
function showNextMail(){
  const trial=structuredClone(game);
  const next=dispatch(trial,{type:'shuffle'},content).run.inbox.map(id=>get(content.jobs,id)).find(j=>!game.run.inbox.includes(j.id))||get(content.jobs,trial.run.inbox[0]);
  if(!next){message('次便の候補はまだありません。');return;}
  info('次便の候補：'+next.title,[next.from,next.body,'閲覧のみです。受取枠や端末は増えません。便の更新・納品後の条件で候補は変わります。']);
}
function recipeStep(){const r=attempt()?.runtime.recipe,op=r?.operations[r.index];if(!op)return;try{const q=quoteOperation(game,op,content);confirm('記録工程：'+q.summary,[`費用 ${money(q.cost)} ／ ${(q.duration/1000).toFixed(1)} 秒`,...q.warnings],()=>act({type:'recipeStep',confirmed:true}),q.cost?`${money(q.cost)} で実行`:'この工程を実行',!!q.warnings.length);}catch(e){error(e);}}
function sideMenu(){
  s.button('設定',s.W-69/s.scale,s.H-66/s.scale,62/s.scale,52/s.scale,openSettings,{style:'dark',small:true});
  if((game.run.intro?.stage??4)<4)return;
  const rail=76/s.scale,panelWidth=Math.min(s.W-rail-10/s.scale,490/s.scale),right=s.W-rail;
  shopProgress+=(Number(shopOpen)-shopProgress)*.18;
  if(Math.abs(Number(shopOpen)-shopProgress)<.001)shopProgress=Number(shopOpen);
  if(shopProgress>0){
    const x=right-panelWidth*shopProgress,y=12/s.scale,h=s.H-24/s.scale;
    s.ctx.save();s.ctx.beginPath();s.ctx.rect(0,0,right,s.H);s.ctx.clip();
    s.rect(x-6,y+5,panelWidth+6,h,'#10272150',null,8);
    // Block interactions with objects beneath the sliding panel.
    s.hotspot('購入メニュー',x,y,panelWidth,h,()=>{},'shop-background');
    room.renderPlane(()=>{terminalMode=true;shopRendering=true;catalog();if(modal)modalRender();shopRendering=false;terminalMode=false;},{x,y,w:panelWidth,h});
    s.ctx.restore();
  }
  s.rect(right,0,rail,s.H,'#173535','#50665d');
  const x=right+7/s.scale,w=rail-14/s.scale,h=54/s.scale;
  s.text('SHOP',right+rail/2,22/s.scale,12/s.scale,C.mint,700,'center');
  [['poc','PoC'],['equipment','機材']].forEach(([id,label],i)=>s.button(label,x,(58+i*69)/s.scale,w,h,()=>{if(storageBlocked)return;shopOpen=!(shopOpen&&catalogTab===id);catalogTab=id;scrolls['catalog-'+id]=0;modal=null;s.focus=-1;},{style:shopOpen&&catalogTab===id?'gold':'dark',small:true,id:'shop-'+id}));
  if(shopOpen)s.button('×',x,210/s.scale,w,46/s.scale,()=>{shopOpen=false;modal=null;},{small:true,style:'dark'});
  s.button('設定',x,s.H-66/s.scale,w,52/s.scale,openSettings,{style:'dark',small:true});
  if(game.run.book_pending.length||Object.values(game.run.chapter_grants).includes(false)){s.rect(right+rail-19/s.scale,48/s.scale,9/s.scale,9/s.scale,C.amber,null,5);}
}
function dialogueRender(){
  const m=modal,safe=(game.run.intro?.stage??4)<4?18:90,margin=18/s.scale,w=s.W-margin-safe/s.scale;
  const frame=dialogueFrame,x=margin,y=30/s.scale,fs=s.narrow?26:42;
  const pages=m.kind==='intro'?introPages:m.kind==='repair'?REPAIR_PAGES:m.event.pages;
  const final=callPage===pages.length-1;
  const shareUrl=m.kind==='story'&&final?storyShareUrl(m.event):null;
  const shareH=Math.max(48/s.scale,s.btnH);
  const text=pages[callPage];
  const formatted=text.replace(/。(?=.)/g,'。\n'),textW=w*.70,buttonH=Math.max(44/s.scale,s.btnH);
  const needed=(fs*1.9+dialogueLines(s,formatted,textW,fs).length*fs*1.4+buttonH+36)/.825;
  const h=Math.min(s.H-y-26/s.scale-(shareUrl?shareH+18/s.scale:0),Math.max(w*frame.h/frame.w,needed));
  s.hits=[];s.regions=[];
  const im=s.images.get('dialogue_frame');s.ctx.drawImage(im,frame.x,frame.y,frame.w,frame.h,x,y,w,h);
  const left=x+w*.035,titleY=y+h*.10;
  s.text(m.kind==='intro'?'工房長 — 最初の説明':'工房長',left,titleY,fs,C.green,700);
  const textY=titleY+fs*1.9,buttonY=y+h-buttonH-h*.075;
  s.wrap(formatted,left,textY,textW,fs,C.ink,1.4);
  // Draw the trimmed person after the frame, without the frame's clipping box.
  const poseId=poseBuffer(m.kind+':'+(m.event?.id||'')+':'+pages.join('|'),pages.length,phonePoses)[callPage];
  const portraitImage=s.images.get(poseId.startsWith('phone-')?'portraits':poseId);
  const portrait=poseId.startsWith('phone-')?portraitFrames[Number(poseId.slice(-1))]:{x:0,y:0,w:portraitImage.width,h:portraitImage.height};
  const ph=Math.min(h*.93+18/s.scale,w*.23*portrait.h/portrait.w),pw=ph*portrait.w/portrait.h,px=x+w*.88-pw/2,py=y+h*.93-ph;
  s.ctx.drawImage(portraitImage,portrait.x,portrait.y,portrait.w,portrait.h,px,py,pw,ph);
  const pageCount=pages.length;
  const backW=Math.min(180/s.scale,textW*.24);
  s.button('戻る',left,buttonY,backW,buttonH,()=>{callPage=Math.max(0,callPage-1);},{small:s.narrow,disabled:callPage===0,id:'dialogue-back'});
  s.button(final?(m.kind==='intro'?'契約へ':'受話器を戻す'):'続き',left+textW-Math.min(300/s.scale,textW*.48),buttonY,Math.min(300/s.scale,textW*.48),buttonH,()=>{
    if(m.kind==='intro'){if(callPage<game.run.intro.stage){callPage++;return;}if(act({type:'introNext'})){if(game.run.intro.complete){modal=null;sound.stop();jobDetail(get(content.jobs,FIRST_JOB));}else callPage=game.run.intro.stage;}}
    else if(m.kind==='repair'){if(callPage<(game.run.tutorial?.briefingPage||0)){callPage++;return;}if(act({type:'tutorialBriefingNext'})){if(final){modal=null;screen='workshop';sound.stop();}else callPage=game.run.tutorial.briefingPage;}}
    else if(!final)callPage++;
    else if(m.kind==='recovery'){modal=null;screen='workshop';sound.stop();}
    else if(m.kind==='retirement-guide'){retirementCallPending=false;returnToWorkshop();sound.stop();}
    else if(m.kind==='graduation'){if(act({type:'tutorialGraduationCall'})){returnToWorkshop();sound.stop();}}
    else if(m.kind==='wrong-purchase'){const next=finishWrongPurchaseCall(game);if(save(next)){game=next;returnToWorkshop();sound.stop();}}
    else if(m.kind==='story'){const next=finishStory(game,m.event);if(save(next)){game=next;returnToWorkshop();sound.stop();}}
    else if(m.kind==='workshop-guide'){const next=finishWorkshopLesson(game,m.event);if(save(next)){game=next;returnToWorkshop();sound.stop();if(m.event.id==='sale')saleConfirmation(get(content.pocs,m.event.pocId));}}
    else if(act({type:'call',id:m.event.id})){modal=null;screen='workshop';sound.stop();}
  },{style:'primary',small:s.narrow,id:'dialogue-next'});
  s.text(`${callPage+1} / ${pageCount}`,left+backW+18,buttonY+buttonH*.3,s.small,C.muted);
  if(shareUrl){
    // The X button is below the dialogue frame, not part of the boss's speech.
    const bw=Math.min(240/s.scale,w*.65),bx=x+(w-bw)/2,by=y+h+10/s.scale;
    const hover=s.inside(s.pointer,{x:bx,y:by,w:bw,h:shareH});
    s.rect(bx,by,bw,shareH,hover?'#242424':'#000000','#ffffff',6);
    s.text('𝕏  ポストする',bx+bw/2,by+(shareH-s.small)/2,s.small,'#ffffff',700,'center');
    s.hotspot('Xに感想を投稿する',bx,by,bw,shareH,()=>window.open(shareUrl,'_blank','noopener,noreferrer'),'story-share-x');
  }
}
function openInspection(){const a=attempt();if(!a||!inspectionVisible())return;const ok=inspect(a,content).every(r=>r.ok);modal={kind:'inspection',title:'返却前の検品',actions:[{label:ok?`返却して ${money(a.practice?0:a.job.reward)} を受け取る`:'未達条件があります',disabled:!ok||!!a.runtime.pending,fn:deliverDevice}]};}

function openDeviceScreen(){const a=attempt();if(a&&!a.device.operational){screen='device';deviceTab='service';scrolls['device-service']=0;return;}if(a&&!a.device.display&&!a.runtime.dock){message('内蔵画面が壊れています。外部画面ドックを接続してください。');return;}screen='device';}
function roomScene(){
  const a=attempt(),model=a?get(content.devices,a.hardware_model_id):null;
  const mode=screen==='phone'?'phone':screen==='workshop'?'overview':screen==='catalog'?'overview':screen==='device'?(!a?.device.operational?'pc':a.device.display?'device':a.runtime.dock?'dock':'overview'):'pc';
  if(mode==='device')physical.view=/カメラ/.test(model.base_model+' '+model.name)?4:0;
  room.begin(mode,model,a);
  room.draw({game,content,selected,combo,loadModel,ringing:phoneIncoming(),openPC:()=>navigate(lastPCScreen),openBook:kind=>{catalogTab=kind;shopOpen=true;},openPhone:openCalls,openDevice:openDeviceScreen,onPort:insert,onEject:()=>act({type:'eject'},'媒体を手で抜きました。'),onEquipment:useEquipment,onItem:(id,instance=0)=>{if(id==='device'){openDeviceScreen();return;}if(id.startsWith('P')){selected=id;selectedInstance=instance;combo=[];const p=get(content.pocs,id);message(`${p.name} ／ ${p.media}。対応する差込口へドラッグしてください。`);}else act({type:'select',attemptId:id});}});
  room.end();
  if(mode!=='overview'&&mode!=='phone')room.renderPlane(()=>{terminalMode=true;const buttons=screen==='device'?[['端末','device'],['正規窓口','service'],['契約','contract']]:[['メール','mail'],...(!a?.device.operational&&a?[['端末の修理','repair']]:[]),['記録','records'],['人事','personnel'],['設定','settings']];const bw=(s.W-24-8*(buttons.length-1))/buttons.length;buttons.forEach(([label,id],i)=>B(label,12+i*(bw+8),12,bw,()=>{if(id==='service'||id==='repair'){deviceTab='service';screen='device';if(!a.device.operational)scrolls['device-service']=0;}else if(id==='contract'&&attempt())jobDetail(attempt().job);else if(id==='device'){deviceTab='media';navigate('device');}else navigate(id);},{style:screen===id?'primary':'light',small:s.narrow,id:'nav-'+id}));({mail:mailbox,device:deviceScreen,catalog,personnel,records,settings,planner}[screen]||mailbox)();if(modal&&!shopOpen)modalRender();terminalMode=false;});
  if(mode==='overview'){
    if(!sound.ready&&(game.run.intro?.stage??4)<4)s.text('クリックすると音が鳴ります。受話器を取ってください。',28,28,s.small,C.cream,600);
    if((game.run.intro?.stage??4)>=4){s.rect(18,18,s.narrow?s.W-36:600,94,'#102e2dd9',null,6);s.image('game-logo',36,16,Math.min(s.narrow?270:360,s.W-130/s.scale),64);const cy=s.narrow?83:84,fs=s.narrow?14:21;s.text(`${money(game.run.cash)}　${game.meta.sp_total_earned} SP　信用 ${'EDCBA'[game.run.rank-1]}　${progressLabel(game)}`,36,cy,fs,C.mint);cashBounds={x:36,y:cy,w:s.measure(money(game.run.cash),fs),h:fs};}
    if(a){const width=s.narrow?s.W-36-76/s.scale:650,x=s.narrow?18:s.W-width-18-76/s.scale,y=s.H-s.btnH-20;const buttons=a.runtime.media.length?[[executeLabel(a),()=>operation({type:'poc'})],['検品',openInspection]]:[['契約を見る',()=>jobDetail(a.job)],['検品',openInspection]];const bw=(width-(buttons.length-1)*8)/buttons.length;buttons.forEach(([label,fn],i)=>label==='検品'&&!inspectionVisible()?null:B(label,x+i*(bw+8),y,bw,fn,{style:i===0?'gold':'light',small:s.narrow}));}
    if(modal&&!shopOpen)modalRender();
  }else if(mode==='phone'){if(modal)modalRender();}else {const label=modal?.returnView?'‹ 元の画面に戻る':modal?'‹ 戻る':'‹ 工房に戻る',options={style:'dark',small:s.narrow||!!modal?.returnView};B(label,18,18,s.narrow?170:240,backFromTerminal,options);B(label,18,s.H-s.btnH-22,s.narrow?170:240,backFromTerminal,options);}
}
function executeLabel(a){return a.runtime.media.length===1?names[get(content.pocs,a.runtime.media[0].pocId).axis]+'権限を解除':'媒体を実行';}
function tutorialCoach(){
  if(screen!=='workshop'||modal||shopOpen)return;
  const recovery=game.run.assistance?.active;
  if(recovery){
    const w=s.W-110/s.scale,h=Math.min(s.H*.30,Math.max(220/s.scale,w/5)),a=attempt();
    const text=recoveryInstruction(game,recovery);
    shortDialogue(s,compactFrame,portraitFrames[1],text,{x:18/s.scale,y:118/s.scale,w,h,title:'工房長 — 復旧案内'});
    if(recovery.retry||recovery.operation)B(recovery.retry?'依頼を受け直す':'復旧操作へ',18/s.scale,118/s.scale+h+12,Math.min(w,340),recoveryAction,{style:'primary',id:'recovery-action',disabled:!!a?.runtime.pending});
    return;
  }
  if(recoveryReady()){
    const w=s.W-110/s.scale,h=Math.min(s.H*.30,Math.max(220/s.scale,w/5));
    shortDialogue(s,compactFrame,portraitFrames[1],'今の操作で契約の条件が変わったな。\n戻し方を説明する。電話を取ってくれ。',{x:18/s.scale,y:118/s.scale,w,h});return;
  }
  const guide=activeGuide(),phase=guide.phase,text=guide.hint||WORKSHOP_HINTS[phase]||REPAIR_HINTS[phase];if(!text){clearShortDialogue();return;}
  const w=s.W-110/s.scale,h=Math.min(s.H*.38,Math.max(180/s.scale,shortDialogueHeight(s,text,w)));
  shortDialogue(s,compactFrame,portraitFrames[1],text,{x:18/s.scale,y:(rewardFlash&&performance.now()<rewardFlash.until?235:118)/s.scale,w,h});
  if(phase==='second-relock')B('管理者を再施錠',18/s.scale,118/s.scale+h+12,Math.min(w,340),()=>operation({type:'lock',axis:'root'}),{style:'primary',id:'guide-relock'});
}
function tutorialArrow(){
  if(modal?.kind==='choices'||modal?.kind==='grant')return;
  const phase=activeGuide().phase;
  const cash=rewardFlash&&performance.now()<rewardFlash.until&&screen==='workshop'&&!modal&&!shopOpen&&cashBounds;
  let target=null;
  if(cash){target={...cashBounds,y:cashBounds.y+cashBounds.h+25/s.scale};s.rect(190,112,Math.min(410,s.W-280),55,C.green,C.amber,6);s.text(`＋${money(rewardFlash.amount)} 入金`,204,123,s.small,C.cream,700);}
  else if(modal?.kind==='inspection'||modal?.kind==='contract')target=s.hits.find(h=>!h.disabled&&(/受注する|返却して/.test(h.label)));
  else if(modal&&(phase!=='done'||game.run.assistance?.active)){
    const guidedOperation=activeGuide().operation;
    const expectedOperation=guidedOperation?modal.operation?.type===guidedOperation.type&&modal.operation?.serviceId===guidedOperation.serviceId:['execute','second-execute'].includes(phase)?modal.operation?.type==='poc':phase==='connect-adapter'?modal.operation?.type==='adapter':phase==='second-dock'?modal.operation?.type==='dock':phase==='second-relock'?modal.operation?.type==='lock'&&modal.operation.axis==='root':false;
    const wrongOperation=modal.operation&&!game.run.assistance?.active&&phase!=='done'&&!expectedOperation;
    target=wrongOperation?s.hits.find(h=>h.id==='modal-close'):s.hits.find(h=>!h.disabled&&(/^(購入する|実行する|続き|受話器を戻す|契約へ|受け直す)$/.test(h.label)||/で実行$/.test(h.label)))||s.hits.find(h=>h.id==='modal-close');
  }
  else if(!modal){
    const guide=activeGuide(),id={'buy-type-c':'shop-poc','insert-type-c':'poc-'+guide.itemId+'-0','buy-adapter':'shop-equipment','connect-adapter':'equipment-M03','grant-catalog':'shop-poc','grant-select':'shop-poc',welcome:'phone-handset',briefing:'phone-handset','followup-call':'phone-handset','graduation-call':'phone-handset','second-dock':'equipment-M02',insert:'poc-P01-0',execute:'device-screen',eject:'inserted-media','next-order':'room-pc','buy-poc':'shop-poc','buy-equipment':'shop-equipment','second-insert':'poc-P02-0','second-execute':attempt()?.runtime.dock&&!attempt()?.device.display?'dock-screen':'device-screen','second-eject':'inserted-media','second-wrong-media':'inserted-media','second-relock':'guide-relock'}[phase];
    target=s.hits.find(h=>h.id===id);
    if(phase==='boot-service')target=s.hits.find(h=>h.id===(screen==='workshop'?'room-pc':screen==='device'?(deviceTab==='service'?'boot-fix':'nav-service'):'nav-repair'));
    if(phase==='boot-buy')target=s.hits.find(h=>h.id==='shop-equipment');
    if(phase==='preset-buy')target=s.hits.find(h=>h.id==='shop-equipment');
    if(phase==='preset-call')target=s.hits.find(h=>h.id==='phone-handset');
    if(phase==='preset-apply')target=s.hits.find(h=>h.id==='equipment-M13');
    if(phase==='profile-buy')target=s.hits.find(h=>h.id==='shop-poc');
    if(phase==='profile-call')target=s.hits.find(h=>h.id==='phone-handset');
    if(phase==='profile-insert')target=s.hits.find(h=>h.id===(selected===guide.itemId?'port-0':'poc-'+guide.itemId+'-0'));
    if(phase==='profile-execute')target=s.hits.find(h=>screen==='device'?deviceTab==='media'?h.label==='設定編集権限を解除':h.id==='nav-device':h.id==='device-screen');
    if(phase==='profile-edit')target=s.hits.find(h=>screen==='device'?deviceTab==='settings'?h.id==='setting-profile-'+guide.operation.value:h.label==='設定':h.id==='device-screen');
    if(phase==='career-personnel')target=s.hits.find(h=>h.id===(screen==='workshop'?'room-pc':'nav-personnel'));
    if(phase==='career-personnel'&&screen==='personnel')target=s.hits.find(h=>!h.disabled&&h.label==='この進路を選ぶ');
    if(['boot-rescue','boot-reimage','boot-restore'].includes(phase))target=s.hits.find(h=>h.id==='equipment-'+guide.itemId);
    if(phase==='next-order'&&screen==='mail')target=s.hits.find(h=>h.label==='契約を読む');
    if((phase==='execute'||phase==='second-execute')&&screen==='device')target=deviceTab!=='media'?s.hits.find(h=>h.id==='nav-device'):s.hits.find(h=>!h.disabled&&h.label.includes('権限を解除'));
    if(phase==='inspect'||phase==='second-inspect')target=s.hits.find(h=>h.label==='検品');
    if(shopOpen&&guide.itemId&&catalogTab===(['buy-poc','buy-type-c','profile-buy'].includes(phase)?'poc':'equipment'))target=s.hits.find(h=>h.id==='buy-'+guide.itemId);
    if(shopOpen&&['grant-catalog','grant-select'].includes(phase))target=s.hits.find(h=>h.id===(phase==='grant-catalog'?'open-catalog-':'grant-')+guide.rank);
    const recovery=game.run.assistance?.active;
    if(recovery&&!shopOpen){target=s.hits.find(h=>h.id==='recovery-action'&&!h.disabled);if(recovery.targetMediaId&&!recovery.operation)target=s.hits.find(h=>h.id===(attempt()?.runtime.media.length?'inserted-media':'poc-'+recovery.targetMediaId+'-0'));}
    else if(phoneIncoming()&&!shopOpen)target=s.hits.find(h=>h.id==='phone-handset');
  }
  if(!target)return;
  const side=target.id?.startsWith('shop-'),below=target.id==='dialogue-next'||target.label==='購入する',c=s.ctx,bob=Math.sin(performance.now()/650)*9/s.scale,x=side?target.x-10/s.scale+bob:target.x+target.w/2,tip=side?target.y+target.h/2:below?target.y+target.h+18/s.scale+bob:target.y-10/s.scale+bob,unit=(s.narrow?1:1.2)/s.scale;
  c.save();c.translate(x,tip);if(cash||below)c.rotate(Math.PI);else if(side)c.rotate(-Math.PI/2);c.scale(unit,unit);c.beginPath();c.moveTo(-13,-98);c.lineTo(13,-98);c.lineTo(13,-40);c.lineTo(36,-40);c.lineTo(0,0);c.lineTo(-36,-40);c.lineTo(-13,-40);c.closePath();c.fillStyle=C.amber;c.strokeStyle=C.navy;c.lineWidth=5;c.fill();c.stroke();c.restore();
}
function draw(){s.begin();if(!booted){s.text('工房を開いています…',s.W/2,s.H/2,s.font,C.cream,600,'center');return;}roomScene();tutorialCoach();sideMenu();tutorialArrow();if(toast&&performance.now()<toast.until){const width=Math.min(s.W-2*s.gap,s.measure(toast.text,s.small)+40),x=(s.W-width)/2,y=s.H-s.btnH-s.small*3-35;s.rect(x,y,width,s.small*2.8,toast.error?C.red:C.navy,C.amber,5);s.text(s.ellipsis(toast.text,width-30,s.small),x+15,y+s.small*.8,s.small,C.cream);}s.focusRing();if(drag?.media&&drag.moved){const p=get(content.pocs,drag.media),size=148*room.transform.scale;physical.media(p.media,s.pointer.x,s.pointer.y,size,0,'',false,p.id);}}
function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/s.scale,y:(e.clientY-r.top)/s.scale};}
canvas.addEventListener('pointerdown',e=>{if(!booted)return;unlockSound();canvas.focus();const p=point(e);s.pointer=p;const hit=s.hit(p),region=[...s.regions].reverse().find(r=>s.inside(p,r));drag={start:p,last:p,hit,region,moved:false,media:hit?.media};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{const p=point(e);s.pointer=p;if(!drag)return;if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>8)drag.moved=true;if(drag.moved&&drag.hit?.phoneHandset){phone.dragTarget=room.world(p);}else if(drag.moved&&!drag.hit?.insertedMedia&&!drag.media&&drag.region){const r=drag.region;scrolls[r.key]=Math.max(0,Math.min(r.max,(scrolls[r.key]||0)+(drag.last.y-p.y)/(r.inputScale||1)));}else if(drag.moved&&drag.hit?.worldObject&&!drag.media&&screen==='workshop'){const origin=drag.hit.objectPosition;room.move(drag.hit.worldObject,origin.x+(p.x-drag.start.x)/room.transform.scale,origin.y+(p.y-drag.start.y)/room.transform.scale);}drag.last=p;});
canvas.addEventListener('pointerup',e=>{if(!drag)return;const p=point(e),d=drag;drag=null;if(d.hit?.insertedMedia){if(!d.moved||Math.hypot(p.x-d.start.x,p.y-d.start.y)>20/s.scale)d.hit.fn();return;}if(d.hit?.phoneHandset&&d.moved){phone.dragTarget=null;openCalls();return;}if(d.media&&d.moved){selected=d.media;selectedInstance=d.hit.instance||0;const port=room.portHits?.slice().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).find(g=>Math.hypot(g.x-p.x,g.y-p.y)<56/s.scale);if(port)insert(port.index);else{const world=room.world(p);room.move(d.hit.worldObject,world.x,world.y);persistLayout();}return;}if(d.moved&&d.hit?.worldObject){persistLayout();const a=attempt();if(d.hit.equipment&&a){const world=room.world(p),pos=room.position(a.id,{x:1065,y:710});if(Math.hypot(world.x-pos.x,world.y-pos.y)<260)useEquipment(d.hit.equipment==='portable'?{id:'portable'}:get(content.equipment,d.hit.equipment));}return;}if(!d.moved){const hit=s.hit(p);if(hit&&d.hit&&hit.label===d.hit.label){sound.play('tap');hit.fn();}}});
canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=point(e),r=[...s.regions].reverse().find(r=>s.inside(p,r));if(r)scrolls[r.key]=Math.max(0,Math.min(r.max,(scrolls[r.key]||0)+e.deltaY/s.scale/(r.inputScale||1)));},{passive:false});
canvas.addEventListener('keydown',e=>{if(!booted)return;unlockSound();if(e.key==='Tab'){e.preventDefault();const n=s.hits.length;let i=s.focus;for(let a=0;a<n;a++){i=(i+(e.shiftKey?-1:1)+n)%n;if(!s.hits[i].disabled)break;}s.focus=i;announce(s.hits[i]?.label||'');}else if(e.key==='Enter'||e.key===' '){e.preventDefault();const hit=s.hits[s.focus];if(hit&&!hit.disabled)hit.fn();}else if(e.key==='Escape'){if(!storageBlocked){if(modal)closeModal();else if(shopOpen)shopOpen=false;else returnToWorkshop();}}else if(!modal&&screen==='workshop'&&e.key==='ArrowLeft'){e.preventDefault();physical.turn(-1);}else if(!modal&&screen==='workshop'&&e.key==='ArrowRight'){e.preventDefault();physical.turn(1);}else if(e.key==='PageDown'||e.key==='PageUp'){const r=s.regions.at(-1);if(r){e.preventDefault();scrolls[r.key]=Math.max(0,Math.min(r.max,(scrolls[r.key]||0)+(e.key==='PageDown'?1:-1)*r.h*.8));}}});
window.addEventListener('resize',()=>s.resize());
document.addEventListener('visibilitychange',()=>{lastTime=performance.now();if(document.hidden){sound.stop();if(booted)save(game);}});
document.querySelector('#file-import').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const next=importSave(await f.text(),content);confirm('保存データを読み込む',[`契約 ${next.run.id} ／ ${money(next.run.cash)} ／ ${next.meta.sp_total_earned} SP`,'現在の記録を置き換えます。'],()=>{storageBlocked=false;saveFault=false;if(save(next)){game=next;room.layout=game.view?.layout||{};screen='workshop';scrolls={};}},'読み込む');}catch(err){error(err);}e.target.value='';});
function loop(time){const delta=Math.min(50,Math.max(0,time-lastTime));lastTime=time;if(creditsEnding.isOpen){requestAnimationFrame(loop);return;}if(booted&&!document.hidden&&!saveFault&&game.run.attempts.some(a=>a.runtime.pending)){
  try{const before=game.run.attempts.map(a=>a.log.length).join(','),next=dispatch(game,{type:'tick',ms:delta},content),finished=before!==next.run.attempts.map(a=>a.log.length).join(',')||next.run.status!==game.run.status;if(!finished||save(next)){game=next;if(finished)sound.play('ok');}}catch(e){error(e);saveFault=true;}
  }if(booted&&recoveryReady()&&lastRecoveryRing!==recoveryIncoming(game).id){lastRecoveryRing=recoveryIncoming(game).id;lastRing=-Infinity;}if(booted){const key=phoneIncoming()?(wrongPurchaseCallPending(game)?'wrong-purchase':lessonReady()?'lesson-'+lessonReady().id:retirementCallPending?'retirement-guide':graduationPending(game)?'graduation':(game.run.intro?.stage??4)<4?'intro':game.run.pending_calls[0]|| (tutorialStatus(game).phase==='briefing'?'repair':recoveryIncoming(game)?.id||storyReady()?.id)):null;if(key!==lastIncomingKey){lastIncomingKey=key;lastRing=-Infinity;}if(key&&screen!=='phone'&&!document.hidden&&sound.ready&&time>=ringNotBefore&&time-lastRing>12000){sound.play('phone');lastRing=time;}}draw();if(booted&&time-lastAnnounce>1000){lastAnnounce=time;canvas.setAttribute('aria-label',`脱獄RTA（物理）。${screen}。所持金 ${game.run.cash}ドル。${game.run.main_completed.length}件納品。${s.hits.filter(h=>!h.disabled).map(h=>h.label).join('。')}`);}requestAnimationFrame(loop);}
requestAnimationFrame(loop);
try{
  const [c,frames,surfaces,phoneFrames,dialogFrame,portraits,shortFrame]=await Promise.all([fetch('./data/content.json').then(r=>r.json()),fetch('./assets/frames.json').then(r=>r.json()),fetch('./assets/surfaces.json').then(r=>r.json()),fetch('./assets/phone-frames.json').then(r=>r.json()),fetch('./assets/dialogue-frame.json').then(r=>r.json()),fetch('./assets/portrait-frames.json').then(r=>r.json()),fetch('./assets/dialogue-short-frame.json').then(r=>r.json())]);dialogueFrame=dialogFrame;compactFrame=shortFrame;portraitFrames=portraits;content=c;display=createDisplay(content);s.format=display.text;s.pickPortrait=text=>poseBuffer('guide:'+text,1,guidePoses)[0];physical=new Physical(s,frames,surfaces,display.map);phone=new Phone(s,phoneFrames);room=new Room(s,physical,phone);
  const loaded=loadGame(content);game=loaded.state||createGame(content,randomSeed());room.layout=game.view?.layout||{};if(!game.run.intro)game.run.intro={stage:game.run.completed.length?4:0,complete:!!game.run.completed.length};
  const terminal=game.view?.terminal;if(terminal?.run===game.run.id){lastPCScreen=['mail','personnel','records','settings','planner'].includes(terminal.lastPCScreen)?terminal.lastPCScreen:'mail';mailTab=terminal.mailTab||'inbox';recordsTab=terminal.recordsTab||'history';scrolls=terminal.scrolls||{};personnelKey=terminal.personnelKey||'';draftSkills=terminal.draftSkills||[];carryPocs=terminal.carryPocs||[];carryEquipment=terminal.carryEquipment||[];}
  try{const raw=localStorage.getItem('jailbreakGame:timer');if(raw){timer={...timer,...JSON.parse(raw)};if(timer.running)timer.reference=true;}const volume=localStorage.getItem('jailbreakGame:volume');if(volume!==null)sound.volume=Math.max(0,Math.min(1,Number(volume)||0));}catch{}
  await Promise.all(['workshop','props','equipment','portraits','boss_manual',...guidePoses,'boss_phone_think','boss_phone_happy','usb_install','phone_parts','dialogue_frame','dialogue_short',...['E','D','C','B','A'].map(g=>'devices_'+g)].map(k=>s.load(k,`./assets/${k}.${k==='workshop'?'jpg':'webp'}`)));
  await s.load('game-logo','./assets/ending/logo.webp');
  loadModel(content.devices[0]);booted=true;if(!loaded.state&&loaded.warning){storageBlocked=true;saveFault=true;openRecovery(loaded.warning);}else if(!loaded.state){save(game);message('電話が鳴っています。受話器をクリックするか、持ち上げてください。');}else if(loaded.warning)info('保存データの回復',loaded.warning);
  if(loaded.state&&!storageBlocked)act({type:'recoveryScan'});
  if(!storageBlocked&&!modal&&tutorialStatus(game).phase==='contract')jobDetail(get(content.jobs,FIRST_JOB));
}catch(e){booted=false;s.begin();announce('起動に失敗しました：'+e.message);canvas.setAttribute('aria-label',status.textContent);s.text('起動に失敗しました。配置とビルドを確認してください。',30,30,s.font,C.cream);console.error(e);}
