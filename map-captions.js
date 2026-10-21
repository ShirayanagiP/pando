/* Shared SVG captions for the editor and exported maps. */
((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else root.PandoCaptions=factory();})(globalThis,()=>{
  'use strict';
  const Tree=typeof module==='object'&&module.exports?require('./legend-tree.js'):globalThis.PandoLegendTree;
  const Fonts=typeof module==='object'&&module.exports?require('./webfonts.js'):globalThis.PandoFonts;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const clamp=(n,min,max,fallback)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  function settings(input={}){input=input||{};return {legendTitle:typeof input.legendTitle==='string'?input.legendTitle.slice(0,80):'범례',legendColumns:Math.round(clamp(input.legendColumns,1,6,4)),legendFontSize:clamp(input.legendFontSize,8,24,12)};}
  function wrap(text,width,size,settings){
    const lines=[];let line='',used=0;for(const ch of Array.from(text||'이름 없는 범례')){const advance=size*(settings?Fonts.glyph(ch,settings).advance:(/[\u0000-\u007f]/.test(ch)?.55:1));if(line&&used+advance>width){lines.push(line);line='';used=0;}line+=ch;used+=advance;}if(line)lines.push(line);return lines;
  }
  const text=(x,y,value,size=12,attrs='')=>`<text x="${x}" y="${y}" font-size="${size}" ${attrs}>${esc(value)}</text>`;
  function documentSVG(body,width,height,label,settings={}){return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}"><g font-family="${esc(Fonts.cssFamily(settings))}" fill="#365344" stroke="none">${body}</g></svg>`;}
  function compactLegend(project,counts,width=1210,options={}){
    const s=settings(project.settings),size=s.legendFontSize,columns=Math.min(options.columns||s.legendColumns,Math.max(1,project.groups.length)),gap=22,pad=16,columnWidth=(width-pad*2-gap*(columns-1))/columns,lineHeight=size*1.5;
    const titleLines=wrap(s.legendTitle||'범례',width-pad*2,size+2,project.settings),headingHeight=Math.max(40,pad+titleLines.length*(size+8)+8);
    const roots=project.groups.filter(g=>!g.parentId),target=Math.max(5,Math.ceil(project.groups.length/columns)),blocks=[];
    const byId=Tree.index(project.groups);
    for(const root of roots){const members=Tree.descendants(root.id,project.groups).slice(1).map(id=>byId.get(id));const parts=members.length?Array.from({length:Math.ceil(members.length/Math.max(1,target-1))},(_,i)=>members.slice(i*(target-1),(i+1)*(target-1))):[[]];
      parts.forEach((part,index)=>{const context=part.length?Tree.ancestors(part[0],byId).slice(1,-1):[];
        const rows=[{group:root,depth:0,continuation:index>0},...context.map(group=>({group,depth:Tree.depth(group,byId),continuation:true})),...part.map(group=>({group,depth:Tree.depth(group,byId)}))];let y=8;
        for(const row of rows){row.x=8+row.depth*14;row.lines=wrap(row.group.name+(row.continuation?' (계속)':''),columnWidth-52-row.x,size,project.settings);row.top=y;row.y=y+size+3;row.height=Math.max(lineHeight,row.lines.length*lineHeight)+12;y+=row.height;}blocks.push({root,rows,height:y+2});});
    }
    const heights=Array(columns).fill(0),placements=[];for(const block of blocks){const column=heights.indexOf(Math.min(...heights));placements.push({...block,x:pad+column*(columnWidth+gap),y:headingHeight+heights[column]});heights[column]+=block.height+12;}
    const baseHeight=Math.max(62,headingHeight+Math.max(...heights)+2),layers=project.outlineLayers||[],outlineRows=[],outlineHeights=Array(columns).fill(0);
    for(const layer of layers){const column=outlineHeights.indexOf(Math.min(...outlineHeights)),lines=wrap(layer.name,columnWidth-48,size,project.settings);outlineRows.push({layer,lines,x:pad+column*(columnWidth+gap)+8,y:baseHeight+44+outlineHeights[column]});outlineHeights[column]+=Math.max(lineHeight,lines.length*lineHeight)+14;}
    const height=Math.max(baseHeight+(layers.length?48+Math.max(...outlineHeights):0),...outlineRows.map(r=>r.y+r.lines.length*lineHeight+12)),out=[`<rect x=".5" y=".5" width="${width-1}" height="${height-1}" rx="10" fill="#fbfcf8" stroke="#d7e0cf" stroke-dasharray="3 3"/>`,...titleLines.map((line,i)=>text(pad,pad+size+2+i*(size+8),line,size+2,'font-weight="700"'))];
    for(const block of placements){out.push(`<g data-legend-family="${esc(block.root.id)}" transform="translate(${block.x} ${block.y})"><rect data-legend-card="${esc(block.root.id)}" width="${columnWidth}" height="${block.height}" rx="5" fill="#fffefa" stroke="#e0e6d9" stroke-width=".75"/>`);
      for(const row of block.rows){const x=row.x,g=row.group;out.push(`<rect data-legend-slot-before="${esc(g.id)}" x="${x-4}" y="${row.top-6}" width="${columnWidth-x}" height="6" fill="transparent"/><g data-legend-depth="${row.depth+1}" ${row.continuation?'data-caption-continuation':'data-legend-entry'}="${esc(g.id)}" role="button" tabindex="0" aria-label="${esc(g.name)} 범례 선택 및 이름 변경"><rect data-caption-hit="true" x="${x-4}" y="${row.top}" width="${columnWidth-x}" height="${row.height-6}" rx="3" fill="${row.depth?'#fbfcf8':'#f1f5ec'}" stroke="#e4eadf" stroke-width=".5"/><rect data-caption-swatch="true" pointer-events="all" x="${x}" y="${row.y-size+1}" width="${size-1}" height="${size-1}" fill="${g.color}" stroke="#b6c2ae" stroke-width=".5"/>`);
        row.lines.forEach((line,i)=>out.push(text(x+size+7,row.y+i*lineHeight,line,size,`data-caption-name="true" font-weight="${row.depth?400:600}"`)));
        if(!row.continuation&&counts)out.push(text(columnWidth-8,row.y,counts.get(g.id)||0,size-2,'data-caption-count="true" text-anchor="end" fill="#87977c"'));out.push('</g>');}const last=block.rows.at(-1);out.push(`<rect data-legend-slot-after="${esc(last.group.id)}" x="${last.x-4}" y="${last.top+last.height-6}" width="${columnWidth-last.x}" height="8" fill="transparent"/></g>`);
    }
    if(layers.length){out.push(`<g data-outline-caption="true"><line x1="${pad}" y1="${baseHeight}" x2="${width-pad}" y2="${baseHeight}" stroke="#c8d4c0"/>`,text(pad,baseHeight+22,'초국가 영역',size,'font-weight="600"'));
      for(const {layer,lines,x,y}of outlineRows){out.push(`<g data-outline-entry="${esc(layer.id)}" role="button" tabindex="0" aria-label="${esc(layer.name)} 영역 선택 및 이름 변경" transform="translate(${x} ${y})"><rect data-caption-hit="true" x="-4" y="${-size-3}" width="${columnWidth-8}" height="${Math.max(lineHeight,lines.length*lineHeight)+8}" rx="3" fill="#fffefa" stroke="#e0e6d9" stroke-width=".75"/><rect data-caption-swatch="true" pointer-events="all" x="0" y="${-size+1}" width="${size-1}" height="${size-1}" fill="none" stroke="${layer.color}" stroke-width="2"/>`);lines.forEach((line,i)=>out.push(text(size+7,i*lineHeight,line,size,'data-caption-name="true"')));out.push('</g>');}out.push('</g>');}
    const body=Fonts.outlineSVG(out.join(''),project.settings);
    return {width,height,body,svg:documentSVG(body,width,height,s.legendTitle||'범례',project.settings),placements};
  }
  function seatEntries(parties,counts,unassigned=0){const result=parties.filter(p=>(counts[p.id]||0)>0).map(p=>({...p,count:counts[p.id]}));if(unassigned)result.push({id:'unassigned',name:'미배정',color:'#dce6db',count:unassigned});return result;}
  // Each point is one seat at normal parliament sizes. Huge fictional assemblies use weighted points.
  function parliament(entries,width=360){
    const total=entries.reduce((n,p)=>n+p.count,0),unit=Math.max(1,Math.ceil(total/5000)),amount=Math.ceil(total/unit),outer=width/2-12,rows=Math.min(amount,Math.max(1,Math.ceil(Math.sqrt(amount)/2))),inner=rows===1?outer:outer*.42,step=rows>1?(outer-inner)/(rows-1):outer;
    const radii=Array.from({length:rows},(_,i)=>inner+i*step),sum=radii.reduce((a,b)=>a+b,0),raw=radii.map(r=>amount*r/sum),allocated=raw.map(Math.floor);let left=amount-allocated.reduce((a,b)=>a+b,0);
    const remainders=raw.map((v,i)=>({i,r:v-allocated[i]})).sort((a,b)=>b.r-a.r||a.i-b.i);for(let i=0;i<left;i++)allocated[remainders[i].i]++;
    const radius=amount?Math.max(.3,Math.min(step*.34,...radii.map((r,i)=>allocated[i]?Math.PI*r/allocated[i]*.34:Infinity),10)):0,points=[];
    radii.forEach((r,row)=>{for(let i=0;i<allocated[row];i++){const angle=Math.PI-(i+.5)*Math.PI/allocated[row];points.push({x:width/2+Math.cos(angle)*r,y:outer+12-Math.sin(angle)*r,angle,row});}});points.sort((a,b)=>b.angle-a.angle||a.row-b.row);
    let index=0,remaining=entries[0]?.count||0;for(const [pointIndex,point] of points.entries()){let weight=Math.min(unit,total-pointIndex*unit),colors=[];while(weight>0&&index<entries.length){const used=Math.min(weight,remaining);colors.push({party:entries[index],count:used});weight-=used;remaining-=used;if(!remaining){index++;remaining=entries[index]?.count||0;}}point.parts=colors;point.color=colors[0]?.party.color||'#dce6db';point.partyId=colors[0]?.party.id||'unassigned';}
    const height=outer+36;return {width,height,total,unit,radius,points};
  }
  function electionCaption(project,totals,width=360){
    const c=project.elections,parties=c.parties,sections=c.proportionalRegional?[...totals.regions.map(r=>({id:r.id,name:r.name,counts:r.proportional})),...(totals.unregionalized.total||totals.unregionalized.proportional.total?[{id:'unregionalized',name:'권역 미지정',counts:totals.unregionalized.proportional}]:[])]:[{id:'national',name:'전국',counts:totals.proportionalNational}];
    const out=[text(0,20,'비례대표 의석',16,'font-weight="700"')];let y=44;
    for(const section of sections){out.push(`<g data-proportional-section="${esc(section.id)}">`);const lines=wrap(section.name,width-40,12,project.settings);for(const line of lines){out.push(text(0,y,line,12,'font-weight="600"'));y+=18;}out.push(text(width,y-18,section.counts.total+'석',11,'text-anchor="end" fill="#819174"'));
      const entries=seatEntries(parties,section.counts.byParty),unit=Math.max(1,Math.ceil(section.counts.total/5000)),cell=18,columns=Math.max(1,Math.floor(width/cell)),size=cell-1.2;let position=0;
      for(const party of entries){let remaining=party.count;while(remaining>0){const seats=Math.min(unit,remaining),x=(position%columns)*cell,top=y+Math.floor(position/columns)*cell;out.push(`<rect data-proportional-seat="${esc(party.id)}" data-seat-count="${seats}" x="${x}" y="${top}" width="${size}" height="${size}" fill="${party.color}" stroke="#c1cbb9" stroke-width=".4"><title>${esc(party.name+' '+seats+'석')}</title></rect>`);position++;remaining-=seats;}}
      if(!position)y+=4;else y+=Math.ceil(position/columns)*cell;if(unit>1){out.push(text(0,y+14,'정사각형 하나당 최대 '+unit+'석',10));y+=20;}y+=22;out.push('</g>');
    }
    out.push(text(0,y+5,'전체 의석',16,'font-weight="700"'));y+=25;
    const entries=seatEntries(parties,totals.national.byParty,totals.national.unassigned),major=entries.filter(p=>p.id!=='unassigned').slice().sort((a,b)=>b.count-a.count).slice(0,2);
    const arranged=major.length===2?[major[0],...entries.filter(p=>!major.some(m=>m.id===p.id)),major[1]]:entries;
    const diagram=parliament(arranged,width);out.push(`<g data-parliament="true" data-total-seats="${diagram.total}" transform="translate(0 ${y})">`);
    diagram.points.forEach((p,i)=>out.push(`<circle data-parliament-seat="${esc(p.partyId)}" data-seat-count="${p.parts.reduce((n,p)=>n+p.count,0)}" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${diagram.radius.toFixed(2)}" fill="${p.color}"><title>${esc(p.parts.map(v=>v.party.name+' '+v.count+'석').join(' | '))}</title></circle>`));
    out.push(text(width/2,diagram.height-18,diagram.total.toLocaleString(),29,'text-anchor="middle" font-weight="700"'));out.push('</g>');y+=diagram.height+20;if(diagram.unit>1){out.push(text(0,y,'원 하나당 최대 '+diagram.unit+'석',10));y+=20;}
    for(const party of [...parties,...(totals.national.unassigned?[{id:'unassigned',name:'미배정',color:'#dce6db'}]:[])]){const count=party.id==='unassigned'?totals.national.unassigned:totals.national.byParty[party.id]||0,lines=wrap(party.name,width-90,13,project.settings);out.push(`<g data-party-total="${esc(party.id)}" data-seats="${count}" role="button" tabindex="0" aria-label="${esc(party.name)} 범례 선택 및 이름 변경"><rect data-caption-swatch="true" pointer-events="all" x="0" y="${y-10}" width="12" height="12" rx="2" fill="${party.color}"/>`);lines.forEach((line,i)=>out.push(text(22,y+i*18,line,13,'data-caption-name="true"')));out.push(text(width,y,count+'석',13,'text-anchor="end" font-weight="600"'));out.push('</g>');y+=Math.max(28,lines.length*18+10);}
    const body=Fonts.outlineSVG(out.join(''),project.settings);
    return {width,height:y+5,body,svg:documentSVG(body,width,y+5,'비례대표와 전체 의석 범례',project.settings),diagram};
  }
  return {settings,wrap,compactLegend,parliament,electionCaption};
});
