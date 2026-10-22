import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {EXTRA_ENEMIES} from '../src/engine.js';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const prompts=JSON.parse(fs.readFileSync('docs/expansion-prompts.json','utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const modern=spawnSync('magick',['-version']).status===0;
const images=[];
for(const enemy of EXTRA_ENEMIES){
 const id=enemy.name.toLowerCase().replaceAll(' ','-'),original=`originals/expansion/${id}.png`,file=`assets/${id}.webp`;
 const args=['-limit','thread','1','-path','assets','-format','webp','-quality','100','-define','webp:lossless=true','-define','webp:method=6','-define','webp:exact=true',original];
 const converted=spawnSync(modern?'magick':'mogrify',modern?['mogrify',...args]:args,{encoding:'utf8'});
 if(converted.status!==0)throw Error(converted.stderr);
 const dimensions=spawnSync(modern?'magick':'identify',modern?['identify','-format','%w %h %[opaque]',original]:['-format','%w %h %[opaque]',original],{encoding:'utf8'});
 if(dimensions.status!==0)throw Error(dimensions.stderr);
 const [width,height,opaque]=dimensions.stdout.trim().split(' ');
 if(opaque.toLowerCase()==='true')throw Error('Sprite has no transparent pixels: '+original);
 const originalBytes=fs.readFileSync(original),bytes=fs.readFileSync(file);
 images.push({id,original,runtimeFile:file,file,format:'WebP',transparent:true,quality:100,filter:'none',width:+width,height:+height,bytes:bytes.length,originalBytes:originalBytes.length,originalSha256:hash(originalBytes),sha256:hash(bytes),lossless:true,method:6,exact:true,prompt:prompts.images.find(x=>x.id===id).prompt});
 console.log(`${file}: ${bytes.length} bytes; ${width}x${height}, lossless RGBA`);
}
fs.writeFileSync('docs/expansion-art.json',JSON.stringify({style:'16-bit coarse pixel art',generation:'built-in imagegen',images},null,2)+'\n');
const manifest=JSON.parse(fs.readFileSync('docs/image-conversion.json','utf8'));
manifest.images=manifest.images.filter(x=>!images.some(y=>y.file===x.file)).concat(images);
manifest.totalBytes=manifest.images.reduce((sum,x)=>sum+x.bytes,0);
fs.writeFileSync('docs/image-conversion.json',JSON.stringify(manifest,null,2)+'\n');
