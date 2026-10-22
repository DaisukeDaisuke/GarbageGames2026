// Visual time uses the same paused clock as the story. Randomness never enters Game.
export function impactFrame(elapsed,{before,after,angle,distance,reduced=false}) {
  const t=Math.max(0,elapsed),flight=Math.min(1,Math.max(0,(t-110)/1090));
  const move=1-Math.pow(1-flight,2),drain=Math.min(1,Math.max(0,(t-180)/600));
  const shaking=t<180&&!reduced;
  return {
    done:t>=1200,
    x:reduced?0:Math.cos(angle)*distance*move,
    y:reduced?0:Math.sin(angle)*distance*.55*move-8*Math.min(1,t/110),
    scale:reduced?1:t<100?.45+.8*t/100:t<220?1.25-.25*(t-100)/120:1,
    opacity:t<650?1:Math.max(0,1-(t-650)/550),
    shake:shaking?Math.sin(t*.17)*3.5*(1-t/180):0,
    fill:t<180?before:after,
    trail:before+(after-before)*(1-Math.pow(1-drain,3)),
    tint:before===after&&t>=180&&t<420?(420-t)/240*.8:0
  };
}
export class ImpactEffect {
  constructor(clock,render,{random=Math.random}={}) {
    this.clock=clock;this.render=render;this.random=random;this.current=null;
    clock.listeners.add(now=>this.tick(now));
  }
  start(amount,before,after,{distance=70,reduced=false}={}) {
    this.current={amount,before,after,angle:this.random()*Math.PI*2,distance:distance*(.65+this.random()*.35),reduced,at:this.clock.time};
    this.tick(this.clock.time);
  }
  tick(now) {
    if(!this.current)return;
    const frame=impactFrame(now-this.current.at,this.current);
    this.render({...frame,amount:this.current.amount});
    if(frame.done)this.current=null;
  }
  reset(hp=100) {
    this.current=null;
    this.render({done:true,amount:0,x:0,y:0,scale:1,opacity:0,shake:0,fill:hp,trail:hp,tint:0});
  }
}
