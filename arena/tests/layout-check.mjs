import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync(process.env.ARENA_BUILT_CSS||new URL('../src/style.css',import.meta.url),'utf8');

// Inspect the shipped CSS at desktop and phone breakpoints without a browser.
function rulesAt(text,width){
 const result=[];let offset=0;
 while(offset<text.length){
  const open=text.indexOf('{',offset);if(open<0)break;
  const selector=text.slice(offset,open).trim();let end=open+1,depth=1;
  for(;end<text.length&&depth;end++)depth+=text[end]==='{'?1:text[end]==='}'?-1:0;
  const body=text.slice(open+1,end-1);offset=end;
  if(selector.startsWith('@media')){
   const max=selector.match(/max-width:\s*(\d+)px/),min=selector.match(/min-width:\s*(\d+)px/);
   if((max||min)&&(!max||width<=+max[1])&&(!min||width>=+min[1]))result.push(...rulesAt(body,width));
  }else if(!selector.startsWith('@'))result.push({selector,body});
 }
 return result;
}
function value(selector,property,width=1440){
 let value;
 for(const rule of rulesAt(css,width))if(rule.selector.split(',').map(s=>s.trim()).includes(selector))
  for(const declaration of rule.body.split(';')){const colon=declaration.indexOf(':');if(declaration.slice(0,colon).trim()===property)value=declaration.slice(colon+1).trim();}
 return value;
}
const originalDimensions=[['.shell','max-width','1450px'],['.topbar','height','77px'],['.brand-mark','width','32px'],['.brand-mark','height','32px'],['.start-block','max-width','340px'],['.seed-field input','width','210px'],['.stage i','width','25px'],['dialog','width','min(900px,92vw)'],['.close','min-width','52px'],['.close','height','52px'],['.route-card','min-height','370px'],['.route-card img','height','250px']];
for(const [selector,property,expected] of originalDimensions)assert.equal(value(selector,property),expected,selector+' '+property);
for(const width of [1440,1024,820]){
 assert.equal(value('.manifest-strip','grid-template-columns',width),'repeat(3,1fr)');
 assert.equal(value('.challenger-grid','grid-template-columns',width),'repeat(3,minmax(0,1fr))');
 assert.equal(value('.route-grid','grid-template-columns',width),'repeat(2,minmax(0,1fr))');
 assert.equal(value('.result-grid','grid-template-columns',width),'1fr 1fr');
 assert.equal(value('.illustrated-slots','grid-template-columns',width),'repeat(3,minmax(0,1fr))');
}
assert.equal(value('.skill-gallery','grid-template-columns',1440),'repeat(3,minmax(0,1fr))');
assert.equal(value('.skill-gallery','grid-template-columns',1024),'repeat(2,minmax(0,1fr))');
for(const selector of ['.manifest-strip','.route-grid','.challenger-grid','.result-grid','.skill-gallery'])assert.equal(value(selector,'grid-template-columns',390),'1fr');
assert.equal(value('.topbar','height',390),'65px');
assert.equal(value('.gear-card','flex'),'0 0 min(420px,88vw)');
assert.equal(value('.gear-card','min-height'),'320px');
assert.equal(value('.charms .gear-card','min-height'),'260px');
for(const width of [1440,1024,390])for(const rule of rulesAt(css,width))if(rule.selector.includes('.readable-text')){
 for(const declaration of rule.body.split(';').filter(Boolean))assert.ok(['font','font-size','line-height','letter-spacing','overflow-wrap'].includes(declaration.split(':')[0].trim()),'Typography must not change geometry: '+rule.selector);
}
assert.equal(value('.readable-text','font-size'),'16px');
assert.equal(value('.readable-text .illustrated-copy h3','font-size'),'20px');
assert.equal(value('.readable-text .illustrated-copy p','font-size'),'16px');
assert.equal(value('.readable-text .toolbar button','font-size'),'14px');
assert.equal(value('.action-title strong','font-size'),'14px');
assert.ok(!css.includes('font-size:35px'));
assert.ok(!css.includes(':is(.readable-text,.readable-text *)'));
assert.equal(value('.landing h1','font-size'),'clamp(65px,8vw,116px)');
assert.equal(value('.close','font-size'),'32px');
assert.equal(value('.is-unowned .card-illustration','filter'),'grayscale(1)');
assert.equal(value('.is-owned .card-illustration','filter'),'none');
assert.equal(value('.share-x','background'),'#000');assert.equal(value('.share-x','color'),'#fff');
assert.equal(value('.share-x','width'),'100%');assert.equal(value('.share-x','min-height'),'48px');
console.log('PASS original UI dimensions / desktop columns at 1440, 1024 and 820px / mobile breakpoints / bounded typography without a global multiplier');
