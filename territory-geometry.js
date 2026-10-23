/* Shared polygon edges let painted districts dissolve without losing hit targets. */
((root,factory)=>{
  const geometry=factory();
  if(typeof module==='object'&&module.exports)module.exports=geometry;
  else root.PandoGeometry=geometry;
})(globalThis,()=>{
  'use strict';
  const Tree=typeof module==='object'&&module.exports?require('./legend-tree.js'):globalThis.PandoLegendTree;
  const outlineCaches=new WeakMap();
  const caches=new WeakMap();
  const regionShapes=new WeakMap();
  const coastalCaches=new WeakMap();
  const landCaches=new WeakMap();
  const mainlandCaches=new WeakMap();
  const segmentIndexes=new WeakMap();
  const borderCaches=new WeakMap();
  // The same boundary is queried thousands of times while fitting glyphs. Keep
  // exact segments in a bounding-volume tree instead of rescanning the coast.
  function segmentIndex(segments){
    if(segmentIndexes.has(segments))return segmentIndexes.get(segments);
    const items=segments.map(([a,b])=>({a,b,left:Math.min(a[0],b[0]),right:Math.max(a[0],b[0]),top:Math.min(a[1],b[1]),bottom:Math.max(a[1],b[1])}));
    function build(items){
      const node={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
      for(const item of items){node.left=Math.min(node.left,item.left);node.right=Math.max(node.right,item.right);node.top=Math.min(node.top,item.top);node.bottom=Math.max(node.bottom,item.bottom);}
      if(items.length<=12)node.items=items;
      else{
        const horizontal=node.right-node.left>=node.bottom-node.top;
        items.sort(horizontal?(a,b)=>(a.left+a.right)-(b.left+b.right):(a,b)=>(a.top+a.bottom)-(b.top+b.bottom));
        const mid=items.length>>1;node.first=build(items.slice(0,mid));node.second=build(items.slice(mid));
      }
      return node;
    }
    const index=build(items);segmentIndexes.set(segments,index);return index;
  }
  function containsPoint(x,y,index){
    let inside=false;
    function visit(node){
      if(y<node.top||y>=node.bottom||x>=node.right)return;
      if(node.items){
        for(const {a,b} of node.items)if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      }else{visit(node.first);visit(node.second);}
    }
    visit(index);return inside;
  }
  function squaredDistance(x,y,a,b){
    const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length)):0;
    return (x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2;
  }
  function signedDistance(x,y,segments){
    const index=segmentIndex(segments);
    let minimum=Infinity;
    function lowerBound(node){return Math.max(node.left-x,0,x-node.right)**2+Math.max(node.top-y,0,y-node.bottom)**2;}
    function visit(node){
      if(lowerBound(node)>=minimum)return;
      if(node.items){for(const {a,b} of node.items)minimum=Math.min(minimum,squaredDistance(x,y,a,b));}
      else{
        const a=lowerBound(node.first),b=lowerBound(node.second);
        if(a<b){visit(node.first);visit(node.second);}else{visit(node.second);visit(node.first);}
      }
    }
    visit(index);return (containsPoint(x,y,index)?1:-1)*Math.sqrt(minimum);
  }
  function anchorPoint(segments,bounds,seeds){
    const [x1,y1,x2,y2]=bounds;
    let best={x:seeds[0][0],y:seeds[0][1],d:-Infinity};
    for(const [x,y] of [...seeds,[(x1+x2)/2,(y1+y2)/2]]){
      const d=signedDistance(x,y,segments);if(d>best.d)best={x,y,d};
    }
    const queue=[];
    function push(cell){
      let i=queue.length;queue.push(cell);
      while(i){const parent=(i-1)>>1;if(queue[parent].max>=cell.max)break;queue[i]=queue[parent];i=parent;}queue[i]=cell;
    }
    function pop(){
      const first=queue[0],last=queue.pop();if(!queue.length)return first;
      let i=0;
      while(i*2+1<queue.length){let child=i*2+1;if(child+1<queue.length&&queue[child+1].max>queue[child].max)child++;if(queue[child].max<=last.max)break;queue[i]=queue[child];i=child;}queue[i]=last;return first;
    }
    function cell(x,y,h){const d=signedDistance(x,y,segments);return {x,y,h,d,max:d+h*Math.SQRT2};}
    const size=Math.max(Math.min(x2-x1,y2-y1),Math.max(x2-x1,y2-y1)/12,.1);
    for(let x=x1;x<x2;x+=size)for(let y=y1;y<y2;y+=size)push(cell(x+size/2,y+size/2,size/2));
    for(let iteration=0;queue.length&&iteration<600;iteration++){
      const next=pop();if(next.d>best.d)best=next;
      if(next.max-best.d<=.35)continue;
      const h=next.h/2;
      push(cell(next.x-h,next.y-h,h));push(cell(next.x+h,next.y-h,h));
      push(cell(next.x-h,next.y+h,h));push(cell(next.x+h,next.y+h,h));
    }
    return {center:[best.x,best.y],radius:Math.max(.1,best.d)};
  }
  function tracePath(boundary,topology){
    const incident=new Map(),remaining=new Set(boundary);
    for(const index of boundary)for(const vertex of topology.edges[index].slice(0,2)){
      if(!incident.has(vertex))incident.set(vertex,[]);incident.get(vertex).push(index);
    }
    const paths=[];
    while(remaining.size){
      const start=topology.edges[remaining.values().next().value][0],stack=[start],ring=[];
      while(stack.length){
        const vertex=stack[stack.length-1],options=incident.get(vertex)||[];
        while(options.length&&!remaining.has(options[options.length-1]))options.pop();
        if(!options.length){ring.push(stack.pop());continue;}
        const index=options.pop(),edge=topology.edges[index];remaining.delete(index);
        stack.push(edge[0]===vertex?edge[1]:edge[0]);
      }
      if(ring.length>3)paths.push('M'+ring.map(index=>topology.points[index].join(',')).join('L')+'Z');
    }
    return paths.join('');
  }
  function outline(members,data){
    const topology=data.topology,memberSet=new Set(members),candidate=new Set();
    for(const index of members)for(const edge of topology.regionEdges[index])candidate.add(edge);
    const boundary=[...candidate].filter(index=>topology.edges[index].slice(2).filter(owner=>memberSet.has(owner)).length===1);
    const segments=boundary.map(index=>topology.edges[index].slice(0,2).map(i=>topology.points[i]));
    const bounds=[Infinity,Infinity,-Infinity,-Infinity];
    for(const segment of segments)for(const [x,y] of segment){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}
    return {d:tracePath(boundary,topology),bounds,segments};
  }
  function massCenter(members,data){
    let area=0,x=0,y=0;
    for(const index of members){
      const region=data.regions[index],weight=region.area||1,point=region.centroid||region.center;
      area+=weight;x+=point[0]*weight;y+=point[1]*weight;
    }
    return {area,center:[x/area,y/area]};
  }
  function componentShape(members,data){
    if(!caches.has(data))caches.set(data,new Map());
    const cache=caches.get(data),key=members.join(',');if(cache.has(key))return cache.get(key);
    const boundary=outline(members,data);
    const anchor=anchorPoint(boundary.segments,boundary.bounds,members.map(index=>data.regions[index].center));
    const result={...boundary,...anchor,centroid:massCenter(members,data).center,
      centers:members.map(index=>data.regions[index].centroid||data.regions[index].center)};
    if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
  }
  function colorTerritories(project,data,{labels=true}={}){
    const groups=new Map(project.groups.map(g=>[g.id,g]));
    const colors=data.regions.map(r=>groups.get(project.assignments[r.id])?.color.toLowerCase()||null);
    const visited=new Set(),result=[];
    for(let index=0;index<data.regions.length;index++){
      if(!colors[index]||visited.has(index))continue;
      const members=[],queue=[index];visited.add(index);
      while(queue.length){
        const current=queue.pop();members.push(current);
        for(const neighbor of data.topology.neighbors[current])if(!visited.has(neighbor)&&colors[neighbor]===colors[index]){visited.add(neighbor);queue.push(neighbor);}
      }
      members.sort((a,b)=>a-b);
      result.push({id:'territory-'+members[0],color:colors[index],members,regionIds:members.map(i=>data.regions[i].id),...(labels?componentShape(members,data):cachedOutline(members,data))});
    }
    return result;
  }
  function familyTerritories(project,data){
    const groups=new Map(project.groups.map(g=>[g.id,g])),members=new Map();
    data.regions.forEach((region,index)=>{
      const group=groups.get(project.assignments[region.id]);if(!group)return;
      const root=Tree.ancestors(group,groups)[0].id;
      if(!members.has(root))members.set(root,[]);members.get(root).push(index);
    });
    return [...members].map(([id,indices])=>({id:'family-'+id,groupId:id,color:groups.get(id).color,
      members:indices,regionIds:indices.map(i=>data.regions[i].id),...componentShape(indices,data)}));
  }
  function cachedOutline(indices,data){
    let cache=outlineCaches.get(data);if(!cache){cache=new Map();outlineCaches.set(data,cache);}
    const key=indices.join(',');if(!cache.has(key)){if(cache.size>=1024)cache.delete(cache.keys().next().value);cache.set(key,outline(indices,data));}return cache.get(key);
  }
  function hierarchyTerritories(project,data){
    const groups=Tree.index(project.groups),members=new Map(),parents=new Set(project.groups.map(g=>g.parentId));
    for(const [i,region]of data.regions.entries())for(const group of Tree.ancestors(groups.get(project.assignments[region.id]),groups)){
      if(group.parentId&&!parents.has(group.id))continue;
      if(!members.has(group.id))members.set(group.id,[]);members.get(group.id).push(i);
    }
    return Tree.ordered(project.groups).filter(g=>members.has(g.id)).map(g=>({id:'family-'+g.id,groupId:g.id,color:g.color,depth:Tree.depth(g,groups),...cachedOutline(members.get(g.id),data)}));
  }
  function outlineTerritories(project,data){
    const scope=project.visibleCountries?new Set(project.visibleCountries):null;
    const visible=project.visibleRegionIds?new Set(project.visibleRegionIds):null;
    return (project.outlineLayers||[]).filter(l=>l.visible!==false&&l.width!==0).flatMap(layer=>{
      const ids=new Set(layer.regionIds),indices=[];for(const [i,r]of data.regions.entries())if(ids.has(r.id)&&(!scope||scope.has(r.country))&&(!visible||visible.has(r.id)))indices.push(i);
      return indices.length?[{...layer,...cachedOutline(indices,data)}]:[];
    });
  }
  function regionShape(index,data){
    let shapes=regionShapes.get(data);if(!shapes){shapes=new Map();regionShapes.set(data,shapes);}
    if(!shapes.has(index))shapes.set(index,componentShape([index],data));
    return shapes.get(index);
  }
  function landParts(shape,data){
    let parts=landCaches.get(shape.segments);
    if(!parts){
      const rings=[];
      for(const match of shape.d.matchAll(/M([^MZ]+)Z/g)){
        const points=match[1].split('L').map(point=>point.split(',').map(Number));
        if(points.length>1&&points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1])points.pop();
        if(points.length<3)continue;
        const segments=points.map((point,i)=>[point,points[(i+1)%points.length]]),bounds=[Infinity,Infinity,-Infinity,-Infinity];
        let twiceArea=0,momentX=0,momentY=0;
        for(const [a,b] of segments){
          bounds[0]=Math.min(bounds[0],a[0]);bounds[1]=Math.min(bounds[1],a[1]);bounds[2]=Math.max(bounds[2],a[0]);bounds[3]=Math.max(bounds[3],a[1]);
          const cross=a[0]*b[1]-b[0]*a[1];twiceArea+=cross;momentX+=(a[0]+b[0])*cross;momentY+=(a[1]+b[1])*cross;
        }
        if(Math.abs(twiceArea)<1e-7)continue;
        rings.push({d:'M'+points.map(point=>point.join(',')).join('L')+'Z',points,segments,bounds,area:Math.abs(twiceArea)/2,
          centroid:[momentX/(3*twiceArea),momentY/(3*twiceArea)],parent:null});
      }
      // Ring orientation is arbitrary after merging. Containment distinguishes lakes from islands.
      for(const ring of rings){
        for(const other of rings){
          if(other.area<=ring.area||ring.parent&&other.area>=ring.parent.area)continue;
          if(ring.bounds[0]<other.bounds[0]||ring.bounds[1]<other.bounds[1]||ring.bounds[2]>other.bounds[2]||ring.bounds[3]>other.bounds[3])continue;
          if(signedDistance(...ring.points[0],other.segments)>0)ring.parent=other;
        }
      }
      const depth=ring=>ring.parent?1+depth(ring.parent):0;
      parts=rings.filter(ring=>depth(ring)%2===0).map(outer=>{
        const holes=rings.filter(ring=>ring.parent===outer),boundaries=[outer,...holes];
        const segments=boundaries.flatMap(ring=>ring.segments),area=outer.area-holes.reduce((sum,ring)=>sum+ring.area,0);
        const centroid=[0,1].map(axis=>(outer.centroid[axis]*outer.area-holes.reduce((sum,ring)=>sum+ring.centroid[axis]*ring.area,0))/area);
        const centers=(shape.centers||[]).filter(point=>signedDistance(...point,segments)>0);
        const anchor=anchorPoint(segments,outer.bounds,[centroid,...centers]);
        return {d:boundaries.map(ring=>ring.d).join(''),segments,bounds:outer.bounds,centroid,centers,area,...anchor};
      }).sort((a,b)=>b.area-a.area);
      // Degenerate merged paths retain the previous safe placement.
      if(!parts.length)parts=[shape];
      landCaches.set(shape.segments,parts);
    }
    return parts.map((part,index)=>{
      const members=shape.members.filter(i=>{
        const b=data.regions[i].bounds,p=part.bounds;
        return b[2]>=p[0]&&b[0]<=p[2]&&b[3]>=p[1]&&b[1]<=p[3];
      });
      return {...shape,...part,id:index?shape.id+'-land-'+index:shape.id,groupId:shape.groupId,members,regionIds:members.map(i=>data.regions[i].id)};
    });
  }
  function islandLabelParts(shape,data,minimumAreaKm2=100){
    const parts=landParts(shape,data);
    let mainland=mainlandCaches.get(data);
    if(!mainland){
      if(data.mainlands){
        mainland=data.mainlands.map(part=>({...part,segments:[...part.d.matchAll(/M([^MZ]+)Z/g)].flatMap(match=>{
          const points=match[1].split('L').map(p=>p.split(',').map(Number));
          return points.slice(0,-1).map((p,i)=>[p,points[i+1]]);
        })}));
      }else{
        const members=data.regions.map((_,i)=>i),whole={id:'country-land',members,centers:[],...outline(members,data)};
        mainland=[{...landParts(whole,data)[0],kind:'continent'}];
      }
      mainlandCaches.set(data,mainland);
    }
    // Keep the primary mainland name. Island names also need enough painted area.
    // Classify against the whole country so an unpainted district cannot turn mainland into an island.
    return parts.filter((part,index)=>{
      const physical=mainland.find(land=>{
        const [x,y]=part.center,b=land.bounds;
        return x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]&&signedDistance(x,y,land.segments)>=0;
      });
      if(physical?.kind==='continent')return index===0;
      if(index===0&&physical?.kind==='large-island')return true;
      return part.area*(data.areaKm2PerUnit||1)>=minimumAreaKm2;
    });
  }
  function coastalLabelShape(shape,data){
    if(!coastalCaches.has(data))coastalCaches.set(data,new Map());
    const memo=coastalCaches.get(data),key=shape.members.join(',');if(memo.has(key))return memo.get(key);
    const members=new Set(shape.members),visited=new Set(),pieces=[];
    for(const index of members){
      if(visited.has(index))continue;
      const indices=[],queue=[index];visited.add(index);
      while(queue.length){
        const current=queue.pop();indices.push(current);
        for(const neighbor of data.topology.neighbors[current])if(members.has(neighbor)&&!visited.has(neighbor)){visited.add(neighbor);queue.push(neighbor);}
      }
      pieces.push({...massCenter(indices,data),members:indices});
    }
    const total=pieces.reduce((sum,piece)=>sum+piece.area,0),largest=Math.max(...pieces.map(piece=>piece.area));
    // Tiny offshore specks should not pull a mainland label out to sea. Substantial islands should.
    const main=pieces.filter(piece=>piece.area>=Math.min(total*.05,largest));
    const centroid=main.length>1?[0,1].map(axis=>main.reduce((sum,piece)=>sum+piece.center[axis],0)/main.length):shape.centroid;
    const focus=main.flatMap(piece=>piece.members),bounds=[Infinity,Infinity,-Infinity,-Infinity];
    for(const index of focus){const b=data.regions[index].bounds;bounds[0]=Math.min(bounds[0],b[0]);bounds[1]=Math.min(bounds[1],b[1]);bounds[2]=Math.max(bounds[2],b[2]);bounds[3]=Math.max(bounds[3],b[3]);}
    const pad=Math.max(8,Math.min(20,shape.radius*.4)),limits=[bounds[0]-pad,bounds[1]-pad,bounds[2]+pad,bounds[3]+pad];
    const excluded=[];
    data.regions.forEach((region,index)=>{
      const b=region.bounds;
      if(!members.has(index)&&b[2]>=limits[0]&&b[0]<=limits[2]&&b[3]>=limits[1]&&b[1]<=limits[3])excluded.push(index);
    });
    const forbidden=excluded.length?outline(excluded,data):{d:'',segments:[]};
    const [left,top,right,bottom]=limits,rect=[[left,top],[right,top],[right,bottom],[left,bottom]];
    const frame='M'+rect.map(point=>point.join(',')).join('L')+'Z';
    let preferredAngle;
    if(main.length>1){
      let xx=0,yy=0,xy=0;
      for(const piece of main){const x=piece.center[0]-centroid[0],y=piece.center[1]-centroid[1];xx+=x*x;yy+=y*y;xy+=x*y;}
      preferredAngle=.5*Math.atan2(2*xy,xx-yy);
    }
    const result={...shape,bounds,centroid,preferredAngle,axisSegments:shape.segments,limits,
      d:frame+forbidden.d,segments:[...rect.map((point,i)=>[point,rect[(i+1)%4]]),...forbidden.segments],
      mask:{limits,forbiddenD:forbidden.d}};
    if(memo.size>=512)memo.delete(memo.keys().next().value);memo.set(key,result);return result;
  }
  function visibleBorders(project,data){
    return visibleBorderChunks(project,data).map(chunk=>chunk.d).join('');
  }
  function visibleBorderChunks(project,data){
    if(!project.settings.regionBorders)return [];
    const groups=new Map(project.groups.map(g=>[g.id,g]));
    const colors=data.regions.map(r=>project.forceRegionBorders?r.id:groups.get(project.assignments[r.id])?.color.toLowerCase()||null);
    const scope=project.visibleCountries?new Set(project.visibleCountries):null;
    const visibility=data.regions.map(r=>!scope||scope.has(r.country));
    const size=1024,topology=data.topology;
    let cache=borderCaches.get(data);
    if(!cache){
        const lines=new Array(topology.edges.length);
      cache={lines,colors:null,visibility:null,chunks:Array.from({length:Math.ceil(lines.length/size)},(_,i)=>{
        const bounds=[Infinity,Infinity,-Infinity,-Infinity];
        for(let edge=i*size;edge<Math.min((i+1)*size,topology.edges.length);edge++)for(const point of topology.edges[edge].slice(0,2)){
          const [x,y]=topology.points[point];bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);
        }
        return {id:String(i),d:'',bounds};
      })};
      borderCaches.set(data,cache);
    }
    const dirty=new Set();
    if(!cache.colors)for(let i=0;i<cache.chunks.length;i++)dirty.add(i);
    else for(let region=0;region<colors.length;region++)if(colors[region]!==cache.colors[region]||visibility[region]!==cache.visibility[region]){
      for(const edge of topology.regionEdges[region])dirty.add(Math.floor(edge/size));
    }
    for(const chunk of dirty){
      const lines=[];
      for(let i=chunk*size;i<Math.min((chunk+1)*size,topology.edges.length);i++){
        const owners=topology.edges[i];
        if(!owners.slice(2).some(owner=>visibility[owner]))continue;
        if(owners.length>3&&colors[owners[2]]&&owners.slice(3).every(owner=>colors[owner]===colors[owners[2]]))continue;
          if(!cache.lines[i])cache.lines[i]='M'+topology.points[owners[0]].join(',')+'L'+topology.points[owners[1]].join(',');
          lines.push(cache.lines[i]);
      }
      cache.chunks[chunk]={...cache.chunks[chunk],d:lines.join('')};
    }
    cache.colors=colors;cache.visibility=visibility;return cache.chunks;
  }
  // Corners alone cannot detect a rectangle crossing a concavity or enclosing a hole.
  function rectangleFits(shape,center,width,height,padding=0,angle=0){
    const [x,y]=center,rx=width/2+padding,ry=height/2+padding;
    const cos=Math.cos(angle),sin=Math.sin(angle),ex=Math.abs(cos)*rx+Math.abs(sin)*ry,ey=Math.abs(sin)*rx+Math.abs(cos)*ry;
    const left=x-ex,right=x+ex,top=y-ey,bottom=y+ey;
    if(shape.limits&&(left<=shape.limits[0]||top<=shape.limits[1]||right>=shape.limits[2]||bottom>=shape.limits[3]))return false;
    const index=segmentIndex(shape.segments);
    for(const [dx,dy] of [[-rx,-ry],[rx,-ry],[-rx,ry],[rx,ry]])if(!containsPoint(x+cos*dx-sin*dy,y+sin*dx+cos*dy,index))return false;
    function intersects(node){
      if(node.right<left||node.left>right||node.bottom<top||node.top>bottom)return false;
      if(!node.items)return intersects(node.first)||intersects(node.second);
      for(const {a:sourceA,b:sourceB} of node.items){
      if(Math.max(sourceA[0],sourceB[0])<left||Math.min(sourceA[0],sourceB[0])>right||Math.max(sourceA[1],sourceB[1])<top||Math.min(sourceA[1],sourceB[1])>bottom)continue;
      const local=p=>[cos*(p[0]-x)+sin*(p[1]-y),-sin*(p[0]-x)+cos*(p[1]-y)];
      const a=local(sourceA),b=local(sourceB);
      let low=0,high=1;
      for(let axis=0;axis<2;axis++){
        const delta=b[axis]-a[axis],min=axis?-ry:-rx,max=axis?ry:rx;
        if(Math.abs(delta)<1e-10){if(a[axis]<min||a[axis]>max){low=2;break;}continue;}
        const t1=(min-a[axis])/delta,t2=(max-a[axis])/delta;
        low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));
      }
      if(low<=high)return true;
      }
      return false;
    }
    return !intersects(index);
  }
  function labelPlacement(shape,metrics,maxFontSize=32){
    // Fit the complete text block and halo to the polygon, including islands and holes.
    let low=0,high=maxFontSize;
    for(let i=0;i<18;i++){
      const size=(low+high)/2;
      if(rectangleFits(shape,shape.center,metrics.width*size,metrics.height*size,.45))low=size;else high=size;
    }
    return {center:shape.center,fontSize:low};
  }
  return {colorTerritories,familyTerritories,hierarchyTerritories,outlineTerritories,regionShape,landParts,islandLabelParts,coastalLabelShape,visibleBorders,visibleBorderChunks,labelPlacement,rectangleFits,signedDistance};
});
