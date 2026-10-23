import {C} from './draw.mjs';
import {tutorialStatus,initialMediaVisible} from './tutorial.mjs';
import {DIRECTIONS} from './physical.mjs';
import {focusScreen,visibleScreen} from './terminal-view.mjs';

// A camera looking at one persistent workshop. All interactable objects live in
// this world coordinate system, including the PC's real screen surface.
export class Room {
  constructor(surface,physical,phone){this.s=surface;this.physical=physical;this.phone=phone;this.camera={x:836,y:470,scale:1};this.transform={x:0,y:0,scale:1};this.layout={};this.screenPlane=null;this.mode='overview';}
  world(point){return {x:(point.x-this.transform.x)/this.transform.scale,y:(point.y-this.transform.y)/this.transform.scale};}
  project(point){return {x:this.transform.x+point.x*this.transform.scale,y:this.transform.y+point.y*this.transform.scale};}
  position(key,fallback){return this.layout[key]||fallback;}
  dockScreen(){const pos=this.position('eq-M02',{x:720,y:853}),size=230;return {x:pos.x-size*.25,y:pos.y-size*.73+25,w:size*.27,h:size*.25};}
  move(key,x,y){this.layout[key]={x:Math.max(60,Math.min(1560,x)),y:Math.max(440,Math.min(850,y))};}
  shadow(x,y,w,h){const c=this.s.ctx;c.save();c.globalAlpha=.3;c.fillStyle='#100d06';c.beginPath();c.ellipse(x,y,w,h,0,0,Math.PI*2);c.fill();c.restore();}
  begin(mode,model,attempt){
    const s=this.s,c=s.ctx,wide=s.W/s.H,overview=Math.min(s.W/1672,s.H/941);
    this.mode=mode;const pos=this.position(attempt?.id||'device',{x:1065,y:710});
    let target={x:836,y:470,scale:overview};
    if(mode==='pc')target={x:291,y:608,scale:Math.min((s.W-100/s.scale)/207,s.H*.87/142)};
    if(mode==='dock')target=focusScreen(this.dockScreen(),s);
    if(mode==='device'&&model){
      const [u,v,w,h]=this.physical.screenRect(model),box=this.deviceBox(model,pos);
      target=focusScreen({x:box.x+box.w*u+5,y:box.y+box.h*v+5,w:box.w*w-10,h:box.h*h-10},s);
    }
    const ease=.13;this.camera.x+=(target.x-this.camera.x)*ease;this.camera.y+=(target.y-this.camera.y)*ease;this.camera.scale+=(target.scale-this.camera.scale)*ease;
    for(const key of ['x','y','scale'])if(Math.abs(target[key]-this.camera[key])<(key==='scale'?.0001:.02))this.camera[key]=target[key];
    const scale=this.camera.scale,x=s.W/2-this.camera.x*scale,y=s.H/2-this.camera.y*scale;
    this.transform={x,y,scale};this.physical.worldScale=scale;this.startHit=s.hits.length;
    c.save();c.translate(x,y);c.scale(scale,scale);s.image('workshop',0,0,1672,941,{fit:'cover'});
    this.screenPlane=null;
  }
  deviceBox(model,pos){
    const key=this.physical.frames[`turn_${model.grade}_${Math.floor((Number(model.id.slice(-3))-1)/5)}`];
    const row=(Number(model.id.slice(-3))-1)%5,frame=key?.[row*8+this.physical.view];
    const ratio=frame?frame.w/frame.h:model.design_size[0]/model.design_size[1],h=Math.min(355,420/ratio),w=h*ratio;
    return {x:pos.x-w/2,y:pos.y-h,w,h};
  }
  draw({game,content,selected,combo,openPC,openBook,openPhone,openDevice,onPort,onEject,onItem,onEquipment,onMove,loadModel,ringing}){
    const s=this.s,c=s.ctx,a=game.run.attempts.find(a=>a.id===game.run.active_id),mode=this.mode,stage=game.run.intro?.stage??4;
    // These are real props on the desk, not navigation cards floating above it.
    if(stage>=1){
    this.shadow(278,779,205,25);s.atlas('props',0,4,2,58,449,450,360);
    const pc={x:188,y:537,w:207,h:142};
    s.rect(pc.x,pc.y,pc.w,pc.h,'#183b36',null,9);
    s.text('WORKSHOP / LOCAL',pc.x+14,pc.y+14,12,C.mint,700);
    s.text(`受信 ${game.run.inbox.length} 通`,pc.x+14,pc.y+45,22,C.cream,700);
    s.text(`所持金 ${'$'+game.run.cash}`,pc.x+14,pc.y+87,15,C.mint);
    s.text('クリックして操作',pc.x+14,pc.y+116,11,C.amber);
    s.hotspot('工房のパソコンへ近づく',60,450,447,355,openPC,'room-pc');
    if(mode==='pc')this.screenPlane=pc;
    }
    this.shadow(600,776,80,13);this.phone.draw({ringing:ringing??(stage<4||game.run.pending_calls.length>0||tutorialStatus(game).phase==='briefing'),picked:mode==='phone',open:openPhone});
    let eIndex=0;for(const id of (stage>=3?game.run.owned_equipment.filter(id=>id!=='M01'):[])){const e=content.equipment.find(e=>e.id===id);const pos=this.position('eq-'+id,{x:720+(eIndex%5)*172,y:853+Math.floor(eIndex/5)*-104});eIndex++;
      const size=id==='M02'?230:142;this.shadow(pos.x,pos.y+20,size*.4,12);s.atlas('equipment',e.art.index,4,4,pos.x-size/2,pos.y-size+25,size,size);s.hotspot(`${e.name}を使う`,pos.x-size/2,pos.y-size+25,size,size,()=>onEquipment(e),'equipment-'+id,{worldObject:'eq-'+id,objectPosition:pos,equipment:id});
      if(id==='M02'&&a?.runtime.dock){this.layout['eq-M02']=pos;const p=this.dockScreen(),device=this.position(a.id,{x:1065,y:710});c.save();c.strokeStyle='#182a2a';c.lineWidth=7;c.beginPath();c.moveTo(pos.x,pos.y);c.bezierCurveTo(pos.x+100,pos.y+40,device.x-80,device.y+65,device.x,device.y);c.stroke();c.restore();s.rect(p.x,p.y,p.w,p.h,'#122f32',null,3);s.clip(p.x,p.y,p.w,p.h,()=>{s.text(a.device.family,p.x+p.w/2,p.y+10,8,C.mint,600,'center');s.text('クリックで操作',p.x+p.w/2,p.y+30,7,C.cream,400,'center');});s.hotspot('外部画面で端末を操作',p.x,p.y,p.w,p.h,openDevice,'dock-screen');if(mode==='dock')this.screenPlane=p;}
    }
    if(stage>=3&&game.run.skills.includes('A3')){const e=content.equipment.find(e=>e.id==='M06'),pos=this.position('portable',{x:1390,y:820});s.atlas('equipment',e.art.index,4,4,pos.x-80,pos.y-120,160,160);s.text('携帯保全',pos.x,pos.y+28,15,C.cream,700,'center');s.hotspot('携帯保全ケースを使う',pos.x-80,pos.y-110,160,140,()=>onEquipment({id:'portable'}),'portable',{worldObject:'portable',objectPosition:pos,equipment:'portable'});}
    for(const other of game.run.attempts){const model=content.devices.find(d=>d.id===other.hardware_model_id);loadModel(model);const fallback=other.id===a?.id?{x:1065,y:710}:{x:1440,y:697},pos=this.position(other.id,fallback),box=this.deviceBox(model,pos);
      this.shadow(pos.x,pos.y-5,box.w*.46,20);
      if(other.id===a?.id){
        this.physical.draw(model,box,other,selected,onPort,openDevice);
        this.physical.onEject=onEject;
        const bounds=this.physical.bounds;
        if(mode==='device'){const [u,v,w,h]=this.physical.screenRect(model);this.screenPlane={x:bounds.x+bounds.w*u+5,y:bounds.y+bounds.h*v+5,w:bounds.w*w-10,h:bounds.h*h-10};}
        // The product label travels with the machine.
        s.rect(pos.x-box.w*.45,pos.y+8,Math.min(260,box.w*.9),48,'#f0dfb7','#a89164',2);s.text(model.name,pos.x-box.w*.42,pos.y+14,17,C.ink,700);s.text(`${other.device.family} ${other.device.version}`,pos.x-box.w*.42,pos.y+35,11,C.ink);
        s.hotspot('端末を持ち上げて移動',box.x,box.y+box.h*.35,box.w,box.h*.37,()=>onItem('device'),other.id,{worldObject:other.id,objectPosition:pos});
        // Socket touch areas must stay above the device-body drag target.
        const ports=s.hits.filter(h=>h.port!==undefined);s.hits=s.hits.filter(h=>h.port===undefined);s.hits.push(...ports);
        // Keep inserted media above the device-body drag target.
        const mediaHit=s.hits.findIndex(h=>h.id==='inserted-media');if(mediaHit>=0)s.hits.push(...s.hits.splice(mediaHit,1));
        // The lower edge remains a reliable place to rotate the solid object.
        s.button('↶',pos.x-65,pos.y+65,58,44,()=>this.physical.turn(-1),{small:true});s.button('↷',pos.x+7,pos.y+65,58,44,()=>this.physical.turn(1),{small:true});
      }else{
        s.atlas(model.art.sheet,model.art.index,5,4,box.x,box.y,box.w,box.h);s.hotspot('保留中の端末へ移る',box.x,box.y,box.w,box.h,()=>onItem(other.id),'other-'+other.id);s.text(other.job.title.slice(0,16),box.x,pos.y+12,15,C.cream);
      }
      if(other.runtime.pending){const p=other.runtime.pending;s.rect(box.x,box.y-25,box.w,12,'#183b36',null,5);s.rect(box.x,box.y-25,box.w*(1-p.remaining/p.total),12,C.amber,null,5);s.text('実行中',box.x,box.y-47,15,C.cream,700);}
    }
    // Media remain loose physical objects on the desk. Occupied instances stay in their sockets.
    let pi=0;for(const id of (initialMediaVisible(game)?[...game.run.owned_pocs].sort((a,b)=>Number(game.run.prepared.includes(b))-Number(game.run.prepared.includes(a))):[])){const p=content.pocs.find(p=>p.id===id);for(let instance=0;instance<(game.run.copies[id]||1);instance++){
      if(game.run.attempts.some(at=>at.runtime.media.some(m=>m.pocId===id&&m.instance===instance)))continue;
      const pos=this.position(`poc-${id}-${instance}`,{x:800+(pi%4)*210,y:812-Math.floor(pi/4)*154});pi++;
      const selectedHere=selected===id;if(game.run.prepared.includes(id))s.rect(pos.x-70,pos.y-80,140,170,'#385a3a44','#c7ba7b',6);if(selectedHere)s.rect(pos.x-72,pos.y-86,144,182,'#315e3c99',C.amber,6);
      const label=instance?id+'②':id;
      this.shadow(pos.x,pos.y+60,44,16);this.physical.media(p.media,pos.x,pos.y,148,0,label,false,label,2);
      s.hotspot(`${id}${instance?' 2本目':''} を持つ`,pos.x-66,pos.y-80,132,170,()=>onItem(id,instance),'poc-'+id+'-'+instance,{media:id,instance,worldObject:`poc-${id}-${instance}`,objectPosition:pos});
    }}
    if(!a&&stage>=4){s.text('ここに端末を置いて作業する',953,666,25,'#eee6ca',600);s.text('左のパソコンから依頼を受け取る',966,705,18,'#f3e2b8');}
  }
  end(){
    const s=this.s,{x,y,scale}=this.transform;s.ctx.restore();
    for(let i=this.startHit;i<s.hits.length;i++){const hit=s.hits[i];hit.x=x+hit.x*scale;hit.y=y+hit.y*scale;hit.w*=scale;hit.h*=scale;}
    this.portHits=this.physical.sockets.map(g=>({...g,...this.project(g)}));
    // A focused terminal owns input. Its transparent gaps must not activate
    // the workshop PC, device, or props that were drawn behind the interface.
    if(['pc','device','dock'].includes(this.mode)){s.hits.splice(this.startHit);this.portHits=[];}
  }
  renderPlane(draw,panel=null){
    if(!this.screenPlane&&!panel)return;const p=this.screenPlane,s=this.s,t=this.transform,focused=!panel&&['device','dock'].includes(this.mode),at=panel||(focused?visibleScreen(p,t,s):{...this.project(p),w:p.w*t.scale,h:p.h*t.scale}),pw=at.w,ph=at.h;
    if(pw<40||ph<40)return;
    // Logical screen resolution changes with available space, not with artwork pixels.
    const old={W:s.W,H:s.H,font:s.font,small:s.small,gap:s.gap,btnH:s.btnH,narrow:s.narrow,pointer:s.pointer,clipRect:s.clipRect};
    const uiW=panel||focused?pw*s.scale:old.narrow?Math.max(360,Math.min(700,s.cssW-24)):1280,uiH=uiW*ph/pw,k=pw/uiW;
    const startHit=s.hits.length,startRegion=s.regions.length;s.planeHitStart=startHit;s.planeRegionStart=startRegion;
    s.ctx.save();s.ctx.beginPath();s.ctx.rect(at.x,at.y,pw,ph);s.ctx.clip();s.ctx.translate(at.x,at.y);s.ctx.scale(k,k);
    Object.assign(s,{W:uiW,H:uiH,font:panel||old.narrow?18:24,small:panel||old.narrow?15:20,gap:panel||old.narrow?12:20,btnH:panel||old.narrow?48:56,narrow:!!panel||old.narrow,pointer:{x:(old.pointer.x-at.x)/k,y:(old.pointer.y-at.y)/k},clipRect:null});
    if(focused)Object.assign(s,{font:uiW<700?22:26,small:uiW<700?18:22,gap:uiW<700?12:20,btnH:56,narrow:uiW<700});
    s.rect(0,0,uiW,uiH,this.mode==='book'?C.paper:'#ecf0da');s.hotspot('画面',0,0,uiW,uiH,()=>{},'terminal-background');draw();
    s.ctx.restore();Object.assign(s,old);
    for(let i=startHit;i<s.hits.length;i++){const h=s.hits[i];h.x=at.x+h.x*k;h.y=at.y+h.y*k;h.w*=k;h.h*=k;}
    for(let i=startRegion;i<s.regions.length;i++){const r=s.regions[i];r.x=at.x+r.x*k;r.y=at.y+r.y*k;r.w*=k;r.h*=k;r.inputScale=k;}
  }
}
