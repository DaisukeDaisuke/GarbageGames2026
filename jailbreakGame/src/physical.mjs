import {C} from './draw.mjs';
export const DIRECTIONS=['正面','右前','右側','右後','背面','左後','左側','左前'];
export function artKey(model){const n=Number(model.id.slice(-3))-1;return {key:`turn_${model.grade}_${Math.floor(n/5)}`,row:n%5};}
export function socketGeometry(model,port,view,bounds,calibration=null){
  if(calibration?.views){const v=calibration.views[view];if(!v)return {visible:false,type:port.type};const [u,vv,nx,ny]=v,n=Math.hypot(nx,ny)||1;return {x:bounds.x+bounds.w*u,y:bounds.y+bounds.h*vv,nx:nx/n,ny:ny/n,visible:true,face:'calibrated',type:port.type,rotation:calibration.rotation?.[view]||0};}
  const [u,v]=port.center_uv,angle=view*Math.PI/4;
  const face=u>.85?'right':u<.12?'left':v<.075?'top':'front';
  let px=(u-.5)*.96,pz=.25,py=(v-.5)*.96,nx=0,nz=1;
  if(face==='right'){px=.40;pz=0;nx=1;nz=0;}if(face==='left'){px=-.40;pz=0;nx=-1;nz=0;}
  const visible=face==='top'||nx*Math.sin(angle)+nz*Math.cos(angle)>.23;
  const x=bounds.x+bounds.w*(.5+px*Math.cos(angle)-pz*Math.sin(angle));
  const y=bounds.y+bounds.h*(.50+py+.09*(pz*Math.cos(angle)-px*Math.sin(angle)));
  const sx=nx*Math.cos(angle)-nz*Math.sin(angle),sy=face==='top'?-1:.7;
  const norm=Math.hypot(sx,sy);return {x,y,visible,face,nx:sx/norm,ny:sy/norm,type:port.type};
}
export class Physical {
  constructor(surface,frames,surfaces={},names={}){this.s=surface;this.frames=frames;this.surfaces=surfaces;this.names=names;this.view=0;this.sockets=[];this.bounds=null;this.animation=null;}
  screenRect(model){return this.surfaces[model.id]?.screen||model.screen_rect_uv;}
  screenBackground(model,b,fill){
    const poly=this.surfaces[model.id]?.screen_polygon,c=this.s.ctx;
    if(poly){c.beginPath();poly.forEach(([u,v],i)=>c[i?'lineTo':'moveTo'](b.x+b.w*u,b.y+b.h*v));c.closePath();c.fillStyle=fill;c.fill();return;}
    const [u,v,w,h]=this.screenRect(model);this.s.rect(b.x+b.w*u+5,b.y+b.h*v+5,b.w*w-10,b.h*h-10,fill,null,2);
  }
  turn(delta){this.view=(this.view+delta+8)%8;}
  draw(model,box,attempt,selected,onPort,onExecute){
    const s=this.s,c=s.ctx,{key,row}=artKey(model),im=s.images.get(key),frame=this.frames[key]?.[row*8+this.view];
    let b={...box};
    if(im&&frame){const scale=Math.min(box.w/frame.w,box.h/frame.h);b={x:box.x+(box.w-frame.w*scale)/2,y:box.y+(box.h-frame.h*scale)/2,w:frame.w*scale,h:frame.h*scale};c.drawImage(im,frame.x,frame.y,frame.w,frame.h,b.x,b.y,b.w,b.h);}
    else s.atlas(model.art.sheet,model.art.index,5,4,box.x,box.y,box.w,box.h);
    this.bounds=b;this.sockets=[];
    model.ports.forEach((p,index)=>{
      const calibration=this.surfaces[model.id]?.ports?.[index];
      const g=socketGeometry(model,Array.isArray(calibration)?{...p,center_uv:calibration}:p,this.view,b,calibration);if(!g.visible)return;this.sockets.push({...g,index});
      const width=calibration?.size_uv?b.w*calibration.size_uv[0]:Math.max(s.narrow?26:38,b.w*(p.type==='DVD'?.27:p.type==='SD'?.16:.105)),height=calibration?.size_uv?b.h*calibration.size_uv[1]:p.type==='USB-A'?width*.42:Math.max(6,width*.19),border=calibration?.size_uv?1:4;
      if(!calibration?.art_socket){c.save();c.translate(g.x,g.y);const slant=g.rotation??(g.face==='right'||g.face==='left'?Math.PI/2:0);c.rotate(slant);
      s.rect(-width/2-border,-height/2-border,width+border*2,height+border*2,'#8c9185','#d7d4bc',3);
      s.rect(-width/2,-height/2,width,height,'#091c21','#45565a',p.type==='USB-C'?height/2:1);
      if(p.type==='USB-A')s.rect(-width*.35,0,width*.7,height*.25,'#bdc9c4');
      if(p.type==='USB-C')s.rect(-width*.30,-1,width*.6,2,'#d2c4a4');
      if(p.type==='SD')for(let i=0;i<5;i++)s.rect(-width*.3+i*width*.13,1,2,3,'#d7b267');
      c.restore();}
      if(selected){c.save();c.strokeStyle=C.amber;c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();c.arc(g.x,g.y,Math.max(28,width*.75),0,Math.PI*2);c.stroke();c.restore();}
      const hit=Math.max(88/(s.scale*(this.worldScale||1)),width+20);s.hotspot(`${p.type} 差込口 ${index+1}`,g.x-hit/2,g.y-hit/2,hit,hit,()=>onPort(index),'port-'+index,{port:index});
      if(attempt?.runtime.media.length&&attempt.runtime.port===index){
        const pocId=attempt.runtime.media[0].pocId,progress=this.animation?.port===index?Math.min(1,(performance.now()-this.animation.start)/240):1;
        const size=p.type==='SD'?Math.max(116,width*1.8):160,offset=size*.25+70*(1-progress)*(1-progress);
        this.media(p.type,g.x+g.nx*offset,g.y+g.ny*offset,size,Math.atan2(g.ny,g.nx)-Math.PI/2,'',progress===1,pocId);
        s.hotspot('刺さった媒体を手で抜く',g.x+g.nx*offset-size/2,g.y+g.ny*offset-size/2,size,size,()=>this.onEject?.(),'inserted-media',{insertedMedia:true});
      }
    });
    const screenView=/カメラ/.test(model.base_model+' '+model.name)?4:0;
    if(attempt&&!attempt.device.operational&&this.view===screenView){const [sx,sy,sw,sh]=this.screenRect(model),x=b.x+b.w*sx,y=b.y+b.h*sy,w=b.w*sw,h=b.h*sh;this.screenBackground(model,b,'#10181b');s.text('起動不能',x+w/2,y+h*.4,Math.min(18,w/6),C.cream,600,'center');s.text('工房PCで修復',x+w/2,y+h*.65,Math.min(12,w/9),C.amber,400,'center');s.hotspot('起動不能の端末を修復する',x,y,w,h,onExecute,'device-screen');}
    if(attempt&&!attempt.device.display&&this.view===screenView){const [sx,sy,sw,sh]=this.screenRect(model),x=b.x+b.w*sx,y=b.y+b.h*sy,w=b.w*sw,h=b.h*sh;this.screenBackground(model,b,'#10181b');s.text('画面故障',x+w/2,y+h*.45,Math.min(18,w/6),C.muted,600,'center');s.hotspot('壊れた内蔵画面',x,y,w,h,onExecute,'device-screen');}
    if(attempt&&this.view===screenView&&attempt.device.display&&attempt.device.operational&&frame){
      const [sx,sy,sw,sh]=this.screenRect(model);
      // Use the authored screen rectangle for a small status display. Controls stay legible below.
      const x=b.x+b.w*sx,y=b.y+b.h*sy,w=b.w*sw,h=b.h*sh;
      if(w>60&&h>40){this.screenBackground(model,b,'#122f32');s.text(attempt.runtime.media.length?'MEDIA READY':attempt.device.family,x+w/2,y+h*.33,Math.min(w/9,20),C.mint,600,'center');s.text(attempt.device.version,x+w/2,y+h*.65,Math.min(w/12,16),C.cream,400,'center');s.hotspot('端末画面を操作',x,y,w,h,onExecute,'device-screen');}
    }
    return b;
  }
  media(type,x,y,size,angle=0,label='',inserted=false,assetId=label,labelScale=1){
    const s=this.s,c=s.ctx,index={'USB-A':4,'USB-C':5,SD:6,DVD:7}[type]??4;c.save();c.translate(x,y);c.rotate(angle);
    if(inserted){c.beginPath();c.rect(-size*.6,-size*.35,size*1.2,size);c.clip();}
    if(assetId.replace('②','')==='P02'&&s.images.has('usb_install'))s.image('usb_install',-size*.30,-size/2,size*.60,size);else s.atlas('props',index,4,2,-size/2,-size/2,size,size);c.restore();
    if(label&&!inserted){const item=this.names[label.replace('②','')];const caption=item?item.shortName+(label.endsWith('②')?' ②':''):label,fs=Math.min(s.small,size*.18/labelScale)*labelScale,cs=Math.min(s.small,size*.12/labelScale)*labelScale;
      if(labelScale===1){s.text(caption,x,y+size*.42,fs,C.cream,700,'center');if(item?.compatibility)s.text(item.compatibility,x,y+size*.64,cs,C.cream,500,'center');}
      else {const width=size*1.35,top=y+size*.33,height=s.wrap(caption,x-width/2,top,width,fs,C.cream,1.05,2,false,'center');if(item?.compatibility)s.text(item.compatibility,x,top+height+5,cs,C.cream,500,'center');}
    }
  }
}
