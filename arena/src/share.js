import {score} from './engine.js';
export const SHARE_ARTICLE_URL='https://qiita.com/DaisukeDaisuke/items/32cf05c0d4255401b1e7';
export function resultShareText(r){
 const outcome=r.duel?(r.won?'特別闘技場で勝利！':'特別闘技場で敗北'):
  r.won?(r.reward===2?'金冠で優勝！':'銀杯で優勝！'):
  `第${r.bout+1}戦で敗北`;
 return `VOID PIT\n${outcome}\nSEED ${r.seed}\n${r.duel?'ROUND '+r.round:'SCORE '+score(r)}\n#Qiitaアベントカレンダー`;
}
export function resultShareUrl(r){
 const params=new URLSearchParams({text:resultShareText(r),url:SHARE_ARTICLE_URL});
 return 'https://twitter.com/intent/tweet?'+params.toString();
}
