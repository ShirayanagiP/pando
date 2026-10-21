/* One geometry file and one autosave slot per selected map. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PandoMapCatalog=factory();
})(globalThis,()=>{
  'use strict';
  const maps=[{id:'world',name:'세계 | 1차 행정구역'}];
  function resolve(search=''){
    const params=new URLSearchParams(search),requested=params.get('mode');
    const mode=['macro','continental','micro'].includes(requested)?requested:'catalog';
    const map=mode==='macro'&&maps.some(m=>m.id===params.get('map'))?params.get('map'):'world';
    const center=params.get('center')==='asia'?'asia':'europe';
    const pack=mode==='macro'&&['eu4','hoi4','vic2'].includes(params.get('pack'))?params.get('pack'):null;
    if(pack)return {mode,map:'pack:'+pack,center,source:null,privatePack:pack};
    return {mode,map,center,source:mode==='catalog'?null:mode==='micro'?'micro-map-data.js':mode==='continental'?'map-data.js':map==='world'?(center==='asia'?'world-asia-map-data.js':'world-map-data.js'):`${map}-map-data.js`};
  }
  function storageKey(data){
    return data.game?`pando-project-macro-${data.game}-v1`:data.mode==='micro'?'pando-project-micro-korea-v1':data.id==='world'?'pando-project-macro-v5':'pando-project-continental-v3';
  }
  function selectURL(href,map){
    const url=new URL(href);url.searchParams.set('mode','macro');
    url.searchParams.delete('pack');
    if(/^pack:(eu4|hoi4|vic2)$/.test(map)){url.searchParams.set('pack',map.slice(5));url.searchParams.delete('map');return url.href;}
    if(map==='world')url.searchParams.delete('map');else url.searchParams.set('map',map);
    return url.href;
  }
  return {maps,resolve,storageKey,selectURL};
});
