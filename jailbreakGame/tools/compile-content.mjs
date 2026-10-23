import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildNameMap} from '../src/display.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function utf8(file) {
  const bytes = readFileSync(path.join(root, file));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) throw new Error(`${file}: UTF-16LE is unsupported; provide UTF-8`);
  return new TextDecoder('utf-8', {fatal:true}).decode(bytes).replace(/^\uFEFF/, '');
}
const spec = utf8('docs/reference-v3.1.md');
const contracts = JSON.parse(utf8('content/contracts.json'));
const catalog = JSON.parse(utf8('content/catalog.json'));
const grades = ['E','D','C','B','A'];
const families = ['KomaOS','MiraOS','FolioOS','ReelOS','HearthOS'];
const axes = ['root','install','feature'];
const features = ['theme','output','export','schedule','content','profile'];
const clean = value => value.replace(/`|\*\*/g, '').trim();
const requireMatch = (text, regex, context) => {
  const m = text.match(regex);
  if (!m) throw new Error(`Missing source field: ${context}`);
  return m;
};
const numbers = text => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const versions = text => [...new Set(text.match(/\d+\.\d+/g) ?? [])];
const sourceLines = spec.split('\n');
const tableRows = prefix => sourceLines.filter(line => line.startsWith(`|${prefix}`)).map(line => line.slice(1,-1).split('|').map(clean));
const hash = object => createHash('sha256').update(JSON.stringify(object)).digest('hex').slice(0,16);
const round = value => Number(value.toFixed(8));
const pointUV = (point,size) => [round(point[0]/size[0]),round(point[1]/size[1])];
const rectUV = (rect,size) => [round(rect[0]/size[0]),round(rect[1]/size[1]),round(rect[2]/size[0]),round(rect[3]/size[1])];
const blocks = new Map();
for (const match of spec.matchAll(/^#{3,4} (H_[EDCBA]_\d{3})[｜：]([^\n]+)\n([\s\S]*?)(?=^#{2,4} |$(?![\s\S]))/gm)) {
  blocks.set(match[1],{name:match[2],body:match[3],line:spec.slice(0,match.index).split('\n').length});
}
const uvRows = new Map(tableRows('H_').filter(row => /^\d+×\d+$/.test(row[1])).map(row => [row[0],row]));
const eRows = new Map(tableRows('H_E_').filter(row => row.length===8).map(row => [row[0],row]));
const cRows = new Map(tableRows('H_C_').filter(row => row.length===7).map(row => [row[0],row]));
const bRows = new Map(tableRows('H_B_').filter(row => row.length===7).map(row => [row[0].split(' ')[0],row]));

const devices = [];
for (const grade of grades) for (let n=1;n<=20;n++) {
  const id=`H_${grade}_${String(n).padStart(3,'0')}`;
  const block=blocks.get(id);
  if (!block) throw new Error(`No hardware block: ${id}`);
  const body=clean(block.body);
  let design, screen, centers, featureList, versionList, baseModel;
  let family=families[grades.indexOf(grade)];
  let secondary=[];
  if (grade==='E') {
    const row=eRows.get(id);
    if (!row) throw new Error(`No hardware table row: ${id}`);
    design=numbers(requireMatch(body,/(\d+×\d+)\s*\/\s*screen/,id+' size')[1]);
    screen=rectUV(numbers(requireMatch(body,/screen\[([^\]]+)\]/,id+' screen')[1]),design);
    centers=[...body.matchAll(/usb_a_\d+\(([^)]+)\)/g)].map(m=>pointUV(numbers(m[1]),design));
    featureList=row[5]==='なし'?[]:row[5].split('、');
    versionList=versions(row[3]);baseModel=row[2];
  } else if (grade==='D'||grade==='C') {
    const row=uvRows.get(id);
    if (!row) throw new Error(`No UV table row: ${id}`);
    design=numbers(row[1]);screen=JSON.parse(row[2]);
    centers=[...row[3].matchAll(/\(([^)]+)\)/g)].map(m=>numbers(m[1]));
    if (grade==='D') {
      family=requireMatch(body,/対応OS版：(\w+OS)/,id+' family')[1];
      versionList=versions(requireMatch(body,/対応OS版：([^。]+)/,id+' versions')[1]);
      featureList=requireMatch(body,/supported_features=\[([^\]]*)\]/,id+' features')[1].split(/[,、]/).map(s=>s.trim()).filter(Boolean);
      baseModel=requireMatch(body,/基本モデル：([^。]+)/,id+' base model')[1];
    } else {
      const row=cRows.get(id);if(!row)throw new Error(`Missing C row ${id}`);
      versionList=versions(row[2]);featureList=row[4]==='なし'?[]:row[4].split('、');baseModel=row[1].split('／')[1];
    }
  } else if (grade==='B') {
    const row=bRows.get(id);if(!row)throw new Error(`Missing B row ${id}`);
    versionList=versions(row[2]);featureList=row[4].split('、');baseModel=row[1];
    if(n===2) {
      const ref=devices.find(d=>d.id==='H_B_001');design=ref.design_size;screen=ref.screen_rect_uv;centers=ref.ports.map(p=>p.center_uv);
    } else {
      design=numbers(requireMatch(body,/横(\d+)×縦(\d+)/,id+' size').slice(1).join(','));
      const screenMatch=requireMatch(body,/主画面[^。(]*\(([^)]+)\)/,id+' screen');
      screen=rectUV(numbers(screenMatch[1]),design);
      const portMatch=requireMatch(body,/DVD(?:口|皿|トレー|スロット)(?:中心)?(?:は)?\(([^)]+)\)/,id+' port');
      centers=[pointUV(numbers(portMatch[1]),design)];
      for(const extra of body.matchAll(/(?:プレビュー画面|予定プレビュー画面|小さな予定表示)\(([^)]+)\)/g)) secondary.push({rect_uv:rectUV(numbers(extra[1]),design)});
    }
  } else {
    design=numbers(requireMatch(body,/(\d+×\d+)/,id+' size')[1]);
    screen=rectUV(numbers(requireMatch(body,/主画面\(([^)]+)\)/,id+' screen')[1]),design);
    const portLine=requireMatch(body,/^- USB-C：([^\n]+)/m,id+' ports')[1];
    centers=[...portLine.matchAll(/\(([^)]+)\)/g)].map(m=>pointUV(numbers(m[1]),design));
    featureList=requireMatch(body,/supported_features：\[([^\]]+)\]/,id+' features')[1].split(',').map(s=>s.trim());
    versionList=versions(requireMatch(body,/OS対応版：([^。]+)/,id+' versions')[1]);
    baseModel=requireMatch(body,/基本モデル：([^。]+)/,id+' base model')[1];
    for(const extra of body.matchAll(/副画面\(([^)]+)\)/g)) secondary.push({rect_uv:rectUV(numbers(extra[1]),design)});
  }
  const type={E:'USB-A',D:'USB-C',C:'SD',B:'DVD',A:'USB-C'}[grade];
  if(!centers.length)throw new Error(`No port centers for ${id}`);
  devices.push({id,name:block.name,grade,family,base_model:baseModel,versions:versionList,features:featureList,skill_point_reward:{E:1,D:1,C:2,B:2,A:3}[grade],design_size:design,display_size:grade==='E'?design.map(v=>v*2):design,screen_rect_uv:screen,secondary_screens:secondary,ports:centers.map((center_uv,i)=>({id:`port_${i+1}`,type,center_uv})),art:{sheet:`devices_${grade}`,index:n-1,columns:5,rows:4},appearance_description:body,source_geometry_excerpt:block.body.trim(),source:{document:'docs/reference-v3.1.md',line:block.line}});
}

const jobSections=new Map();
for(const match of spec.matchAll(/^### (JOB_[EDCBA]_\d{3})｜([^\n]+)\n([\s\S]*?)(?=^#{2,3} |$(?![\s\S]))/gm)) jobSections.set(match[1],{title:match[2],text:match[3],line:spec.slice(0,match.index).split('\n').length});
function classify(job) {
  const tags=[];
  const goal=job.goal;
  if(job.network===false)tags.push('offline');
  if(!job.initial.operational)tags.push('recovery');
  if(!job.initial.display)tags.push('screen_fault');
  if(goal.version && ![].concat(goal.version).includes(job.version))tags.push('version_change');
  if(goal.apps?.some(a=>!job.initial.apps.includes(a))||goal.remove?.length)tags.push('app_change');
  if(Object.keys(goal.settings??{}).length)tags.push('settings_change');
  if(goal.s?.some((v,i)=>v===false&&(job.initial.s[i]||['install','feature'].includes(axes[i])&&(tags.includes('app_change')||tags.includes('settings_change')))))tags.push('relock');
  if(job.forbid.includes('erase'))tags.push('never_erase');
  if(job.forbid.includes('root'))tags.push('never_root');
  if(job.beforeBackup)tags.push('backup_before_erase');
  if(job.preset)tags.push('preset');
  if(goal.empty?.length)tags.push('selective_restore');
  if(job.keep.length)tags.push('preserve_data');
  if((goal.s??[]).filter(Boolean).length>1||((goal.apps?.length??0)>1&&tags.includes('settings_change')))tags.push('compound');
  const family=tags.includes('offline')?'offline':tags.includes('recovery')||tags.includes('selective_restore')?'data_recovery':tags.includes('version_change')?'os_update':tags.includes('compound')||tags.includes('screen_fault')?'compound_validation':tags.includes('settings_change')?'settings_relock':tags.includes('app_change')?'app_change':'unlock_only';
  return {decision_family:family,decision_tags:tags};
}
const jobs=[];
for(const grade of grades) for(const entry of contracts[grade]) {
  const id=`JOB_${grade}_${String(entry.n).padStart(3,'0')}`;
  const source=jobSections.get(id);if(!source)throw new Error(`Missing mail ${id}`);
  const device=devices.find(d=>d.id===id.replace('JOB','H'));
  const text=clean(source.text);
  const metadata=source.text.split('\n').find(l=>/端末.*(?:報酬|OS).*：/.test(l))??source.text.split('\n').find(l=>/^差出人：.*報酬/.test(l));
  if(!metadata)throw new Error(`Missing metadata ${id}`);
  const os=requireMatch(metadata,/(KomaOS|MiraOS|FolioOS|ReelOS|HearthOS)\s*(\d+\.\d+)/,id+' initial OS');
  const reward=Number(requireMatch(metadata,/\$([\d,]+)/,id+' reward')[1].replaceAll(',',''));
  const from=requireMatch(text,/差出人：(.+?)(?:。本文：|／端末：|\n)/,id+' sender')[1];
  const body=requireMatch(text,/本文：([^\n]+)/,id+' body')[1];
  const initial={s:[false,false,false],settings:{},apps:[],operational:true,display:true,...entry.initial};
  const prerequisites=[];
  const prerequisiteLines=text.split('\n').filter(l=>/出現|端末.*報酬/.test(l)).join('\n');
  for(const m of prerequisiteLines.matchAll(/(JOB_[EDCBA]_\d{3})納品後/g)) prerequisites.push(m[1]);
  const j={id,grade,rank:grades.indexOf(grade)+1,n:entry.n,title:source.title,from,body,family:os[1],version:os[2],reward,hardware_model_id:device.id,data:entry.data,keep:entry.keep??entry.data,initial,goal:entry.goal,forbid:entry.forbid??[],routes:entry.routes,network:entry.network??true,preset:entry.preset??false,beforeBackup:entry.beforeBackup??false,priorGradeCount:entry.priorGradeCount??0,evaluation:entry.evaluation??false,prerequisites:[...new Set(prerequisites)],source:{document:'docs/reference-v3.1.md',line:source.line}};
  Object.assign(j,classify(j));
  const appChange=(j.goal.apps??[]).some(app=>!initial.apps.includes(app))||(j.goal.remove??[]).some(app=>initial.apps.includes(app));
  const settingChange=Object.entries(j.goal.settings??{}).some(([k,v])=>v!==(initial.settings[k]??catalog.game.defaults[k]));
  j.creditable_axes=axes.filter((axis,i)=>!initial.s[i]&&(j.goal.s?.[i]===true||(axis==='install'&&appChange)||(axis==='feature'&&settingChange)));
  const shape={initial:{...initial,settings:{...catalog.game.defaults,...initial.settings}},goal:j.goal,forbid:j.forbid,network:j.network,preset:j.preset,backup:j.beforeBackup,data_count:j.data.length,keep_indices:j.keep.map(k=>j.data.indexOf(k)),features:device.features};
  j.decision_structure=`STRUCT-${hash(shape)}`;
  j.decision_signature=`DS-${hash({...shape,family:j.family,version:j.version,reward:j.reward})}`;
  jobs.push(j);
}

const axisName={R:'管理者制限解除',I:'アプリ導入制限解除',F:'設定編集制限解除'};
const pocs=tableRows('P').filter(row=>/^P\d{2}$/.test(row[0])&&row.length===6).map(row=>{
  const [id,os,media,letter,price,rank]=row;
  const family=requireMatch(os,/(\w+OS)/,id+' family')[1];
  const v=versions(os);
  const isNew=family==='KomaOS'?v.includes('2.0'):v.includes('1.1');
  return {id,name:`${family} ${v.join(' / ')} ${axisName[letter]}`,family,versions:v,media,axis:{R:'root',I:'install',F:'feature'}[letter],price:parseInt(price,10),rank:Number(rank),duration:isNew?1500:1200,description:`${axisName[letter]}だけを行います。他の権限・データ・アプリ・OS版は変更しません。`,surrenderable:id!=='P01'};
});
const durations={M04:1200,M05:2400,M06:1800,M09:2000};
const equipment=tableRows('M').filter(row=>/^M\d{2} /.test(row[0])&&row.length===4).map(row=>{
  const [id,...name]=row[0].split(' ');const [price,rank]=row[1].split('／');
  return {id,name:name.join(' '),price:parseInt(price,10),rank:Number(rank),duration:durations[id]??600,description:row[2],limits:row[3],art:{sheet:'equipment',index:Number(id.slice(1))-1,columns:4,rows:4}};
});
const skills=sourceLines.filter(line=>/^\|[ABCDFR][1-5]\|[^|]+\|\d+・/.test(line)).map(line=>{
  const [id,name,req,description]=line.slice(1,-1).split('|').map(clean);
  return {id,name,cost:parseInt(req,10),requires:id==='F1'?[]:(req.match(/[ABCDR][1-5]/g)??[]),...(id==='F1'?{requires_any:['A2','B2','C2','D2'],requires_any_count:2}:{}),description};
});
const events=tableRows('CALL').map(row=>{
  const [id,number]=row[0].split('・');const [title,portrait]=row[1].split('／');
  const index=Number(id.slice(4));const rank=index>=2&&index<=5?index:null;
  return {id,threshold:parseInt(number,10),rank,grant:rank?(rank-1)*200:0,title,portrait,pages:[...row[2].matchAll(/「([^」]+)」/g)].map(m=>m[1]),result:row[3]};
});
const endingQuotes=tableRows('').filter(row=>['自由退職','研修修了','診断担当','独立開業','メーカー研究職','主任継承','巡回修理'].includes(row[0]));
const endings=sourceLines.filter(line=>/^\|`END_/.test(line)).map((line,index)=>{
  const [label,condition,description]=line.slice(1,-1).split('|').map(clean);
  const [id,...name]=label.split(' ');
  const quote=endingQuotes[index]?.[1]?.match(/「([^」]+)」/)?.[1]??'';
  return {id,name:name.join(' '),condition,description,quote,reemployment_quote:endingQuotes[index]?.[2]?.match(/「([^」]+)」/)?.[1]??''};
});
const os_versions=families.flatMap(family=>(family==='KomaOS'?['1.0','1.1','2.0']:['1.0','1.1']).map((version,index,list)=>({id:`${family}:${version}`,family,version,next:list[index+1]??null,format:`${family}:format1`})));
const content={...catalog,jobs,devices,pocs,equipment,skills,events,endings,os_versions,provenance:{document:'docs/reference-v3.1.md',sha256:createHash('sha256').update(spec).digest('hex'),contracts:'content/contracts.json',generator:'tools/compile-content.mjs'}};
const out=path.resolve(root,process.argv[2]??'data');mkdirSync(out,{recursive:true});
content.display_names=buildNameMap(content);
writeFileSync(path.join(root,'docs/INTERNAL_NAME_MAP.md'),'# 内部名と表示名の対応表\n\n内部IDはセーブ・検証fixtureの参照キーです。ゲーム画面では表示名に変換します。媒体は対応OS・版・用途・形状で識別し、IDの暗記を要求しません。対応表の原本は `data/display_names.json`、変換処理は `src/display.mjs` です。\n\n|内部ID|分類|ゲーム内の表示名|対応・形状|\n|---|---|---|---|\n'+Object.entries(content.display_names).map(([id,n])=>`|${id}|${n.kind}|${n.name}|${[n.compatibility,n.shape].filter(Boolean).join(' ／ ')}|`).join('\n')+'\n');
const write=(name,value)=>writeFileSync(path.join(out,`${name}.json`),JSON.stringify(value,null,2)+'\n','utf8');
write('content',content);
write('display_names',content.display_names);
for(const key of ['devices','pocs','equipment','skills','events','endings','apps','ranks','game','services','timing','ui','os_versions'])write(key,content[key]);
for(const grade of grades)write(`jobs_${grade}`,jobs.filter(j=>j.grade===grade));
write('solution_fixtures',jobs.map(j=>({job_id:j.id,routes:j.routes.map((dsl,index)=>({id:`${j.id}:${index+1}`,dsl})),source:j.source})));
write('decision_audit',{signature_count:new Set(jobs.map(j=>j.decision_signature)).size,structure_count:new Set(jobs.map(j=>j.decision_structure)).size,family_counts:Object.fromEntries([...new Set(jobs.map(j=>j.decision_family))].map(f=>[f,jobs.filter(j=>j.decision_family===f).length])),note:'署名は状態・禁止条件・互換版・費用条件の重複を検出する。100種類の面白さを実測した数値ではない。'});
console.log(`Compiled ${jobs.length} contracts, ${devices.length} hardware models, ${pocs.length} PoCs, ${equipment.length} equipment items.`);
