/* PANDO — a browser-only map studio. No analytics, APIs or remote assets. */
(() => {
  'use strict';
  const DATA = window.PANDO_MAP;
  const IS_MICRO=DATA.mode==='micro',IS_GAME=!!DATA.game,Elections=window.PandoElections;
  const MODE_NAME=IS_MICRO?'미시판도학':DATA.id==='world'||IS_GAME?'거시판도학':'대륙판도학';
  const AREA_NAME=IS_GAME?DATA.name:IS_MICRO?'대한민국 읍면동':DATA.id==='world'?'세계':'동아시아';
  const Model = window.PandoModel;
  const RegionSearch=window.PandoRegionSearch.create(DATA);
  const Renderer=window.PandoRenderer;
  const Insets=window.PandoWorldInsets;
  let FRAME = Model.mapFrame(DATA),currentMapView=null,visibleRegionIds=new Set(),visibleCountries=new Set();
  let resultLimit=120;
  let searchFiltersKey=null;
  const Color=window.PandoColors;
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const STORAGE_KEY = window.PandoMapCatalog.storageKey(DATA);
  const COLORS = Color.palette(24);
  let paletteCount=24,colorDraftSource='hex';
  let quickPaletteCount=24,quickColorSource='hex',quickColorGroupId=null,quickColorAnchor=null;
  let quickColorApply=null,quickColorVirtual=null;
  let dockTab='legend',microUI=null;
  let activeOutlineId=null;
  const activeOutline=()=>dockTab==='legend'?(state.outlineLayers||[]).find(l=>l.id===activeOutlineId):null;
  const EMPTY = '#dce6db';
  const emptyColor=()=>state.settings.emptyColor||EMPTY;
  const regionById = new Map(DATA.regions.map(r => [r.id,r]));
  let scopedProvinceById=new Map();
  const paths = new Map();
  const undoStack = [], redoStack = [];
  let tool = 'brush', spacePan = false, gesture = null, selectedRegion = null;
  let view = { k:1, x:0, y:0 }, toastTimer, saveTimer, tooltipId;
  let storageAvailable = true;
  let confirmAction = null;
  let renderedTerritories = [];
  const labelDefinitions = new Map();
  const labelNodes = new Map();
  let mapDetailsTimer=0,mapDetailsPending=false,labelViewFrame=0,sceneTimer=0;
  let currentDetail=-1;
  let legendLayoutFrame=0;
  let captionFrame=0,lastCaption='';
  let lastInsets='',insetGesture=null;
  const legendCardObserver=new ResizeObserver(()=>{
    if(legendLayoutFrame)return;
    legendLayoutFrame=requestAnimationFrame(()=>{legendLayoutFrame=0;layoutLegendCards();});
  });
  let state = freshState();

  function freshState() {
    return {title:DATA.defaultTitle||(DATA.id==='world'?'나의 세계 지도':'나의 동아시아 지도'),...(IS_MICRO?{elections:Elections.createConfiguration(DATA)}:{}),groups:[
      {id:'g1',name:'그룹 1',color:'#5d9785'},
      {id:'g2',name:'그룹 2',color:'#d99774'},
      {id:'g3',name:'그룹 3',color:'#dfc268'},
      {id:'g4',name:'그룹 4',color:'#779bb3'}
    ].map(g=>({...g,displayName:'',parentId:null,provinceId:null})),activeGroup:'g1',assignments:{},settings:{...window.PandoCaptions.settings(),placeLanguage:'ko',nativeNames:false,mapView:DATA.defaultView||'eastasia',borders:true,familyBorders:true,regionBorders:true,labels:false,labelMode:'legend',legend:true,omitSuffix:false,fontFamily:'Pretendard',labelStyle:'curved',autoSpacing:true,labelsOverWater:true,islandMinArea:100,...Model.labelTypography()}};
  }
  const snapshot = () => JSON.stringify(state);
  const activeGroup = () => state.groups.find(g => g.id === state.activeGroup) || state.groups[0];
  const paletteGroup = () => activeOutline()||(IS_MICRO&&dockTab==='seats'?state.elections.parties.find(p=>p.id===state.elections.activePartyId)||state.elections.parties[0]:activeGroup());
  const mapProject = () => IS_MICRO?Elections.displayProject(state,DATA,dockTab):state;
  const groupFor = (id) => state.groups.find(g => g.id === state.assignments[id]);
  function toast(message) {
    $('toast').textContent=message; $('toast').hidden=false;
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,3400);
  }
  function record(before) {
    if (before === snapshot()) return;
    undoStack.push(before); if(undoStack.length>80)undoStack.shift();
    redoStack.length=0; updateHistory(); scheduleSave();
  }
  function mutate(fn, fullRender = true) {
    const before=snapshot(); fn(); record(before);
    if(fullRender)renderAll(); else renderCounts();
  }
  function updateHistory() {
    $('undo-button').disabled=!undoStack.length;
    $('redo-button').disabled=!redoStack.length;
  }
  function history(direction) {
    endGesture();finishInsetGesture();
    const from=direction==='undo'?undoStack:redoStack;
    const to=direction==='undo'?redoStack:undoStack;
    if(!from.length)return;
    to.push(snapshot()); state=JSON.parse(from.pop());if(IS_MICRO)state.elections.stage=dockTab;renderAll();updateHistory();scheduleSave();
  }
  function validateProject(input) {
    return Model.validateProject(input,DATA);
  }
  function projectFile() {
    return {app:'pando',version:2,mapId:DATA.id||'eastasia',boundaryVersion:DATA.version,savedAt:new Date().toISOString(),project:state};
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer=setTimeout(persist,350);
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY,JSON.stringify(projectFile()));
      storageAvailable=true;
      $('save-status').querySelector('span').textContent='모든 변경사항이 이 브라우저에 저장됨';
    } catch {
      storageAvailable=false;
      $('save-status').querySelector('span').textContent='자동 저장 불가 | 작업 저장으로 파일을 보관하세요';
    }
  }
  try {
    const saved=localStorage.getItem(STORAGE_KEY)||(DATA.id==='eastasia'?localStorage.getItem('pando-project-v1'):null);
    if(saved)state=validateProject(JSON.parse(saved));
  } catch {
    toast('자동 저장 내용을 열 수 없어 새 지도를 시작했습니다.');
  }
  if(IS_MICRO)dockTab=state.elections.stage;

  function createSVG(tag,attrs) {
    const el=document.createElementNS(NS,tag);
    Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); return el;
  }
  function buildMap() {
    if(DATA.wrap){
      $('world-center-row').hidden=false;$('map-detail-note').hidden=false;
      $('world-center').value=DATA.wrap.layout;
      const content=createSVG('g',{id:'map-content'});
      content.append(...$('map-transform').children);$('map-transform').appendChild(content);
      for(const offset of [-DATA.wrap.period,DATA.wrap.period])$('map-transform').appendChild(createSVG('use',{href:'#map-content',transform:`translate(${offset} 0)`,'data-world-copy':offset,'aria-hidden':'true','pointer-events':'none'}));
    }
    for(const entry of DATA.views||[]){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;$('map-view').appendChild(option);}
    const fragment=document.createDocumentFragment();
    for(const r of DATA.regions){
      const path=createSVG('path',{d:r.d,'data-region':r.id,tabindex:0,role:'button','aria-label':`${Model.regionLocation(r,state.settings)} ${Model.regionName(r,state.settings)} 색칠`});
      if(DATA.rendering){path.style.stroke='currentColor';path.style.strokeWidth='.35px';path.setAttribute('vector-effect','non-scaling-stroke');}
      paths.set(r.id,path);fragment.appendChild(path);
    }
    $('regions').appendChild(fragment);
    for(const p of DATA.provinces)$('map-base').appendChild(createSVG('path',{d:p.d,fill:emptyColor(),stroke:'none','data-country':p.country,'data-base-province':p.id}));
    for(const p of DATA.provinces){
      const clip=createSVG('clipPath',{id:'pando-border-'+p.id,clipPathUnits:'userSpaceOnUse'});
      clip.appendChild(createSVG('path',{d:p.d,fill:'#000000'}));$('province-clips').appendChild(clip);
      $('province-borders').appendChild(createSVG('path',{d:Renderer.outline(p.d,DATA),'data-province':p.id,'data-country':p.country,'clip-path':`url(#pando-border-${p.id})`}));
    }
  }
  function renderSearchFilters(){
    const country=$('country-filter'),parent=$('province-filter');
    const key=JSON.stringify([country.value,state.settings.placeLanguage,state.settings.nativeNames]);
    if(searchFiltersKey===key)return;
    const selectedCountry=country.value,selectedParent=parent.value;
    const countries=RegionSearch.countryOptions(state.settings);
    const all=document.createElement('option');all.value='';all.textContent='모든 국가·지역';country.replaceChildren(all);
    for(const entry of countries){const option=document.createElement('option');option.value=entry.id;option.textContent=`${entry.name} | ${entry.count}개 지역`;country.appendChild(option);}
    country.value=countries.some(c=>c.id===selectedCountry)?selectedCountry:'';
    const entries=RegionSearch.parentOptions(country.value,state.settings);
    const placeholder=document.createElement('option');placeholder.value='';
    placeholder.textContent=IS_MICRO?'모든 시군구':IS_GAME?'모든 지역':!country.value?'국가·지역을 먼저 선택':entries[0]?.kind==='district'?'모든 연방관구':entries[0]?.kind==='country'?'본국 및 연계 지역 전체':DATA.id==='world'?'모든 1차 행정구역':'모든 상위 행정구역';
    parent.replaceChildren(placeholder);
    for(const entry of entries){const option=document.createElement('option');option.value=entry.id;option.textContent=`${entry.name} | ${entry.count}개 지역`;parent.appendChild(option);}
    parent.value=entries.some(e=>e.id===selectedParent)?selectedParent:'';
    parent.disabled=!IS_MICRO&&!IS_GAME&&!country.value;
    $('paint-province').disabled=!country.value&&!parent.value;
    searchFiltersKey=JSON.stringify([country.value,state.settings.placeLanguage,state.settings.nativeNames]);
  }
  function renderPlaceNames(){
    for(const option of $('map-view').options){const entry=DATA.views.find(v=>v.id===option.value);option.textContent=Model.viewName(entry,state.settings);}
    renderSearchFilters();
    $('map-view-name').textContent=Model.viewName(DATA.views?.find(v=>v.id===currentMapView),state.settings)||DATA.name;
    $('mode-name').textContent=MODE_NAME;
    hideTooltip();
  }
  function renderMapScope(){
    const next=Model.selectedView(state,DATA);if(currentMapView===next)return;
    currentMapView=next;FRAME=Model.mapFrame(DATA,next);
    visibleCountries=new Set(Model.viewCountries(state,DATA));
    visibleRegionIds=new Set(DATA.regions.filter(r=>visibleCountries.has(r.country)).map(r=>r.id));
    for(const [id,path] of paths)path.style.display=visibleRegionIds.has(id)?'':'none';
    scopedProvinceById=new Map(Model.scopedProvinces(state,DATA).map(p=>[p.id,p]));
    for(const id of ['map-base','province-borders'])for(const path of $(id).children){
      const p=scopedProvinceById.get(path.dataset.province||path.dataset.baseProvince);
      path.style.display=p?'':'none';
      if(p){path.setAttribute('d',id==='province-borders'?Renderer.outline(p.d,DATA):p.d);$('pando-border-'+p.id).firstElementChild.setAttribute('d',p.d);}
    }
    currentDetail=-1;
    $('map-svg').setAttribute('viewBox',FRAME.join(' '));$('map-view').value=next;
    $('boundary-count').textContent=visibleRegionIds.size+'개 지역';$('region-total').textContent=visibleRegionIds.size;
    $('map-view-name').textContent=Model.viewName((DATA.views||[]).find(v=>v.id===next),state.settings)||DATA.name;
    resetView();queueMapDetails();
    for(const copy of document.querySelectorAll('[data-world-copy]'))copy.style.display=next==='world'?'':'none';
  }
  function renderColors() {
    for(const path of $('map-base').children)path.setAttribute('fill',emptyColor());
    const display=mapProject(),groupMap=new Map(display.groups.map(g=>[g.id,g]));
    const electoral=IS_MICRO&&dockTab!=='legend'?Elections.membership(state,DATA):null;
    for(const [id,path]of paths){
      path.style.fill=groupMap.get(display.assignments[id])?.color || emptyColor();
      if(DATA.rendering)path.style.color=path.style.fill;
      const r=regionById.get(id), g=groupMap.get(display.assignments[id]);
      const district=electoral?Elections.districtFor(DATA,electoral.get(id),state):null;
      const seat=dockTab==='seats'?state.elections.parties.find(p=>p.id===state.elections.partyAssignments[district?.id]):null;
      const detail=electoral?(district?.name||'선거구 미배정')+(dockTab==='seats'?' | 의석 '+(seat?.name||'미배정')+' | 색칠 '+(g?.name||'미지정'):''):(g?.name||'미지정');
      path.setAttribute('aria-label',`${Model.regionLocation(r,state.settings)} ${Model.regionName(r,state.settings)}, ${detail}. ${dockTab==='election'?'배정':'색칠'}`);
    }
    queueMapDetails();
  }
  function queueMapDetails(delay=60){
    mapDetailsPending=true;clearTimeout(mapDetailsTimer);
    if(!gesture)mapDetailsTimer=setTimeout(flushMapDetails,delay);
  }
  function flushMapDetails(){
    clearTimeout(mapDetailsTimer);mapDetailsTimer=0;
    if(!mapDetailsPending||gesture)return;
    mapDetailsPending=false;
    renderTerritories();renderProvinceBorders();renderFamilyBorders();renderLabelContent();
  }
  function queueLabelView(){
    if(!labelViewFrame)labelViewFrame=requestAnimationFrame(()=>{labelViewFrame=0;updateLabels();});
  }
  function syncPaths(container,items,keyName){
    const current=new Map([...container.children].map(path=>[path.dataset[keyName],path]));
    for(const item of items){
      let path=current.get(item.id);
      if(!path){path=createSVG('path',{...item.attrs,d:item.d});path.dataset[keyName]=item.id;container.appendChild(path);}
      else{
        current.delete(item.id);
        if(path.getAttribute('d')!==item.d)path.setAttribute('d',item.d);
        for(const [key,value] of Object.entries(item.attrs))if(path.getAttribute(key)!==String(value))path.setAttribute(key,value);
      }
    }
    for(const path of current.values())path.remove();
  }
  function renderTerritories() {
    const scoped=Model.scopedProject(mapProject(),DATA);
    renderedTerritories=Model.colorTerritories(scoped,DATA);
    syncPaths($('territory-fills'),DATA.rendering?[]:renderedTerritories.map(t=>({id:t.id,d:t.d,attrs:{fill:t.color,'fill-rule':'evenodd',stroke:'none'}})),'territory');
    if(DATA.rendering)renderScene();
    else syncPaths($('region-boundaries'),Model.visibleBorderChunks(scoped,DATA).filter(c=>c.d).map(c=>({id:c.id,d:c.d,attrs:{'vector-effect':'non-scaling-stroke'}})),'borderChunk');
  }
  function queueScene(){
    if(!DATA.rendering||sceneTimer)return;
    sceneTimer=setTimeout(()=>{sceneTimer=0;renderScene();},90);
  }
  function renderScene(){
    const ctm=$('map-transform').getScreenCTM();if(!ctm)return;
    const rect=$('map-svg').getBoundingClientRect(),scale=Math.abs(ctm.a),padding=50/scale;
    const bounds=[(rect.left-ctm.e)/scale-padding,(rect.top-ctm.f)/scale-padding,(rect.right-ctm.e)/scale+padding,(rect.bottom-ctm.f)/scale+padding];
    const scene=Renderer.scene(Model.scopedProject(mapProject(),DATA),DATA,{scale,bounds,wrap:currentMapView==='world'?DATA.wrap:null});
    for(const [id,path]of paths){
      path.style.display=scene.visible.has(id)?'':'none';
      if(currentDetail!==scene.level)path.setAttribute('d',Renderer.path(regionById.get(id),scene.level));
    }
    for(const container of ['map-base','province-borders'])for(const path of $(container).children){
      const p=scopedProvinceById.get(path.dataset.province||path.dataset.baseProvince);
      if(!p){path.style.display='none';continue;}
      path.style.display=Renderer.inView(p.bounds,scene.views)?'':'none';
      if(currentDetail!==scene.level)path.setAttribute('d',container==='province-borders'?Renderer.outline(Renderer.path(p,scene.level),DATA):Renderer.path(p,scene.level));
    }
    // Clips and their outline always use identical geometry at each detail level.
    if(currentDetail!==scene.level)for(const p of scopedProvinceById.values())$('pando-border-'+p.id)?.firstElementChild.setAttribute('d',Renderer.path(p,scene.level));
    currentDetail=scene.level;
    syncPaths($('region-boundaries'),scene.chunks.map(c=>({id:c.id,d:c.d,attrs:{'vector-effect':'non-scaling-stroke'}})),'borderChunk');
    const electoral=IS_MICRO&&dockTab!=='legend'?Elections.borderChunks(state,DATA,{level:scene.level,views:scene.views}):[];
    syncPaths($('election-boundaries'),electoral.map(c=>({id:c.id,d:c.d,attrs:{fill:'none',stroke:state.elections?.borderColor||'#586f60','stroke-width':Elections.strokeWidth(state.elections?.borderWidth),'vector-effect':'non-scaling-stroke'}})),'electionChunk');
    $('map-svg').dataset.detail=['country','regional','full'][scene.level];
    $('map-svg').dataset.renderedRegions=scene.visible.size;$('map-svg').dataset.renderedBorders=scene.borderCount;
  }
  function renderProvinceBorders() {
    const colors=Model.provinceColors(mapProject(),DATA);
    for(const path of $('province-borders').children){
      const color=colors.get(path.dataset.province);path.style.stroke=color;
      path.style.strokeWidth=color==='#9aaa8f'?'1.5px':'2.6px';
    }
  }
  function renderFamilyBorders(){
    const display=mapProject(),scoped=Model.scopedProject(display,DATA),families=display.settings.familyBorders?Model.hierarchyTerritories(scoped,DATA):[];
    const clips=new Map([...$('family-clips').children].map(clip=>[clip.id,clip]));
    for(const family of families){
      const clipId='pando-'+family.id,clip=createSVG('clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'});
      const existing=clips.get(clipId);
      if(existing){if(existing.firstElementChild.getAttribute('d')!==family.d)existing.firstElementChild.setAttribute('d',family.d);clips.delete(clipId);}
      else{clip.appendChild(createSVG('path',{d:family.d,'clip-rule':'evenodd'}));$('family-clips').appendChild(clip);}
    }
    for(const clip of clips.values())clip.remove();
    syncPaths($('family-borders'),families.map(f=>({id:f.groupId,d:Renderer.outline(f.d,DATA),attrs:{fill:'none',stroke:f.color,
      'stroke-width':3.8-f.depth*.8,'stroke-linejoin':'round','vector-effect':'non-scaling-stroke','clip-path':`url(#pando-${f.id})`}})),'family');
    syncPaths($('outline-borders'),Model.outlineTerritories(scoped,DATA).map(l=>({id:l.id,d:Renderer.outline(l.d,DATA),attrs:{fill:'none',stroke:l.color,'stroke-width':Model.outlineWidth(l.width),'stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}})),'outline');
  }
  function renderPalette() {
    const group=paletteGroup();
    $('active-color-code').textContent=group.color.toUpperCase();
    syncColorInputs(group.color);
    for(const swatch of $('swatches').children){
      const isActive=swatch.dataset.color===group.color;
      swatch.classList.toggle('selected',isActive);swatch.setAttribute('aria-pressed',isActive);
      swatch.innerHTML=isActive?'<svg><use href="#i-check"/></svg>':'';
    }
    microUI?.renderPalette();
  }
  function syncColorInputs(hex,source='all'){
    if(source!=='hex')$('color-hex').value=hex.toUpperCase();
    if(source!=='rgb')Color.toRGB(hex).forEach((value,i)=>$(['color-r','color-g','color-b'][i]).value=value);
    $('custom-preview').style.background=hex;$('color-error').hidden=true;
    for(const id of ['color-hex','color-r','color-g','color-b'])$(id).removeAttribute('aria-invalid');
  }
  function buildPalette(){
    const colors=Color.palette(paletteCount);
    while($('swatches').children.length>paletteCount)$('swatches').lastElementChild.remove();
    for(const color of colors.slice($('swatches').children.length)){
      const b=document.createElement('button');b.className='swatch';b.style.backgroundColor=color;b.dataset.color=color;
      b.title=`선택한 그룹의 색상: ${color.toUpperCase()}`;b.setAttribute('aria-label',`${color.toUpperCase()} 색상`);
      b.addEventListener('click',()=>setGroupColor(color));$('swatches').appendChild(b);
    }
    $('palette-count').textContent=paletteCount+'색';$('more-colors').textContent='더보기 +'+(paletteCount<60?36:12);
    $('collapse-colors').hidden=paletteCount<=24;renderPalette();
  }
  function applyColorInput(){
    const hex=colorDraftSource==='rgb'?Color.fromRGB(['color-r','color-g','color-b'].map(id=>$(id).value)):Color.parseHex($('color-hex').value);
    if(!hex){
      $('color-error').textContent=colorDraftSource==='rgb'?'RGB는 각각 0~255의 정수로 입력해주세요.':'HEX는 #RRGGBB 또는 #RGB로 입력해주세요.';
      $('color-error').hidden=false;
      for(const id of colorDraftSource==='rgb'?['color-r','color-g','color-b']:['color-hex'])$(id).setAttribute('aria-invalid','true');
      return;
    }
    setGroupColor(hex);toast(activeOutline()?'선택한 영역의 테두리 색상을 바꿨어요.':'선택한 범례의 색상을 바꿨어요.');
  }
  function syncQuickColor(hex,source='all') {
    if(source!=='hex')$('quick-color-hex').value=hex.toUpperCase();
    if(source!=='rgb')Color.toRGB(hex).forEach((value,i)=>$(['quick-color-r','quick-color-g','quick-color-b'][i]).value=value);
    $('quick-color-preview').style.background=hex;$('quick-color-error').hidden=true;
    for(const id of ['quick-color-hex','quick-color-r','quick-color-g','quick-color-b'])$(id).removeAttribute('aria-invalid');
  }
  function positionQuickColor() {
    const picker=$('quick-color-picker');if(picker.hidden||!quickColorAnchor)return;
    if(!quickColorAnchor.isConnected){closeQuickColor();return;}
    const rect=quickColorAnchor.getBoundingClientRect(),width=picker.offsetWidth,height=picker.offsetHeight;
    const viewportWidth=document.documentElement.clientWidth,viewportHeight=window.innerHeight;
    const left=Math.max(12,Math.min(rect.left,viewportWidth-width-12));
    let top=rect.bottom+8;if(top+height>viewportHeight-12)top=rect.top-height-8;
    picker.style.left=left+'px';picker.style.top=Math.max(12,Math.min(top,viewportHeight-height-12))+'px';
  }
  function closeQuickColor(restoreFocus=false) {
    const anchor=quickColorAnchor;$('quick-color-picker').hidden=true;
    anchor?.setAttribute('aria-expanded','false');quickColorGroupId=null;quickColorAnchor=null;quickColorApply=null;quickColorVirtual=null;
    if(restoreFocus&&anchor?.isConnected)anchor.focus({preventScroll:true});
  }
  function buildQuickPalette() {
    const group=quickColorVirtual||state.groups.find(g=>g.id===quickColorGroupId);if(!group)return;
    const fragment=document.createDocumentFragment();
    for(const color of Color.palette(quickPaletteCount)){
      const button=document.createElement('button');button.className='swatch';button.style.background=color;
      button.setAttribute('aria-label',color.toUpperCase()+' 빠른 색상');button.title=color.toUpperCase();
      button.setAttribute('aria-pressed',color===group.color);
      button.classList.toggle('selected',color===group.color);
      if(color===group.color)button.innerHTML='<svg><use href="#i-check"/></svg>';
      button.addEventListener('click',()=>applyQuickColor(color));fragment.appendChild(button);
    }
    $('quick-swatches').replaceChildren(fragment);$('quick-palette-count').textContent=quickPaletteCount+'색';
    $('quick-more-colors').textContent='더보기 +'+(quickPaletteCount<60?36:12);$('quick-collapse-colors').hidden=quickPaletteCount<=24;
    positionQuickColor();
  }
  function openQuickColor(group,anchor,onApply=null) {
    if(quickColorGroupId===group.id&&!$('quick-color-picker').hidden){closeQuickColor(true);return;}
    closeQuickColor();quickColorGroupId=group.id;quickColorAnchor=anchor;quickColorSource='hex';
    quickColorApply=onApply;quickColorVirtual=onApply?group:null;
    $('quick-color-name').textContent=(group.name||'이름 없는 범례')+' | 색상';
    syncQuickColor(group.color);$('quick-color-picker').hidden=false;anchor.setAttribute('aria-expanded','true');
    buildQuickPalette();$('quick-color-picker').focus({preventScroll:true});
  }
  function applyQuickColor(color) {
    const hex=color||(quickColorSource==='rgb'?Color.fromRGB(['quick-color-r','quick-color-g','quick-color-b'].map(id=>$(id).value)):Color.parseHex($('quick-color-hex').value));
    if(!hex){
      $('quick-color-error').textContent=quickColorSource==='rgb'?'RGB는 각각 0~255의 정수로 입력해주세요.':'HEX는 #RRGGBB 또는 #RGB로 입력해주세요.';
      $('quick-color-error').hidden=false;
      for(const id of quickColorSource==='rgb'?['quick-color-r','quick-color-g','quick-color-b']:['quick-color-hex'])$(id).setAttribute('aria-invalid','true');
      positionQuickColor();return;
    }
    if(quickColorApply){const apply=quickColorApply;closeQuickColor();apply(hex);return;}
    if(!state.groups.some(g=>g.id===quickColorGroupId)){closeQuickColor();return;}
    setGroupColor(hex,quickColorGroupId);closeQuickColor(true);
  }
  function layoutLegendCards() {
    const list=$('legend-list');if(!list.clientWidth)return;
    const css=getComputedStyle(list),gap=parseFloat(css.columnGap)||12;
    const columns=css.gridTemplateColumns.trim().split(/\s+/).length;
    const width=(list.clientWidth-gap*(columns-1))/columns,cards=[...list.children];
    list.classList.add('legend-masonry');
    for(const card of cards){const value=width+'px';if(card.style.width!==value)card.style.width=value;}
    const sizes=cards.map(card=>card.getBoundingClientRect().height),heights=Array(columns).fill(0);
    cards.forEach((card,index)=>{
      const column=heights.indexOf(Math.min(...heights));
      card.style.left=column*(width+gap)+'px';card.style.top=heights[column]+'px';
      heights[column]+=sizes[index]+gap;
    });
    const height=Math.max(0,...heights)- (cards.length?gap:0),value=height+'px';
    if(list.style.height!==value)list.style.height=value;
    positionQuickColor();
  }
  let lastLegendPreview='',captionInput=null,legendDrag=null,suppressCaptionClick=false;
  function renderLegendPreview(){
    if(dockTab!=='legend'||legendDrag)return;
    const caption=window.PandoCaptions.compactLegend(state,Model.groupCounts(Model.scopedProject(state,DATA)).total,1210);
    if(caption.svg!==lastLegendPreview){$('legend-list').innerHTML=caption.svg;lastLegendPreview=caption.svg;}
    $('legend-list').firstElementChild?.setAttribute('role','group');
    for(const node of $('legend-list').querySelectorAll('[data-legend-entry],[data-caption-continuation]'))node.classList.toggle('selected',!activeOutline()&&(node.dataset.legendEntry||node.dataset.captionContinuation)===state.activeGroup);
    for(const node of $('legend-list').querySelectorAll('[data-outline-entry]'))node.classList.toggle('selected',node.dataset.outlineEntry===activeOutlineId);
  }
  function renderLegend(){
    closeQuickColor();legendCardObserver.disconnect();
    $('legend-list').classList.remove('legend-masonry');$('legend-list').style.height='auto';
    renderLegendPreview();renderLegendInspector();renderOutlines();renderPalette();renderCounts();renderElections();
  }
  function renderLegendInspector(){
    const panel=$('legend-inspector');panel.replaceChildren();panel.hidden=!!activeOutline();if(panel.hidden)return;
    const group=activeGroup(),depth=Model.groupDepth(group,state.groups),heading=document.createElement('div');heading.className='legend-inspector-heading';
    const title=document.createElement('strong');title.textContent=group.name||'이름 없는 범례';const level=document.createElement('span');level.textContent=(depth+1)+'단계 | 하위 범례 '+(Model.groupDescendants(group.id,state.groups).length-1)+'개';heading.append(title,level);
    const rename=document.createElement('button');rename.className='text-button';rename.textContent='이름 변경';rename.addEventListener('click',()=>beginCaptionRename(group.id));heading.appendChild(rename);
    for(const [step,label]of [[-1,'앞으로 이동'],[1,'뒤로 이동']]){const button=document.createElement('button');button.className='button secondary';button.textContent=step<0?'↑':'↓';button.setAttribute('aria-label',label);const siblings=state.groups.filter(g=>(g.parentId||null)===(group.parentId||null)),index=siblings.findIndex(g=>g.id===group.id);button.disabled=index+step<0||index+step>=siblings.length;button.addEventListener('click',()=>mutate(()=>state.groups=window.PandoLegendOrder.move(state.groups,group.id,step)));heading.appendChild(button);}
    if(depth<2){const add=document.createElement('button');add.className='button secondary';add.textContent='하위 범례 추가';add.addEventListener('click',()=>addGroup(group.id));heading.appendChild(add);}
    const remove=document.createElement('button');remove.className='text-button';remove.textContent='범례 삭제';remove.addEventListener('click',()=>deleteGroup(group.id));heading.appendChild(remove);panel.appendChild(heading);
    const meta=document.createElement('div');meta.className='legend-meta legend-inspector-fields';populateGroupMeta(meta,group);panel.appendChild(meta);
  }
  function beginCaptionRename(id,kind='group',node=null){
    captionInput?.blur();const group=kind==='party'?state.elections?.parties.find(p=>p.id===id):kind==='outline'?state.outlineLayers?.find(g=>g.id===id):state.groups.find(g=>g.id===id);if(!group)return;
    if(kind==='group')selectGroup(id);if(kind==='party'){state.elections.activePartyId=id;renderPalette();refreshElectionColors();}if(kind==='outline'){activeOutlineId=id;renderLegendInspector();renderOutlines();renderPalette();renderCounts();}
    node=node||$('legend-list').querySelector(`[${kind==='outline'?'data-outline-entry':'data-legend-entry'}="${id}"] [data-caption-name]`);if(!node)return;
    const rect=node.getBoundingClientRect(),input=document.createElement('input'),before=snapshot(),original=group.name;
    input.className='caption-name-editor';input.value=group.name;input.maxLength=60;input.setAttribute('aria-label','범례 이름 변경');input.style.left=Math.max(8,Math.min(rect.left,innerWidth-250))+'px';input.style.top=Math.max(8,Math.min(rect.top-5,innerHeight-45))+'px';input.style.fontFamily=Model.fontFamily(state.settings);document.body.appendChild(input);captionInput=input;
    let cancel=false;input.addEventListener('input',()=>{group.name=input.value;queueMapDetails(100);queueCaption();scheduleSave();});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}if(e.key==='Escape'){e.preventDefault();cancel=true;input.blur();}});
    input.addEventListener('blur',()=>{if(cancel)group.name=original;else record(before);input.remove();captionInput=null;renderAll();},{once:true});input.focus();input.select();
  }
  function setDockTab(next){
    if(!IS_MICRO)return;
    closeQuickColor();activeOutlineId=null;dockTab=next;state.elections.stage=next;
    if(next==='regions')setTool('pan');else if(next!=='legend')setTool('brush');
    renderAll();scheduleSave();
  }
  function syncMicroStage(){
    if(!IS_MICRO)return;
    for(const tab of ['legend','election','regions','seats']){
      $(tab+'-tab').setAttribute('aria-selected',String(tab===dockTab));$(tab+'-tab').tabIndex=tab===dockTab?0:-1;$(tab+'-panel').hidden=tab!==dockTab;
    }
    $('add-group').hidden=dockTab!=='legend';$('legend-hint').hidden=dockTab!=='legend';
    document.querySelector('.palette-section').hidden=!['legend','seats'].includes(dockTab);
    document.querySelector('.display-section').hidden=dockTab!=='legend';
    $('micro-map-controls').hidden=dockTab==='legend';
    $('party-palette').hidden=dockTab!=='seats';
    if(dockTab!=='seats')$('base-color-controls').hidden=false;
    $('apply-color').textContent=dockTab==='seats'?'정당 기본색에 적용':'선택한 범례에 적용';
    $('reset-button').hidden=!['legend','seats'].includes(dockTab);
    $('reset-button').lastChild.textContent=dockTab==='seats'?' 의석 배정 비우기':' 지도 비우기';
    $('paint-province').hidden=dockTab!=='legend';
    document.querySelector('[data-tool="brush"] span').textContent=dockTab==='election'?'읍면동 배정':'색칠';
    document.querySelector('[data-tool="eraser"] span').textContent=dockTab==='election'?'배정 해제':'지우개';
  }
  function refreshElectionColors(){microUI?.refresh();}
  function renderElections(){microUI?.render(dockTab);}
  function locateElection(district){
    if(!district.memberIds.length)return;
    const boxes=district.memberIds.map(id=>regionById.get(id).bounds);
    const x1=Math.min(...boxes.map(b=>b[0])),y1=Math.min(...boxes.map(b=>b[1])),x2=Math.max(...boxes.map(b=>b[2])),y2=Math.max(...boxes.map(b=>b[3]));
    const k=Math.min(200,Math.max(1.2,.65*Math.min(FRAME[2]/Math.max(x2-x1,.5),FRAME[3]/Math.max(y2-y1,.5))));
    view={k,x:FRAME[0]+FRAME[2]/2-((x1+x2)/2)*k,y:FRAME[1]+FRAME[3]/2-((y1+y2)/2)*k};applyView();
    $('map-shell').scrollIntoView({block:'start',behavior:'smooth'});
    toast(`${district.sido} ${district.name} | ${district.memberIds.length}개 읍면동`);
  }
  function populateGroupMeta(meta,group) {
    const displayLabel=document.createElement('label');displayLabel.textContent='지도 표시 이름';
    const displayInput=document.createElement('input');displayInput.className='legend-display-name';displayInput.maxLength=60;
    displayInput.value=group.displayName||'';displayInput.placeholder='비우면 범례 이름 사용';displayInput.setAttribute('aria-label',`${group.name} 지도 표시 이름`);
    let displayBefore;
    displayInput.addEventListener('focus',()=>displayBefore=snapshot());
    displayInput.addEventListener('input',()=>{group.displayName=displayInput.value;queueMapDetails(100);scheduleSave();});
    displayInput.addEventListener('change',()=>{if(displayBefore)record(displayBefore);});
    displayInput.addEventListener('keydown',e=>{if(e.key==='Enter')displayInput.blur();});
    displayLabel.appendChild(displayInput);meta.appendChild(displayLabel);
    {
      const label=document.createElement('label');label.textContent='상위 범례';
      const select=document.createElement('select');select.className='legend-parent-select';select.setAttribute('aria-label',`${group.name} 상위 범례`);
      const independent=document.createElement('option');independent.value='';independent.textContent='없음 | 1단계 범례';select.appendChild(independent);
      for(const parent of Model.orderedGroups(state.groups).filter(g=>Model.canParent(group.id,g.id,state.groups))){
        const option=document.createElement('option');option.value=parent.id;option.textContent=Model.groupAncestors(parent,state.groups).map(g=>g.name||'이름 없는 범례').join(' > ');select.appendChild(option);
      }
      select.value=group.parentId||'';
      select.addEventListener('change',()=>mutate(()=>{group.parentId=select.value||null;group.provinceId=null;if(group.parentId)delete group.electionDistrictId;delete group.microRegionId;}));
      label.appendChild(select);meta.appendChild(label);
    }
  }
  function renderCounts() {
    queueCaption();
    const scoped=Model.scopedProject(state,DATA),counts=Model.groupCounts(scoped).total;
    document.querySelectorAll('[data-count]').forEach(el=>el.textContent=counts.get(el.dataset.count)||0);
    const ordinaryCount=Object.keys(scoped.assignments).length;
    let count=ordinaryCount,total=visibleRegionIds.size||DATA.regions.length,unit='개 지역';
    $('unfilled-count').textContent=total-ordinaryCount;
    if(IS_MICRO&&dockTab!=='legend'){
      if(dockTab==='election'){count=DATA.regions.length-Elections.unassigned(state,DATA).length;total=DATA.regions.length;unit='개 읍면동 배정';}
      else if(dockTab==='regions'){total=state.elections.districts.length;count=state.elections.districts.filter(d=>d.regionId).length;unit='개 선거구 권역 배정';}
      else{const seats=Elections.seatTotals(state,DATA).districtNational;count=seats.assigned;total=seats.total;unit='석 지역구 배정';}
    }
    const percent=total?Math.round(count/total*1000)/10:0;
    $('region-total').textContent=total;$('progress-unit').textContent=unit;
    $('japan-basic-note').hidden=DATA.id!=='eastasia'||!visibleCountries.has('japan');
    $('colored-count').textContent=count;$('colored-percent').textContent=percent+'%';$('progress-fill').style.width=percent+'%';
    refreshElectionColors();
    for(const el of document.querySelectorAll('[data-outline-count]'))el.textContent=(state.outlineLayers||[]).find(l=>l.id===el.dataset.outlineCount)?.regionIds.length||0;
    if(activeOutline()){
      $('instruction-title').textContent=activeOutline().name+' | 테두리 영역 편집';$('instruction-detail').textContent='클릭·드래그로 포함 | 지우개·우클릭으로 제외 | 기존 색칠 유지';return;
    }
    if(IS_MICRO&&dockTab!=='legend'){
      $('instruction-title').textContent=dockTab==='election'?'읍면동으로 선거구를 획정하세요':dockTab==='regions'?'권역 배정은 선택 사항입니다':state.elections.detailPainting?'읍면동별 명도 색칠':'정당을 골라 선거구에 의석을 배정하세요';
      $('instruction-detail').textContent=dockTab==='election'?'선거구 카드의 지도에서 편집 → 읍면동 클릭·드래그':dockTab==='regions'?'아래에서 권역을 만들거나 다음 단계로 넘어가세요':state.elections.detailPainting?'세부 색칠 | 의석 배정 유지':'선거구 클릭·드래그 | 의석 자동 배정';return;
    }
    if(count){$('instruction-title').textContent='나만의 지도가 만들어지고 있어요';$('instruction-detail').textContent=sidebarMedia.matches?'한 손가락으로 색칠 | 두 손가락으로 확대와 이동':'드래그로 연속 색칠 | 실수했다면 Ctrl + Z';}
    else{$('instruction-title').textContent='어디부터 채워볼까요?';$('instruction-detail').textContent=sidebarMedia.matches?'위에서 도구를 고르고 지역을 터치하세요. 두 손가락으로 확대할 수 있어요.':'왼쪽에서 그룹을 고른 뒤, 지역을 클릭하세요.';}
  }
  function renderSettings() {
    renderMapScope();
    $('map-viewport').style.backgroundColor=state.settings.seaColor||'#fbfcf8';$('map-viewport').style.backgroundImage=state.settings.seaColor?'none':'';
    $('sea-color').value=(state.settings.seaColor||'#fbfcf8').toUpperCase();$('empty-color').value=emptyColor().toUpperCase();$('export-region').value=state.settings.exportRegion||'current';
    $('project-title').style.fontFamily=Model.fontFamily(state.settings);
    const order=window.PandoLegendOrder.options(state.settings.legendSort);$('legend-sort-key').value=order.key;$('legend-sort-direction').value=order.direction;$('legend-sort-scope').value=order.scope;
    $('show-borders').checked=state.settings.borders;$('show-labels').checked=state.settings.labels;$('export-legend').checked=state.settings.legend;
    $('world-inset-settings').hidden=!Insets.available(DATA);
    const insetSettings=Insets.settings(state.settings.worldInsets);for(const input of document.querySelectorAll('[data-inset-toggle]'))input.checked=insetSettings[input.dataset.insetToggle];
    const insetCount=Insets.exportable(state,DATA).length;
    for(const button of document.querySelectorAll('[data-export]')){const format=button.dataset.export.toUpperCase();button.querySelector('strong').textContent=insetCount?format+' 이미지 묶음 (ZIP)':format==='PNG'?'PNG 이미지':'SVG 벡터';button.querySelector('small').textContent=insetCount?`전체 지도 + 확대 지도 ${insetCount}개 | 개별 ${format} 파일`:format==='PNG'?'고해상도 | 바로 사용하기':'크기 제한 없이 선명하게';}
    $('show-region-borders').checked=state.settings.regionBorders;$('label-mode').value=state.settings.labelMode;
    $('omit-suffix').checked=state.settings.omitSuffix;
    $('place-language').value=state.settings.placeLanguage||'ko';$('place-language').disabled=state.settings.nativeNames===true;
    $('native-names').checked=state.settings.nativeNames===true;
    $('show-family-borders').checked=state.settings.familyBorders;
    const captionSettings=window.PandoCaptions.settings(state.settings);$('caption-title').value=captionSettings.legendTitle;$('caption-columns').value=captionSettings.legendColumns;$('caption-font-size').value=captionSettings.legendFontSize;
    if(![...$('label-font').options].some(o=>o.value===state.settings.fontFamily)){
      const option=document.createElement('option');option.value=state.settings.fontFamily;option.textContent='설치 글꼴 | 다시 불러오기';$('label-font').appendChild(option);
    }
    $('label-font').value=state.settings.fontFamily;
    if(!window.PandoFonts.available(state.settings.fontFamily))$('font-status').textContent='저장된 설치 글꼴을 다시 불러와주세요. 지금은 프리텐다드로 미리 봅니다.';
    $('font-preview').style.fontFamily=Model.fontFamily(state.settings);
    const textStyle=Model.labelTypography(state.settings);
    $('font-preview').style.fontWeight=textStyle.labelBold?'700':'400';$('font-preview').style.fontStyle=textStyle.labelItalic?'italic':'normal';
    $('font-preview').style.letterSpacing=textStyle.labelTracking/100+'em';$('font-preview').style.color=textStyle.labelColor||'';
    $('label-bold').checked=textStyle.labelBold;$('label-italic').checked=textStyle.labelItalic;
    for(const [id,key] of [['label-size','labelSize'],['label-tracking','labelTracking'],['label-outline-width','labelOutlineWidth']])$(id).value=textStyle[key];
    for(const [id,key] of [['label-color','labelColor'],['label-outline-color','labelOutlineColor']]){
      $(id).value=textStyle[key]||'';$(id).style.borderLeftColor=textStyle[key]||'#dfe7d6';
    }
    $('label-style').value=state.settings.labelStyle;$('auto-spacing').checked=state.settings.autoSpacing;
    $('labels-over-water').checked=state.settings.labelsOverWater;
    $('island-min-area').value=Model.islandMinimumArea(state.settings.islandMinArea);
    $('island-min-area').disabled=state.settings.labelsOverWater||state.settings.labelMode!=='family';
    $('map-svg').classList.toggle('region-borders-off',!mapProject().settings.regionBorders);
    $('province-borders').style.display=mapProject().settings.borders?'':'none';
    queueMapDetails();
  }
  function renderAll() {
    syncMicroStage();
    renderMapScope();renderPlaceNames();
    $('project-title').value=state.title;document.title=(state.title||'판도')+' — PANDO';
    renderColors();renderLegend();renderSettings();renderResults();
  }
  function queueCaption(){if(captionFrame)return;captionFrame=requestAnimationFrame(()=>{captionFrame=0;renderMapCaption();});}
  function renderMapCaption(){
    renderWorldInsets();renderLegendPreview();const display=mapProject(),show=dockTab!=='legend'&&display.settings.legend&&!(IS_MICRO&&['election','regions'].includes(dockTab));
    $('map-caption').hidden=!show;$('map-presentation').classList.toggle('caption-on-right',show&&IS_MICRO);
    if(!show)return;
    const caption=IS_MICRO&&dockTab==='seats'?window.PandoCaptions.electionCaption(state,Elections.seatTotals(state,DATA),360):window.PandoCaptions.compactLegend(display,Model.groupCounts(display).total,IS_MICRO?360:1210,IS_MICRO?{columns:1}:{});
    if(caption.svg!==lastCaption){$('map-caption').innerHTML=caption.svg;lastCaption=caption.svg;}
    $('map-caption').firstElementChild?.setAttribute('role','group');
  }
  function renderWorldInsets(){
    const host=$('world-insets'),selected=Insets.enabled(state,DATA);host.hidden=!selected.length;if(!selected.length){lastInsets='';return;}
    const hidden=Insets.hiddenSettings(state.settings.worldInsetHidden),key=JSON.stringify([selected.map(p=>p.id),hidden,host.clientWidth,state.settings.fontFamily,window.PandoFonts.available(state.settings.fontFamily),state.settings.placeLanguage,state.settings.nativeNames,state.settings.regionBorders,state.settings.seaColor,state.settings.emptyColor]);
    if(key!==lastInsets){
      host.replaceChildren();const heading=document.createElement('div');heading.className='world-insets-heading';heading.innerHTML='<h2>작은 국가 확대 지도</h2><p>각 칸에서 직접 색칠할 수 있습니다. 숨기기는 이미지에서만 제외하며, 화면의 표시하기 버튼으로 되돌릴 수 있습니다.</p>';host.appendChild(heading);
      const grid=document.createElement('div');grid.className='world-inset-grid';host.appendChild(grid);
      for(const preset of selected){const card=document.createElement('article');card.className='world-inset-card';card.dataset.insetPreset=preset.id;grid.appendChild(card);}
      for(const card of grid.children){const preset=selected.find(p=>p.id===card.dataset.insetPreset),excluded=hidden.panels.includes(preset.id);card.classList.toggle('inset-panel-hidden',excluded);const actions=document.createElement('div');actions.className='world-inset-actions';const status=document.createElement('span');status.textContent=excluded?'이미지에서 이 권역 제외':'이미지에 이 권역 포함';const button=document.createElement('button');button.className='text-button';button.dataset.insetHidePanel=preset.id;button.textContent=excluded?'권역 표시하기':'권역 숨기기';button.setAttribute('aria-label',preset.name+(excluded?' 이미지에 표시하기':' 이미지에서 숨기기'));button.setAttribute('aria-pressed',String(excluded));actions.append(status,button);const preview=document.createElement('div');preview.className='world-inset-preview';preview.innerHTML=Insets.panel(state,DATA,preset,Math.max(280,Math.floor(card.clientWidth)),'editor-inset',{editor:true}).svg;card.append(actions,preview);}
      lastInsets=key;
    }
    const groups=new Map(state.groups.map(g=>[g.id,g]));
    for(const node of host.querySelectorAll('[data-inset-region]')){const color=groups.get(state.assignments[node.dataset.insetRegion])?.color||emptyColor();if(node.getAttribute('fill')!==color)node.setAttribute('fill',color);if(state.settings.regionBorders===false&&!node.dataset.insetMarker)node.setAttribute('stroke',color);}
    host.dataset.tool=tool;
  }
  function selectGroup(id){
    activeOutlineId=null;state.activeGroup=id;renderLegendPreview();renderLegendInspector();renderOutlines();renderCounts();renderPalette();refreshElectionColors();if(tool!=='brush')setTool('brush');scheduleSave();
  }
  function renderOutlines(){
    const layer=activeOutline();$('outline-edit-bar').hidden=!layer;
    $('outline-edit-name').textContent=layer?layer.name+' | 영역 편집':'';
    $('outline-empty').hidden=!!state.outlineLayers?.length;
    $('outline-list').replaceChildren();
    for(const entry of state.outlineLayers||[]){
      const card=document.createElement('div');card.className='outline-card';card.dataset.outlineCard=entry.id;card.classList.toggle('active',entry===layer);
      const row=document.createElement('div');row.className='legend-row';
      const color=document.createElement('button');color.className='legend-color outline-swatch';color.style.color=entry.color;color.setAttribute('aria-label',entry.name+' 테두리 색상 변경');color.setAttribute('aria-haspopup','dialog');
      color.addEventListener('click',()=>openQuickColor(entry,color,hex=>mutate(()=>entry.color=hex)));
      const name=document.createElement('button');name.className='legend-name outline-name-button';name.textContent=entry.name;name.setAttribute('aria-label',entry.name+' 이름 변경');name.addEventListener('click',()=>beginCaptionRename(entry.id,'outline'));
      const count=document.createElement('span');count.className='legend-count';count.dataset.outlineCount=entry.id;count.textContent=entry.regionIds.length;
      const remove=document.createElement('button');remove.className='legend-delete';remove.innerHTML='<svg><use href="#i-close"/></svg>';remove.setAttribute('aria-label',entry.name+' 영역 삭제');
      remove.addEventListener('click',()=>mutate(()=>{state.outlineLayers=state.outlineLayers.filter(l=>l.id!==entry.id);if(activeOutlineId===entry.id)activeOutlineId=null;}));row.append(color,name,count,remove);card.appendChild(row);
      const controls=document.createElement('div');controls.className='outline-controls';
      const visibleLabel=document.createElement('label');visibleLabel.textContent='테두리 표시';const visible=document.createElement('input');visible.type='checkbox';visible.checked=entry.visible!==false;visible.setAttribute('aria-label',entry.name+' 테두리 표시');visible.addEventListener('change',()=>mutate(()=>entry.visible=visible.checked));visibleLabel.appendChild(visible);
      const widthLabel=document.createElement('label');widthLabel.textContent='두께';const width=document.createElement('input');width.type='number';width.min='0';width.max='12';width.step='.25';width.value=Model.outlineWidth(entry.width);width.setAttribute('aria-label',entry.name+' 테두리 두께');width.addEventListener('input',()=>{const n=Number(width.value);if(width.value.trim()&&Number.isFinite(n)){mutate(()=>entry.width=Model.outlineWidth(n),false);queueMapDetails();}});width.addEventListener('change',()=>width.value=Model.outlineWidth(entry.width));widthLabel.append(width,document.createTextNode('px'));
      const edit=document.createElement('button');edit.className='button secondary';edit.textContent=entry===layer?'영역 편집 마침':'지도에서 편집';edit.setAttribute('aria-pressed',String(entry===layer));
      edit.addEventListener('click',()=>{activeOutlineId=entry===layer?null:entry.id;renderAll();if(activeOutline()){setTool('brush');$('outline-edit-bar').scrollIntoView({block:'start',behavior:'smooth'});}});controls.append(visibleLabel,widthLabel,edit);card.appendChild(controls);
      if(entry===layer){
        const members=document.createElement('div');members.className='outline-members';
        const select=document.createElement('select');select.setAttribute('aria-label',entry.name+' 구성 지역을 가져올 범례');
        for(const group of Model.orderedGroups(state.groups)){const option=document.createElement('option');option.value=group.id;option.textContent=Model.groupAncestors(group,state.groups).map(g=>g.name).join(' > ');select.appendChild(option);}select.value=state.activeGroup;
        for(const erase of [false,true]){const b=document.createElement('button');b.className='button secondary';b.textContent=erase?'범례 영역 제외':'범례 영역 추가';b.addEventListener('click',()=>mutate(()=>Model.setOutlineMembers(state,entry.id,Model.outlineMembers(state,select.value),erase)));members.appendChild(b);}
        members.prepend(select);const note=document.createElement('p');note.className='section-hint';note.textContent='하위 범례까지 현재 색칠한 지역을 가져옵니다. 이후 지도에서 속령 등 개별 지역을 더하거나 뺄 수 있습니다.';members.appendChild(note);card.appendChild(members);
      }
      $('outline-list').appendChild(card);
    }
    if(dockTab==='legend')$('apply-color').textContent=layer?'선택한 영역 테두리에 적용':'선택한 범례에 적용';
    if(!IS_MICRO||dockTab==='legend')$('paint-province').lastChild.textContent=layer?' 선택한 지역을 영역에 포함':' 선택한 국가/지역 전체 색칠';
  }
  function setGroupColor(color,groupId=null) {
    if(activeOutline()&&groupId===null){mutate(()=>activeOutline().color=color);return;}
    if(IS_MICRO&&dockTab==='seats'&&groupId===null){mutate(()=>{paletteGroup().color=color;state.elections.activeShade=0;});return;}
    groupId=groupId||state.activeGroup;
    const group=state.groups.find(g=>g.id===groupId);if(!group)return;
    mutate(()=>{group.color=color},false);renderColors();renderPalette();
    document.querySelector(`.legend-row[data-group="${groupId}"] .legend-color`)?.style.setProperty('background',color);
    refreshElectionColors();
    renderResults();
  }
  function deleteGroup(id) {
    const deleted=new Set(Model.groupDescendants(id,state.groups));
    if(deleted.size===state.groups.length){toast('범례는 하나 이상 있어야 해요.');return;}
    const execute=()=>mutate(()=>{
      state.groups=state.groups.filter(g=>!deleted.has(g.id));
      for(const [r,g]of Object.entries(state.assignments))if(deleted.has(g))delete state.assignments[r];
      if(deleted.has(state.activeGroup))state.activeGroup=state.groups[0].id;
    });
    if(deleted.size>1||Object.values(state.assignments).some(g=>deleted.has(g)))askConfirm('범례를 삭제할까요?','포함된 소범례도 삭제되고 해당 지역은 미지정으로 돌아갑니다. 실행 취소로 되돌릴 수 있어요.','범례 삭제',execute);
    else execute();
  }
  function addGroup(parentId=null) {
    if(parentId&&Model.groupDepth(state.groups.find(g=>g.id===parentId),state.groups)>=2)return;
    activeOutlineId=null;
    let id;
    mutate(()=>{
      id='g'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
      const number=parentId?state.groups.filter(g=>g.parentId===parentId).length+1:state.groups.filter(g=>!g.parentId).length+1;
      state.groups.push({id,name:parentId?`소범례 ${number}`:`범례 ${number}`,displayName:'',color:COLORS[state.groups.length%COLORS.length],parentId,provinceId:null});state.activeGroup=id;
    });
    setTool('brush');beginCaptionRename(id);
  }
  function setTool(next) {
    tool=next;$('map-viewport').dataset.tool=next;
    $('world-insets').dataset.tool=next;
    document.querySelectorAll('[data-tool].tool').forEach(b=>{b.classList.toggle('active',b.dataset.tool===next);b.setAttribute('aria-pressed',b.dataset.tool===next)});
    hideTooltip();
  }
  function paintRegion(id,erase=false) {
    if(!regionById.has(id))return;
    if(activeOutline()){
      if(Model.setOutlineMembers(state,activeOutlineId,[id],erase)){renderCounts();queueMapDetails();}
      return;
    }
    if(IS_MICRO&&dockTab!=='legend'){
      const result=microUI.paintRegion(id,erase,dockTab);
      if(result?.changed){for(const member of result.ids||[]){const color=result.colors?.[member]||result.color||emptyColor();paths.get(member).style.fill=color;paths.get(member).style.color=color;}renderCounts();if(!gesture){renderColors();renderResults();renderElections();}queueMapDetails();queueScene();}
      return;
    }
    if((erase&&!state.assignments[id])||(!erase&&state.assignments[id]===activeGroup().id))return;
    if(erase)delete state.assignments[id];else state.assignments[id]=activeGroup().id;
    paths.get(id).style.fill=erase?emptyColor():activeGroup().color;
    if(DATA.rendering)paths.get(id).style.color=paths.get(id).style.fill;
    const r=regionById.get(id),g=groupFor(id);
    paths.get(id).setAttribute('aria-label',`${Model.regionLocation(r,state.settings)} ${Model.regionName(r,state.settings)}, ${g?g.name:'미지정'}. ${tool==='eraser'?'지우기':'색칠'}`);
    renderCounts();queueMapDetails();
  }
  function pickRegion(id) {
    if(IS_MICRO&&dockTab!=='legend'){
      const own=Elections.membership(state,DATA).get(id),paint=state.elections.mapPaint?.[id];
      if(dockTab==='election'&&!own)return;
      mutate(()=>{if(dockTab==='election')state.elections.activeDistrictId=own;else if(dockTab==='seats'){const party=paint?.partyId||state.elections.partyAssignments[own];if(party){state.elections.activePartyId=party;state.elections.activeShade=paint?.shade||0;}}});setTool('brush');return;
    }
    const g=groupFor(id);
    if(g){selectGroup(g.id);toast(`‘${g.name || '이름 없는 그룹'}’을 선택했어요.`)}else toast('아직 색칠하지 않은 지역이에요.');
  }
  function basePoint(clientX,clientY) {
    const point=$('map-svg').createSVGPoint();point.x=clientX;point.y=clientY;
    return point.matrixTransform($('map-svg').getScreenCTM().inverse());
  }
  function applyView() {
    if(DATA.wrap&&currentMapView==='world')view.x=Renderer.normalizePan(view.x,view.k,FRAME,DATA.wrap);
    $('map-transform').setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.k})`);
    $('zoom-reset').textContent=Math.round(view.k*100)+'%';queueLabelView();queueScene();
  }
  function renderLabelContent() {
    const definitions=Model.mapLabels(mapProject(),DATA,renderedTerritories),retained=new Set();
    $('map-labels').style.fontFamily=Model.fontFamily(state.settings);
    labelDefinitions.clear();
    for(const definition of definitions){
      labelDefinitions.set(definition.id,definition);retained.add(definition.id);
      const previous=labelNodes.get(definition.id);
      if(previous&&previous.definition.runs===definition.runs&&previous.definition.shape.segments===definition.shape.segments){
        previous.definition=definition;previous.node.style.fill=definition.color;previous.node.style.color=definition.color;previous.node.style.stroke=definition.outlineColor;
        continue;
      }
      if(previous){previous.node.remove();previous.clip.remove();}
      const clipId='pando-label-'+definition.id,mask=definition.shape.mask;
      let clip;
      if(mask){
        const [x,y,right,bottom]=mask.limits;
        clip=createSVG('mask',{id:clipId,maskUnits:'userSpaceOnUse',x,y,width:right-x,height:bottom-y,'mask-type':'luminance'});
        clip.appendChild(createSVG('rect',{x,y,width:right-x,height:bottom-y,fill:'#ffffff',stroke:'none'}));
        clip.appendChild(createSVG('path',{d:mask.forbiddenD,fill:'#000000',stroke:'none','fill-rule':'evenodd'}));
      }else{
        clip=createSVG('clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'});
        clip.appendChild(createSVG('path',{d:definition.shape.d,'clip-rule':'evenodd'}));
      }
      $('label-clips').appendChild(clip);
      const label=createSVG('g',{'data-label':definition.id,'data-label-kind':definition.kind,'data-label-style':definition.curve?'curved':'straight',
        'data-label-font':state.settings.fontFamily,'data-label-bold':definition.typography.labelBold,'data-label-italic':definition.typography.labelItalic,
        'aria-label':definition.lines.join(' / '),'paint-order':'stroke',[mask?'mask':'clip-path']:`url(#${clipId})`});
      label.style.fill=definition.color;label.style.color=definition.color;label.style.stroke=definition.outlineColor;
      label.style.display='none';
      // Glyph paths stay mounted while zooming. Only the inner ink group scales;
      // the outer clip/mask remains in map coordinates.
      label.innerHTML='<g class="label-ink">'+Model.labelMarkup({...definition,center:[0,0]},1)+'</g>';
      $('map-labels').appendChild(label);
      labelNodes.set(definition.id,{node:label,clip,ink:label.firstElementChild,definition,fits:new Map()});
    }
    for(const [id,entry] of labelNodes)if(!retained.has(id)){entry.node.remove();entry.clip.remove();labelNodes.delete(id);}
    queueLabelView();
  }
  function updateLabels() {
    const ctm=$('map-transform').getScreenCTM();if(!ctm)return;
    const scale=Math.abs(ctm.a),rect=$('map-svg').getBoundingClientRect(),occupied=[];
    for(const [id,definition] of labelDefinitions){
      const entry=labelNodes.get(id),label=entry.node;
      const [x,y]=definition.center,offset=DATA.wrap&&currentMapView==='world'?Math.round(((rect.left+rect.width/2-ctm.e)/scale-x)/DATA.wrap.period)*DATA.wrap.period:0;
      const screenX=(x+offset)*ctm.a+ctm.e,screenY=y*ctm.d+ctm.f;
      const availableWidth=Math.max(0,2*Math.min(screenX-rect.left,rect.right-screenX)-8);
      const availableHeight=Math.max(0,2*Math.min(screenY-rect.top,rect.bottom-screenY)-8);
      let fontSize=Model.labelViewportSize(definition,scale,availableWidth,availableHeight);
      if(fontSize*scale<7){label.style.display='none';continue;}
      const fitsAt=size=>{
        if(!entry.fits.has(size)){
          if(entry.fits.size>32)entry.fits.clear();entry.fits.set(size,Model.labelFits(definition,size));
        }
        return entry.fits.get(size);
      };
      let fits=fontSize*scale>=7&&fitsAt(fontSize);
      for(let attempt=0;fontSize*scale>=7&&!fits&&attempt<6;attempt++){fontSize*=.82;fits=fitsAt(fontSize);}
      if(fontSize*scale<7||!fits){label.style.display='none';continue;}
      label.style.fontSize=fontSize+'px';
      const boxes=Model.labelBoxes(definition,fontSize).map(box=>({x:(box.x+offset)*scale+ctm.e,y:box.y*scale+ctm.f,width:box.width*scale,height:box.height*scale}));
      const collides=boxes.some(box=>occupied.some(b=>box.x<b.x+b.width+2&&box.x+box.width+2>b.x&&box.y<b.y+b.height+2&&box.y+box.height+2>b.y));
      const visible=fontSize*scale>=7&&!collides&&fits;
      label.style.display=visible?'':'none';if(visible)occupied.push(...boxes);
      if(visible&&Math.abs(Number(label.dataset.drawSize||0)-fontSize)>.0001){
        entry.ink.setAttribute('transform',`translate(${x} ${y}) scale(${fontSize})`);
        label.style.setProperty('--label-stroke',definition.typography.labelOutlineWidth/fontSize+(definition.typography.labelBold?.035:0));
        label.dataset.drawSize=fontSize;
      }
    }
  }
  function zoom(factor,clientX,clientY) {
    const rect=$('map-viewport').getBoundingClientRect();
    const p=basePoint(clientX??rect.x+rect.width/2,clientY??rect.y+rect.height/2);
    const next=Math.max(.75,Math.min(250,view.k*factor));
    const ratio=next/view.k;
    view={k:next,x:p.x-(p.x-view.x)*ratio,y:p.y-(p.y-view.y)*ratio};applyView();hideTooltip();
  }
  function resetView() {
    view={k:1,x:0,y:0};applyView();
    if(selectedRegion)paths.get(selectedRegion)?.classList.remove('located');selectedRegion=null;
  }
  function locateRegion(id) {
    const r=regionById.get(id),[x1,y1,x2,y2]=r.bounds;
    if(!visibleRegionIds.has(id)){
      state.settings.mapView=r.country;renderMapScope();renderColors();renderCounts();scheduleSave();
    }
    if(selectedRegion)paths.get(selectedRegion)?.classList.remove('located');
    selectedRegion=id;paths.get(id).classList.add('located');
    // Zoom around the actual SVG viewport, including its letterboxed area.
    const k=Math.min(200,Math.max(1.2,.55*Math.min(FRAME[2]/Math.max(x2-x1,.5),FRAME[3]/Math.max(y2-y1,.5))));
    view={k,x:FRAME[0]+FRAME[2]/2-((x1+x2)/2)*k,y:FRAME[1]+FRAME[3]/2-((y1+y2)/2)*k};applyView();
    if(window.innerWidth<800)toggleRegionPanel(false);
    toast(`${Model.regionLocation(r,state.settings)} ${Model.regionName(r,state.settings)} | 지도에서 클릭해 색칠하세요.`);
  }
  function regionAt(x,y) {
    const hit=document.elementFromPoint(x,y),id=hit?.closest('[data-region]')?.dataset.region;
    if(id||!DATA.wrap||currentMapView!=='world'||!hit?.closest('#map-viewport'))return id;
    const point=$('map-svg').createSVGPoint();point.x=x;point.y=y;
    const p=point.matrixTransform($('map-transform').getScreenCTM().inverse());
    p.x=DATA.wrap.left+((p.x-DATA.wrap.left)%DATA.wrap.period+DATA.wrap.period)%DATA.wrap.period;
    for(const r of DATA.regions){const b=r.bounds;if(p.x>=b[0]&&p.x<=b[2]&&p.y>=b[1]&&p.y<=b[3]&&paths.get(r.id).isPointInFill(p))return r.id;}
  }
  function hideTooltip() {$('map-tooltip').hidden=true;tooltipId=null;}
  function showTooltip(id,e) {
    if(!id || gesture){hideTooltip();return;}
    const r=regionById.get(id),g=groupFor(id),tip=$('map-tooltip');
    if(id!==tooltipId){tip.replaceChildren();tip.append(document.createTextNode(Model.regionName(r,state.settings)));const small=document.createElement('small');const root=Model.rootFor(g,state.groups);small.textContent=Model.regionLocation(r,state.settings)+' | '+(g?Model.groupAncestors(g,state.groups).map(entry=>entry.name).join(' > '):'미지정');
      if(IS_MICRO&&dockTab!=='legend'){const d=Elections.districtFor(DATA,Elections.membership(state,DATA).get(id),state);small.textContent=Model.regionLocation(r,state.settings)+' | '+(d?.name||'선거구 미배정');if(dockTab==='seats'){small.textContent+=' | 의석 '+(state.elections.parties.find(p=>p.id===state.elections.partyAssignments[d?.id])?.name||'미배정');const paint=state.elections.mapPaint?.[id],party=state.elections.parties.find(p=>p.id===paint?.partyId);if(party)small.textContent+=' | 색칠 '+party.name+' '+Elections.shades(party.color).find(t=>t.shade===paint.shade).name;}}
      tip.appendChild(small);tooltipId=id;}
    tip.hidden=false;
    const rect=$('map-shell').getBoundingClientRect();
    tip.style.left=Math.max(8,Math.min(e.clientX-rect.x+15,rect.width-tip.offsetWidth-10))+'px';
    tip.style.top=Math.max(55,Math.min(e.clientY-rect.y+17,rect.height-tip.offsetHeight-10))+'px';
  }
  function endGesture() {
    if(!gesture)return;
    const ended=gesture;gesture=null;$('map-viewport').classList.remove('dragging');
    if(ended.mode==='paint'){record(ended.before);if(activeOutline())renderOutlines();if(IS_MICRO&&dockTab!=='legend')renderColors();renderResults();renderElections();}
    if(mapDetailsPending)queueMapDetails();
  }
  function askConfirm(title,description,label,action) {
    $('confirm-title').textContent=title;$('confirm-description').textContent=description;$('confirm-ok').textContent=label;confirmAction=action;$('confirm-dialog').showModal();
  }
  function toggleRegionPanel(open) {
    $('region-panel').hidden=!open;$('region-toggle').setAttribute('aria-expanded',open);
    if(open){renderResults();$('region-search').focus();}hideTooltip();
  }
  function renderResults() {
    if($('region-panel').hidden)return;
    $('japan-basic-note').hidden=DATA.id!=='eastasia'||($('country-filter').value?$('country-filter').value!=='japan':!visibleCountries.has('japan'));
    const display=mapProject(),shownGroups=new Map(display.groups.map(g=>[g.id,g]));
    const search=$('region-search').value.trim();
    const province=$('province-filter').value;
    const results=RegionSearch.results({query:search,parent:province,country:$('country-filter').value,settings:state.settings});
    $('result-count').textContent=results.length+'개 지역';$('region-results').replaceChildren();
    for(const r of results.slice(0,resultLimit)){
      const b=document.createElement('button');b.className='region-result';b.dataset.locate=r.id;
        const swatch=document.createElement('span');swatch.className='result-swatch';swatch.style.background=shownGroups.get(display.assignments[r.id])?.color||emptyColor();
        const text=document.createElement('span'),name=document.createElement('strong'),provinceName=document.createElement('small');name.textContent=Model.formatRegionName(Model.regionName(r,state.settings),state.settings.omitSuffix);provinceName.textContent=[Model.regionLocation(r,state.settings),r.unit||'',r.memberIds?`정·촌 ${r.memberIds.length}개`: ''].filter(Boolean).join(' | ');text.append(name,provinceName);
      b.append(swatch,text);b.insertAdjacentHTML('beforeend','<svg><use href="#i-chevron"/></svg>');
      b.addEventListener('click',()=>locateRegion(r.id));$('region-results').appendChild(b);
    }
    if(results.length>resultLimit){const more=document.createElement('button');more.className='button secondary result-more';more.textContent=`더 보기 | ${Math.min(resultLimit,results.length)} / ${results.length}`;more.addEventListener('click',()=>{resultLimit+=120;renderResults();});$('region-results').appendChild(more);}
    if(!results.length){const empty=document.createElement('p');empty.className='no-results';empty.textContent='검색한 지역을 찾지 못했어요.\n다른 이름으로 검색해보세요.';$('region-results').appendChild(empty);}
  }
  function filename(extension) {
    const title=(state.title.trim()||'나의 동아시아 지도').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,70)||'pando';
    return title+'.'+extension;
  }
  function download(blob,name) {
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function exportBlob(output,format){
    const blob=new Blob([output.svg],{type:'image/svg+xml;charset=utf-8'});if(format==='svg')return blob;
    const url=URL.createObjectURL(blob);
    try{const img=new Image();img.src=url;await img.decode();const size=window.PandoSVG.rasterSize(output.width,output.height),canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;const context=canvas.getContext('2d');if(!context)throw new Error('canvas');context.drawImage(img,0,0,canvas.width,canvas.height);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));canvas.width=canvas.height=1;if(!png)throw new Error('png');return png;}finally{URL.revokeObjectURL(url);}
  }
  async function exportImage(format) {
    const display=mapProject();
    if(!window.PandoFonts.available(state.settings.fontFamily)){toast('선택한 설치 글꼴을 다시 불러온 뒤 내보내주세요.');return;}
    $('export-menu').hidden=true;$('export-button').setAttribute('aria-expanded','false');
    $('export-button').disabled=true;
    try {
      const outputs=window.PandoSVG.makeDocuments(display,DATA),files=[];
      for(const [i,output]of outputs.entries()){if(outputs.length>1)toast(`이미지 생성 중 | ${i+1} / ${outputs.length}`);files.push({name:output.id==='main'?filename(format):filename(format).replace('.'+format,' - '+output.name+'.'+format),blob:await exportBlob(output,format)});}
      if(files.length===1){download(files[0].blob,files[0].name);toast(format.toUpperCase()+' 지도를 내보냈어요.');}
      else{download(await window.PandoExportFiles.archive(files),filename('zip'));toast(`전체 지도와 확대 지도 ${files.length-1}개를 별도 ${format.toUpperCase()} 파일로 ZIP에 저장했습니다.`);}
    } catch(error) {console.error('PANDO image export:',error);toast('이미지 생성에 실패했습니다. 다시 시도하거나 SVG로 저장해주세요.');}
    finally{$('export-button').disabled=false;}
  }

  buildPalette();
  $('more-colors').addEventListener('click',()=>{paletteCount=Color.nextCount(paletteCount);buildPalette();});
  $('collapse-colors').addEventListener('click',()=>{paletteCount=24;buildPalette();});
  $('color-hex').addEventListener('input',e=>{colorDraftSource='hex';const hex=Color.parseHex(e.target.value);if(hex)syncColorInputs(hex,'hex');});
  for(const id of ['color-r','color-g','color-b'])$(id).addEventListener('input',()=>{
    colorDraftSource='rgb';const hex=Color.fromRGB(['color-r','color-g','color-b'].map(id=>$(id).value));if(hex)syncColorInputs(hex,'rgb');
  });
  for(const id of ['color-hex','color-r','color-g','color-b'])$(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyColorInput();}});
  $('apply-color').addEventListener('click',applyColorInput);
  $('legend-sort-apply').addEventListener('click',()=>{const options=window.PandoLegendOrder.options({key:$('legend-sort-key').value,direction:$('legend-sort-direction').value,scope:$('legend-sort-scope').value});mutate(()=>{state.settings.legendSort=options;state.groups=window.PandoLegendOrder.sort(state,options.key,options.direction,options.scope==='siblings'?(activeGroup().parentId||null):undefined);});});
  $('export-region-settings').hidden=!window.PandoExportRegions.available(DATA);
  for(const input of document.querySelectorAll('[data-inset-toggle]'))input.addEventListener('change',()=>mutate(()=>state.settings.worldInsets={...Insets.settings(state.settings.worldInsets),[input.dataset.insetToggle]:input.checked}));
  new ResizeObserver(()=>queueCaption()).observe($('world-insets'));
  for(const preset of window.PandoExportRegions.presets){const option=document.createElement('option');option.value=preset.id;option.textContent=preset.name;$('export-region').appendChild(option);}
  $('export-region').addEventListener('change',e=>mutate(()=>state.settings.exportRegion=e.target.value));
  for(const [input,key,reset]of [['sea-color','seaColor','sea-color-reset'],['empty-color','emptyColor','empty-color-reset']]){
    $(input).addEventListener('input',()=>{const color=Color.parseHex($(input).value);$(input).setAttribute('aria-invalid',String(!color));if(!color)return;mutate(()=>state.settings[key]=color,false);if(key==='seaColor'){$('map-viewport').style.backgroundColor=color;$('map-viewport').style.backgroundImage='none';}else renderColors();});
    $(reset).addEventListener('click',()=>mutate(()=>delete state.settings[key]));
  }
  function captionTarget(event,host){
    const node=event.target.closest('[data-legend-entry],[data-caption-continuation],[data-party-total],[data-outline-entry]');if(!node||!host.contains(node))return null;
    return {node,id:node.dataset.legendEntry||node.dataset.captionContinuation||node.dataset.partyTotal||node.dataset.outlineEntry,kind:node.dataset.partyTotal?'party':node.dataset.outlineEntry?'outline':'group'};
  }
  function legendDropPlan(drag,x,y){
    const within=zone=>{const r=zone.rect,dx=scrollX-drag.scroll[0],dy=scrollY-drag.scroll[1];return x>=r.left-dx&&x<=r.right-dx&&y>=r.top-dy&&y<=r.bottom-dy;};
    const row=drag.zones.find(z=>z.kind==='row'&&within(z)),slot=drag.zones.find(z=>z.kind==='slot'&&within(z)),card=drag.zones.find(z=>z.kind==='card'&&within(z));
    if(drag.target.kind==='outline'){
      if(row?.outline){if(row.id===drag.group.id)return {valid:true,noop:true,label:'현재 위치 유지'};const target=state.outlineLayers.find(g=>g.id===row.id),after=y>row.rect.top-(scrollY-drag.scroll[1])+row.rect.height/2;return {node:row.node,outlineId:row.id,after,label:target.name+(after?' 뒤로 이동':' 앞으로 이동'),valid:true};}
      return {valid:false,label:'초국가 영역 사이에서 순서를 바꿀 수 있습니다.'};
    }
    let node=null,placement,label,mode='nest';
    if(row){
      node=row.node;if(row.outline)return {node,valid:false,label:'일반 범례는 초국가 영역에 넣을 수 없습니다.'};
      if(row.id===drag.group.id)return {node,valid:true,noop:true,label:'현재 위치 유지'};
      placement={parentId:row.id};label=state.groups.find(g=>g.id===row.id).name+'의 하위 범례로 이동';
    }else if(slot){
      node=slot.node;const anchor=state.groups.find(g=>g.id===slot.id);placement={parentId:anchor.parentId||null,[slot.after?'afterId':'beforeId']:anchor.id};mode='slot';label=anchor.name+(slot.after?' 뒤로 이동':' 앞으로 이동');
    }else if(card){
      node=card.node;if(card.id===drag.familyId)return {valid:true,noop:true,label:'현재 소속 유지'};
      placement={parentId:card.id};label=state.groups.find(g=>g.id===card.id).name+'의 하위 범례로 이동';
    }else{
      // An empty area detaches a child; position in the root list is snapped to a nearby card.
      placement={parentId:null};mode='root';label=drag.group.parentId?'독립 범례로 이동':'독립 범례 순서 변경';
      const roots=drag.zones.filter(z=>z.kind==='card'&&z.id!==drag.familyId),dx=scrollX-drag.scroll[0],dy=scrollY-drag.scroll[1];
      roots.sort((a,b)=>Math.hypot(x-(a.rect.left+a.rect.right)/2+dx,y-(a.rect.top+a.rect.bottom)/2+dy)-Math.hypot(x-(b.rect.left+b.rect.right)/2+dx,y-(b.rect.top+b.rect.bottom)/2+dy));
      if(roots.length){const nearest=roots[0];placement[y<nearest.rect.top+nearest.rect.height/2-dy?'beforeId':'afterId']=nearest.id;}
    }
    const parentId=placement.parentId||null,valid=Model.canParent(drag.group.id,parentId,state.groups),members=drag.members;
    if(!valid)label=members.has(parentId)?'자신이나 하위 범례 안으로 이동할 수 없습니다.':'하위 범례를 포함해 최대 3단계까지만 묶을 수 있습니다.';
    if(members.has(placement.beforeId)||members.has(placement.afterId))return {node,valid:true,noop:true,label:'현재 위치 유지'};
    return {node,placement,mode,label,valid};
  }
  function updateLegendDrag(drag,e){
    if(!drag.moved){
      drag.moved=true;drag.host.classList.add('legend-dragging');
      for(const zone of drag.zones)if(zone.kind==='row'&&(drag.target.kind==='outline'?zone.outline&&zone.id===drag.group.id:!zone.outline&&drag.members.has(zone.id)))zone.node.classList.add('legend-drag-source');
      drag.badge=document.createElement('div');drag.badge.className='legend-drag-badge';document.body.appendChild(drag.badge);
    }
    drag.plan?.node?.classList.remove('legend-drop-target','legend-drop-invalid','legend-drop-slot');
    drag.plan=legendDropPlan(drag,e.clientX,e.clientY);
    if(drag.plan.node&&!drag.plan.noop)drag.plan.node.classList.add(drag.plan.valid?(drag.plan.mode==='slot'?'legend-drop-slot':'legend-drop-target'):'legend-drop-invalid');
    drag.badge.textContent=drag.plan.label;drag.badge.classList.toggle('invalid',!drag.plan.valid);drag.badge.style.left=Math.max(8,Math.min(e.clientX+16,innerWidth-300))+'px';drag.badge.style.top=Math.max(8,Math.min(e.clientY+18,innerHeight-50))+'px';
    if($('legend-drag-status').textContent!==drag.plan.label)$('legend-drag-status').textContent=drag.plan.label;
  }
  function clearLegendDrag(drag){
    drag.badge?.remove();drag.host.classList.remove('legend-dragging');
    for(const node of drag.host.querySelectorAll('.legend-drag-source,.legend-drop-target,.legend-drop-invalid,.legend-drop-slot'))node.classList.remove('legend-drag-source','legend-drop-target','legend-drop-invalid','legend-drop-slot');
    $('legend-drag-status').textContent='항목 위에 놓으면 하위 범례 | 칸 밖으로 빼면 독립 범례 | 칸 사이에 놓으면 순서 변경';
  }
  for(const host of [$('legend-list'),$('map-caption')]){
    host.addEventListener('click',e=>{
      if(suppressCaptionClick){suppressCaptionClick=false;return;}const target=captionTarget(e,host);if(!target)return;
      const group=target.kind==='party'?state.elections.parties.find(p=>p.id===target.id):target.kind==='outline'?state.outlineLayers?.find(g=>g.id===target.id):state.groups.find(g=>g.id===target.id);if(!group)return;
      if(e.target.closest('[data-caption-swatch]')){if(target.kind==='group')selectGroup(group.id);openQuickColor(group,e.target.closest('[data-caption-swatch]'),target.kind!=='group'?hex=>mutate(()=>group.color=hex):null);return;}
      if(e.target.closest('[data-caption-count]')){if(target.kind==='group')selectGroup(group.id);return;}
      beginCaptionRename(target.id,target.kind,target.node.querySelector('[data-caption-name]')||target.node);
    });
    host.addEventListener('keydown',e=>{const target=captionTarget(e,host);if(!target)return;if(['Enter','F2'].includes(e.key)){e.preventDefault();beginCaptionRename(target.id,target.kind,target.node.querySelector('[data-caption-name]')||target.node);}if(target.kind==='group'&&e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();mutate(()=>state.groups=window.PandoLegendOrder.move(state.groups,target.id,e.key==='ArrowUp'?-1:1));}});
    host.addEventListener('pointerdown',e=>{const target=captionTarget(e,host);if(!target||target.kind==='party'||e.button!==0||e.target.closest('[data-caption-swatch]'))return;
      const group=target.kind==='outline'?state.outlineLayers.find(g=>g.id===target.id):state.groups.find(g=>g.id===target.id),zones=[];
      for(const node of host.querySelectorAll('[data-caption-hit]')){const row=node.parentElement;zones.push({node:row,id:row.dataset.legendEntry||row.dataset.captionContinuation||row.dataset.outlineEntry,outline:!!row.dataset.outlineEntry,kind:'row',rect:node.getBoundingClientRect()});}
      for(const node of host.querySelectorAll('[data-legend-slot-before],[data-legend-slot-after]'))zones.push({node,id:node.dataset.legendSlotBefore||node.dataset.legendSlotAfter,after:!!node.dataset.legendSlotAfter,kind:'slot',rect:node.getBoundingClientRect()});
      for(const node of host.querySelectorAll('[data-legend-card]'))zones.push({node,id:node.dataset.legendCard,kind:'card',rect:node.getBoundingClientRect()});
      legendDrag={host,group,start:[e.clientX,e.clientY],scroll:[scrollX,scrollY],zones,familyId:target.node.closest('[data-legend-family]')?.dataset.legendFamily,members:new Set(target.kind==='group'?Model.groupDescendants(group.id,state.groups):[]),moved:false,pointerId:e.pointerId,target,count:!!e.target.closest('[data-caption-count]')};host.setPointerCapture(e.pointerId);e.preventDefault();
    });
    host.addEventListener('pointermove',e=>{const drag=legendDrag;if(!drag||drag.host!==host||e.pointerId!==drag.pointerId)return;
      const x=e.clientX-drag.start[0],y=e.clientY-drag.start[1];if(!drag.moved&&Math.hypot(x,y)<=4)return;
      updateLegendDrag(drag,e);e.preventDefault();
    });
    const end=e=>{const drag=legendDrag;if(!drag||drag.host!==host||drag.pointerId!==e.pointerId)return;
      if(drag.moved&&e.type!=='pointercancel')updateLegendDrag(drag,e);
      legendDrag=null;if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);suppressCaptionClick=true;clearLegendDrag(drag);
      if(e.type==='pointercancel'){renderLegendPreview();return;}
      if(drag.moved){const plan=drag.plan;if(!plan?.valid){toast(plan?.label||'범례를 이동하지 않았습니다.');return;}if(plan.noop)return;
        mutate(()=>{if(drag.target.kind==='group'){state.groups=window.PandoLegendOrder.place(state.groups,drag.group.id,plan.placement);activeOutlineId=null;state.activeGroup=drag.group.id;}else{const layers=state.outlineLayers.filter(g=>g.id!==drag.group.id),index=layers.findIndex(g=>g.id===plan.outlineId);if(index>=0)layers.splice(index+(plan.after?1:0),0,drag.group);else layers.push(drag.group);state.outlineLayers=layers;activeOutlineId=drag.group.id;}});
      }
      else if(drag.count){if(drag.target.kind==='group')selectGroup(drag.group.id);}
      else beginCaptionRename(drag.target.id,drag.target.kind,drag.target.node.querySelector('[data-caption-name]')||drag.target.node);
    };
    host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);
  }
  document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!legendDrag)return;const drag=legendDrag;legendDrag=null;if(drag.host.hasPointerCapture(drag.pointerId))drag.host.releasePointerCapture(drag.pointerId);clearLegendDrag(drag);suppressCaptionClick=true;e.preventDefault();e.stopImmediatePropagation();});
  $('close-quick-color').addEventListener('click',()=>closeQuickColor(true));
  $('quick-more-colors').addEventListener('click',()=>{quickPaletteCount=Color.nextCount(quickPaletteCount);buildQuickPalette();});
  $('quick-collapse-colors').addEventListener('click',()=>{quickPaletteCount=24;buildQuickPalette();});
  $('quick-color-hex').addEventListener('input',e=>{quickColorSource='hex';const hex=Color.parseHex(e.target.value);if(hex)syncQuickColor(hex,'hex');});
  for(const id of ['quick-color-r','quick-color-g','quick-color-b'])$(id).addEventListener('input',()=>{
    quickColorSource='rgb';const hex=Color.fromRGB(['quick-color-r','quick-color-g','quick-color-b'].map(id=>$(id).value));if(hex)syncQuickColor(hex,'rgb');
  });
  for(const id of ['quick-color-hex','quick-color-r','quick-color-g','quick-color-b'])$(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyQuickColor();}});
  $('apply-quick-color').addEventListener('click',()=>applyQuickColor());
  document.addEventListener('pointerdown',e=>{if(!$('quick-color-picker').hidden&&!$('quick-color-picker').contains(e.target)&&!e.target.closest('.legend-color'))closeQuickColor();});
  window.addEventListener('resize',positionQuickColor);window.addEventListener('scroll',positionQuickColor,{passive:true});
  document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>{touchInput.cancel();endGesture();setTool(b.dataset.tool);if(sidebarMedia.matches)toggleSidebar(false);}));
  $('add-group').addEventListener('click',()=>addGroup());
  for(const [id,key]of [['show-borders','borders'],['show-family-borders','familyBorders'],['show-region-borders','regionBorders'],['show-labels','labels'],['omit-suffix','omitSuffix'],['auto-spacing','autoSpacing'],['labels-over-water','labelsOverWater'],['export-legend','legend']])$(id).addEventListener('change',e=>mutate(()=>state.settings[key]=e.target.checked));
  $('label-mode').addEventListener('change',e=>mutate(()=>state.settings.labelMode=e.target.value));
  $('label-style').addEventListener('change',e=>mutate(()=>state.settings.labelStyle=e.target.value));
  for(const [id,key] of [['caption-title','legendTitle'],['caption-columns','legendColumns'],['caption-font-size','legendFontSize']]){
    const commit=()=>{const value=id==='caption-title'?$(id).value:Number($(id).value),next=window.PandoCaptions.settings({...state.settings,[key]:value});if(next[key]!==state.settings[key])mutate(()=>Object.assign(state.settings,next));};
    $(id).addEventListener('change',commit);$(id).addEventListener('blur',commit);$(id).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit();event.target.blur();}});
  }
  for(const [id,key] of [['label-bold','labelBold'],['label-italic','labelItalic']])$(id).addEventListener('change',e=>mutate(()=>state.settings[key]=e.target.checked));
  for(const [id,key] of [['label-size','labelSize'],['label-tracking','labelTracking'],['label-outline-width','labelOutlineWidth']])$(id).addEventListener('change',e=>{
    const value=e.target.value.trim()===''?undefined:Number(e.target.value),normalized=Model.labelTypography({...state.settings,[key]:value});
    mutate(()=>{state.settings[key]=normalized[key];if(key==='labelTracking')state.settings.autoSpacing=false;});
  });
  for(const [id,key,reset] of [['label-color','labelColor','reset-label-color'],['label-outline-color','labelOutlineColor','reset-outline-color']]){
    $(id).addEventListener('change',e=>{
      const value=e.target.value.trim(),color=value?Color.parseHex(value):null;
      if(value&&!color){toast('#123456 또는 #ABC 같은 HEX 색상을 입력해주세요.');renderSettings();return;}
      mutate(()=>state.settings[key]=color);
    });
    $(reset).addEventListener('click',()=>mutate(()=>state.settings[key]=null));
  }
  $('island-min-area').addEventListener('change',e=>{
    const value=e.target.value.trim()===''?100:Number(e.target.value);
    mutate(()=>state.settings.islandMinArea=Model.islandMinimumArea(value));
  });
  function refreshFontChoices(){
    const web=document.createElement('optgroup'),local=document.createElement('optgroup');web.label='기본 웹폰트';local.label='불러온 설치 글꼴';
    for(const font of Model.fontChoices){const option=document.createElement('option');option.value=font.name;option.textContent=font.label;(font.local?local:web).appendChild(option);}
    $('label-font').replaceChildren(web,...(local.children.length?[local]:[]));
  }
  refreshFontChoices();
  $('label-font').addEventListener('change',e=>{
    mutate(()=>state.settings.fontFamily=e.target.value);
  });
  const Fonts=window.PandoFonts;
  function fontStatus(){
    $('font-status').textContent=Fonts.available(state.settings.fontFamily)?'웹폰트·불러온 글꼴은 PNG·SVG에도 동일 적용':'저장된 설치 글꼴을 다시 불러와주세요. 지금은 프리텐다드로 미리 봅니다.';
  }
  $('label-font').addEventListener('change',fontStatus);
  Promise.all([Fonts.install(),Fonts.restoreLocal()]).then(()=>{refreshFontChoices();renderSettings();queueCaption();fontStatus();}).catch(()=>$('font-status').textContent='미리보기 글꼴을 불러오지 못했어요. 지도·이미지의 벡터 글자는 사용할 수 있습니다.');
  let systemFonts=[];
  function renderSystemFontList(){
    const query=$('system-font-search').value.trim().toLocaleLowerCase(),options=[];
    systemFonts.forEach((font,index)=>{
      if(![font.family,font.fullName,font.postscriptName].join(' ').toLocaleLowerCase().includes(query))return;
      const option=document.createElement('option');option.value=String(index);option.textContent=font.fullName||font.family;options.push(option);
    });
    $('system-font-list').replaceChildren(...options);$('use-system-font').disabled=!options.length;
    if(options.length)$('system-font-list').value=options[0].value;
  }
  $('load-system-fonts').addEventListener('click',async()=>{
    if(typeof window.queryLocalFonts!=='function'){
      $('font-status').textContent='이 브라우저는 설치 목록을 지원하지 않습니다. TTF·OTF·WOFF 파일을 선택해주세요.';$('font-file').click();return;
    }
    $('load-system-fonts').disabled=true;
    $('font-status').textContent='브라우저의 설치 글꼴 접근을 허용해주세요. 글꼴 파일로도 불러올 수 있습니다.';
    try{
      systemFonts=(await window.queryLocalFonts()).sort((a,b)=>(a.fullName||a.family).localeCompare(b.fullName||b.family,'ko'));
      $('system-font-picker').hidden=false;renderSystemFontList();
      $('font-status').textContent=systemFonts.length?'설치 글꼴을 선택한 뒤 ‘선택 글꼴 사용’을 누르세요.':'선택할 설치 글꼴이 없습니다. 글꼴 파일로 불러올 수 있습니다.';
    }catch{$('font-status').textContent='설치 글꼴 접근이 허용되지 않았어요. 글꼴 파일로 불러올 수 있습니다.';}
    finally{$('load-system-fonts').disabled=false;}
  });
  $('system-font-search').addEventListener('input',renderSystemFontList);
  async function applyLocalFont(buffer,label){
    $('font-status').textContent='글꼴을 불러오는 중…';
    const entry=await Fonts.loadLocal(buffer,label);refreshFontChoices();mutate(()=>state.settings.fontFamily=entry.name);
    $('system-font-picker').hidden=true;
    $('font-status').textContent=entry.saved?'설치 글꼴을 이 브라우저에 보관했습니다 | PNG·SVG에도 동일 적용':'글꼴을 적용했습니다. 자동 보관이 안 되어 다음에 다시 불러와야 합니다.';
  }
  $('use-system-font').addEventListener('click',async()=>{
    const value=$('system-font-list').value,font=value===''?null:systemFonts[Number(value)];if(!font)return;
    $('use-system-font').disabled=true;
    try{await applyLocalFont(await (await font.blob()).arrayBuffer(),font.fullName||font.family);}catch(error){$('font-status').textContent=error.message;}
    finally{$('use-system-font').disabled=false;}
  });
  $('load-font-file').addEventListener('click',()=>$('font-file').click());
  $('font-file').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>40*1024*1024)throw new Error('40MB 이하의 글꼴을 선택해주세요.');await applyLocalFont(await file.arrayBuffer());}
    catch(error){$('font-status').textContent=error.message;}
    finally{e.target.value='';}
  });
  let titleBefore;
  $('project-title').addEventListener('focus',()=>titleBefore=snapshot());
  $('project-title').addEventListener('input',e=>{state.title=e.target.value;document.title=(state.title||'판도')+' — PANDO';scheduleSave()});
  $('project-title').addEventListener('change',()=>record(titleBefore));
  $('project-title').addEventListener('keydown',e=>{if(e.key==='Enter')e.target.blur()});
  $('undo-button').addEventListener('click',()=>history('undo'));$('redo-button').addEventListener('click',()=>history('redo'));
  $('reset-button').addEventListener('click',()=>{
    if(IS_MICRO&&dockTab==='seats'){
      if(!Elections.seatTotals(state,DATA).national.assigned){toast('배정된 의석이 없습니다.');return;}
      askConfirm('의석 배정을 비울까요?','지역구와 비례대표 의석 배정을 지웁니다. 선거구·권역 구성과 세부 색칠은 유지하며 실행 취소할 수 있습니다.','의석 배정 비우기',()=>mutate(()=>{state.elections.partyAssignments={};state.elections.proportionalSeats={national:{},unregionalized:{},regions:{}};}));return;
    }
    if(!Object.keys(state.assignments).length){toast('아직 색칠한 지역이 없어요.');return;}
    askConfirm('지도를 비울까요?','모든 지역의 색상이 지워집니다. 실행 취소로 되돌릴 수 있어요.','지도 비우기',()=>mutate(()=>state.assignments={}));
  });
  $('confirm-cancel').addEventListener('click',()=>$('confirm-dialog').close());
  $('confirm-ok').addEventListener('click',()=>{$('confirm-dialog').close();confirmAction?.();confirmAction=null;});
  $('confirm-dialog').addEventListener('close',()=>confirmAction=null);
  $('dismiss-tip').addEventListener('click',()=>$('map-instruction').hidden=true);
  $('zoom-in').addEventListener('click',()=>zoom(1.35));$('zoom-out').addEventListener('click',()=>zoom(1/1.35));
  $('zoom-reset').addEventListener('click',resetView);$('fit-button').addEventListener('click',resetView);
  $('region-toggle').addEventListener('click',()=>toggleRegionPanel($('region-panel').hidden));$('close-region-panel').addEventListener('click',()=>toggleRegionPanel(false));
  $('map-view').addEventListener('change',e=>mutate(()=>state.settings.mapView=e.target.value));
  $('world-center').addEventListener('change',e=>{
    endGesture();persist();const url=new URL(location.href);url.searchParams.set('center',e.target.value);location.href=url.href;
  });
  $('macro-map').addEventListener('change',e=>{
    endGesture();persist();location.href=window.PandoMapCatalog.selectURL(location.href,e.target.value);
  });
  $('game-campaign').addEventListener('click',()=>{
    if(!IS_GAME||!DATA.campaign)return;
    endGesture();mutate(()=>{state=window.PandoCampaign.apply(state,DATA);});
    toast(`${DATA.campaign.date} 시작 국가와 게임 RGB를 적용했습니다. 실행 취소로 되돌릴 수 있습니다.`);
  });
  $('place-language').addEventListener('change',e=>mutate(()=>state.settings.placeLanguage=e.target.value));
  $('native-names').addEventListener('change',e=>mutate(()=>state.settings.nativeNames=e.target.checked));
  $('region-search').addEventListener('input',()=>{resultLimit=120;renderResults();});
  $('province-filter').addEventListener('change',()=>{resultLimit=120;$('paint-province').disabled=!$('country-filter').value&&!$('province-filter').value;renderResults()});
  $('country-filter').addEventListener('change',()=>{
    resultLimit=120;$('province-filter').value='';
    renderSearchFilters();renderResults();
  });
  $('paint-province').addEventListener('click',()=>{
    const country=$('country-filter').value,province=$('province-filter').value;if(!country&&!province)return;
    const regions=RegionSearch.members(country,province);if(!regions.length)return;
    const countries=new Set(regions.map(r=>r.country));
    mutate(()=>{
      if([...countries].some(c=>!visibleCountries.has(c)))state.settings.mapView=countries.size>1&&(DATA.id==='world'||IS_GAME)?'world':regions[0].country;
      if(activeOutline())Model.setOutlineMembers(state,activeOutlineId,regions.map(r=>r.id));
      else regions.forEach(r=>state.assignments[r.id]=activeGroup().id);
    });toast(activeOutline()?`${regions.length}개 지역을 ‘${activeOutline().name}’ 영역에 포함했습니다.`:`${regions.length}개 지역을 ‘${activeGroup().name}’ 색상으로 채웠어요.`);
  });
  $('add-outline').addEventListener('click',()=>{
    mutate(()=>{state.outlineLayers??=[];const entry={id:'o'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:'초국가 영역 '+(state.outlineLayers.length+1),color:'#a87830',width:2.5,visible:true,regionIds:[]};state.outlineLayers.push(entry);activeOutlineId=entry.id;});setTool('brush');
    beginCaptionRename(activeOutlineId,'outline');
  });
  $('outline-edit-done').addEventListener('click',()=>{activeOutlineId=null;renderAll();});
  $('save-button').addEventListener('click',()=>{persist();download(new Blob([JSON.stringify(projectFile(),null,2)],{type:'application/json;charset=utf-8'}),filename('json'));toast('편집 가능한 프로젝트를 저장했어요.');});
  $('import-button').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try {
      if(file.size>5*1024*1024)throw new Error('5MB 이하의 판도 JSON 파일을 선택해주세요.');
      const imported=validateProject(JSON.parse(await file.text()));
      const apply=()=>{mutate(()=>{state=imported;if(IS_MICRO)dockTab=state.elections.stage;});resetView();toast('프로젝트를 불러왔어요.');};
      if(Object.keys(state.assignments).length)askConfirm('프로젝트를 불러올까요?','현재 지도를 파일의 내용으로 바꿉니다. 실행 취소로 현재 작업을 복원할 수 있어요.','불러오기',apply);else apply();
    } catch(error){toast(error instanceof SyntaxError?'JSON 파일을 읽지 못했어요. 판도에서 저장한 파일인지 확인해주세요.':error.message);}
    finally{e.target.value='';}
  });
  $('export-button').addEventListener('click',()=>{const open=$('export-menu').hidden;$('export-menu').hidden=!open;$('export-button').setAttribute('aria-expanded',open);});
  document.querySelectorAll('[data-export]').forEach(b=>b.addEventListener('click',()=>exportImage(b.dataset.export)));
  document.addEventListener('click',e=>{if(!e.target.closest('.export-wrap')){$('export-menu').hidden=true;$('export-button').setAttribute('aria-expanded','false');}});
  $('help-button').addEventListener('click',()=>$('info-dialog').showModal());
  const sidebarMedia=window.matchMedia('(max-width:720px), (pointer:coarse) and (max-width:1100px)');
  function syncSidebar(){
    const open=$('editor-sidebar').classList.contains('open');
    $('editor-sidebar').inert=sidebarMedia.matches&&!open;
    $('sidebar-backdrop').hidden=!(sidebarMedia.matches&&open);
    document.body.classList.toggle('mobile-settings-open',sidebarMedia.matches&&open);
  }
  function toggleSidebar(open){$('editor-sidebar').classList.toggle('open',open);for(const id of ['sidebar-toggle','mobile-map-settings'])$(id).setAttribute('aria-expanded',String(open));syncSidebar();}
  $('sidebar-toggle').addEventListener('click',()=>toggleSidebar(!$('editor-sidebar').classList.contains('open')));
  $('mobile-map-settings').addEventListener('click',()=>toggleSidebar(!$('editor-sidebar').classList.contains('open')));
  $('sidebar-close').addEventListener('click',()=>toggleSidebar(false));
  $('sidebar-backdrop').addEventListener('click',()=>toggleSidebar(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sidebarMedia.matches)toggleSidebar(false);});
  sidebarMedia.addEventListener('change',syncSidebar);syncSidebar();
  document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}}));

  const viewport=$('map-viewport');
  const touchInput=window.PandoMapTouch.create({
    getView:()=>view,setView:next=>{view=next;applyView();hideTooltip();},
    point:p=>basePoint(p.x,p.y),regionAt:p=>regionAt(p.x,p.y),getTool:()=>tool,hideTooltip,
    startStroke:(id,erase)=>{gesture={mode:'paint',before:snapshot(),erase,visited:new Set([id])};paintRegion(id,erase);},
    moveStroke:id=>{if(gesture?.mode==='paint'&&!gesture.visited.has(id)){gesture.visited.add(id);paintRegion(id,gesture.erase);}},
    endStroke:endGesture,
    cancelStroke:()=>{if(gesture?.mode!=='paint')return;state=JSON.parse(gesture.before);gesture=null;renderAll();},pick:pickRegion
  });
  viewport.addEventListener('pointerdown',e=>{if(touchInput.down(e)){viewport.setPointerCapture(e.pointerId);e.preventDefault();}});
  viewport.addEventListener('pointermove',e=>{if(touchInput.move(e))e.preventDefault();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,e=>{if(touchInput.up(e)&&viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);});
  const insetHost=$('world-insets');
  function toggleInsetExport(target){const tile=target.closest('[data-inset-hide-tile]'),panel=target.closest('[data-inset-hide-panel]');if(!tile&&!panel)return false;mutate(()=>state.settings.worldInsetHidden=Insets.toggleHidden(state.settings.worldInsetHidden,tile?'tile':'panel',tile?.dataset.insetHideTile||panel.dataset.insetHidePanel),false);renderSettings();return true;}
  insetHost.addEventListener('click',e=>{if(toggleInsetExport(e.target)){e.preventDefault();e.stopPropagation();}});
  insetHost.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.closest('[data-inset-hide-tile],[data-inset-hide-panel]')){e.preventDefault();e.stopPropagation();toggleInsetExport(e.target);}});
  const insetRegionAt=(x,y)=>{const node=document.elementFromPoint(x,y)?.closest('[data-inset-region]');return node&&insetHost.contains(node)?node.dataset.insetRegion:null;};
  function finishInsetGesture(){if(!insetGesture)return;const before=insetGesture.before;insetGesture=null;record(before);renderColors();renderResults();if(activeOutline())renderOutlines();}
  insetHost.addEventListener('contextmenu',e=>e.preventDefault());
  insetHost.addEventListener('pointerdown',e=>{const id=e.target.closest('[data-inset-region]')?.dataset.insetRegion;if(!id||![0,2].includes(e.button)||tool==='pan'||spacePan)return;if(tool==='picker'&&e.button!==2){pickRegion(id);return;}insetGesture={before:snapshot(),pointerId:e.pointerId,erase:tool==='eraser'||e.button===2,visited:new Set([id])};insetHost.setPointerCapture(e.pointerId);paintRegion(id,insetGesture.erase);e.preventDefault();});
  insetHost.addEventListener('pointermove',e=>{if(!insetGesture||e.pointerId!==insetGesture.pointerId)return;const id=insetRegionAt(e.clientX,e.clientY);if(id&&!insetGesture.visited.has(id)){insetGesture.visited.add(id);paintRegion(id,insetGesture.erase);}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])insetHost.addEventListener(event,e=>{if(insetGesture?.pointerId===e.pointerId)finishInsetGesture();});
  insetHost.addEventListener('keydown',e=>{const id=e.target.closest('[data-inset-region]')?.dataset.insetRegion;if(!id||!['Enter',' '].includes(e.key))return;e.preventDefault();e.stopPropagation();if(tool==='picker')pickRegion(id);else if(tool!=='pan')mutate(()=>paintRegion(id,tool==='eraser'),false);});
  viewport.addEventListener('contextmenu',e=>e.preventDefault());
  viewport.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();zoom(Math.exp(-Math.sign(e.deltaY)*.16),e.clientX,e.clientY)},{passive:false});
  viewport.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch')return;
    if(e.button!==0&&e.button!==1&&e.button!==2)return;
    if(gesture)return;
    const id=regionAt(e.clientX,e.clientY),p=basePoint(e.clientX,e.clientY);
    hideTooltip();
    if(tool==='pan'||spacePan||e.button===1||!id){
      gesture={mode:'pan',pointerId:e.pointerId,start:p,x:view.x,y:view.y};viewport.classList.add('dragging');
    }else if(tool==='picker'&&e.button!==2){pickRegion(id);return;}
    else{gesture={mode:'paint',pointerId:e.pointerId,before:snapshot(),erase:tool==='eraser'||e.button===2,visited:new Set([id])};paintRegion(id,gesture.erase);}
    viewport.setPointerCapture(e.pointerId);e.preventDefault();
  });
  viewport.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch')return;
    if(gesture){
      if(e.pointerId!==gesture.pointerId)return;
      if(gesture.mode==='pan'){const p=basePoint(e.clientX,e.clientY);view.x=gesture.x+p.x-gesture.start.x;view.y=gesture.y+p.y-gesture.start.y;applyView();}
      else {const id=regionAt(e.clientX,e.clientY);if(id&&!gesture.visited.has(id)){gesture.visited.add(id);paintRegion(id,gesture.erase);}}
    }else showTooltip(regionAt(e.clientX,e.clientY),e);
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,e=>{if(gesture?.pointerId===e.pointerId)endGesture()});
  viewport.addEventListener('pointerleave',hideTooltip);
  $('regions').addEventListener('keydown',e=>{
    const id=e.target.dataset.region;if(!id || !['Enter',' '].includes(e.key))return;
    e.preventDefault();e.stopPropagation();
    if(tool==='picker')pickRegion(id);else if(tool!=='pan')mutate(()=>paintRegion(id,tool==='eraser'),false);
  });
  document.addEventListener('keydown',e=>{
    if(!$('quick-color-picker').hidden){if(e.key==='Escape'){e.preventDefault();closeQuickColor(true);}return;}
    if(e.target.closest('input,textarea,select,[contenteditable="true"]') || document.querySelector('dialog[open]'))return;
    const key=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&key==='z'){e.preventDefault();history(e.shiftKey?'redo':'undo');return;}
    if((e.ctrlKey||e.metaKey)&&key==='y'){e.preventDefault();history('redo');return;}
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(key===' '){e.preventDefault();spacePan=true;viewport.classList.add('space-pan');return;}
    const tools={b:'brush',e:'eraser',h:'pan',i:'picker'};if(tools[key])setTool(tools[key]);
    if(key==='+'||key==='=')zoom(1.35);if(key==='-')zoom(1/1.35);if(key==='0')resetView();
    if(key==='escape'){toggleRegionPanel(false);toggleSidebar(false);$('export-menu').hidden=true;}
    if(key==='/'){e.preventDefault();toggleRegionPanel(true);}
  });
  document.addEventListener('keyup',e=>{if(e.key===' '){spacePan=false;viewport.classList.remove('space-pan');}});
  window.addEventListener('blur',()=>{touchInput.cancel();spacePan=false;viewport.classList.remove('space-pan');endGesture();});
  window.addEventListener('pagehide',()=>{touchInput.cancel();endGesture();finishInsetGesture();persist()});
  new ResizeObserver(()=>{queueLabelView();queueScene();}).observe($('map-svg'));
  const credit=document.querySelector('.data-credit');credit.replaceChildren();
  const summary=document.createElement('strong');summary.textContent=`${MODE_NAME} | ${AREA_NAME} / ${DATA.regions.length.toLocaleString()}개 지역`;credit.appendChild(summary);
  const description=document.createElement('p');description.textContent=DATA.description||'';credit.appendChild(description);
  if(DATA.id!=='world'&&!IS_GAME)for(const country of DATA.countries){const line=document.createElement('p');line.textContent=`${country.name} ${country.count}개 | ${country.unit} / ${country.credit} | ${country.license} | ${country.year}`;credit.appendChild(line);}
  if(IS_GAME){const line=document.createElement('p');line.textContent='Paradox Interactive | 설치된 게임에서 경계와 지명을 추출한 개인용 지도입니다.';credit.appendChild(line);}
  for(const [url,text] of [[DATA.creditFile?'./'+DATA.creditFile:DATA.id==='world'?'./data/LICENSE-WORLD.md':'./data/LICENSE-EAST-ASIA.md','경계 출처·가공 내역 ↗'],['./data/localization/README.md','지명 출처·독음 가공 내역 ↗']]){
    const line=document.createElement('p'),link=document.createElement('a');link.href=url;link.textContent=text;link.target='_blank';link.rel='noopener noreferrer';line.appendChild(link);credit.appendChild(line);
  }
  for(const [href,label] of [['./THIRD_PARTY_NOTICES.md','전체 출처와 라이선스 ↗'],['./data/odbl/README.md','OpenStreetMap 파생 데이터 다운로드 ↗']]){
    const paragraph=document.createElement('p'),link=document.createElement('a');link.href=href;link.textContent=label;link.target='_blank';link.rel='noopener noreferrer';paragraph.appendChild(link);credit.appendChild(paragraph);
  }
  document.querySelector('.header-description').textContent=MODE_NAME+' | '+AREA_NAME;
  $('map-svg').setAttribute('aria-label',AREA_NAME+' '+(IS_GAME?DATA.unit:'행정구역')+' 색칠 지도');
  if(DATA.id==='world'||IS_GAME)$('macro-map-description').textContent=IS_GAME?`${DATA.game.toUpperCase()} | ${DATA.regions.length.toLocaleString()}개 ${DATA.unit} | ${DATA.gameVersion}`:'세계의 1차 행정구역을 색칠합니다.';
  if(IS_GAME){
    $('game-campaign').hidden=false;$('game-campaign').textContent=DATA.campaign.date+' 국가 색칠';
    $('game-campaign').title='시작 국가별 범례와 게임 지도 색상을 적용합니다. 실행 취소할 수 있습니다.';
    $('province-filter').setAttribute('aria-label','지역 선택');
    $('paint-province').lastChild.textContent=' 선택한 국가/지역 전체 색칠';
    $('map-detail-note').hidden=false;$('map-detail-note').textContent='게임 원본 지도입니다. 확대하면 세부 경계가 표시됩니다. 각 지도 작업은 따로 자동 저장됩니다.';
    document.querySelector('.canvas-note').textContent=`${DATA.gameVersion} | ${DATA.unit} 단위 | Paradox Interactive`;
    document.querySelector('.sidebar-footer strong').textContent=`나만의 ${DATA.game.toUpperCase()} 판도.`;
    $('show-borders').closest('label').querySelector('span').textContent=DATA.game==='eu4'?'지역(area) 경계':DATA.game==='vic2'?'주(state) 경계':'전략지역 경계';
  }
  if(IS_MICRO){
    $('legend-tabs').hidden=false;$('legend-title').hidden=true;
    $('country-filter').hidden=true;$('province-filter').firstElementChild.textContent='모든 시군구';
    document.querySelector('.canvas-note').textContent='읍·면·행정동 2024.04.01 | 제22대 총선 선거구 2024.04.10';
    document.querySelector('.sidebar-footer strong').textContent='나만의 미시 판도.';
    for(const tab of ['legend','election','regions','seats']){
      $(tab+'-tab').addEventListener('click',()=>setDockTab(tab));
      $(tab+'-tab').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=['legend','election','regions','seats'],index=tabs.indexOf(dockTab),next=e.key==='Home'?'legend':e.key==='End'?'seats':tabs[(index+(e.key==='ArrowRight'?1:3))%4];setDockTab(next);$(next+'-tab').focus();}});
    }
    microUI=window.PandoMicroUI.create({data:DATA,getProject:()=>state,mutate,toast,openColor:openQuickColor,locateRegion:id=>{locateRegion(id);$('map-shell').scrollIntoView({block:'start',behavior:'smooth'});},locateDistrict:locateElection,changeStage:setDockTab,confirm:askConfirm,activateBrush:()=>setTool('brush')});
  }
  const desktopCanvasNote=document.querySelector('.canvas-note').textContent;
  const syncTouchHint=()=>{document.querySelector('.canvas-note').textContent=sidebarMedia.matches?'두 손가락: 확대·축소와 이동 | 이동 도구: 한 손가락 이동':desktopCanvasNote;};
  sidebarMedia.addEventListener('change',syncTouchHint);syncTouchHint();
  buildMap();renderAll();applyView();
  if(!storageAvailable)$('save-status').querySelector('span').textContent='자동 저장 불가 | 작업 저장으로 파일을 보관하세요';
})();
