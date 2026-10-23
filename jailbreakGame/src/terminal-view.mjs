// Read the screen at viewport size; the machine's bezel may leave the camera.
export function terminalViewport(s){
  const unit=1/s.scale;
  return {x:20*unit,y:80*unit,w:Math.max(160*unit,s.W-116*unit),h:Math.max(120*unit,s.H-166*unit)};
}
export function focusScreen(plane,s){
  const v=terminalViewport(s),scale=Math.max(v.w/plane.w,v.h/plane.h);
  return {x:plane.x+plane.w/2-(v.x+v.w/2-s.W/2)/scale,y:plane.y+plane.h/2-(v.y+v.h/2-s.H/2)/scale,scale};
}
export function visibleScreen(plane,transform,s){
  const v=terminalViewport(s),x=Math.max(v.x,transform.x+plane.x*transform.scale),y=Math.max(v.y,transform.y+plane.y*transform.scale);
  return {x,y,w:Math.max(0,Math.min(v.x+v.w,transform.x+(plane.x+plane.w)*transform.scale)-x),h:Math.max(0,Math.min(v.y+v.h,transform.y+(plane.y+plane.h)*transform.scale)-y)};
}
