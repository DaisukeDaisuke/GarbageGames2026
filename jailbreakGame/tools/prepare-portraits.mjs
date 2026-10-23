import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/sharp`:'sharp');
const {data,info}=await sharp('assets/portraits.webp').ensureAlpha().raw().toBuffer({resolveWithObject:true}),frames=[];
for(let i=0;i<3;i++){
  const x0=Math.round(i*info.width/3),x1=Math.round((i+1)*info.width/3);let l=x1,t=info.height,r=x0,b=0;
  for(let y=0;y<info.height;y++)for(let x=x0;x<x1;x++)if(data[(y*info.width+x)*4+3]>220){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  frames.push({x:l,y:t,w:r-l+1,h:b-t+1});
}
await fs.writeFile('assets/portrait-frames.json',JSON.stringify(frames)+'\n');
