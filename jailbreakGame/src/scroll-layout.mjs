// Integer content extents avoid alternating bottom limits caused by float cancellation.
export function scrollMetrics(height,viewport,requested=0){
  const extent=Math.max(0,Math.round(height));
  const max=Math.max(0,extent-Math.floor(viewport));
  const offset=Math.max(0,Math.min(max,Math.round(requested)));
  return {max,offset,overflow:max>0,atBottom:offset>=max};
}
