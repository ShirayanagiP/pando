/* Screen-scale geometry selection. Exports continue using the complete topology. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PandoRenderer=factory();
})(globalThis,()=>{
  'use strict';
  const indexes=new WeakMap();
  const regionIndexes=new WeakMap();
  const outlines=new WeakMap();
  const outlineSeams=new WeakMap();
  const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
  function tier(scale,thresholds=[.018,.075]){return scale<thresholds[0]?0:scale<thresholds[1]?1:2;}
  function windows(bounds,wrap){
    if(!wrap)return [bounds];
    return [-wrap.period,0,wrap.period].map(offset=>[bounds[0]-offset,bounds[1],bounds[2]-offset,bounds[3]]);
  }
  function inView(bounds,views){return !bounds||views.some(view=>intersects(bounds,view));}
  function path(item,level){return item.lod?.[level]||item.d;}
  function outline(d,data){
    if(!data.wrap)return d;
    const {left,period}=data.wrap,right=left+period;
    let keys=outlineSeams.get(data);
    if(!keys){
      // SVG paths retain two decimals; topology paths omit trailing zeros.
      // Independently rounded window endpoints can also differ by one grid unit.
      keys=[...new Set([left,right].flatMap(value=>[-.02,-.01,0,.01,.02].flatMap(delta=>{
        const fixed=(value+delta).toFixed(2);return [fixed+',',Number(fixed)+','];
      })))];outlineSeams.set(data,keys);
    }
    if(!keys.some(key=>d.includes(key)))return d;
    let cache=outlines.get(data);if(!cache){cache=new Map();outlines.set(data,cache);}
    if(cache.has(d))return cache.get(d);
    const seam=(a,b)=>Math.abs(a[0]-b[0])<.025&&(Math.abs(a[0]-left)<.025||Math.abs(a[0]-right)<.025);
    const tokens=d.match(/[MLZ]|[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)||[];
    let point=null,start=null,pen=null,output='';
    const segment=next=>{
      if(point&&!seam(point,next)){
        if(!pen||pen[0]!==point[0]||pen[1]!==point[1])output+='M'+point.join(',');
        output+='L'+next.join(',');pen=next;
      }else pen=null;
      point=next;
    };
    for(let i=0;i<tokens.length;){
      const command=tokens[i++].toUpperCase();
      if(command==='Z'){if(start)segment(start);point=null;pen=null;continue;}
      const next=[Number(tokens[i++]),Number(tokens[i++])];
      if(command==='M'){point=next;start=next;pen=null;}else segment(next);
    }
    if(cache.size>800)cache.clear();cache.set(d,output);return output;
  }
  function tree(items){
    if(!items.length)return null;
    const bounds=[Math.min(...items.map(i=>i.bounds[0])),Math.min(...items.map(i=>i.bounds[1])),Math.max(...items.map(i=>i.bounds[2])),Math.max(...items.map(i=>i.bounds[3]))];
    if(items.length<=24)return {bounds,items};
    const axis=bounds[2]-bounds[0]>bounds[3]-bounds[1]?0:1;
    items.sort((a,b)=>a.bounds[axis]+a.bounds[axis+2]-b.bounds[axis]-b.bounds[axis+2]);
    const middle=Math.floor(items.length/2);return {bounds,children:[tree(items.slice(0,middle)),tree(items.slice(middle))]};
  }
  function query(node,views,result){
    if(!node||!inView(node.bounds,views))return;
    if(node.items){for(const item of node.items)if(inView(item.bounds,views))result.push(item);}
    else for(const child of node.children)query(child,views,result);
  }
  function scene(project,data,{scale,bounds,wrap=null}){
    const level=tier(scale,data.rendering?.thresholds),views=windows(bounds,wrap),scope=project.visibleCountries?new Set(project.visibleCountries):null;
    let regionIndex=regionIndexes.get(data);
    if(!regionIndex){regionIndex={tree:tree(data.regions.filter(r=>r.bounds)),unbounded:data.regions.filter(r=>!r.bounds)};regionIndexes.set(data,regionIndex);}
    const candidatesInView=[...regionIndex.unbounded];query(regionIndex.tree,views,candidatesInView);
    const visible=new Set(candidatesInView.filter(r=>!scope||scope.has(r.country)).map(r=>r.id));
    const chunks=[];
    if(project.settings.regionBorders&&data.rendering){
      let index=indexes.get(data);
      if(!index){index=tree(data.rendering.chains.map((chain,id)=>({...chain,id})));indexes.set(data,index);}
      const candidates=[];query(index,views,candidates);
      const groups=new Map(project.groups.map(g=>[g.id,g.color.toLowerCase()]));
      const colors=data.regions.map(r=>groups.get(project.assignments[r.id])||null);
      let lines=[],count=0;
      for(const chain of candidates){
        if(level<2&&Math.hypot(chain.bounds[2]-chain.bounds[0],chain.bounds[3]-chain.bounds[1])*scale<(level===0?2:.7))continue;
        const own=chain.owners.filter(i=>!scope||scope.has(data.regions[i].country));if(!own.length)continue;
        if(!project.forceRegionBorders&&own.length>1&&colors[own[0]]&&own.every(i=>colors[i]===colors[own[0]]))continue;
        const boundaryKey=data.rendering.internalTier==='province'?'provinceId':'country';
        const internal=own.length>1&&data.regions[own[0]].country!=='ata'&&own.every(i=>data.regions[i][boundaryKey]===data.regions[own[0]][boundaryKey]);
        if(internal&&(level===0||(level===1&&Math.min(...own.map(i=>Math.sqrt(data.regions[i].area)))*scale<5)))continue;
        const line=outline(chain.paths[level],data);if(!line)continue;
        lines.push(line);count++;
        if(lines.length===192){chunks.push({id:String(chunks.length),d:lines.join('')});lines=[];}
      }
      if(lines.length)chunks.push({id:String(chunks.length),d:lines.join('')});
      return {level,visible,views,chunks,borderCount:count};
    }
    return {level,visible,views,chunks,borderCount:0};
  }
  function normalizePan(x,k,frame,wrap){
    const center=(frame[0]+frame[2]/2-x)/k;
    const normalized=wrap.left+((center-wrap.left)%wrap.period+wrap.period)%wrap.period;
    return x+(center-normalized)*k;
  }
  // Screen-space glyph collision queries keep the original exact overlap rule.
  function collisionIndex(padding=2,cellSize=128){
    const cells=new Map(),large=[],all=[];
    const range=b=>[Math.floor((b.x-padding)/cellSize),Math.floor((b.y-padding)/cellSize),Math.floor((b.x+b.width+padding)/cellSize),Math.floor((b.y+b.height+padding)/cellSize)];
    const overlaps=(a,b)=>a.x<b.x+b.width+padding&&a.x+a.width+padding>b.x&&a.y<b.y+b.height+padding&&a.y+a.height+padding>b.y;
    function add(box){all.push(box);const [l,t,r,b]=range(box);if((r-l+1)*(b-t+1)>256){large.push(box);return;}for(let x=l;x<=r;x++)for(let y=t;y<=b;y++){const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(box);}}
    function intersects(box){const [l,t,r,b]=range(box);if((r-l+1)*(b-t+1)>256)return all.some(other=>overlaps(box,other));if(large.some(other=>overlaps(box,other)))return true;for(let x=l;x<=r;x++)for(let y=t;y<=b;y++)if(cells.get(x+','+y)?.some(other=>overlaps(box,other)))return true;return false;}
    return {add,intersects};
  }
  return {tier,windows,inView,path,outline,scene,normalizePan,collisionIndex};
});
