import {C} from './draw.mjs';
const dialoguePages=new Map();
let readingShortDialogue=false;
export const shortDialogueBusy=()=>readingShortDialogue;
export const clearShortDialogue=()=>{readingShortDialogue=false;};
export function dialogueLines(s,text,width,size){
  const lines=[];
  for(const paragraph of s.format(text).split('\n')){
    let line='';
    for(const char of paragraph){if(line&&s.measure(line+char,size)>width&&!/[、。，！？）」』】]/.test(char)){lines.push(line);line='';}line+=char;}
    lines.push(line);
  }
  return lines;
}
export function conditionTable(s,rows,x,y,w){
  const widths=[.29,.29,.29,.13].map(v=>v*w),headers=['確認項目','成功条件','現在','判定'],pad=12,fs=s.small;
  const drawRow=(cells,header=false,ok=true)=>{
    const heights=cells.map((value,i)=>s.wrap(value,0,0,widths[i]-pad*2,fs,C.ink,1.5,100,true));
    const h=Math.max(fs*1.7,...heights)+pad*2;let xx=x;
    cells.forEach((value,i)=>{s.rect(xx,y,widths[i],h,header?C.green:ok?'#f6f5e9':'#fff0df',C.line);s.wrap(value,xx+pad,y+pad,widths[i]-pad*2,fs,header?C.cream:i===3&&!ok?C.red:C.ink,1.5);xx+=widths[i];});y+=h;
  };
  drawRow(headers,true);
  for(const row of rows)drawRow([row.label,row.expected,row.actual,row.ok?'✓ 達成':'未達'],false,row.ok);
  return y;
}
export function shortDialogue(s,frame,portrait,text,{x,y,w,h,title='工房長',pose=null}){
  const image=s.images.get('dialogue_short');if(!image||!frame)return;
  s.ctx.drawImage(image,frame.x,frame.y,frame.w,frame.h,x,y,w,h);
  const left=x+w*.035,tw=w*.68,fs=s.small*1.5,titleSize=s.small;
  const top=y+h*.10+titleSize*1.5,lineH=fs*1.35,lines=dialogueLines(s,text,tw,fs);
  const fullLines=Math.max(1,Math.floor((y+h*.90-top)/lineH));
  const pageLines=lines.length<=fullLines?fullLines:Math.max(1,Math.floor((y+h*.90-top-48)/lineH)),count=Math.ceil(lines.length/pageLines);
  const page=Math.min(dialoguePages.get(text)||0,count-1);
  readingShortDialogue=page<count-1;
  s.text(title,left,y+h*.10,titleSize,C.green,700);
  s.clip(left,top,tw,pageLines*lineH,()=>lines.slice(page*pageLines,(page+1)*pageLines).forEach((line,i)=>s.text(line,left,top+i*lineH,fs,C.ink)));
  if(count>1){const by=y+h*.90-44,bw=Math.min(tw*.29,160);s.button('戻る',left,by,bw,44,()=>dialoguePages.set(text,Math.max(0,page-1)),{small:true,disabled:page===0});s.text(`${page+1} / ${count}`,left+bw+12,by+9,Math.min(20,titleSize),C.muted);s.button('続き',left+tw-bw,by,bw,44,()=>dialoguePages.set(text,page+1),{small:true,style:'primary',disabled:page===count-1,id:'coach-next'});}
  const figure=s.images.get(pose||s.pickPortrait?.(text)||'boss_explain'),crop=figure?{x:0,y:0,w:figure.width,h:figure.height}:portrait;
  const ph=Math.min(h*.92+10,w*.23*crop.h/crop.w),pw=ph*crop.w/crop.h;
  s.ctx.drawImage(figure||s.images.get('portraits'),crop.x,crop.y,crop.w,crop.h,x+w*.875-pw/2,y+h*.92-ph,pw,ph);
}
export function shortDialogueHeight(s,text,w){
  const fs=s.small*1.5,lines=dialogueLines(s,text,w*.68,fs).length;
  return Math.ceil((s.small*1.5+lines*fs*1.35+12)/.8);
}
