import {dispatch,currentAttempt,inspect,quoteOperation,AXES} from './core.mjs';

// C2 uses the real transition model on an isolated copy. No saving, rewards,
// wall-clock timing or random mailbox changes happen during a calculation.
export function simulatePlan(original,actions,content){
  let state=structuredClone(original);const initialCash=state.run.cash,steps=[];
  for(const action of actions){
    if(!['buy','insert','eject','start','duplicate'].includes(action.type))throw new Error('試算できない操作です');
    try{
      const quote=action.type==='start'?quoteOperation(state,action.operation,content):null;
      state=dispatch(state,{...action,confirmed:true},content);
      while(currentAttempt(state)?.runtime.pending)state=dispatch(state,{type:'tick',ms:2400},content);
      steps.push({action,summary:quote?.summary||action.label||action.type,warnings:quote?.warnings||[]});
    }catch(e){return {state,steps,cost:initialCash-state.run.cash,error:e.message,checks:currentAttempt(state)?inspect(currentAttempt(state),content):[]};}
  }
  return {state,steps,cost:initialCash-state.run.cash,error:null,checks:currentAttempt(state)?inspect(currentAttempt(state),content):[]};
}
export function planningChoices(state,content,group='operation'){
  const a=currentAttempt(state),out=[];
  const add=(label,action)=>{try{if(action.type==='start')quoteOperation(state,action.operation,content);else dispatch(state,action,content);out.push({label,action:{...action,label}});}catch{}};
  if(group==='buy'){
    for(const item of [...content.pocs,...content.equipment])if(![...state.run.owned_pocs,...state.run.owned_equipment].includes(item.id))add(`${item.id} ${item.name}　$${item.price}`,{type:'buy',id:item.id});
    return out;
  }
  if(!a)return out;
  if(group==='media'){
    if(a.runtime.media.length)add('挿入中の媒体を取り出す',{type:'eject'});
    else for(const p of content.pocs.filter(p=>state.run.owned_pocs.includes(p.id)))for(let portIndex=0;portIndex<content.devices.find(d=>d.id===a.hardware_model_id).ports.length;portIndex++)add(`${p.id} を差込口 ${portIndex+1} に挿す`,{type:'insert',pocId:p.id,portIndex});
    return out;
  }
  const ops=[{type:'poc'},...AXES.map(axis=>({type:'lock',axis})),{type:'lock',axis:'all'},...['S02','S03','S04'].map(serviceId=>({type:'service',serviceId})),{type:'dock'},{type:'adapter'},{type:'update',offline:true},{type:'preset'},...[false,true].map(development=>({type:'reimage',development}))];
  for(let bits=1;bits<8;bits++)ops.push({type:'service',serviceId:'S01',axes:AXES.filter((_,i)=>bits&(1<<i))});
  for(const app of content.apps){const name=typeof app==='string'?app:app.name;ops.push({type:'install',app:name},{type:'remove',app:name});}
  for(const [key,values] of Object.entries({theme:['standard','custom'],output:['internal','external'],export:['off','local'],schedule:['locked','custom'],content:['stock','custom'],profile:['factory','custom']}))for(const value of values)ops.push({type:'setting',key,value});
  for(const type of ['backup','rescue','restore'])for(const categories of [['data'],['apps'],['settings'],['data','apps'],['data','apps','settings'],...(a.job.data||[]).map(k=>[k])])for(const portable of [false,true])ops.push({type,categories,portable});
  for(const operation of ops){try{const q=quoteOperation(state,operation,content);add(`${q.summary}${operation.portable?'（携帯）':''}　$${q.cost}`,{type:'start',operation});}catch{}}
  return out;
}
