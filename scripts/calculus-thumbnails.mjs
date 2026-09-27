const escapeXml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export const CALCULUS_THUMBNAIL_VARIANTS = ['calculus-level-sets','calculus-partial-derivative','calculus-saddle'];
export function calculusThumbnail(variant) {
  if (!CALCULUS_THUMBNAIL_VARIANTS.includes(variant)) throw new Error(`Unknown calculus thumbnail: ${variant}`);
  const saddle = variant === 'calculus-saddle';
  const partial = variant === 'calculus-partial-derivative';
  const project = (x,y,z) => [290+65*(x-y), 390+24*(x+y)-(saddle?35:28)*z];
  const path = (points,color,width=2,opacity=1) => `<polyline points="${points.map(p=>project(...p).map(n=>n.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
  const mesh=[];
  const f=(x,y)=>x*x+(saddle?-1:1)*y*y;
  const bound=saddle?1.7:2;
  for(let i=0;i<=16;i++){
    const fixed=-bound+2*bound*i/16;
    for(const swap of [false,true])mesh.push(path(Array.from({length:33},(_,j)=>{const t=-bound+2*bound*j/32;const x=swap?t:fixed,y=swap?fixed:t;return [x,y,f(x,y)];}),'#187d78',2,.5));
  }
  if(saddle){
    mesh.push(path(Array.from({length:65},(_,i)=>{const t=-1.7+i*3.4/64;return [t,0,t*t];}),'#e08528',7));
    mesh.push(path(Array.from({length:65},(_,i)=>{const t=-1.7+i*3.4/64;return [0,t,-t*t];}),'#8556b8',7));
  }else if(partial){
    mesh.push(path(Array.from({length:65},(_,i)=>{const x=-1.6+i*3.2/64;return [x,1,x*x+1];}),'#e08528',7));
    mesh.push(path([[.1,1,.2],[1.6,1,3.2]],'#8556b8',6));
  }else{
    for(const h of [1,2,4])mesh.push(path(Array.from({length:97},(_,i)=>{const a=i*Math.PI*2/96;return [Math.sqrt(h)*Math.cos(a),Math.sqrt(h)*Math.sin(a),h];}),'#e08528',h===2?6:3));
  }
  const title=saddle?'同一点，不同方向':partial?'固定 y，看切线斜率':'固定高度，看截线';
  const lines=saddle?['z = x² − y²','f(t,0) = t²','f(0,t) = −t²']:partial?['z = x² + y²','y = 1，z = x² + 1','P处切线：z = 2x']:['z = x² + y²','z = h → x² + y² = h','r = √h'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><rect width="1200" height="675" fill="#f7f2e8"/><rect x="35" y="45" width="535" height="505" rx="28" fill="#fffdf8" stroke="#d9d2c5"/>${mesh.join('')}<g font-family="system-ui, sans-serif" fill="#183b3a">${lines.map((t,i)=>`<text x="605" y="${160+i*95}" font-size="${i===0?44:34}">${escapeXml(t)}</text>`).join('')}<text x="605" y="470" font-size="34" font-weight="700">${title}</text><text x="50" y="610" font-size="30">用截面理解多元函数 · ${saddle?'03 鞍点':partial?'02 偏导数':'01 等高线'}</text></g></svg>\n`;
}
