// Rebuild production assets from the bundled image-generated PNG sources.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const sharp=require(require.resolve('sharp',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const root=new URL('../',import.meta.url).pathname;
const records=JSON.parse(readFileSync(join(root,'art-source/manifest.json'),'utf8'));
mkdirSync(join(root,'assets'),{recursive:true});
for(const record of records){
  const original=join(root,'art-source',record.key+'.png'),im=sharp(original);
  if(record.key==='workshop')await im.jpeg({quality:95}).toFile(join(root,'assets/workshop.jpg'));
  else await im.webp({lossless:true,effort:6}).toFile(join(root,'assets',record.key+'.webp'));
  record.source=record.key+'.png';
  console.log('Prepared',record.key);
}
writeFileSync(join(root,'art-source/manifest.json'),JSON.stringify(records,null,2)+'\n');
// Generated sheets have irregular gutters: component-based crops preserve all 8 views.
for(const script of ['measure-frames','calibrate-surfaces','prepare-phone','prepare-dialogue','prepare-short-dialogue','prepare-portraits'])execFileSync(process.execPath,[join(root,'tools',script+'.mjs')],{cwd:root,stdio:'inherit'});
