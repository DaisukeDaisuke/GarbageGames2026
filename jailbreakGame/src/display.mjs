// Internal identifiers are persistence keys, never player-facing names.
const labels={root:'管理者権限',install:'アプリ導入権限',feature:'設定編集権限',all:'すべての権限',theme:'配色',output:'出力先',export:'書き出し',schedule:'予定',content:'表示内容',profile:'プリセット',data:'利用者データ',apps:'アプリ',settings:'設定',standard:'標準',custom:'依頼どおり',internal:'内蔵',external:'外部',off:'禁止',local:'ローカル',locked:'固定',stock:'標準',factory:'工場出荷'};
export function buildNameMap(content){
  return Object.fromEntries(['pocs','equipment','skills','services','jobs','devices','events','endings'].flatMap(group=>(content[group]||[]).map(item=>[item.id,{kind:group,name:item.name||item.title,shortName:group==='pocs'?{root:'管理者用',install:'アプリ導入制限解除',feature:'設定編集用'}[item.axis]:item.name||item.title,...(group==='pocs'?{compatibility:`${item.family} ${item.versions.join(' / ')}`,shape:item.media,purpose:labels[item.axis]}:{})}])));
}
export function createDisplay(content){
  const map=content.display_names||buildNameMap(content);
  const keys=Object.keys(map).sort((a,b)=>b.length-a.length).map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const ids=new RegExp(`(?<![A-Za-z0-9_])(?:${keys.join('|')})(?![A-Za-z0-9_])`,'g');
  const name=id=>map[id]?.name||labels[id]||String(id??'');
  const text=value=>String(value??'').replace(ids,id=>name(id)).replace(/\b(root|install|feature|theme|output|export|schedule|content|profile|data|apps|settings|standard|custom|internal|external|off|local|locked|stock|factory)\b/g,k=>labels[k]);
  const operation=op=>{
    if(!op)return '';
    if(op.type==='poc')return op.pocId?`${name(op.pocId)}を実行`:'挿入した媒体を実行';
    if(op.type==='service')return `${name(op.serviceId)}${op.axes?'：'+op.axes.map(name).join('・'):''}`;
    if(op.type==='install'||op.type==='remove')return `${op.app}を${op.type==='install'?'導入':'削除'}`;
    if(op.type==='setting')return `${name(op.key)}を「${name(op.value)}」に変更`;
    if(op.type==='lock')return `${name(op.axis)}を再施錠`;
    if(['backup','rescue','restore'].includes(op.type))return `${(op.categories||[]).map(name).join('・')}を${{backup:'退避',rescue:'救出',restore:'復元'}[op.type]}`;
    return {reimage:`${op.development?'開発用':'標準'}イメージで初期化`,update:'通信せずにOSを更新',dock:'外部画面ドックへ中継',adapter:'USB変換器を装着',preset:'依頼のプリセットを転写',diagnose:'端末を診断',test:'端末を試運転'}[op.type]||'端末を操作';
  };
  const route=dsl=>dsl.trim().split(/\s+/).map(token=>{
    if(map[token])return `${name(token)}を実行`;
    if(token.startsWith('S:'))return operation({type:'service',serviceId:'S01',axes:token.slice(2).split('+')});
    if(token.startsWith('+')||token.startsWith('-'))return operation({type:token[0]==='+'?'install':'remove',app:token.slice(1)});
    if(token.startsWith('L:'))return operation({type:'lock',axis:token.slice(2)});
    if(/^[BQR]:/.test(token))return operation({type:{B:'backup',Q:'rescue',R:'restore'}[token[0]],categories:token.slice(2).split(',')});
    if(token.includes('=')){const [key,value]=token.split('=');return operation({type:'setting',key,value});}
    return {X:'標準イメージで初期化','X+':'開発用イメージで初期化',U:'正規窓口でOSを更新',O:'通信せずにOSを更新',fix:'正規窓口で起動を修復',screen:'画面を交換',dock:'外部画面ドックへ中継',adapter:'USB変換器を装着',preset:'依頼のプリセットを転写'}[token]||text(token);
  }).map((step,i)=>`${i+1}. ${step}`).join('\n');
  return {map,name,text,operation,route};
}
