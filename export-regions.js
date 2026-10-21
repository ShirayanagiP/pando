/* Export windows are independent of editor pan, paint and administrative ownership. */
((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else root.PandoExportRegions=factory();})(globalThis,()=>{
  'use strict';
  const presets=[
    {id:'europe',name:'유럽',bounds:[-26,34,65,73]},
    {id:'asia',name:'아시아',bounds:[25,-12,190,80]},
    {id:'africa',name:'아프리카',bounds:[-26,-38,55,39]},
    {id:'north-america',name:'북아메리카',bounds:[-171,4,-48,84]},
    {id:'south-america',name:'남아메리카',bounds:[-85,-58,-32,15]},
    {id:'oceania',name:'오세아니아',bounds:[110,-52,212,12]},
    {id:'eurasia',name:'유라시아',bounds:[-26,-12,190,82]},
    {id:'americas',name:'남북아메리카',bounds:[-171,-58,-32,84]},
    {id:'mediterranean',name:'유럽 + 근동 + 북아프리카',bounds:[-26,15,66,73]},
    {id:'north-atlantic',name:'북아메리카 + 유럽',bounds:[-171,4,65,84]},
    {id:'inner-east-asia',name:'우랄 동쪽 러시아 + 중앙아시아 + 동아시아',bounds:[48,18,190,80]},
    {id:'east-asia-siberia',name:'동아시아 + 시베리아 + 극동 러시아',bounds:[75,18,190,80]},
    {id:'oceania-southeast-asia',name:'오세아니아 + 동남아시아',bounds:[90,-52,212,30]}
  ];
  const available=data=>data?.id==='world'||data?.mode==='macro'||!!data?.game;
  const normalize=value=>presets.some(p=>p.id===value)?value:'current';
  const preset=(project,data)=>available(data)?presets.find(p=>p.id===normalize(project?.settings?.exportRegion)):undefined;
  function projectPoint(lon,lat,data){
    if(!data.game)return [(lon-124.3)*Math.cos(Math.PI/5)*147+30,(38.85-lat)*147+25];
    // The games use their own non-geodetic raster. Latitude guide lines follow
    // their common world-map layout; no province geometry is resampled.
    const guides=[[85,0],[75,.045],[60,.15],[50,.26],[40,.36],[30,.44],[20,.51],[0,.65],[-20,.78],[-35,.92],[-58,1]];
    let fraction=lat>=85?0:1;for(let i=1;i<guides.length;i++)if(lat<=guides[i-1][0]&&lat>=guides[i][0]){const [a,y]=guides[i-1],[b,z]=guides[i];fraction=y+(a-lat)/(a-b)*(z-y);break;}
    return [(lon+180)/360*data.width,fraction*data.height];
  }
  function frame(project,data){const p=preset(project,data);if(!p)return null;const [west,south,east,north]=p.bounds,a=projectPoint(west,north,data),b=projectPoint(east,south,data);return [a[0],a[1],b[0]-a[0],b[1]-a[1]].map(v=>Math.round(v*100)/100);}
  const intersects=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
  function prepare(project,data){
    const f=frame(project,data);if(!f)return project;
    const period=data.wrap?.period||data.width,windows=[-period,0,period].map(x=>[f[0]-x,f[1],f[0]+f[2]-x,f[1]+f[3]]),ids=new Set(data.regions.filter(r=>windows.some(w=>intersects(r.bounds,w))).map(r=>r.id));
    const assignments=Object.fromEntries(Object.entries(project.assignments).filter(([id])=>ids.has(id))),byId=new Map(project.groups.map(g=>[g.id,g])),used=new Set();
    for(const groupId of Object.values(assignments)){let group=byId.get(groupId);while(group&&!used.has(group.id)){used.add(group.id);group=byId.get(group.parentId);}}
    return {...project,...(project.outlineLayers?{outlineLayers:project.outlineLayers.filter(layer=>layer.regionIds.some(id=>ids.has(id)))}:{}),groups:project.groups.filter(g=>used.has(g.id)),visibleCountries:[...new Set(data.regions.filter(r=>ids.has(r.id)).map(r=>r.country))],visibleRegionIds:[...ids],assignments,settings:{...project.settings,mapView:'world'}};
  }
  return {presets,available,normalize,preset,frame,prepare,projectPoint};
});
