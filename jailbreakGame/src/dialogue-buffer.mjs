// Pick portraits when messages enter the buffer, never while changing pages.
export function bufferedPoses(cache,key,count,pool,random=Math.random){
  if(cache[key]?.length===count&&cache[key].every(id=>pool.includes(id)))return cache[key];
  const ids=[];
  for(let i=0;i<count;i++){
    if(i%2)ids.push(ids[i-1]);
    else{const choices=pool.filter(id=>id!==ids[i-1]);ids.push(choices[Math.min(choices.length-1,Math.floor(random()*choices.length))]);}
  }
  cache[key]=ids;return ids;
}
