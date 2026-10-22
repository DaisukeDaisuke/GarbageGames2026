import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const project=path.resolve(new URL('..',import.meta.url).pathname);
const manifest=JSON.parse(fs.readFileSync(path.join(project,'docs/image-conversion.json'),'utf8'));
const executable=spawnSync('magick',['-version']).status===0?'magick':'convert';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function convert(args){const result=spawnSync(executable,args,{maxBuffer:32*1024*1024});assert.equal(result.status,0,result.stderr?.toString()||'ImageMagick is required');return result.stdout;}
const checks=[];
for(const item of manifest.images){
 const file=path.join(project,item.file),original=path.join(project,item.original);
 assert.equal(hash(fs.readFileSync(original)),item.originalSha256);
 const [width,height]=convert([file,'-format','%w %h','info:']).toString().split(' ').map(Number);
 assert.equal(width,item.width);assert.equal(height,item.height);
 const actual=convert([file,'-depth','8','rgba:-']);assert.equal(actual.length,width*height*4);
 if(item.transparent){
  const expected=convert([original,'-depth','8','rgba:-']);
  assert.ok(actual.equals(expected),'Full RGBA pixels differ: '+item.file);
 }
 checks.push({file:item.file,sha256:hash(fs.readFileSync(file)),width,height,bytes:fs.statSync(file).size,decoded:true,...(item.transparent?{rgbaPixelsEqual:true}:{})});
}
fs.writeFileSync(path.join(project,'docs/image-quality-check.json'),JSON.stringify({date:new Date().toISOString().slice(0,10),allDecoded:true,losslessCharacters:checks.filter(x=>x.rgbaPixelsEqual).length,checks},null,2)+'\n');
console.log(`PASS ${checks.length} decoded images, original PNG hashes, and ${checks.filter(x=>x.rgbaPixelsEqual).length} original-resolution lossless RGBA matches`);
