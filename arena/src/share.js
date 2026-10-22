import {score} from './engine.js';
export const SHARE_ARTICLE_URL='https://qiita.com/DaisukeDaisuke/items/32cf05c0d4255401b1e7';
export function resultShareText(r){
 const outcome=r.duel?(r.won?'特別闘技場で勝利！ 優勝者との一戦を制しました。':'特別闘技場で敗北。次の一手を考えて、もう一度挑戦！'):
  r.won?(r.reward===2?`金冠で優勝！ 全${r.campaign===10?10:5}戦を勝ち抜きました。`:'銀杯で優勝！ 借りた力も、自分の戦い方に。'):
  `第${r.bout+1}戦で敗北。ここまでの挑戦を次の勝利につなげよう！`;
 return `VOID PIT: BORROWED CROWN\n${outcome}\nSEED ${r.seed}\n${r.duel?'ROUND '+r.round:'SCORE '+score(r)}`;
}
export function resultShareUrl(r){
 const params=new URLSearchParams({text:resultShareText(r),url:SHARE_ARTICLE_URL});
 return 'https://twitter.com/intent/tweet?'+params.toString();
}
