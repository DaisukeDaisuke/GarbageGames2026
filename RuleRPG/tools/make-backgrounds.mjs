// Authored pixel scenery. ImageMagick renders native MVG masters to PNG;
// compress-images.sh creates the JPEG display copies. No source PNG is edited.
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const command=spawnSync('magick',['-version']).status===0?'magick':'convert';
let seed=20261022;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const C={dark:'#102830',ink:'#18343c',teal:'#30535a',sea:'#4d7775',mint:'#88a59a',gold:'#be9a57',light:'#dfc588',wood:'#625548',rust:'#8b6043',paper:'#e7d9a3',night:'#142b3d'};
let shapes=[];
const rect=(x,y,w,h,fill)=>shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`);
const poly=(points,fill)=>shapes.push(`<polygon points="${points}" fill="${fill}"/>`);
const line=(x,y,a,b,color,width=1)=>shapes.push(`<path d="M${x},${y} L${a},${b}" fill="none" stroke="${color}" stroke-width="${width}"/>`);
const oval=(x,y,rx,ry,fill)=>shapes.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`);
function dots(x,y,w,h,n,colors){for(let i=0;i<n;i++){rect(Math.floor(x+random()*w),Math.floor(y+random()*h),1+Math.floor(random()*3),1,colors[Math.floor(random()*colors.length)]);}}
function sky(night=false){
  const colors=night?['#142a3c','#193549','#234654','#365c60','#617575']:['#315c65','#4c7c7e','#71978b','#a6b393','#d0bf90'];
  colors.forEach((c,i)=>rect(0,i*22,480,23,c));
  for(let i=0;i<28;i++){const x=Math.floor(random()*500)-20,y=Math.floor(random()*80);rect(x,y,8+Math.floor(random()*55),2,night?'#45606a':'#d2cda5');}
  if(night){oval(366,29,12,12,'#dfd4ab');oval(371,26,12,12,'#193549');dots(0,0,480,65,48,['#b9c6b7','#729a9e']);}
  else {oval(357,40,15,15,'#e6cf91');rect(340,47,37,3,'#a6b393');}
  for(let layer=0;layer<3;layer++){
    let points=`0,115 `;for(let x=0;x<=500;x+=15)points+=`${x},${67+layer*12-Math.floor(random()*17)} `;points+='480,135 0,135';poly(points,['#577c7d','#3c666b','#294e55'][layer]);
  }
}
function ground(y=116){
  rect(0,y,480,180-y,'#817f65');
  for(let row=0;row<7;row++){let yy=y+Math.floor((row/6)**1.6*(180-y));line(0,yy,480,yy,'#505f55');line(0,yy+1,480,yy+1,'#a49b74');}
  for(let x=-250;x<800;x+=46)line(240+(x-240)*.38,y,x,180,'#526257');
  dots(0,y+2,480,180-y-3,620,['#ada079','#6c725f','#bec191','#747760']);
}
function window(x,y,w=20,h=26,warm=true){
  rect(x-2,y-2,w+4,h+5,C.dark);rect(x,y,w,h,warm?'#b78845':'#3d666a');
  rect(x+2,y+2,w-4,h-4,warm?'#ebc67c':'#80a69c');rect(x+w/2-1,y,2,h,C.wood);rect(x,y+h*.5,w,2,C.wood);
  rect(x-3,y+h+1,w+6,3,C.gold);rect(x,y,2,h,C.rust);
}
function lamp(x,y){
  line(x,y-20,x,y+30,C.dark,3);rect(x-6,y-10,13,2,C.dark);rect(x-4,y-8,9,14,C.gold);rect(x-2,y-6,5,10,'#efd58c');rect(x-5,y+6,11,3,C.dark);rect(x-1,y-8,1,14,'#98723c');
}
function pole(x,y,h){
  rect(x,y-h,5,h,C.wood);rect(x+1,y-h,1,h,'#b49462');rect(x-11,y-h+7,28,3,C.dark);
  for(const dx of [-8,0,10]){rect(x+dx,y-h+1,3,5,C.mint);rect(x+dx-1,y-h+5,5,2,C.dark);}
  shapes.push(`<path d="M${x-200},${y-h-3} Q${x-90},${y-h+32} ${x+1},${y-h+4} T${x+230},${y-h-5}" fill="none" stroke="#182f38" stroke-width="1"/>`);
}
function building(x,y,w,h,roof=true){
  rect(x,y,w,h,'url(#brick)');rect(x,y,3,h,C.dark);rect(x+w-5,y,5,h,C.dark);rect(x+4,y,w-9,3,'#a19b7c');
  if(roof){poly(`${x-7},${y} ${x+w/2},${y-30} ${x+w+7},${y} ${x+w+7},${y+5} ${x-7},${y+5}`,'#21424b');for(let j=0;j<5;j++)line(x-4+j*8,y-j*5,x+w+4-j*8,y-j*5,'#53726a',2);}
}
function tree(x,base,h,shade=0){
  const colors=[['#142f38','#234b50','#3b6462'],['#23464d','#376664','#577f71']][shade];
  rect(x-3,base-h*.75,7,h*.75,'#414e43');rect(x,base-h*.7,2,h*.7,'#7b7654');
  for(let i=0;i<4;i++){
    const top=base-h+i*h*.13,wide=h*(.28+i*.045);
    poly(`${x},${top} ${x+wide},${top+h*.36} ${x+wide*.55},${top+h*.36} ${x+wide*.8},${top+h*.44} ${x-wide*.8},${top+h*.44} ${x-wide*.55},${top+h*.36} ${x-wide},${top+h*.36}`,colors[0]);
    poly(`${x},${top} ${x+wide*.23},${top+h*.2} ${x+wide*.7},${top+h*.3} ${x-wide*.55},${top+h*.3}`,colors[1]);
    for(let j=0;j<12;j++){const yy=top+h*.17+random()*h*.13,ww=(yy-top)*.75;rect(Math.floor(x-ww+random()*ww*2),Math.floor(yy),3,1,colors[2]);}
  }
}
function plants(x,y,w,n=25){for(let i=0;i<n;i++){const a=x+random()*w,h=3+random()*8;line(a,y,a-2,y-h,'#37635a',2);line(a,y,a+3,y-h*.7,'#7b9772');}}
function rivet(x,y){rect(x,y,2,2,C.light);rect(x+1,y+1,2,2,C.dark);}
const defs=`<defs><pattern id="brick" width="24" height="14" patternUnits="userSpaceOnUse"><rect width="24" height="14" fill="#52655f"/><path d="M0,0H24M0,7H24M0,14H24M12,0V7M0,7V14M24,7V14" stroke="#2d484a"/><path d="M1,1H11M13,1H23M1,8H23" stroke="#85907b"/><path d="M3,4H7M16,3H21M4,10H9M15,12H19" stroke="#62766b"/></pattern><pattern id="plaster" width="31" height="23" patternUnits="userSpaceOnUse"><rect width="31" height="23" fill="#bdac80"/><path d="M2,3H8M12,6H17M19,18H28M5,20H9M22,8H25M9,11H12" stroke="#9f9874"/><path d="M3,5H7M13,7H16M20,20H25" stroke="#d0bc8d"/></pattern></defs>`;
function draw(id){
  seed=20261022;shapes=[];
  if(id==='border_checkpoint'){
    sky();ground(116);
    building(6,48,146,82,false);building(332,42,142,88,false);
    for(const x of [6,332]){for(let j=0;j<7;j++)rect(x+j*21,36,12,15,'url(#brick)');rect(x-2,48,148,5,'#9b9b7a');}
    rect(152,63,180,9,C.dark);rect(151,60,182,4,C.gold);
    for(const x of [155,321]){rect(x,59,7,70,C.dark);rect(x+1,59,2,70,C.sea);for(let y=65;y<125;y+=14)rivet(x+2,y);}
    building(23,72,56,54,false);window(35,82,30,24);lamp(92,88);lamp(391,85);
    rect(134,112,211,5,C.dark);rect(134,110,211,2,C.light);for(let x=139;x<340;x+=19)rect(x,111,7,4,'#b56e4d');
    rect(130,106,9,35,C.dark);oval(131,115,8,8,C.wood);oval(131,115,4,4,C.gold);
    rect(376,100,56,30,C.wood);for(let x=380;x<430;x+=8)line(x,102,x,129,C.rust);line(378,102,429,127,C.gold,2);
    plants(0,141,110,40);plants(365,145,115,40);pole(453,135,116);
  }else if(id==='forest_path'){
    sky();rect(0,101,480,79,'#426456');
    for(let i=0;i<28;i++)tree(i*19-15,117,48+random()*48,1);
    ground(124);poly('201,103 278,103 400,180 61,180','#8e8f6c');
    dots(103,133,270,47,450,['#b0ac7c','#777e61','#a3a77a']);
    for(const [x,h] of [[22,137],[74,99],[415,112],[470,151]])tree(x,161,h);
    rect(12,141,138,9,C.dark);rect(12,142,138,3,'#81958a');rect(32,138,5,15,C.gold);rect(126,138,5,15,C.gold);
    for(let x=15;x<145;x+=12)rect(x,149,5,2,C.rust);
    pole(344,137,108);pole(302,114,64);pole(280,105,35);
    rect(359,110,27,36,C.dark);rect(361,112,23,31,'#56756d');window(366,118,12,10,false);rect(370,137,9,2,C.gold);
    plants(0,173,130,90);plants(362,169,118,90);dots(0,165,480,15,180,['#4c6e56','#9ea876','#334e45']);
  }else if(id==='moon_bridge'){
    sky(true);rect(0,104,480,76,'#1d4754');
    for(let i=0;i<200;i++){const x=random()*480,y=106+random()*74;rect(Math.floor(x),Math.floor(y),3+Math.floor(random()*16),1,['#386674','#517e82','#6d8e8d'][i%3]);}
    for(const x of [37,416]){building(x,61,29,66,false);rect(x-3,58,35,5,C.gold);lamp(x+14,68);}
    rect(0,139,480,41,'#596e68');for(let y=144;y<180;y+=6){line(0,y,480,y,'#2c4a4c');line(0,y+1,480,y+1,'#7f8b79');}
    rect(0,106,480,7,C.dark);rect(0,105,480,2,C.sea);rect(0,133,480,7,C.dark);rect(0,133,480,2,C.gold);
    for(let x=0;x<480;x+=40){line(x,110,x+40,135,'#345963',4);line(x+40,110,x,135,'#345963',4);rect(x,104,4,37,C.dark);rivet(x+1,106);rivet(x+1,134);}
    for(const x of [3,472]){rect(x,30,7,150,C.dark);rect(x+1,30,2,150,C.sea);}
    line(6,32,240,124,C.ink,4);line(475,32,240,124,C.ink,4);line(6,32,475,32,C.teal,5);
    for(let x=30;x<460;x+=25)rivet(x,32);dots(0,143,480,36,350,['#798878','#506c64','#a4a17c']);
  }else if(id==='last_train_platform'){
    sky(true);rect(0,114,480,66,'#9a9274');
    for(let y=117;y<180;y+=9){line(0,y,480,y,'#716e5c');line(0,y+1,480,y+1,'#b3a682');}
    dots(0,118,480,62,420,['#b8ad87','#7e7f68','#c4b58c']);
    rect(12,59,454,50,'#294b51');rect(12,57,454,4,'#759085');rect(12,97,454,7,'#1a323b');rect(12,95,454,2,C.gold);
    for(let x=22;x<461;x+=36)window(x,67,24,21);
    for(let x=27;x<460;x+=67){oval(x,111,8,8,C.dark);oval(x,111,3,3,C.gold);}
    rect(0,117,480,3,C.dark);rect(0,119,480,2,C.sea);rect(0,126,480,3,C.dark);
    for(let x=0;x<480;x+=16)rect(x,121,8,6,'#5f665c');
    rect(0,21,480,5,C.dark);rect(0,26,480,3,C.gold);poly('0,21 27,8 450,8 480,21','#24434d');
    for(let x=15;x<480;x+=14)line(x,11,x-9,21,'#57746f');
    for(const x of [27,439]){rect(x,28,7,126,C.dark);rect(x+1,28,2,126,C.sea);poly(`${x+6},28 ${x+44},28 ${x+6},55`,C.dark);line(x+8,31,x+36,31,C.gold);}
    lamp(91,49);lamp(391,50);
    rect(54,130,63,6,C.wood);rect(54,143,63,5,C.wood);for(const x of [59,108])rect(x,135,4,22,C.dark);for(let y=130;y<135;y+=2)line(54,y,117,y,C.gold);
    rect(367,139,27,17,C.rust);rect(369,137,23,3,C.gold);rect(373,136,15,2,C.dark);rect(372,140,2,16,C.light);rect(386,140,2,16,C.light);
  }else if(id==='home_door'){
    sky(true);ground(136);
    building(43,31,394,112,false);rect(49,34,382,100,'url(#plaster)');
    rect(54,34,7,103,C.wood);rect(420,34,7,103,C.wood);rect(49,64,382,6,C.wood);rect(49,119,382,6,C.wood);
    poly('24,32 92,0 388,0 456,32 456,38 24,38',C.dark);for(let y=4;y<34;y+=5){line(85-y*1.8,y,395+y*1.8,y,'#496962',2);for(let x=60;x<420;x+=17)line(x,y,x-3,y+4,'#284b53');}
    rect(199,42,82,97,C.wood);rect(203,45,74,91,C.dark);rect(210,49,60,87,'#dfb764');rect(213,52,54,80,'#bd8748');
    rect(217,55,45,44,'#8b6339');rect(217,103,45,26,'#8b6339');rect(219,57,41,39,'#bf8e50');rect(219,105,41,21,'#bf8e50');oval(258,100,2,2,'#f2d9a1');
    rect(207,135,65,3,'#edd493');rect(191,139,97,4,'#a49b79');rect(185,143,109,4,'#6c7769');
    window(91,81,45,33);window(342,81,45,33);rect(91,82,11,30,'#dfce9b');rect(126,82,10,30,'#dfce9b');rect(343,82,11,30,'#dfce9b');rect(377,82,10,30,'#dfce9b');
    lamp(175,82);lamp(304,82);rect(150,120,19,17,C.rust);rect(147,118,25,4,C.gold);plants(149,119,21,22);
    rect(315,121,20,18,C.rust);rect(312,118,26,5,C.gold);plants(313,119,24,26);
    for(let x=11;x<45;x+=10){rect(x,108,5,43,C.wood);poly(`${x-1},109 ${x+2},104 ${x+6},109`,C.wood);}rect(8,122,37,4,C.gold);
    rect(359,130,30,12,C.wood);rect(358,128,33,3,C.gold);rect(367,126,15,3,C.dark);plants(404,148,67,42);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="180" viewBox="0 0 480 180" shape-rendering="crispEdges">${defs}${shapes.join('')}</svg>`;
}
await mkdir(path.join(root,'art-originals','background-sources'),{recursive:true});
function mvgShapes(svg){
  return [...svg.matchAll(/<(rect|path|ellipse|polygon)\b([^>]+)\/>/g)].map(([,tag,attributes])=>{
    const a=Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
    let cmd=`fill '${a.fill||'none'}' stroke '${a.stroke||'none'}' stroke-width ${a['stroke-width']||1} `;
    if(tag==='rect')cmd+=`rectangle ${a.x||0},${a.y||0} ${Number(a.x||0)+Number(a.width)-1},${Number(a.y||0)+Number(a.height)-1}`;
    if(tag==='ellipse')cmd+=`ellipse ${a.cx},${a.cy} ${a.rx},${a.ry} 0,360`;
    if(tag==='polygon')cmd+=`polygon ${a.points}`;
    if(tag==='path')cmd+=`path '${a.d}'`;
    return `push graphic-context\n${cmd}\npop graphic-context`;
  }).join('\n');
}
const mvgDefs=[...defs.matchAll(/<pattern id="([^"]+)" width="(\d+)" height="(\d+)"[^>]*>([\s\S]*?)<\/pattern>/g)].map(([,id,w,h,body])=>`push pattern ${id} 0,0 ${w},${h}\n${mvgShapes(body)}\npop pattern`).join('\n');
for(const id of ['border_checkpoint','forest_path','moon_bridge','last_train_platform','home_door']){
  const master=path.join(root,'art-originals','background-sources',id+'.svg');
  const svg=draw(id);await writeFile(master,svg,'utf8');
  const mvg=master.replace(/\.svg$/,'.mvg');
  await writeFile(mvg,`push graphic-context\nviewbox 0 0 480 180\npush defs\n${mvgDefs}\npop defs\n${mvgShapes(shapes.join(''))}\npop graphic-context\n`,'utf8');
  const png=path.join(root,'assets',id+'.png');
  const render=spawnSync(command,['-size','480x180','+antialias','mvg:'+mvg,'-alpha','off','-depth','8','-strip',png],{encoding:'utf8'});
  if(render.status!==0)throw Error(render.stderr);
  const original=spawnSync(command,[png,'-filter','point','-resize','1920x720',path.join(root,'art-originals',id+'.png')],{encoding:'utf8'});
  if(original.status!==0)throw Error(original.stderr);
  console.log(id+': ImageMagick MVG → PNG (480×180 and source master 1920×720)');
}
