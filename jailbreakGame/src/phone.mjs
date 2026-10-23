// Separate base and receiver sprites. The cord follows the receiver continuously.
export function handsetAttachment(center,angle,width,aspect){
  const x=-width*.43,y=width*aspect*.24;
  return {x:center.x+x*Math.cos(angle)-y*Math.sin(angle),y:center.y+x*Math.sin(angle)+y*Math.cos(angle)};
}
export class Phone {
  constructor(surface,frames){this.s=surface;this.frames=frames;this.lift=0;this.dragTarget=null;}
  sprite(index,x,y,w,angle=0){const s=this.s,c=s.ctx,f=this.frames[index],im=s.images.get('phone_parts');if(!im)return;const h=w*f.h/f.w;c.save();c.translate(x,y);c.rotate(angle);c.drawImage(im,f.x,f.y,f.w,f.h,-w/2,-h/2,w,h);c.restore();}
  draw({ringing,picked,open}){
    const s=this.s,c=s.ctx,t=performance.now();this.lift+=(Number(picked)-this.lift)*.14;
    const ring=ringing&&!picked&&!this.dragTarget&&Math.sin(t/750)>.05;
    const shake=ring?Math.sin(t/23)*4:0;
    const receiver=this.dragTarget||{x:600+this.lift*10+shake,y:647-this.lift*125+(ring?Math.cos(t/28)*2:0)};
    const angle=-this.lift*.62+(ring?Math.sin(t/23)*.035:0);
    const socket=handsetAttachment(receiver,angle,190,this.frames[1].h/this.frames[1].w);
    // The dark coiled lead starts at the base, curves down, then reaches the earpiece.
    // Both endpoints sit inside their plastic parts; drawing the parts afterwards
    // hides the attachment seam. Rotate the receiver socket with the bitmap.
    const bendX=Math.min(497,socket.x-48),bendY=Math.max(777,socket.y+85);
    c.save();c.lineWidth=5;c.strokeStyle='#67351c';c.lineCap='round';c.beginPath();c.moveTo(537,728);c.bezierCurveTo(bendX,bendY,bendX-22,socket.y+65,socket.x,socket.y);c.stroke();c.lineWidth=2;c.strokeStyle='#ba6832';c.setLineDash([1.5,3.5]);c.stroke();c.restore();
    this.sprite(0,600,710,148);
    this.sprite(1,receiver.x,receiver.y,190,angle);
    s.hotspot(picked?'受話器を戻す':'電話に出る',490,615,220,175,open,'phone-base');
    s.hotspot(picked?'受話器を戻す':'受話器を取る',receiver.x-100,receiver.y-40,200,80,open,'phone-handset',{phoneHandset:true});
  }
}
