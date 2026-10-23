import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/sharp`:'sharp');
const source=process.argv[2]||'art-source/dialogue_short.png';
await sharp(source).webp({lossless:true}).toFile('assets/dialogue_short.webp');
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let l=info.width,t=info.height,r=0,b=0;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>220){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
await fs.writeFile('assets/dialogue-short-frame.json',JSON.stringify({x:l,y:t,w:r-l+1,h:b-t+1})+'\n');
