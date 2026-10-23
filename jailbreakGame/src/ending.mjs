// Optional credits. This module never dispatches game actions or writes a save.
import {STORY_EPISODES} from './story.mjs';
import {Phone} from './phone.mjs';

export const ENDING_CREDITS=[
  {title:'Developer',lines:['GPT6 Astra','GPT6 Chat  xhigh'],photo:1},
  {title:'Story',lines:['GPT6 Chat xhigh','DaisukeDasiuke'],photo:2},
  {title:'Music',lines:['otologic','CC BY 4.0','This game uses sound sources from OtoLogic'],photo:3},
  {title:'Director',lines:['DaisukeDaisuke','GPT6 Astra','GPT6 Chat xhigh'],photo:4},
  {title:'Publisher',lines:['DaisukeDaisuke'],photo:5},
  {title:'Hosting',lines:['GitHub'],photo:6},
  {title:'SpecialThanks',lines:['You']}
];
export function endingUnlocked(state){return !!state?.meta?.story?.heard?.includes(STORY_EPISODES.at(-1).id);}
const asset=name=>new URL('../assets/'+name,import.meta.url).href;
const pick=(items,n)=>{
  const pool=[...items],chosen=[];
  while(chosen.length<n&&pool.length)chosen.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  return chosen;
};
const node=(tag,className,text)=>{
  const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;
};
function picture(src,alt,className){const img=node('img',className);img.src=src;img.alt=alt;img.decoding='async';return img;}
function load(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('エンディングの画像を読み込めませんでした'));img.src=src;});}

export function createEnding({onOpen=()=>{},onClose=()=>{}}={}){
  let current=null;
  function close(){
    if(!current)return;
    const session=current;current=null;cancelAnimationFrame(session.frame);
    session.events.abort();session.dialog.close();session.dialog.remove();onClose();
  }
  function open(){
    if(current)return;
    const dialog=node('dialog','ending-overlay');dialog.setAttribute('aria-label','片桐工房 エンディング');
    const scene=node('canvas','ending-scene');scene.setAttribute('aria-hidden','true');
    const shade=node('div','ending-shade'),viewport=node('div','ending-scroll');viewport.tabIndex=0;viewport.setAttribute('aria-label','エンドクレジット');
    const roll=node('div','ending-roll');
    const logo=picture(asset('ending/logo.webp'),'脱獄RTA（物理） 片桐工房','ending-logo');roll.append(logo);
    for(const credit of ENDING_CREDITS){
      const block=node('section','ending-credit');block.append(node('h2','',credit.title));
      for(const line of credit.lines)block.append(node('p','',line));
      roll.append(block);
      if(credit.photo){
        const frame=node('figure','ending-photo');frame.append(picture(asset(`ending/photo-${credit.photo}.webp`),`制作写真 ${credit.photo}`));roll.append(frame);
      }
    }
    viewport.append(roll);
    const controls=node('div','ending-controls'),pause=node('button','','一時停止'),exit=node('button','ending-close','閉じる ×');
    pause.type=exit.type='button';exit.setAttribute('aria-label','エンディングを閉じる');controls.append(pause,exit);
    const status=node('p','ending-status');status.setAttribute('role','status');
    dialog.append(scene,shade,viewport,controls,status);document.body.append(dialog);
    const session={dialog,events:new AbortController(),frame:0,elapsed:0,last:0,position:0,paused:false,finished:false,images:null};
    current=session;
    const listen=(target,type,handler,options={})=>target.addEventListener(type,handler,{...options,signal:session.events.signal});
    const setPaused=value=>{session.paused=value;session.position=viewport.scrollTop;pause.textContent=session.finished?'もう一度見る':value?'再生':'一時停止';pause.setAttribute('aria-pressed',String(value));};
    listen(exit,'click',close);
    listen(dialog,'cancel',e=>{e.preventDefault();close();});
    listen(pause,'click',()=>{
      if(session.finished){session.finished=false;session.elapsed=0;session.position=0;viewport.scrollTop=0;setPaused(false);}
      else setPaused(!session.paused);
    });
    listen(viewport,'wheel',()=>setPaused(true),{passive:true});
    listen(viewport,'touchstart',()=>setPaused(true),{passive:true});
    listen(viewport,'pointerdown',()=>setPaused(true));
    listen(dialog,'keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();close();return;}
      if(e.key===' '&&e.target.tagName!=='BUTTON'){e.preventDefault();pause.click();}
      if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(e.key))setPaused(true);
      e.stopPropagation();
    });
    const media=pick([4,5,6,7],3);
    const devices=pick(Array.from({length:100},(_,i)=>({sheet:'devices_'+['E','D','C','B','A'][Math.floor(i/20)],index:i%20})),3);
    function drawScene(){
      const w=dialog.clientWidth,h=dialog.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
      if(scene.width!==Math.round(w*dpr)||scene.height!==Math.round(h*dpr)){scene.width=Math.round(w*dpr);scene.height=Math.round(h*dpr);}
      const ctx=scene.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#132e30';ctx.fillRect(0,0,w,h);
      const imgs=session.images;if(!imgs)return;
      // Match Room.begin('overview') and the permanent desk props exactly.
      const k=Math.min(w/1672,h/941);ctx.save();ctx.translate(w/2-836*k,h/2-470*k);ctx.scale(k,k);
      ctx.drawImage(imgs.workshop,0,0,1672,941);
      const alphaAt=delay=>Math.min(1,Math.max(0,(session.elapsed-delay)/1500));
      const sprite=(sheet,index,cols,rows,x,y,width,height,delay)=>{
        const alpha=alphaAt(delay);if(!alpha)return;
        const img=imgs[sheet],sw=img.width/cols,sh=img.height/rows;
        const fit=Math.min(width/sw,height/sh);
        ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(img,(index%cols)*sw,Math.floor(index/cols)*sh,sw,sh,x+(width-sw*fit)/2,y+(height-sh*fit)/2,sw*fit,sh*fit);ctx.restore();
      };
      const shadow=(x,y,rx,ry,delay)=>{ctx.save();ctx.globalAlpha=.3*alphaAt(delay);ctx.fillStyle='#100d06';ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();};
      shadow(600,776,80,13,1200);
      ctx.save();ctx.globalAlpha=alphaAt(1200);session.phone.draw({ringing:false,picked:false,open:()=>{}});ctx.restore();
      shadow(278,779,205,25,2400);sprite('props',0,4,2,58,449,450,360,2400);
      media.forEach((index,i)=>sprite('props',index,4,2,793+i*89,775,74,74,3700+i*650));
      devices.forEach((d,i)=>sprite(d.sheet,d.index,5,4,780+i*260,460,260,260,5600+i*750));
      ctx.restore();
    }
    function frame(time){
      if(current!==session)return;
      const dt=session.last?Math.min(80,time-session.last):0;session.last=time;
      if(!document.hidden&&!session.paused&&session.images){
        session.elapsed+=dt;
        if(session.elapsed>=9000){
          const max=viewport.scrollHeight-viewport.clientHeight;
          session.position=Math.min(max,session.position+dt*.0304);viewport.scrollTop=session.position;
          if(max>0&&session.position>=max){session.finished=true;setPaused(true);}
        }
      }
      drawScene();session.frame=requestAnimationFrame(frame);
    }
    dialog.showModal();exit.focus();onOpen();session.frame=requestAnimationFrame(frame);
    const names=['workshop','props','phone_parts',...new Set(devices.map(d=>d.sheet))];
    Promise.all([
      Promise.all(names.map(async name=>[name,await load(asset(name+(name==='workshop'?'.jpg':'.webp')))])),
      Promise.all([...roll.querySelectorAll('img')].map(img=>img.decode())),
      fetch(asset('phone-frames.json')).then(r=>{if(!r.ok)throw new Error('電話の画像情報を読み込めませんでした');return r.json();})
    ]).then(([images,,phoneFrames])=>{if(current!==session)return;session.images=Object.fromEntries(images);session.phone=new Phone({ctx:scene.getContext('2d'),images:new Map(images),hotspot:()=>{}},phoneFrames);}).catch(err=>{
      if(current!==session)return;status.textContent=err.message;setPaused(true);
    });
  }
  return {open,close,get isOpen(){return !!current;}};
}
