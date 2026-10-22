import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateData,BACKGROUNDS,ENEMIES} from '../source/core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const specBytes=await readFile(path.join(root,'specification.md'));
if(specBytes[0]===0xff&&specBytes[1]===0xfe)throw new Error('UTF-16LEのファイルは処理できません。');
const spec=new TextDecoder('utf-8',{fatal:true}).decode(specBytes);
const block=spec.match(/```json\s*\n([\s\S]*?)\n```/);
if(!block)throw new Error('仕様書のJSONがありません');
const data=JSON.parse(block[1]);const counts=validateData(data);
const output=path.resolve(process.argv[2]||root);
await mkdir(path.join(output,'assets','display'),{recursive:true});
const assets={};let imageBytes=0;
for(const id of [...BACKGROUNDS,...ENEMIES,'dialogue_frame']){
  const extension=ENEMIES.includes(id)?'webp':'jpg';
  const relative=`assets/display/${id}.${extension}`;
  const source=path.join(root,relative),destination=path.join(output,relative);
  const bytes=await readFile(source);
  if(bytes.length===0||bytes.length>80000)throw new Error(`表示用画像 ${relative} は1〜80000 bytesにしてください。RPG_RECOMPRESS=1 bash build.sh で再圧縮できます。`);
  if(source!==destination)await copyFile(source,destination);
  assets[id]=`./${relative}`;imageBytes+=bytes.length;
}
const audioManifest=JSON.parse(await readFile(path.join(root,'audio','manifest.json'),'utf8'));
const sounds={};
for(const [id,item] of Object.entries(audioManifest.sounds)){
  const bytes=await readFile(path.join(root,'audio',item.file));
  if(bytes.length<100)throw new Error(`音源 ${id} が空です`);
  sounds[id]={...item,src:'data:audio/mpeg;base64,'+bytes.toString('base64')};
}
const read=name=>readFile(path.join(root,'source',name),'utf8');
const [template,css,core,journal,sound,impact,ui]=await Promise.all(['template.html','style.css','core.mjs','achievements.mjs','sound.mjs','impact.mjs','ui.mjs'].map(read));
const safe=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const script=[core,journal,sound,impact].map(source=>source.replace(/^export /gm,'')).join('\n')+'\n'+ui;
if(/<\/script/i.test(script))throw new Error('script終了タグが混入しています');
const html=template.replace('/*__STYLE__*/',()=>css).replace('/*__SCENARIO__*/',()=>safe(data)).replace('/*__ASSETS__*/',()=>safe(assets)).replace('/*__SOUNDS__*/',()=>safe(sounds)).replace('/*__SPEC__*/',()=>safe(spec)).replace('/*__SCRIPT__*/',()=>script);
await writeFile(path.join(output,'index.html'),html,'utf8');
console.log(JSON.stringify({output:path.join(output,'index.html'),bytes:Buffer.byteLength(html),imageBytes,patterns:counts}));
