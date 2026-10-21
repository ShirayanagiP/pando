/* Shared project rules: browser UI and offline regression checks. */
((root, factory) => {
  const node=typeof module==='object'&&module.exports;
  const model = factory(node?require('./territory-geometry.js'):root.PandoGeometry,node?require('./webfonts.js'):root.PandoFonts,node?require('./label-layout.js'):root.PandoLabelLayout,node?require('./place-names.js'):root.PandoPlaceNames,node?require('./micro-elections.js'):root.PandoElections);
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.PandoModel = model;
})(globalThis, (Geometry,Fonts,LabelLayout,PlaceNames,Elections) => {
  'use strict';
  const LABEL_MODES = ['none', 'legend', 'family', 'region', 'both'];
  const Tree=typeof module==='object'&&module.exports?require('./legend-tree.js'):globalThis.PandoLegendTree;
  const fontFamily=settings=>Fonts.cssFamily(settings);
  const displayName=group=>group?.displayName?.trim()||group?.name||'이름 없는 범례';
  const islandMinimumArea=value=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(10000,Math.round(value))):100;
  const outlineWidth=value=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(12,value)):2.5;
  function validateOutlines(layers,regionIds,expansion={}){
    if(!Array.isArray(layers))throw new Error('초국가 영역 정보가 올바르지 않습니다.');
    const ids=new Set();return layers.map(layer=>{
      if(!layer||typeof layer.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(layer.id)||ids.has(layer.id)||typeof layer.name!=='string'||layer.name.length>60||!/^#[0-9a-f]{6}$/i.test(layer.color)||!Array.isArray(layer.regionIds))throw new Error('초국가 영역 이름이나 색상이 올바르지 않습니다.');
      ids.add(layer.id);const members=new Set();for(const id of layer.regionIds){const targets=regionIds.has(id)?[id]:expansion?.[id];if(!targets?.length)throw new Error('초국가 영역에 이 지도에 없는 지역이 포함되어 있습니다.');for(const target of targets)members.add(target);}
      return {id:layer.id,name:layer.name,color:layer.color.toLowerCase(),width:outlineWidth(layer.width),visible:layer.visible!==false,regionIds:[...members],...(layer.captionOffset?{captionOffset:(typeof module==='object'&&module.exports?require('./legend-order.js'):globalThis.PandoLegendOrder).offset(layer.captionOffset)}:{})};
    });
  }
  function outlineMembers(project,groupId){const ids=new Set(Tree.descendants(groupId,project.groups));return Object.entries(project.assignments).filter(([,group])=>ids.has(group)).map(([id])=>id);}
  function setOutlineMembers(project,layerId,regionIds,erase=false){
    const layer=project.outlineLayers?.find(l=>l.id===layerId);if(!layer)return false;
    const members=new Set(layer.regionIds);let changed=false;
    for(const id of regionIds)if(erase?members.has(id):!members.has(id)){if(erase)members.delete(id);else members.add(id);changed=true;}
    if(changed)layer.regionIds=[...members];return changed;
  }
  function validateProject(input, data) {
    if (!input || input.app !== 'pando' || ![1, 2].includes(input.version) || ![data.version,...(data.compatibleVersions||[])].includes(input.boundaryVersion))
      throw new Error('이 경계 버전에서 저장한 판도 JSON 파일을 선택해주세요.');
    const s = input.project;
    const elections=data.elections?Elections.validateConfiguration(s?.elections,data):null;
    if (!s || typeof s.title !== 'string' || s.title.length > 80 || !Array.isArray(s.groups) || !s.groups.length)
      throw new Error('프로젝트 제목 또는 범례 정보가 올바르지 않습니다.');
    const ids = new Set(), provinceIds = new Set(data.provinces.map(p => p.id));
    const groups = s.groups.map(g => {
      if (!g || typeof g.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(g.id) || ids.has(g.id) || typeof g.name !== 'string' || g.name.length > 60 || !/^#[0-9a-f]{6}$/i.test(g.color))
        throw new Error('범례 이름이나 색상 정보가 올바르지 않습니다.');
      ids.add(g.id);
      if(g.displayName!==undefined&&(typeof g.displayName!=='string'||g.displayName.length>60))throw new Error('범례 표시 이름은 60자 이내로 입력해주세요.');
      return {id:g.id, name:g.name, displayName:g.displayName||'', color:g.color.toLowerCase(), parentId:g.parentId ?? null,
        provinceId:data.removedProvinceIds?.includes(g.provinceId)?null:(g.provinceId ?? null),...(g.captionOffset?{captionOffset:(typeof module==='object'&&module.exports?require('./legend-order.js'):globalThis.PandoLegendOrder).offset(g.captionOffset)}:{})};
    });
    Tree.validate(groups);
    for (const g of groups) {
      if (g.provinceId !== null && (!provinceIds.has(g.provinceId) || g.parentId !== null))
        throw new Error('상위 범례의 연결 시도 정보가 올바르지 않습니다.');
    }
    if (!s.assignments || typeof s.assignments !== 'object' || Array.isArray(s.assignments))
      throw new Error('지역 색상 정보가 올바르지 않습니다.');
    const assignments={},regionIds=new Set(data.regions.map(r=>r.id));
    for(const [id,group]of Object.entries(s.assignments)){
      const targets=regionIds.has(id)?[id]:data.assignmentExpansion?.[id];
      if(!targets?.length||!ids.has(group))throw new Error('이 지도에 없는 지역 또는 범례가 포함되어 있습니다.');
      for(const target of targets)if(target===id||!Object.hasOwn(s.assignments,target))assignments[target]=group;
    }
    const outlineLayers=s.outlineLayers===undefined?undefined:validateOutlines(s.outlineLayers,regionIds,data.assignmentExpansion);
    return {title:s.title, groups, activeGroup:ids.has(s.activeGroup) ? s.activeGroup : groups[0].id, assignments,...(outlineLayers?{outlineLayers}:{}),...(elections?{elections}:{}),
      settings:{...(typeof module==='object'&&module.exports?require('./map-captions.js'):globalThis.PandoCaptions).settings(s.settings),borders:s.settings?.borders !== false, familyBorders:s.settings?.familyBorders !== false,regionBorders:s.settings?.regionBorders !== false,
        labels:s.settings?.labels === true, legend:s.settings?.legend !== false,omitSuffix:s.settings?.omitSuffix === true,
        fontFamily:Fonts.normalize(s.settings?.fontFamily),labelStyle:s.settings?.labelStyle==='straight'?'straight':'curved',autoSpacing:s.settings?.autoSpacing!==false,labelsOverWater:s.settings?.labelsOverWater!==false,
        islandMinArea:islandMinimumArea(s.settings?.islandMinArea),
        ...PlaceNames.placeSettings(s.settings),
        ...(s.settings?.legendSort?{legendSort:(typeof module==='object'&&module.exports?require('./legend-order.js'):globalThis.PandoLegendOrder).options(s.settings.legendSort)}:{}),
        ...(s.settings?.exportRegion?{exportRegion:(typeof module==='object'&&module.exports?require('./export-regions.js'):globalThis.PandoExportRegions).normalize(s.settings.exportRegion)}:{}),
        ...(s.settings?.seaColor?{seaColor:/^#[0-9a-f]{6}$/i.test(s.settings.seaColor)?s.settings.seaColor.toLowerCase():'#fbfcf8'}:{}),
        ...(s.settings?.emptyColor?{emptyColor:/^#[0-9a-f]{6}$/i.test(s.settings.emptyColor)?s.settings.emptyColor.toLowerCase():'#dce6db'}:{}),
        ...(s.settings?.worldInsets?{worldInsets:(typeof module==='object'&&module.exports?require('./world-insets.js'):globalThis.PandoWorldInsets).settings(s.settings.worldInsets)}:{}),
        ...(s.settings?.worldInsetHidden?{worldInsetHidden:(typeof module==='object'&&module.exports?require('./world-insets.js'):globalThis.PandoWorldInsets).hiddenSettings(s.settings.worldInsetHidden)}:{}),
        ...(data.views?.some(v=>v.id===s.settings?.mapView)?{mapView:s.settings.mapView}:{}),
        ...LabelLayout.typography(s.settings),
        labelMode:LABEL_MODES.includes(s.settings?.labelMode) ? s.settings.labelMode : (s.settings?.labels ? 'region' : 'legend')}};
  }
  function groupCounts(project) {
    const direct = new Map(project.groups.map(g => [g.id,0]));
    for (const id of Object.values(project.assignments)) direct.set(id,(direct.get(id)||0)+1);
    const total = new Map(direct);
    const byId=Tree.index(project.groups);
    for(const g of project.groups)for(const parent of Tree.ancestors(g,byId).slice(0,-1))total.set(parent.id,total.get(parent.id)+(direct.get(g.id)||0));
    return {direct,total};
  }
  function orderedGroups(groups) {
    return Tree.ordered(groups);
  }
  function rootFor(group, groups) {
    return Tree.ancestors(group,groups)[0];
  }
  function provinceColors(project, data) {
    const byId = new Map(project.groups.map(g => [g.id,g]));
    const roots = project.groups.filter(g => !g.parentId);
    const result = new Map(), votes = new Map();
    for (const r of data.regions) {
      const g = byId.get(project.assignments[r.id]);
      if (!g) continue;
      const root = rootFor(g,byId);
      if (!votes.has(r.provinceId)) votes.set(r.provinceId,new Map());
      const counts = votes.get(r.provinceId);
      counts.set(root.id,(counts.get(root.id)||0)+1);
    }
    for (const p of data.provinces) {
      // Boundary colors follow matching names, then the dominant painted root.
      const compact = name => name.replace(/\s|범례/g,'').replace(/특별자치도|특별자치시|통합특별시|특별시|광역시|도$/g,'');
      const named = roots.find(g => compact(g.name) && compact(g.name) === compact(p.name));
      let group = named;
      if (!group) {
        const counts = votes.get(p.id);
        group = roots.reduce((best,g) => (counts?.get(g.id)||0) > (counts?.get(best?.id)||0) ? g : best,null);
      }
      result.set(p.id,group?.color || '#9aaa8f');
    }
    return result;
  }
  function labelLines(region, group, settings) {
    const name=formatRegionName(PlaceNames.regionName(region,settings),settings.omitSuffix);
    if (!group) return settings.labels ? [name] : [];
    switch (settings.labelMode) {
      case 'region': case 'both': return [name];
      default: return [];
    }
  }
  function formatRegionName(name,omitSuffix=false) {
    return omitSuffix ? name.replace(/\s+아이막$/,'').replace(/\s+(?:City|County|District|Ward|Town|Village|Aimag|League|Prefecture)\b/gi,'').replace(/-(?:si|gun|gu|eup|myeon|dong)\b/gi,'').split(' ').map(part=>part.length>1?part.replace(/自治州$|地区$|구역$|지구$|[시군구읍면동정촌현市町村区郡縣县盟]$/,''):part).join(' ').trim() : name;
  }
  function selectedView(project,data){return data.views?.find(v=>v.id===project.settings?.mapView)?.id||(data.views?.some(v=>v.id==='peninsula')?'peninsula':'');}
  function mapFrame(data,viewId=''){return data.views?.find(v=>v.id===viewId)?.frame||data.viewBox||[0,0,data.width||1000,data.height||900];}
  function viewCountries(project,data){return data.views?.find(v=>v.id===selectedView(project,data))?.countries||[...new Set(data.regions.map(r=>r.country))];}
  function scopedProvinces(project,data){
    const scope=new Set(project.visibleCountries||viewCountries(project,data));
    return data.provinces.flatMap(p=>{
      if(!p.countries)return scope.has(p.country)?[p]:[];
      const owners=p.countries.filter(id=>scope.has(id));if(!owners.length)return [];
      if(owners.length===p.countries.length)return [p];
      const parts=p.countryParts.filter(part=>scope.has(part.country));
      if(parts.length===1)return [{...p,...parts[0]}];
      return [{...p,d:parts.map(part=>part.d).join(''),lod:[0,1].map(level=>parts.map(part=>part.lod[level]).join(''))}];
    });
  }
  function scopedProject(project,data){
    if(!data.views||project.visibleCountries)return project;
    const countries=new Set(viewCountries(project,data)),ids=new Set(data.regions.filter(r=>countries.has(r.country)).map(r=>r.id));
    return {...project,assignments:Object.fromEntries(Object.entries(project.assignments).filter(([id])=>ids.has(id))),visibleCountries:[...countries]};
  }
  function mapLabels(project,data,territories=null) {
    project=scopedProject(project,data);territories=territories||Geometry.colorTerritories(project,data);
    const groups=new Map(project.groups.map(g=>[g.id,g])),labels=[],singleRegion=new Set();
    if(project.settings.labelMode==='family')for(const family of Geometry.familyTerritories(project,data)){
      const lines=[displayName(groups.get(family.groupId))];
      const parts=project.settings.labelsOverWater?[Geometry.coastalLabelShape(family,data)]:Geometry.islandLabelParts(family,data,islandMinimumArea(project.settings.islandMinArea));
      for(const part of parts){
        const layout=LabelLayout.layout(part,lines,project.settings,'family');
        if(layout.fontSize<=0||!LabelLayout.fits(layout))continue;
        labels.push({id:part.id,regionIds:part.regionIds,color:'#244033',bounds:part.bounds,...layout});
      }
    }
    const showLegend=['legend','both'].includes(project.settings.labelMode);
    if(showLegend)for(const territory of territories){
      const memberGroups=new Set(territory.regionIds.map(id=>project.assignments[id]));
      const legends=project.groups.filter(g=>memberGroups.has(g.id));
      const roots=new Set(legends.map(g=>rootFor(g,groups).id));
      const name=legends.length>1&&roots.size===1 ? displayName(groups.get([...roots][0])) : [...new Set(legends.map(displayName))].join(' · ');
      const lines=[name];
      if(project.settings.labelMode==='both'&&territory.regionIds.length===1){
        const region=data.regions[territory.members[0]];lines.push(formatRegionName(PlaceNames.regionName(region,project.settings),project.settings.omitSuffix));singleRegion.add(region.id);
      }
      labels.push({id:territory.id,regionIds:territory.regionIds,color:contrastColor(territory.color),bounds:territory.bounds,
        ...LabelLayout.layout(project.settings.labelsOverWater?Geometry.coastalLabelShape(territory,data):territory,lines,project.settings,'territory')});
    }
    for(const [index,region] of data.regions.entries()){
      if(project.visibleCountries&&!project.visibleCountries.includes(region.country)||project.visibleRegionIds&&!project.visibleRegionIds.includes(region.id))continue;
      if(singleRegion.has(region.id))continue;
      const group=groups.get(project.assignments[region.id]),lines=labelLines(region,group,project.settings);
      if(!lines.length)continue;
      const shape=Geometry.regionShape(index,data);
      labels.push({id:'region-'+region.id,regionId:region.id,regionIds:[region.id],
        color:group?contrastColor(group.color):'#456043',bounds:region.bounds,...LabelLayout.layout(shape,lines,project.settings,'region')});
    }
    const style=LabelLayout.typography(project.settings);
    for(const label of labels){
      label.color=style.labelColor||label.color;
      label.outlineColor=style.labelOutlineColor||(label.color==='#ffffff'?'#284d3c':'#fbfcf8');
    }
    return labels;
  }
  function wrapText(text, length = 20) {
    const characters = Array.from(text || '이름 없는 범례'), lines = [];
    for (let i=0;i<characters.length;i+=length) lines.push(characters.slice(i,i+length).join(''));
    return lines;
  }
  function contrastColor(hex) {
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722 > .38 ? '#203e30' : '#ffffff';
  }
  function labelFontSize(region, lines, zoom=1) {
    const b=region.bounds;
    const textWidth=Math.max(1,...lines.map(line=>Array.from(line).reduce((sum,char)=>sum+(/[\u0000-\u007f]/.test(char)?.57:1),0)));
    return Math.max(.65,Math.min(8/Math.sqrt(zoom),(b[2]-b[0])*.82/textWidth,(b[3]-b[1])*.72/(Math.max(1,lines.length)*1.25)));
  }
  function legendLayout(groups) {
    // Three columns of complete family cards; height grows with the content.
    const heights = [0,0,0], cards = [], children = new Map();
    for (const group of groups) if (group.parentId) {
      if (!children.has(group.parentId)) children.set(group.parentId,[]);
      children.get(group.parentId).push(group);
    }
    for (const group of groups.filter(g => !g.parentId)) {
      const column = heights.indexOf(Math.min(...heights));
      const rows = []; let y=22;
      for (const g of Tree.ordered(groups).filter(g=>rootFor(g,groups).id===group.id)) {
        const depth = Tree.depth(g,groups), lines = wrapText(g.name,22-depth);
        rows.push({group:g,depth,lines,y});
        y += Math.max(depth ? 27 : 34,lines.length*17+12);
      }
      cards.push({x:55+column*410,y:heights[column],height:y+4,rows});
      heights[column]+=y+18;
    }
    return {cards,height:Math.max(...heights)};
  }
  return {validateProject,groupCounts,orderedGroups,rootFor,provinceColors,labelLines,formatRegionName,mapLabels,fontFamily,displayName,
    groupDepth:Tree.depth,groupAncestors:Tree.ancestors,groupDescendants:Tree.descendants,canParent:Tree.canParent,outlineWidth,outlineMembers,setOutlineMembers,
    labelMarkup:LabelLayout.markup,labelFits:LabelLayout.fits,labelBoxes:LabelLayout.boxes,labelViewportSize:LabelLayout.viewportFontSize,fontChoices:Fonts.families,fontName:Fonts.normalize,islandMinimumArea,labelTypography:LabelLayout.typography,
    colorTerritories:Geometry.colorTerritories,familyTerritories:Geometry.familyTerritories,hierarchyTerritories:Geometry.hierarchyTerritories,outlineTerritories:Geometry.outlineTerritories,visibleBorders:Geometry.visibleBorders,visibleBorderChunks:Geometry.visibleBorderChunks,
    electionBorderChunks:(project,data,options)=>Elections.borderChunks(project,data,options),
    wrapText,contrastColor,labelFontSize,legendLayout,...PlaceNames,mapFrame,selectedView,viewCountries,scopedProject,scopedProvinces};
});
