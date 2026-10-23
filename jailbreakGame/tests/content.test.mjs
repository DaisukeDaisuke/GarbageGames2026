import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const content=JSON.parse(readFileSync(path.join(root,'data/content.json'),'utf8'));
const {jobs,devices,pocs,equipment,skills,events,endings}=content;
const grades=['E','D','C','B','A'];
const families=new Set(['unlock_only','app_change','settings_relock','os_update','data_recovery','offline','compound_validation']);
const namedApps=new Set(content.apps);
const unique=(items,key='id')=>assert.equal(new Set(items.map(item=>item[key])).size,items.length,`duplicate ${key}`);

test('100 complete contracts and 100 models retain original correspondence',()=>{
  assert.equal(jobs.length,100);assert.equal(devices.length,100);unique(jobs);unique(devices);
  for(const grade of grades)assert.equal(jobs.filter(j=>j.grade===grade).length,20);
  for(const job of jobs){
    const device=devices.find(d=>d.id===job.hardware_model_id);
    assert.ok(device,job.id);assert.equal(device.family,job.family,job.id);
    assert.ok(device.versions.includes(job.version),job.id+' initial version');
    assert.ok(job.body.length>=40,job.id+' complete body');assert.ok(job.from.length>0,job.id+' sender');
    assert.ok(job.title.length>0,job.id+' title');assert.ok(job.reward>0,job.id+' reward');
    assert.ok(job.source.line>870,job.id+' source');
    assert.ok(!/解法A|解法B|判断ポイント/.test(job.body),job.id+' no fixture leaked into mail');
    assert.ok(Array.isArray(job.keep));assert.ok(job.keep.every(k=>job.data.includes(k)),job.id+' kept data');
    assert.equal(job.initial.s.length,3);assert.ok(job.initial.s.every(v=>typeof v==='boolean'));
    assert.ok(families.has(job.decision_family),job.id+' family');
  }
});

test('goals use only actual hardware features and supported OS versions',()=>{
  for(const job of jobs){
    const device=devices.find(d=>d.id===job.hardware_model_id);
    for(const key of [...Object.keys(job.goal.settings??{}),...(job.goal.keepSettings??[])])assert.ok(device.features.includes(key),`${job.id} ${key}`);
    for(const version of [].concat(job.goal.version??[]))assert.ok(device.versions.includes(version),`${job.id} ${version}`);
    for(const app of [...job.initial.apps,...(job.goal.apps??[]),...(job.goal.remove??[])])assert.ok(namedApps.has(app),`${job.id} ${app}`);
    if(job.network===false)assert.ok(job.forbid.includes('network'),job.id+' offline history');
  }
});

test('100 machine transforms have valid screens and distinct real ports',()=>{
  for(const d of devices){
    assert.equal(d.design_size.length,2);assert.ok(d.design_size.every(v=>Number.isFinite(v)&&v>0),d.id);
    assert.equal(d.screen_rect_uv.length,4);
    const [x,y,w,h]=d.screen_rect_uv;
    assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1.001&&y+h<=1.001,d.id+' screen');
    assert.ok(d.ports.length>=1&&d.ports.length<=3,d.id+' ports');unique(d.ports);
    for(const p of d.ports){assert.ok(['USB-A','USB-C','SD','DVD'].includes(p.type));assert.equal(p.center_uv.length,2);assert.ok(p.center_uv.every(v=>v>=0&&v<=1),d.id+' port UV');}
    assert.deepEqual(d.display_size,d.grade==='E'?d.design_size.map(v=>v*2):d.design_size,d.id+' display sizing');
    assert.equal(d.art.index,Number(d.id.slice(-3))-1);assert.equal(d.art.columns,5);assert.equal(d.art.rows,4);
  }
  const adapter=devices.find(d=>d.id==='H_D_020');assert.equal(adapter.family,'KomaOS');assert.equal(adapter.ports[0].type,'USB-C');
  assert.equal(devices.find(d=>d.id==='H_C_006').ports.length,2);
});

test('199 authored fixture routes reference available equipment and compatible PoCs',()=>{
  assert.equal(jobs.reduce((n,j)=>n+j.routes.length,0),199);
  for(const job of jobs){
    assert.equal(job.routes.length,job.id==='JOB_E_001'?1:2,job.id);
    assert.equal(new Set(job.routes).size,job.routes.length,job.id+' repeated route');
    for(const route of job.routes){
      let version=job.version;
      for(const token of route.split(' ')){
        if(/^P\d\d$/.test(token)){
          const p=pocs.find(p=>p.id===token);assert.ok(p,token);assert.equal(p.family,job.family,job.id+' family');assert.ok(p.versions.includes(version),job.id+' '+token+' version');assert.ok(p.rank<=job.rank,job.id+' unavailable PoC');
        }else if(token==='U'||token==='O'){
          if(token==='O')assert.ok(job.rank>=4,job.id+' unavailable offline box');
          if(token==='U')assert.ok(job.network,job.id+' forbidden network route');
          const next=content.os_versions.find(v=>v.family===job.family&&v.version===version).next;assert.ok(next,job.id+' no next OS');version=next;
        }else if(/^[BQR]:/.test(token)){
          const rank=token[0]==='Q'?3:2;assert.ok(job.rank>=rank,job.id+' unavailable backup hardware');
          for(const category of token.slice(2).split(','))assert.ok(['data','apps','settings',...job.data].includes(category),job.id+' backup category '+category);
        }else if(/^X\+?$/.test(token))assert.ok(job.rank>=3,job.id+' unavailable recovery hardware');
        else if(token==='preset')assert.ok(job.preset&&job.rank===5,job.id+' preset');
        else if(/^S:/.test(token))assert.ok(job.network,job.id+' forbidden network service');
        else assert.ok(/^(L:(all|root|install|feature)|[+-].+|[a-z]+=[a-z]+|fix|screen|dock|adapter)$/.test(token),job.id+' unknown fixture token '+token);
      }
    }
  }
});

test('decision signatures ignore identifiers but retain differing constraints and economics',()=>{
  assert.equal(new Set(jobs.map(j=>j.decision_signature)).size,100);
  assert.equal(new Set(jobs.map(j=>j.decision_family)).size,7);
  const signatureShape=jobs[0].decision_signature;assert.match(signatureShape,/^DS-[a-f0-9]{16}$/);
  assert.notEqual(jobs.find(j=>j.id==='JOB_C_012').decision_signature,jobs.find(j=>j.id==='JOB_C_016').decision_signature);
  for(const grade of grades)assert.ok(new Set(jobs.filter(j=>j.grade===grade).map(j=>j.decision_family)).size>=4,grade+' variety');
});

test('catalogue preserves prices with an expanded skill tree, five deliveries and seven optional endings',()=>{
  assert.equal(pocs.length,30);assert.equal(equipment.length,16);assert.equal(skills.length,22);assert.equal(events.length,6);assert.equal(endings.length,7);
  for(const list of [pocs,equipment,skills,events,endings])unique(list);
  assert.equal(skills.reduce((n,s)=>n+s.cost,0),103);
  const f1=skills.find(s=>s.id==='F1');assert.equal(f1.cost,2);assert.equal(f1.requires_any_count,2);assert.equal(f1.requires_any.length,4);
  assert.deepEqual(events.map(e=>e.threshold),[1,1,2,3,4,5]);assert.deepEqual(events.map(e=>e.grant),[0,200,400,600,800,0]);
  assert.equal(content.ranks.reduce((n,r)=>n+r.quota,0),5);
  assert.equal(pocs.find(p=>p.id==='P03').price,220);assert.equal(equipment.find(e=>e.id==='M05').duration,2400);
  assert.equal(content.game.initial_cash,400);assert.equal(content.game.carryover_rate,0.5);
  assert.ok(content.disabled_endings.every(e=>e.enabled===false));assert.deepEqual(content.timing.fixed_courses,[]);
});

test('review-critical cases retain noninterchangeable requirements',()=>{
  const get=id=>jobs.find(j=>j.id===id);
  assert.ok(get('JOB_C_020').beforeBackup);assert.equal(get('JOB_C_020').network,false);
  assert.ok(get('JOB_A_009').goal.keepSettings.includes('content'));
  assert.ok(get('JOB_A_009').goal.keepSettings.includes('output'));
  assert.ok(get('JOB_A_009').routes[1].includes('Q:data,apps,settings'));
  assert.ok(get('JOB_A_009').routes[1].includes('R:data,apps,settings'));
  assert.deepEqual(get('JOB_B_015').keep,['作品']);assert.deepEqual(get('JOB_B_015').goal.empty,['写真']);
  assert.deepEqual(get('JOB_E_020').creditable_axes,[]);assert.deepEqual(get('JOB_D_015').creditable_axes,[]);
  assert.ok(get('JOB_C_016').forbid.includes('erase'));
  assert.equal(get('JOB_D_020').family,'KomaOS');assert.equal(get('JOB_D_020').version,'1.1');
  assert.deepEqual(jobs.filter(j=>j.evaluation).map(j=>j.id),['JOB_C_016','JOB_B_007','JOB_A_003']);
});
