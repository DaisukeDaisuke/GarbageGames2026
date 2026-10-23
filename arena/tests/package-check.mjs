import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]),project=path.resolve(new URL('..',import.meta.url).pathname);
const manifest=JSON.parse(fs.readFileSync(path.join(project,'docs/build-manifest.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,manifest.files.app),'utf8');
const css=fs.readFileSync(path.join(root,manifest.files.css),'utf8');
assert.equal(manifest.version,5);assert.ok(Buffer.byteLength(html)<4096);
assert.ok(Buffer.byteLength(app)<256*1024);assert.ok(Buffer.byteLength(css)<40*1024);
assert.ok(!/<style|<script\s*>/.test(html));assert.ok(!/(data:image|data:audio|;base64,)/.test(html+app+css));
assert.ok(!app.includes('scaleFontCss'));assert.ok(!css.includes('font-size:35px'));
assert.equal(Object.keys(manifest.assetFiles).length,64);
const imageFiles=Object.values(manifest.assetFiles);
const shippedMedia=fs.readdirSync(path.join(root,'assets'),{recursive:true}).filter(file=>fs.statSync(path.join(root,'assets',file)).isFile()).map(file=>'assets/'+file.replaceAll(path.sep,'/'));
assert.deepEqual(shippedMedia.sort(),Object.keys(manifest.media).sort(),'Publish directory contains obsolete or unexpected media');
assert.equal(imageFiles.filter(file=>file.endsWith('.jpg')).length,33);
assert.equal(imageFiles.filter(file=>file.endsWith('.webp')).length,31);
for(const file of imageFiles.filter(x=>x.endsWith('.jpg')))assert.ok(manifest.media[file].bytes<=80000,file+' exceeds 80KB');
for(const [file,record] of Object.entries(manifest.media)){
 const bytes=fs.readFileSync(path.join(root,file));assert.equal(bytes.length,record.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256);
 if(file.endsWith('.webp')){assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes.includes(Buffer.from('VP8L')),'Must contain lossless pixels: '+file);}
 if(file.endsWith('.jpg')){assert.equal(bytes.readUInt16BE(0),0xffd8);assert.equal(bytes.readUInt16BE(bytes.length-2),0xffd9);}
}
const ui=spawnSync(process.execPath,[path.join(project,'tests/ui-check.mjs')],{encoding:'utf8',env:{...process.env,ARENA_BUILT_APP:path.join(root,manifest.files.app)}});
assert.equal(ui.status,0,ui.stdout+'\n'+ui.stderr);
const initial=JSON.parse(ui.stdout.match(/^INITIAL_RESOURCE_MODEL (.+)$/m)[1]);
assert.equal(initial.images.length,2);assert.equal(initial.audio.length,0);
assert.deepEqual(initial.images.map(x=>x.split('?')[0]).sort(),['./assets/arena-background.jpg','./assets/void-knight.webp']);
assert.ok(!initial.images.some(x=>/skills\/|items\//.test(x)));
const layout=spawnSync(process.execPath,[path.join(project,'tests/layout-check.mjs')],{encoding:'utf8',env:{...process.env,ARENA_BUILT_CSS:path.join(root,manifest.files.css)}});
assert.equal(layout.status,0,layout.stdout+'\n'+layout.stderr);
const requests=[];
const server=http.createServer((req,res)=>{
 const parsed=new URL(req.url,'http://localhost'),prefix='/Garbage2026/arena/';
 if(!parsed.pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
 const relative=decodeURIComponent(parsed.pathname.slice(prefix.length))||'index.html';
 if(relative.split('/').includes('..')){res.writeHead(403);res.end();return;}
 const file=path.join(root,relative);requests.push(relative);
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.jpg')?'image/jpeg':'text/html'});res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 const base=`http://127.0.0.1:${server.address().port}/Garbage2026/arena/`;
 const initialUrls=['./index.html',...html.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g)].map(x=>Array.isArray(x)?x[1]:x).concat(initial.images);
 let total=0;
 for(const url of initialUrls){const response=await fetch(new URL(url,base));assert.equal(response.status,200,url);total+=(await response.arrayBuffer()).byteLength;}
 assert.equal(total,manifest.initialUncompressedBytes);assert.equal(requests.length,6);
 assert.ok(total<1000000,'Initial resource budget exceeds 1MB with original-resolution character');
 assert.ok(!requests.some(x=>x.endsWith('.png')||x.endsWith('.mp3')||x.includes('qualifier-worker')||x.includes('skills/')||x.includes('items/')));
 console.log(`PASS rebuilt app UI handlers and CSS / HTTP subdirectory links / 33 JPEG <= 80KB + 31 lossless WebP / home resource model: ${requests.length} files, ${total} bytes, no skill/equipment/audio preloads`);
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
