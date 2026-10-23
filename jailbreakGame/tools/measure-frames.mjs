// Find the actual connected sprite silhouettes; generated rows are not assumed
// to land on equal-sized grid cells. This only writes crop metadata.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/sharp`:'sharp');
const output={};
for(const grade of 'EDCBA')for(let batch=0;batch<4;batch++){
  const key=`turn_${grade}_${batch}`,{data,info}=await sharp(`assets/${key}.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const W=info.width,H=info.height,mask=new Uint8Array(W*H),stack=new Int32Array(W*H),components=[];
  for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>220?1:0;
  for(let i=0;i<mask.length;i++)if(mask[i]){
    let head=0,tail=1,area=0,l=W,r=0,t=H,b=0,sx=0,sy=0;stack[0]=i;mask[i]=0;
    while(head<tail){const at=stack[head++],x=at%W,y=Math.floor(at/W);area++;sx+=x;sy+=y;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
      if(x&&mask[at-1]){mask[at-1]=0;stack[tail++]=at-1;}if(x<W-1&&mask[at+1]){mask[at+1]=0;stack[tail++]=at+1;}
      if(y&&mask[at-W]){mask[at-W]=0;stack[tail++]=at-W;}if(y<H-1&&mask[at+W]){mask[at+W]=0;stack[tail++]=at+W;}
    }
    if(area>1000&&r-l>15&&b-t>25)components.push({x:l,y:t,w:r-l+1,h:b-t+1,area,cx:sx/area,cy:sy/area});
  }
  const main=components.sort((a,b)=>b.area-a.area).slice(0,40);
  let centers=Array.from({length:5},(_,i)=>(i+.5)*H/5),groups;
  for(let n=0;n<12;n++){
    groups=Array.from({length:5},()=>[]);for(const c of main){let row=0;for(let j=1;j<5;j++)if(Math.abs(c.cy-centers[j])<Math.abs(c.cy-centers[row]))row=j;groups[row].push(c);}
    centers=groups.map((g,i)=>g.length?g.reduce((v,c)=>v+c.cy,0)/g.length:centers[i]);
  }
  console.log(key,components.length,groups.map(g=>g.length).join('/'));
  if(groups.some(g=>g.length!==8))throw new Error(`${key}: cannot identify exactly eight silhouettes in each row`);
  output[key]=groups.flatMap(g=>g.sort((a,b)=>a.cx-b.cx).map(({x,y,w,h})=>({x,y,w,h})));
}
await fs.writeFile('assets/frames.json',JSON.stringify(output)+'\n');
