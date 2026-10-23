import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/sharp`:'sharp');
const source='art-source/phone_parts.png';
await sharp(source).webp({lossless:true}).toFile('assets/phone_parts.webp');
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const frames=[];
for(let part=0;part<2;part++){
  let l=info.width,t=info.height,r=0,b=0;
  for(let y=0;y<info.height;y++)for(let x=Math.floor(part*info.width/2);x<Math.floor((part+1)*info.width/2);x++)if(data[(y*info.width+x)*4+3]>220){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  frames.push({x:l,y:t,w:r-l+1,h:b-t+1});
}
await fs.writeFile('assets/phone-frames.json',JSON.stringify(frames)+'\n');
