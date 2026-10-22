import {formatStatement} from '../source/core.mjs';
const frame=document.getElementById('game'),summary=document.getElementById('summary'),log=document.getElementById('log');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const doc=()=>frame.contentDocument;
const el=id=>doc().getElementById(id);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function until(predicate,message,timeout=7000){const start=performance.now();while(!predicate()){if(performance.now()-start>timeout)throw new Error(message);await sleep(12);}}
const click=id=>el(id).click();
const seen=new Set();let data,inputs=0;
const write=text=>{log.textContent+=text+'\n';summary.textContent=`検証中: ${seen.size} / 225通り`;};
async function start(){await until(()=>el('start')&&!el('start').disabled,'開始ボタン');click('start');await until(()=>el('nouns').children.length>0&&!el('nouns').children[0].disabled,'選択待ち');}
async function reload(){await new Promise(resolve=>{frame.addEventListener('load',resolve,{once:true});frame.src=frame.src;});}
async function reaction(scene,p){
  const options=(id,value)=>[...el(id).querySelectorAll('button')].find(button=>button.textContent===value);
  assert(el('enemy-name').textContent===scene.name,'敵名');
  options('nouns',p.noun).click();options('verbs',p.verb).click();
  if(scene.attributes){assert(el('speak').disabled,'中央未選択では確定不可');options('attributes',p.attribute===''?'空欄':p.attribute).click();}
  assert(!el('speak').disabled,'確定可能');assert(el('statement').textContent===formatStatement(scene,p),'合成文');
  click('speak');inputs++;
  const expected=p.script.split('<Page>').map(part=>part.replace(/<[^>]*>/g,''));let pages=[];let hpBefore;
  for(let i=0;i<expected.length;i++){
    await until(()=>!el('continue').hidden,'反応の停止点');
    pages.push(el('dialogue-text').textContent);hpBefore=el('hp-text').textContent;
    assert(el('speak').disabled,'本文中は確定不可');assert([...doc().querySelectorAll('.word')].every(button=>button.disabled),'本文中は語句ロック');
    click('continue');await sleep(0);
  }
  assert(JSON.stringify(pages)===JSON.stringify(expected),`専用台詞不一致 ${scene.id}:${p.noun}/${p.verb}`);
  if(p.script.endsWith('<fault>')){
    assert(!el('fault-notice').hidden,'失敗表示');assert(el('hp-text').textContent==='HP 100 / 100','失敗でHP不変');assert([...doc().querySelectorAll('.word')].every(button=>button.getAttribute('aria-pressed')==='false'),'選択解除');assert(el('speak').disabled,'再入力時は未選択');
  }else assert(hpBefore===(p.script.includes('<damage=')?'HP 0 / 100':'HP 100 / 100'),'ダメージ確定');
  seen.add(JSON.stringify([scene.id,p.noun,p.attribute,p.verb]));write(`PASS ${scene.id+1} ${p.noun} / ${p.attribute??''} / ${p.verb}`);
}
async function finish(expected){
  for(let i=0;i<4&&el('results').hidden;i++){await until(()=>!el('continue').hidden,'帰宅の結末待機');click('continue');await sleep(0);}
  assert(el('results').querySelector('h2').textContent===expected+'体撃破','撃破数');
  assert(el('results').querySelectorAll('.result-time').length===10,'10体の所要時間');
  assert([...el('results').querySelectorAll('.result-time')].every(x=>/\d+時間\d+分\d+秒/.test(x.textContent)),'時間分秒表示');
  assert(el('results').querySelector('.result-time').textContent.startsWith(expected===9?'通過まで':'撃破まで'),'通過と撃破の時間区別');
  const share=el('share-x'),url=new URL(share.href);
  assert(share.textContent==='X'&&share.target==='_blank'&&share.rel.includes('noopener'),'Xリンクの表示と別タブ');
  assert(url.origin==='https://x.com'&&url.pathname==='/intent/tweet','公式投稿UI');
  assert(url.searchParams.get('url')==='https://qiita.com/DaisukeDaisuke/items/32cf05c0d4255401b1e7','添付記事URL');
  assert(url.searchParams.get('text').includes(expected+'体撃破'),'共有文の結果');assert(url.searchParams.get('text').includes('#Qiitaアベントカレンダー'),'必須ハッシュタグ');
  for(let i=0;i<4&&el('restart').hidden;i++){await until(()=>!el('continue').hidden,'結末待機');click('continue');await sleep(0);}
  assert(!el('restart').hidden,'再開始');
}
document.querySelectorAll('[data-width]').forEach(button=>button.addEventListener('click',()=>{frame.style.width=button.dataset.width+'px';summary.textContent='表示幅 '+button.dataset.width+'px';}));
document.getElementById('reload').addEventListener('click',()=>{frame.src=frame.src;});
document.getElementById('run').addEventListener('click',async event=>{
  event.currentTarget.disabled=true;seen.clear();inputs=0;log.textContent='';
  try{
    await reload();await start();data=JSON.parse(el('scenario').textContent);
    // Exercise the real rendered buttons and compare every displayed reaction to the supplied script.
    for(const scene of data.scenes){
      for(const p of scene.patterns.filter(p=>p.script.endsWith('<fault>')))await reaction(scene,p);
      await reaction(scene,scene.id===7?scene.patterns.find(p=>p.noun==='私'&&p.attribute==='攻撃力'&&p.verb==='0です'):scene.patterns.find(p=>p.script.includes('<damage=')));
    }
    await finish(10);
    assert([...el('results').querySelectorAll('small')].map(x=>x.textContent).join(',')===data.scenes.map(s=>`失敗 ${s.patterns.filter(p=>p.script.endsWith('<fault>')).length}回`).join(','),'全211失敗の集計');
    click('restart');await reaction(data.scenes[0],data.scenes[0].patterns.find(p=>p.noun==='同意'&&p.verb==='しない'));
    await reload();await start();
    await reaction(data.scenes[0],data.scenes[0].patterns.find(p=>p.noun==='同意'&&p.verb==='する'));
    for(const scene of data.scenes.slice(1))await reaction(scene,scene.id===4?scene.patterns.find(p=>p.noun==='私'&&p.verb==='同意しません'):scene.id===7?scene.patterns.find(p=>p.noun==='君'&&p.attribute==='守備力'&&p.verb==='0です'):scene.patterns.find(p=>p.script.includes('<damage=')));
    await finish(9);
    click('spec-open');assert(el('spec-dialog').open,'仕様書モーダル');assert(el('spec-text').textContent===JSON.parse(el('specification').textContent),'仕様書原文');click('spec-close');assert(!el('spec-dialog').open,'仕様書を閉じる');
    assert(seen.size===225,'全225通り');
    click('achievements-open');assert(el('achievements-dialog').open,'実績モーダル');
    let tried=0;for(let index=0;index<data.scenes.length;index++){
      el('map-stages').children[index].click();
      for(let attribute=0;attribute<(data.scenes[index].attributes?.length??1);attribute++){
        if(data.scenes[index].attributes)el('map-attributes').children[attribute].click();
        tried+=el('achievement-grid').querySelectorAll('.tried').length;
      }
    }
    assert(tried===225,'再開始・再読込後も全試行の実績を保持');
    el('map-stages').children[1].click();
    const love=[...el('achievement-grid').querySelectorAll('button')].find(b=>b.getAttribute('aria-label').startsWith('「ラブレター」は「食べます」'));
    love.focus();assert(el('map-dialogue').textContent==='隠し持っていたラブレターを食べた。あまりおいしくなかった','実績から台詞を再読');click('achievements-close');
    summary.textContent=`PASS: 全225通りの実入力と台詞一致 / ${inputs}回の確定 / 全211失敗の集計 / 10体・9体の両エンディング / 全10体の時間表示 / 実績永続化と台詞再読 / 仕様書モーダル / X共有リンク`;
    summary.dataset.result='passed';
  }catch(error){summary.textContent='FAIL: '+error.message;summary.dataset.result='failed';console.error(error);}
  finally{document.getElementById('run').disabled=false;}
});
