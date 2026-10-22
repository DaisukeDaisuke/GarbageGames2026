#!/usr/bin/env bash
set -euo pipefail
# Usage: bash arena/build.sh [output-root] [--verify] [--compress-images]
project_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
output_root="$project_dir/dist"
verify=0
compress_images=0
for arg in "$@"; do
  if [[ "$arg" == "--verify" ]]; then verify=1
  elif [[ "$arg" == "--compress-images" ]]; then compress_images=1
  elif [[ "$arg" == /* ]]; then output_root="$arg"
  else output_root="$PWD/$arg"
  fi
done
cd "$project_dir"
command -v node >/dev/null || { echo 'Node.js 20 or later is required.' >&2; exit 1; }
if [[ "$compress_images" == 1 ]]; then
  if command -v magick >/dev/null; then image_command=(magick mogrify)
  elif command -v mogrify >/dev/null; then image_command=(mogrify)
  else echo 'ImageMagick is required for --compress-images.' >&2; exit 1
  fi
  ARENA_MOGRIFY_BIN="${image_command[0]}" ARENA_MOGRIFY_SUBCOMMAND="${image_command[1]:-}" node --input-type=module <<'IMAGES'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const previous=JSON.parse(fs.readFileSync('docs/image-conversion-lossless.json','utf8'));
const sources=[...previous.images.filter(image=>image.original!=='originals/skills/wait.png'),JSON.parse(fs.readFileSync('docs/algorithm-arena-source.json','utf8')),...JSON.parse(fs.readFileSync('docs/challenger-art.json','utf8')).images,JSON.parse(fs.readFileSync('docs/meditation-art.json','utf8'))];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'arena-images-'));
const executable=process.env.ARENA_MOGRIFY_BIN,subcommand=process.env.ARENA_MOGRIFY_SUBCOMMAND;
const images=[],maxBytes=80000;
try{
 for(const original of sources){
  const source=original.original,stem=path.basename(source,'.png');
  const transparent=!source.includes('/skills/')&&!source.includes('/items/')&&!['arena-background','algorithm-arena','dialogue-frame'].includes(stem);
  const extension=transparent?'webp':'jpg',file=original.runtimeFile||source.replace(/^originals\//,'assets/').replace(/\.png$/,'.'+extension);
  const originalBytes=fs.readFileSync(source);
  if(hash(originalBytes)!==original.originalSha256)throw Error('Original PNG changed: '+source);
  const widths=stem==='dialogue-frame'?[1024,896,768,640,512]:[640,576,512,480,448,416,384];
  function encode(width,quality){
   const options=['-limit','thread','1','-path',temp];
   if(transparent)options.push('-quality','100','-define','webp:lossless=true','-define','webp:method=6','-define','webp:exact=true');
   else options.push('-filter','point','-resize',width+'x'+width+'>','-strip','-quality',String(quality),'-sampling-factor','4:4:4','-interlace','Plane');
   options.push('-format',extension,source);
   const result=spawnSync(executable,subcommand?[subcommand,...options]:options,{encoding:'utf8'});
   if(result.status!==0)throw Error(result.stderr||'ImageMagick failed');
   return fs.readFileSync(path.join(temp,stem+'.'+extension));
  }
  let selected=transparent?{width:Math.max(original.width,original.height),quality:100,bytes:encode(null,100)}:null;
  for(const width of transparent?[]:widths){
   let best=encode(width,80);if(best.length>maxBytes)continue;
   let quality=80,low=81,high=92;
   while(low<=high){const trial=Math.floor((low+high)/2),bytes=encode(width,trial);if(bytes.length<=maxBytes){quality=trial;best=bytes;low=trial+1;}else high=trial-1;}
   selected={width,quality,bytes:best};break;
  }
  if(!selected)throw Error('Cannot meet image budget: '+source);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,selected.bytes);
  const ratio=Math.min(1,selected.width/Math.max(original.width,original.height));
  images.push({original:source,file,format:extension==='jpg'?'JPEG':'WebP',transparent,quality:selected.quality,filter:transparent?'none':'point',width:Math.round(original.width*ratio),height:Math.round(original.height*ratio),bytes:selected.bytes.length,originalBytes:originalBytes.length,previousLosslessBytes:original.webpBytes,originalSha256:original.originalSha256,sha256:hash(selected.bytes),...(transparent?{lossless:true,method:6,exact:true}:{samplingFactor:'4:4:4',progressive:true})});
  if(original.file!==file&&fs.existsSync(original.file))fs.unlinkSync(original.file);
  console.log(`${file}: ${selected.bytes.length} bytes, ${images.at(-1).width}x${images.at(-1).height}, quality ${selected.quality}`);
 }
 const totalBytes=images.reduce((n,image)=>n+image.bytes,0);
 fs.writeFileSync('docs/image-conversion.json',JSON.stringify({version:3,jpegMaxBytes:maxBytes,characters:'full-resolution lossless WebP; no size cap',encoder:'ImageMagick mogrify',originalsRetained:true,totalBytes,images},null,2)+'\n');
 console.log(`Converted ${images.length} images: ${totalBytes} bytes total; JPEG <= ${maxBytes} bytes, characters lossless at original resolution.`);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
IMAGES
  node tests/image-check.mjs
fi
if [[ "$verify" == 1 ]]; then
  command -v g++ >/dev/null || { echo 'g++ is required for --verify.' >&2; exit 1; }
  verify_dir="$(mktemp -d)"
  trap 'rm -rf -- "$verify_dir"' EXIT
  native=vendor/arena-cli
  # Preserve the original vendor; the comparison fixture changes only wait's requested healing data.
  ARENA_VERIFY_DIR="$verify_dir" node --input-type=module <<'ORACLE_DATA'
import fs from 'node:fs';
import path from 'node:path';
const original=fs.readFileSync('vendor/arena-cli/data.cpp','utf8');
const before='skill("wait", "待機", "防御せずMP+6", 0, {fx(Opcode::RestoreMP, 6)})';
const after='skill("wait", "めいそう", "防御せずHP+15・MP+6", 0, {fx(Opcode::Heal, 15), fx(Opcode::RestoreMP, 6)})';
if(original.split(before).length!==2)throw Error('Original wait fixture changed');
fs.writeFileSync(path.join(process.env.ARENA_VERIFY_DIR,'data.cpp'),original.replace(before,after));
ORACLE_DATA
  g++ -std=c++17 -O2 -I "$native" tests/oracle.cpp "$native/battle.cpp" "$verify_dir/data.cpp" "$native/effects.cpp" "$native/effects_extra.cpp" -o "$verify_dir/oracle"
  ARENA_ORACLE="$verify_dir/oracle" node tests/check.mjs
  g++ -std=c++17 -O2 "$native/main.cpp" "$native/battle.cpp" "$native/data.cpp" "$native/effects.cpp" "$native/effects_extra.cpp" "$native/session.cpp" "$native/ui.cpp" "$native/tests.cpp" -o "$verify_dir/original"
  "$verify_dir/original" --self-test --plain
else
  node tests/check.mjs
fi
node tests/ui-check.mjs
node tests/layout-check.mjs
ARENA_OUTPUT_ROOT="$output_root" node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {REQUIREMENTS} from './src/requirements.js';
import {CHALLENGER_CHARACTERS} from './src/arena/characters.js';
const read=p=>fs.readFileSync(p,'utf8'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const strip=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const out=path.join(process.env.ARENA_OUTPUT_ROOT,'arena');fs.mkdirSync(out,{recursive:true});
for(const entry of fs.readdirSync(out))if(/^(app|style|qualifier-worker|dragscroll)\.[a-f0-9]{12}\.(js|css)$/.test(entry))fs.unlinkSync(path.join(out,entry));
const writeHashed=(name,extension,content)=>{const file=name+'.'+sha(content).slice(0,12)+'.'+extension;fs.writeFileSync(path.join(out,file),content);return file;};
const data='const DATA='+read('src/data.json')+';\n',engine=strip(read('src/engine.js')),policies=strip(read('src/arena/strategies.js'))+strip(read('src/policies.js'));
const worker=data+engine+policies+`\nlet started=false;onmessage=()=>{if(started)return;started=true;let i=0;const jobs=POLICIES.flatMap((_,p)=>TRIAL_SEEDS.map((s,t)=>[p,t+1,s]));const tick=()=>{if(i>=jobs.length){close();return;}try{postMessage(runTrial(...jobs[i++]));setTimeout(tick,0);}catch(error){postMessage({error:error.message});close();}};tick();};`;
new vm.Script(worker);
const workerFile=writeHashed('qualifier-worker','js',worker);
const gameData=JSON.parse(read('src/data.json')),details=JSON.parse(read('src/details.json'));
const assetNames=['arena-background','algorithm-arena','dialogue-frame','player','iron-hound','hex-mage','stone-golem','ash-wisp','shade','iron-monk','bone-archer','frost-witch','blade-dancer','void-knight'];
for(const character of CHALLENGER_CHARACTERS)assetNames.push('challengers/'+character.id);
for(const [kind,list] of [['skills',gameData.skills],['items',gameData.items]])for(const entry of list)assetNames.push(kind+'/'+entry.name);
const imageManifest=JSON.parse(read('docs/image-conversion.json'));
const imageFiles=Object.fromEntries(imageManifest.images.map(record=>[record.file.replace(/^assets\//,'').replace(/\.(jpg|webp)$/,''),record.file]));
const assetFiles=Object.fromEntries(assetNames.map(name=>{if(!imageFiles[name])throw Error('Missing image: '+name);return [name,imageFiles[name]];}));
for(const record of JSON.parse(read('docs/image-conversion-lossless.json')).images){const current=assetFiles[record.file.replace(/^assets\//,'').replace(/\.webp$/,'')];const obsolete=path.join(out,record.file);if(current!==record.file&&fs.existsSync(obsolete))fs.unlinkSync(obsolete);}
const media={};
function copyMedia(file){const bytes=fs.readFileSync(file),hash=sha(bytes),target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});if(path.resolve(file)!==path.resolve(target))fs.copyFileSync(file,target);media[file]={bytes:bytes.length,sha256:hash};return './'+file+'?v='+hash.slice(0,12);}
const assets=Object.fromEntries(assetNames.map(name=>[name,copyMedia(assetFiles[name])]));
const audioManifest=JSON.parse(read('src/audio.json'));
const audio=Object.fromEntries(Object.entries(audioManifest.sounds).map(([cue,file])=>[cue,copyMedia(file)]));
const specBytes=fs.readFileSync('docs/specification.md'),spec=new TextDecoder('utf-8',{fatal:true}).decode(specBytes);
const safe=x=>JSON.stringify(x).replaceAll('<','\\u003c');
const boot=`'use strict';\n(()=>{\nconst ASSETS=${safe(assets)};\nconst AUDIO=${safe(audio)};\nconst AUDIO_CREDIT=${safe(audioManifest.credit)};\nconst DETAILS=${safe(details)};\nconst DRAGSCROLL_LICENSE=${safe(read('vendor/dragscroll/LICENSE'))};\nconst SPECIFICATION=${safe(spec)};\nconst LICENSE_TEXT=${safe(read('LICENSE'))};\nconst WORKER_URL=${safe('./'+workerFile)};\n`+data+engine+policies+strip(read('src/requirements.js'))+strip(read('src/ui-model.js'))+strip(read('src/views.js'))+strip(read('src/arena/characters.js'))+strip(read('src/arena/views.js'))+strip(read('src/share.js'))+strip(read('src/app.js'))+'\n})();';
new vm.Script(boot);
const appFile=writeHashed('app','js',boot);
const css=read('src/style.css').replace(/url\('asset:([^']+)'\)/g,(_,id)=>id==='arena-background'?'none':`url('${assets[id]}')`);
const cssFile=writeHashed('style','css',css),dragFile=writeHashed('dragscroll','js',read('vendor/dragscroll/dragscroll.js'));
const html=read('src/index.html').replace('__STYLE_URL__','./'+cssFile).replace('__DRAG_URL__','./'+dragFile).replace('__APP_URL__','./'+appFile);
fs.writeFileSync(path.join(out,'index.html'),html);fs.writeFileSync(path.join(process.env.ARENA_OUTPUT_ROOT,'.nojekyll'),'');
fs.writeFileSync('docs/ui-ledger.json',JSON.stringify(REQUIREMENTS,null,2)+'\n');
const initialFiles=['index.html',cssFile,dragFile,appFile,assetFiles['arena-background'],assetFiles['void-knight']];
const manifest={version:5,base:'/Garbage2026/arena/',specificationSha256:sha(specBytes),htmlSha256:sha(html),assets:assetNames,assetFiles,audio:audioManifest.sounds,media,files:{html:'index.html',css:cssFile,app:appFile,dragscroll:dragFile,worker:workerFile},htmlBytes:Buffer.byteLength(html),initialFiles,initialUncompressedBytes:initialFiles.reduce((sum,file)=>sum+fs.statSync(path.join(out,file)).size,0)};
fs.writeFileSync('docs/build-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Built ${out}/index.html (${manifest.htmlBytes} bytes); external CSS/JS, ${assetNames.length} on-demand JPEG/lossless WebP images, 7 on-demand MP3s. Initial home resource budget: ${manifest.initialUncompressedBytes} bytes before HTTP compression.`);
NODE
node tests/package-check.mjs "$output_root/arena"
node tests/worker-check.mjs "$output_root/arena"
