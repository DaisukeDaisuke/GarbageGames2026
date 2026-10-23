// Extract safe rectangular screen interiors from the generated turntable art.
// This analyses pixels; it does not alter or regenerate the artwork.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/sharp`:'sharp');
const content=JSON.parse(await fs.readFile('data/content.json'));
const frames=JSON.parse(await fs.readFile('assets/frames.json'));
const sheets=new Map(),surfaces={};
for(const m of content.devices){
  const n=Number(m.id.slice(-3))-1,key=`turn_${m.grade}_${Math.floor(n/5)}`,view=/カメラ/.test(m.base_model+' '+m.name)?4:0;
  if(!sheets.has(key))sheets.set(key,await sharp(`assets/${key}.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
  const {data,info}=sheets.get(key),f=frames[key][n%5*8+view],heights=new Array(f.w).fill(0);
  let best=null;
  for(let y=0;y<f.h;y++){
    for(let x=0;x<f.w;x++){
      const i=((f.y+y)*info.width+f.x+x)*4,[r,g,b,a]=data.subarray(i,i+4);
      heights[x]=a>230&&r<108&&g<116&&b<122?heights[x]+1:0;
    }
    const stack=[];
    for(let x=0;x<=f.w;x++){
      const h=x===f.w?0:heights[x];let start=x;
      while(stack.length&&stack.at(-1).h>h){
        const p=stack.pop(),w=x-p.x,hh=p.h,xx=p.x,yy=y-hh+1;start=p.x;
        if(w<f.w*.23||hh<f.h*.13||yy>f.h*.68)continue;
        const cx=(xx+w/2)/f.w,cy=(yy+hh/2)/f.h;
        const [u,v,sw,sh]=m.screen_rect_uv;
        const score=w*hh/(1+5*Math.hypot(cx-(u+sw/2),cy-(v+sh/2)));
        if(!best||score>best.score)best={x:xx,y:yy,w,h:hh,score};
      }
      if(!stack.length||stack.at(-1).h<h)stack.push({x:start,h});
    }
  }
  surfaces[m.id]={view,screen:best?[(best.x+1)/f.w,(best.y+1)/f.h,(best.w-2)/f.w,(best.h-2)/f.h]:m.screen_rect_uv,calibrated:!!best};
}
// This front USB mouth is lower than the specification's concept coordinates.
surfaces.H_E_001.ports=[[.22,.84]];
await fs.writeFile('assets/surfaces.json',JSON.stringify(surfaces,null,2)+'\n');
console.log(`Screen interiors: ${Object.values(surfaces).filter(s=>s.calibrated).length}/100`);
