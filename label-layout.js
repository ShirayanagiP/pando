/* One glyph layout drives the live map and vector/PNG exports. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./territory-geometry.js'),require('./webfonts.js'));
  else root.PandoLabelLayout=factory(root.PandoGeometry,root.PandoFonts);
})(globalThis,(Geometry,Fonts)=>{
  'use strict';
  const cache=new WeakMap();
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const number=(value,fallback,min,max)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
  const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():null;
  function typography(settings={}){
    settings=settings||{};
    return {labelBold:settings.labelBold===true,labelItalic:settings.labelItalic===true,labelColor:color(settings.labelColor),
      labelOutlineColor:color(settings.labelOutlineColor),labelOutlineWidth:number(settings.labelOutlineWidth,1.5,0,10),
      labelSize:number(settings.labelSize,100,25,300),labelTracking:number(settings.labelTracking,6,-20,300)};
  }
  function metrics(lines,settings,kind){
    const style=typography(settings),tracking=style.labelTracking/100;
    return {width:Math.max(...lines.map(line=>Fonts.measure(line,settings)+Math.max(0,Array.from(line).length-1)*tracking))+.24+(style.labelItalic?.3:0)+(style.labelBold?.035:0),
      height:1.4+(lines.length-1)*1.25};
  }
  function positions(label,size=label.fontSize){
    const result=[],[cx,cy]=label.center;
    label.runs.forEach((run,row)=>{
      const gap=label.curve?.gap??label.tracking??(label.kind==='region'?0:.06);
      const width=run.reduce((sum,g)=>sum+g.advance,0)+Math.max(0,run.length-1)*gap;
      let cursor=-width/2;
      for(const glyph of run){
        const localX=(cursor+glyph.advance/2)*size;
        const curve=label.curve,half=Math.max(width*size/2,.01),localY=curve?curve.bend*localX*localX/half:0;
        const angle=curve?.angle??label.angle??0,cos=Math.cos(angle),sin=Math.sin(angle);
        const rowY=(row-(label.runs.length-1)/2)*1.25*size;
        result.push({glyph,x:cx+cos*localX-sin*(localY+rowY),y:cy+sin*localX+cos*(localY+rowY),
          angle:angle+(curve?Math.atan(2*curve.bend*localX/half):0)});
        cursor+=glyph.advance+gap;
      }
    });
    return result;
  }
  function fits(label,size=label.fontSize){
    if(size<=0)return false;
    if(!label.curve&&!Geometry.rectangleFits(label.shape,label.center,label.metrics.width*size,label.metrics.height*size,
      .45+(label.typography?.labelOutlineWidth||0)/2,label.angle||0))return false;
    return boxes(label,size).every(box=>Geometry.rectangleFits(label.shape,[box.x+box.width/2,box.y+box.height/2],box.width,box.height,.3));
  }
  function boxes(label,size=label.fontSize){
    return positions(label,size).filter(p=>p.glyph.d).map(p=>{
      const cos=Math.abs(Math.cos(p.angle)),sin=Math.abs(Math.sin(p.angle));
      const style=label.typography||typography(),bold=style.labelBold?.035:0,slant=style.labelItalic?Math.tan(Math.PI/15):0;
      const glyphWidth=p.glyph.width+p.glyph.height*slant+bold,glyphHeight=p.glyph.height+bold;
      const width=(glyphWidth*cos+glyphHeight*sin)*size+style.labelOutlineWidth,height=(glyphWidth*sin+glyphHeight*cos)*size+style.labelOutlineWidth;
      return {x:p.x-width/2,y:p.y-height/2,width,height};
    });
  }
  function axis(shape){
    const upright=angle=>Math.atan(Math.tan(angle));
    if(Number.isFinite(shape.preferredAngle))return upright(shape.preferredAngle);
    let xx=0,yy=0,xy=0;
    const [x,y]=shape.center;
    for(const [a,b] of shape.axisSegments||shape.segments){
      const dx=(a[0]+b[0])/2-x,dy=(a[1]+b[1])/2-y,weight=Math.hypot(a[0]-b[0],a[1]-b[1]);
      xx+=dx*dx*weight;yy+=dy*dy*weight;xy+=dx*dy*weight;
    }
    const angle=.5*Math.atan2(2*xy,xx-yy);
    return upright(angle);
  }
  function centered(shape,box,kind,angles=[0]){
    if(kind==='region'||!shape.centroid)return shape;
    const target=shape.centroid,distance=point=>Math.hypot(point[0]-target[0],point[1]-target[1]);
    const points=[target,shape.center,...[.25,.5,.75].map(t=>target.map((v,i)=>v+(shape.center[i]-v)*t)),...(shape.centers||[])];
    points.sort((a,b)=>distance(a)-distance(b));
    const probe=Math.min(12,shape.radius*.6);
    const point=points.find(point=>angles.some(angle=>Geometry.rectangleFits(shape,point,box.width*probe,box.height*probe,.45,angle)));
    return point?{...shape,center:point}:shape;
  }
  function layout(shape,lines,settings,kind){
    const style=typography(settings),tracking=style.labelTracking/100;
    const key=JSON.stringify([lines,Fonts.normalize(settings.fontFamily),Fonts.revision(),settings.labelStyle,settings.autoSpacing,style,kind]);
    const identity=shape.segments;
    if(!cache.has(identity))cache.set(identity,new Map());
    const memo=cache.get(identity);if(memo.has(key))return memo.get(key);
    const width=shape.bounds[2]-shape.bounds[0],height=shape.bounds[3]-shape.bounds[1];
    const single=lines.length===1&&Array.from(lines[0]).filter(c=>c.trim()).length===1;
    const primary=single?0:axis(shape),tall=Math.abs(primary)>Math.PI/4||height>width*1.25;
    const straightAngles=!single&&tall?[primary,primary<0?-Math.PI/2:Math.PI/2,0]:[0];
    const box=metrics(lines,settings,kind);shape=centered(shape,box,kind,straightAngles);
    const result={center:shape.center,fontSize:0,lines,kind,shape,metrics:box,runs:lines.map(line=>Fonts.run(line,settings)),curve:null,angle:0,tracking,typography:style};
    const curved=settings.labelStyle==='curved'&&kind!=='region'&&lines.length===1&&!single;
    const angles=[...new Set((curved?[primary,0,-Math.PI/8,Math.PI/8,...(tall?[primary<0?-Math.PI/2:Math.PI/2]:[])]:straightAngles).map(a=>Math.round(a*1e6)/1e6))];
    // Size every name from available space and its actual font metrics. There
    // is no country-size or character-count ceiling; labelSize scales this
    // starting footprint, then the precise polygon/halo tests enforce the fit.
    const maxFont=Math.max(...angles.map(angle=>{
      const cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle));
      return Math.min(width/(box.width*cos+box.height*sin),height/(box.width*sin+box.height*cos));
    }))*.72*style.labelSize/100;
    const candidates=[];
    for(const angle of angles)for(const bend of curved?[-.12,.12]:[0]){
      const candidate={...result,angle,curve:curved?{angle,bend,gap:tracking}:null};
      let lower=0,upper=maxFont;
      for(let i=0;i<18;i++){const size=(lower+upper)/2;if(fits(candidate,size))lower=size;else upper=size;}
      candidate.fontSize=lower;candidates.push(candidate);
    }
    // Compare directions at a readable size before using extra room for gaps.
    // A narrow horizontal placement must not beat a much larger vertical one.
    const largest=Math.max(...candidates.map(c=>c.fontSize));
    const finalists=candidates.filter(c=>c.fontSize>=largest*.995);
    const measure=gap=>({width:Math.max(...result.runs.map(run=>run.reduce((sum,g)=>sum+g.advance,0)+Math.max(0,run.length-1)*gap))+.24+(style.labelItalic?.3:0)+(style.labelBold?.035:0),height:box.height});
    for(const candidate of finalists){
      const slots=Math.max(...candidate.runs.map(run=>run.length-1));
      let low=tracking,high=Math.max(tracking,3);
      if(settings.autoSpacing!==false&&kind!=='region'&&slots&&candidate.fontSize>0){
        for(let step=0;step<11;step++){
          const gap=(low+high)/2;
          if(candidate.curve)candidate.curve.gap=gap;
          else{candidate.tracking=gap;candidate.metrics=measure(gap);}
          if(fits(candidate))low=gap;else high=gap;
        }
      }
      if(candidate.curve)candidate.curve.gap=low;
      else{candidate.tracking=low;candidate.metrics=measure(low);}
    }
    const score=c=>(c.curve?.gap??c.tracking)+(Math.abs(c.angle-angles[0])<1e-5?.025:0);
    Object.assign(result,finalists.reduce((best,c)=>score(c)>score(best)?c:best));
    if(result.curve){
      const ink=boxes(result),halfWidth=Math.max(0,...ink.map(b=>Math.max(Math.abs(b.x-result.center[0]),Math.abs(b.x+b.width-result.center[0]))));
      const halfHeight=Math.max(0,...ink.map(b=>Math.max(Math.abs(b.y-result.center[1]),Math.abs(b.y+b.height-result.center[1]))));
      result.metrics={width:halfWidth*2/Math.max(result.fontSize,.01),height:halfHeight*2/Math.max(result.fontSize,.01)};
    }
    // Logical width/height are used by the oriented fit test. The viewport
    // needs the actual rotated ink extents, with the fixed-width halo separate.
    const ink=boxes(result,1),halo=style.labelOutlineWidth;
    result.inkMetrics={width:Math.max(0,...ink.map(b=>2*Math.max(Math.abs(b.x-result.center[0]),Math.abs(b.x+b.width-result.center[0]))-halo)),
      height:Math.max(0,...ink.map(b=>2*Math.max(Math.abs(b.y-result.center[1]),Math.abs(b.y+b.height-result.center[1]))-halo))};
    if(memo.size>40)memo.clear();memo.set(key,result);return result;
  }
  function viewportFontSize(label,scale,availableWidth,availableHeight){
    if(!(scale>0))return 0;
    const metric=label.inkMetrics||label.metrics,halo=label.typography?.labelOutlineWidth||0;
    return Math.max(0,Math.min(label.fontSize,
      (availableWidth/scale-halo)/Math.max(.001,metric.width),(availableHeight/scale-halo)/Math.max(.001,metric.height)));
  }
  function markup(label,size=label.fontSize){
    if(size<=0)return '';
    const style=label.typography||typography(),bold=style.labelBold?.035:0;
    return positions(label,size).filter(p=>p.glyph.d).map(p=>{
      const transform=`translate(${p.x} ${p.y}) rotate(${p.angle*180/Math.PI}) scale(${size})${style.labelItalic?' skewX(-12)':''}`;
      const outline=style.labelOutlineWidth?style.labelOutlineWidth/size+bold:0;
      return `<g transform="${transform}" stroke-linejoin="round" stroke-linecap="round"><path data-glyph="${esc(p.glyph.char)}" d="${p.glyph.d}" stroke-width="${outline}"${style.labelOutlineWidth?'':' stroke="none"'}/>${bold?`<path data-bold-glyph="${esc(p.glyph.char)}" d="${p.glyph.d}" stroke="currentColor" stroke-width="${bold}"/>`:''}</g>`;
    }).join('');
  }
  return {layout,metrics,positions,fits,boxes,markup,typography,viewportFontSize};
});
