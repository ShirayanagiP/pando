((root, factory) => {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./project-model.js'),require('./map-renderer.js'),require('./map-captions.js'),require('./micro-elections.js'));
  else root.PandoSVG = factory(root.PandoModel,root.PandoRenderer,root.PandoCaptions,root.PandoElections);
})(globalThis, (Model,Renderer,Captions,Elections) => {
  'use strict';
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const Regions=typeof module==='object'&&module.exports?require('./export-regions.js'):globalThis.PandoExportRegions;
  const Fonts=typeof module==='object'&&module.exports?require('./webfonts.js'):globalThis.PandoFonts;
  const Insets=typeof module==='object'&&module.exports?require('./world-insets.js'):globalThis.PandoWorldInsets;
  function mapOutputFrame(project,data){
    const regional=Regions.frame(project,data);if(regional)return regional;
    const view=Model.selectedView(project,data),frame=[...Model.mapFrame(data,view)];
    if(data.id!=='world'||view!=='world'||!data.wrap)return frame;
    const seam=data.wrap.exportSeamLongitude;
    frame[0]=Math.round((data.wrap.left+(seam-(data.wrap.center-180))*data.wrap.period/360)*100)/100;
    frame[2]=data.wrap.period;
    return frame;
  }
  function makeDocument(project, data) {
    const inset=Insets.combined(project,data);
    const exportRegion=Regions.preset(project,data);
    if(exportRegion)project=Regions.prepare(project,data);
    const view=Model.selectedView(project,data);
    project=Model.scopedProject(project,data);
    const scope=new Set(project.visibleCountries||Model.viewCountries(project,data)),visible=project.visibleRegionIds?new Set(project.visibleRegionIds):null,regions=data.regions.filter(r=>scope.has(r.country)&&(!visible||visible.has(r.id))),provinceIds=new Set(regions.map(r=>r.provinceId)),provinces=Model.scopedProvinces(project,data).filter(p=>!visible||provinceIds.has(p.id));
    const sources=(data.countries||[]).filter(c=>scope.has(c.id));
    const credits=data.game?[{name:data.name,credit:'Paradox Interactive | '+data.unit+' 단위',license:'로컬 게임에서 추출 | 개인 사용',year:data.gameVersion}]:data.id==='world'?[{name:'세계 경계',credit:'Natural Earth / geoBoundaries / VARAM; data/LICENSE-WORLD.md',license:'Public domain / 개별 라이선스',year:'혼합 기준일'},
      {name:'동아시아',credit:'SGIS | WFP | CTAmap | MLIT | NLSC | OSM',license:'국가별 라이선스',year:'2017–2026'}]:sources;
    const nameCredit=[scope.has('china')?'Wikidata | CC0':'',scope.has('japan')?'Geolonia 住所データ | CC BY 4.0 (가공)':''].filter(Boolean).join(' / ');
    const creditFile=data.creditFile||'data/LICENSE-EAST-ASIA.md';
    const coordinateScale=data.coordinateScale||1;
    const width=1320,counts=Model.groupCounts(project);if(project.seatCounts)counts.total=new Map(Object.entries(project.seatCounts));
    const sideLegend=data.mode==='micro'&&project.settings.legend;
    const caption=!project.settings.legend?{height:0,body:''}:project.electionStage==='seats'?Captions.electionCaption(project,Elections.seatTotals(project,data),360):Captions.compactLegend({...project,groups:project.legendGroups||project.groups},counts.total,sideLegend?360:1210,sideLegend?{columns:1}:{});
    const titleSize = Math.min(28,1120/Math.max(1,Fonts.measure(project.title,project.settings)));
    const frame=mapOutputFrame(project,data),mapLeft=sideLegend?55:145,mapWidth=sideLegend?800:990,mapScale=Math.min(mapWidth/frame[2],891/frame[3]);
    const wrapOutput=data.id==='world'&&view==='world'&&data.wrap||exportRegion&&data.game;
    const period=data.wrap?.period||data.width,offsets=wrapOutput?[-period,0,period]:[0];
    const mapHeight=frame[3]*mapScale,insetTop=153+mapHeight,insetSpace=inset.height?inset.height+22:0,legendTop=insetTop+insetSpace;
    const clipWidth=exportRegion?frame[2]*mapScale:mapWidth,clipLeft=mapLeft+(mapWidth-clipWidth)/2;
    const footerExtra=Math.max(0,Math.ceil(credits.length/2)-3)*12;
    const height=Math.ceil(sideLegend?Math.max(125+mapHeight,145+caption.height)+100:project.settings.legend?legendTop+caption.height+100:mapHeight+209+insetSpace)+footerExtra;
    const mapX=mapLeft+mapWidth/2-(frame[0]+frame[2]/2)*mapScale,mapY=125-frame[1]*mapScale;
    const groups = new Map(project.groups.map(g=>[g.id,g]));
    const territories=Model.colorTerritories(project,data);
    const colors = Model.provinceColors(project,data);
    const emptyColor=project.settings.emptyColor||'#dce6db',seaColor=project.settings.seaColor||'#fbfcf8';
    const borderData=exportRegion&&data.game?{...data,wrap:{left:0,period:data.width}}:data;
    const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><metadata>${esc(sources.map(c=>`${c.name}: ${c.credit}; ${c.license}; ${c.year}; ${c.count} source units.`).join(' '))} Place names: ${esc(nameCredit)}; see data/localization/README.md. Generalized, cartographically aligned source boundaries. See ${esc(creditFile)} for provenance, modifications and administrative exceptions.</metadata><rect width="100%" height="100%" fill="#fbfcf8"/><g font-family="${esc(Model.fontFamily(project.settings))}"><text x="55" y="44" font-size="10" fill="#879b7a" letter-spacing="3">판도</text><text x="55" y="86" font-size="${titleSize}" font-weight="700" fill="#244e42">${esc(project.title||'나의 동아시아 지도')}</text><line x1="55" y1="110" x2="1265" y2="110" stroke="#e0e6d9"/><defs><clipPath id="map-output-clip"><rect x="${clipLeft}" y="125" width="${clipWidth}" height="${mapHeight}"/></clipPath></defs><g clip-path="url(#map-output-clip)"><g data-map-frame="${frame.join(' ')}" transform="translate(${mapX} ${mapY}) scale(${mapScale})">`];
    if(wrapOutput)out.push(`<g id="map-output-world" data-output-seam-longitude="${data.wrap?.exportSeamLongitude??180}" data-output-region="${exportRegion?.id||'current'}">`);
    out.push(`<rect data-sea-background="true" x="${frame[0]}" y="${frame[1]}" width="${frame[2]}" height="${frame[3]}" fill="${seaColor}" stroke="none"/>`);
    for (const p of provinces) out.push(`<path d="${p.d}" fill="${emptyColor}" stroke="none"/>`);
    for (const territory of territories) out.push(`<path data-territory="${territory.id}" d="${territory.d}" fill="${territory.color}" fill-rule="evenodd" stroke="none"/>`);
    for (const r of regions) out.push(`<path data-region="${r.id}" d="${r.d}" fill="${groups.get(project.assignments[r.id])?.color||emptyColor}" stroke="none"><title>${esc(Model.regionLocation(r,project.settings)+' '+Model.regionName(r,project.settings))}</title></path>`);
    if(project.settings.regionBorders)out.push(`<path data-region-boundaries="true" d="${Renderer.outline(Model.visibleBorders(project,data),borderData)}" fill="none" stroke="#fbfcf8" stroke-width="${.75*coordinateScale}" stroke-linejoin="round"/>`);
    if (project.settings.borders) {
      out.push('<defs>');
      for (const p of provinces) out.push(`<clipPath id="border-${p.id}" clipPathUnits="userSpaceOnUse"><path d="${p.d}"/></clipPath>`);
      out.push('</defs>');
      for (const p of provinces) out.push(`<path data-province="${p.id}" d="${Renderer.outline(p.d,borderData)}" fill="none" stroke="${colors.get(p.id)}" stroke-width="${(colors.get(p.id)==='#9aaa8f'?1.5:2.6)*coordinateScale}" stroke-linejoin="round" clip-path="url(#border-${p.id})"/>`);
    }
    if(project.settings.familyBorders!==false){
      for(const family of Model.hierarchyTerritories(project,data)){
        out.push(`<defs><clipPath id="${family.id}" clipPathUnits="userSpaceOnUse"><path d="${family.d}" clip-rule="evenodd"/></clipPath></defs>`);
        out.push(`<path data-family="${family.groupId}" data-depth="${family.depth+1}" d="${Renderer.outline(family.d,borderData)}" fill="none" stroke="${family.color}" stroke-width="${(3.8-family.depth*.8)*coordinateScale}" stroke-linejoin="round" clip-path="url(#${family.id})"/>`);
      }
    }
    if(project.electionStage)out.push(`<path data-election-boundaries="true" d="${Model.electionBorderChunks(project,data).map(c=>c.d).join('')}" fill="none" stroke="${project.elections?.borderColor||'#586f60'}" stroke-width="${Elections.strokeWidth(project.elections?.borderWidth)}" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`);
    for(const layer of Model.outlineTerritories(project,data))out.push(`<path data-outline="${layer.id}" d="${Renderer.outline(layer.d,borderData)}" fill="none" stroke="${layer.color}" stroke-width="${Model.outlineWidth(layer.width)*coordinateScale}" stroke-linejoin="round"/>`);
    const occupied=[];
    for (const label of Model.mapLabels(project,data,territories)) {
      const [x,y]=label.center,fill=label.color,halo=label.outlineColor,fontSize=label.fontSize;
      if(fontSize*mapScale<7||!Model.labelFits(label,fontSize))continue;
      const baseBoxes=Model.labelBoxes(label,fontSize);
      const boxes=wrapOutput?baseBoxes.flatMap(box=>offsets.map(offset=>({...box,x:box.x+offset})))
        .filter(box=>box.x+box.width>frame[0]&&box.x<frame[0]+frame[2]&&box.y+box.height>frame[1]&&box.y<frame[1]+frame[3]):baseBoxes;
      if(!boxes.length)continue;
      if(boxes.some(box=>occupied.some(b=>box.x<b.x+b.width+2&&box.x+box.width+2>b.x&&box.y<b.y+b.height+2&&box.y+box.height+2>b.y)))continue;
      occupied.push(...boxes);
      const mask=label.shape.mask;
      if(mask){
        const [x1,y1,x2,y2]=mask.limits;
        out.push(`<defs><mask id="label-${label.id}" maskUnits="userSpaceOnUse" x="${x1}" y="${y1}" width="${x2-x1}" height="${y2-y1}" mask-type="luminance"><rect x="${x1}" y="${y1}" width="${x2-x1}" height="${y2-y1}" fill="#ffffff" stroke="none"/><path d="${mask.forbiddenD}" fill="#000000" stroke="none" fill-rule="evenodd"/></mask></defs>`);
      }else out.push(`<defs><clipPath id="label-${label.id}" clipPathUnits="userSpaceOnUse"><path d="${label.shape.d}" clip-rule="evenodd"/></clipPath></defs>`);
      out.push(`<g data-label="${label.id}" data-label-kind="${label.kind}" data-label-style="${label.curve?'curved':'straight'}" data-label-font="${esc(Model.fontName(project.settings.fontFamily))}" data-label-bold="${label.typography.labelBold}" data-label-italic="${label.typography.labelItalic}" aria-label="${esc(label.lines.join(' / '))}" ${mask?'mask':'clip-path'}="url(#label-${label.id})" fill="${fill}" color="${fill}" stroke="${halo}" stroke-opacity="1" paint-order="stroke"><title>${esc(label.lines.join(' / '))}</title>${Model.labelMarkup(label,fontSize)}</g>`);
    }
    if(wrapOutput){
      out.push('</g>');
      for(const offset of offsets)if(offset)out.push(`<use href="#map-output-world" data-output-wrap="${offset}" transform="translate(${offset} 0)"/>`);
    }
    out.push('</g></g>');
    if(inset.height)out.push(`<g data-world-insets="true" transform="translate(55 ${insetTop})" stroke="none">${inset.body}</g>`);
    if(project.settings.legend){
      out.push(`<g data-map-caption="true" data-caption-placement="${sideLegend?'right':'below'}" transform="translate(${sideLegend?905:55} ${sideLegend?145:legendTop})" fill="#365344" stroke="none">${caption.body}</g>`);
      if(project.seatSummary?.unassigned)out.push(`<text x="1265" y="${height-75}" font-size="10" text-anchor="end" fill="#9caa91">미배정 ${project.seatSummary.unassigned}석</text>`);
    }
    out.push(`<line x1="55" y1="${height-52-footerExtra}" x2="1265" y2="${height-52-footerExtra}" stroke="#e0e6d9"/>`);
    credits.forEach((c,i)=>out.push(`<text x="${55+(i%2)*545}" y="${height-41-footerExtra+Math.floor(i/2)*12}" font-size="8" fill="#8c9b84">${esc(c.name+': '+c.credit+' | '+c.license+' | '+c.year+' 자료')}</text>`));
    if(nameCredit)out.push(`<text x="55" y="${height-6}" font-size="8" fill="#8c9b84">${esc("지명: "+nameCredit)}</text>`);
    out.push(`<text x="1265" y="${height-25}" font-size="11" text-anchor="end" fill="#749066">판도</text></g></svg>`);
    return {svg:Fonts.outlineSVG(out.join(''),project.settings),width,height};
  }
  function rasterSize(width,height) {
    const scale=Math.min(2,16384/width,16384/height,Math.sqrt(64000000/(width*height)));
    return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
  }
  function makeInsetDocuments(project,data){
    return Insets.exportable(project,data).map(preset=>{
      const regions=new Set(Insets.visibleTiles(project,data,preset).flatMap(t=>t.regions.map(r=>r.id))),assignments=Object.fromEntries(Object.entries(project.assignments).filter(([id])=>regions.has(id))),used=new Set();
      for(const id of Object.values(assignments))for(const g of Model.groupAncestors(project.groups.find(g=>g.id===id),project.groups))used.add(g.id);
      const scoped={...project,assignments,groups:project.groups.filter(g=>used.has(g.id))},panel=Insets.panel(project,data,preset,1210,'separate-inset'),caption=project.settings.legend&&used.size?Captions.compactLegend(scoped,Model.groupCounts(scoped).total,1210):{height:0,body:''};
      const width=1320,height=Math.ceil(170+panel.height+caption.height+(caption.height?24:0)),title=(project.title||'판도')+' | '+preset.name,titleSize=Math.min(26,1190/Math.max(1,Fonts.measure(title,project.settings)));
      const body=`<rect width="100%" height="100%" fill="#fbfcf8"/><g font-family="${esc(Fonts.cssFamily(project.settings))}" stroke="none">`+`<text x="55" y="65" font-size="${titleSize}" fill="#244e42" font-weight="700">${esc(title)}</text><g data-separate-inset="${preset.id}" transform="translate(55 95)">${panel.body}</g>`+(caption.height?`<g data-map-caption="true" transform="translate(55 ${119+panel.height})">${caption.body}</g>`:'')+`<text x="55" y="${height-20}" font-size="9" fill="#8b9c80">세계 지도와 같은 편집 구역 | 각 칸의 축척과 위치는 서로 다릅니다 | 판도</text></g>`;
      return {id:preset.id,name:preset.name,width,height,svg:Fonts.outlineSVG(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`,project.settings)};
    });
  }
  function makeDocuments(project,data){return [{id:'main',name:'전체 지도',...makeDocument(project,data)},...makeInsetDocuments(project,data)];}
  return {makeDocument,makeDocuments,makeInsetDocuments,rasterSize,mapOutputFrame};
});
