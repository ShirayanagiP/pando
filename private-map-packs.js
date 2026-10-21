/* Personal geometry stays in this browser. Imported files are JSON, never scripts. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PandoPrivateMaps=factory();
})(globalThis,()=>{
  'use strict';
  const games={eu4:'Europa Universalis IV',hoi4:'Hearts of Iron IV',vic2:'Victoria II'};
  const MAX_BYTES=100*1024*1024,DB_NAME='pando-private-maps',STORE='packs';
  const fail=()=>{throw new Error('올바른 판도 개인용 지도 팩이 아닙니다. 작업 JSON과 지도 팩은 서로 다른 파일입니다.');};
  const text=(v,max=500)=>typeof v==='string'&&v.length>0&&v.length<=max;
  const number=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e9;
  const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(number);
  const id=v=>text(v,160)&&/^[A-Za-z0-9_-]+$/.test(v)&&!['__proto__','prototype','constructor'].includes(v);
  const path=v=>typeof v==='string'&&v.length<=8*1024*1024&&(!v||/^M[MLZmlz0-9.,\s+\-eE]*$/.test(v));
  function validate(pack){
    if(!pack||pack.format!=='pando-map-pack'||pack.version!==1)fail();
    const d=pack.map;
    if(!d||!Object.hasOwn(games,d.game)||d.id!==d.game||d.mode!=='macro'||!text(d.version,180)||!text(d.name)||!text(d.unit,40)||!text(d.gameVersion))fail();
    if(!number(d.width)||!number(d.height)||d.width<=0||d.height<=0||!vector(d.viewBox,4)||d.viewBox[2]<=0||d.viewBox[3]<=0||!number(d.areaKm2PerUnit)||d.areaKm2PerUnit<=0)fail();
    const lists={countries:3000,regions:20000,provinces:20000,views:3001,mainlands:10000};
    for(const [key,limit]of Object.entries(lists))if(!Array.isArray(d[key])||d[key].length>limit)fail();
    if(!d.regions.length||!d.countries.length||!d.views.length)fail();
    const ids=key=>{const found=new Set();for(const item of d[key]){if(!item||!id(item.id)||found.has(item.id)||!text(item.name))fail();found.add(item.id);}return found;};
    const countries=ids('countries'),regions=ids('regions'),provinces=ids('provinces'),views=ids('views');
    const shape=s=>{if(!s||!path(s.d)||!vector(s.bounds,4)||s.bounds[0]>s.bounds[2]||s.bounds[1]>s.bounds[3])fail();if(s.center&&!vector(s.center,2))fail();if(s.lod&&(!Array.isArray(s.lod)||s.lod.length>4||!s.lod.every(path)))fail();};
    for(const c of d.countries)if(c.mapColor&&!/^#[0-9a-f]{6}$/i.test(c.mapColor)||c.tag&&!id(c.tag))fail();
    for(const r of d.regions){shape(r);if(!countries.has(r.country)||!provinces.has(r.provinceId)||!vector(r.center,2)||!number(r.area)||r.area<=0)fail();}
    for(const p of d.provinces){shape(p);if(p.country!==null&&!countries.has(p.country))fail();if(p.countries&&(!Array.isArray(p.countries)||p.countries.some(c=>!countries.has(c))))fail();if(p.countryParts){if(!Array.isArray(p.countryParts)||p.countryParts.length>countries.size)fail();for(const part of p.countryParts){shape(part);if(!countries.has(part.country))fail();}}}
    for(const v of d.views)if(!vector(v.frame,4)||v.frame[2]<=0||v.frame[3]<=0||!Array.isArray(v.countries)||v.countries.some(c=>!countries.has(c)))fail();
    if(!views.has(d.defaultView))fail();
    for(const land of d.mainlands)shape(land);
    if(!Array.isArray(d.markers)||d.markers.length)fail();
    const t=d.topology,n=d.regions.length,index=(v,max)=>Number.isInteger(v)&&v>=0&&v<max;
    if(!t||!Array.isArray(t.points)||t.points.length>2000000||!Array.isArray(t.edges)||t.edges.length>3000000||t.regionEdges?.length!==n||t.neighbors?.length!==n)fail();
    for(const point of t.points)if(!vector(point,2))fail();
    for(const e of t.edges)if(!Array.isArray(e)||![3,4].includes(e.length)||!e.slice(0,2).every(i=>index(i,t.points.length))||!e.slice(2).every(i=>index(i,n)))fail();
    for(const [i,list]of t.regionEdges.entries())if(!Array.isArray(list)||list.length>t.edges.length||list.some(e=>!index(e,t.edges.length)||!t.edges[e].slice(2).includes(i)))fail();
    for(const [i,list]of t.neighbors.entries())if(!Array.isArray(list)||list.length>n||list.some(j=>!index(j,n)||i===j))fail();
    if(!d.rendering||!Array.isArray(d.rendering.chains)||d.rendering.chains.length>300000||!vector(d.rendering.thresholds,2)||!['province','country'].includes(d.rendering.internalTier))fail();
    for(const c of d.rendering.chains)if(!c||!vector(c.bounds,4)||!Array.isArray(c.paths)||c.paths.length!==3||!c.paths.every(path)||!Array.isArray(c.owners)||!c.owners.length||c.owners.length>2||!c.owners.every(i=>index(i,n)))fail();
    if(!d.campaign||!text(d.campaign.date,30)||!Array.isArray(d.campaign.dependencies)||d.campaign.dependencies.length>countries.size*2)fail();
    // Some game history includes landless countries; campaign coloring already skips them.
    for(const r of d.campaign.dependencies)if(!id(r.subject)||!id(r.overlord)||!text(r.type,100))fail();
    // No URLs, markup, or arbitrary SVG elements are accepted as geometry. Keep text
    // escaping in the renderer, and block prototype keys before any dictionary merge.
    let count=0;
    function inspect(value,depth=0){
      if(++count>20000000||depth>18)fail();
      if(value===null||typeof value==='boolean')return;
      if(typeof value==='number'){if(!number(value))fail();return;}
      if(typeof value==='string'){if(value.length>8*1024*1024)fail();return;}
      if(!value||typeof value!=='object')fail();
      if(Array.isArray(value)){for(const item of value)inspect(item,depth+1);return;}
      for(const [key,item]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key)||key.length>200)fail();inspect(item,depth+1);}
    }
    inspect(d);
    if(d.placeNames)for(const key of ['countries','regions','provinces','contexts']){
      const dict=d.placeNames[key];if(!dict||typeof dict!=='object'||Array.isArray(dict))fail();
      for(const [key,value]of Object.entries(dict)){
        if(!id(key)||!value||typeof value!=='object'||Array.isArray(value))fail();
        for(const field of ['ko','en','native'])if(value[field]!==undefined&&!text(value[field],1000))fail();
        if(value.aliases&&(!Array.isArray(value.aliases)||value.aliases.length>100||value.aliases.some(a=>!text(a,1000))))fail();
      }
    }
    return pack;
  }
  function parse(source){
    if(typeof source!=='string'||source.length>MAX_BYTES)fail();
    let value;try{value=JSON.parse(source);}catch{fail();}
    return validate(value);
  }
  function metadata(pack,bytes){const d=pack.map;return {game:d.game,name:d.name,boundaryVersion:d.version,gameVersion:d.gameVersion,regions:d.regions.length,bytes,importedAt:Date.now()};}
  function openURL(href,game){if(!Object.hasOwn(games,game))fail();const url=new URL(href);url.search='';url.searchParams.set('mode','macro');url.searchParams.set('pack',game);return url.href;}
  function createStore(indexedDB=globalThis.indexedDB){
    function open(){return new Promise((resolve,reject)=>{
      if(!indexedDB){reject(new Error('이 브라우저에서는 개인용 지도 저장소를 사용할 수 없습니다. 일반 브라우저 창에서 열어주세요.'));return;}
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'game'});};
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
      request.onerror=()=>reject(new Error('개인용 지도 저장소를 열지 못했습니다. 브라우저의 사이트 저장 권한을 확인해주세요.'));
      request.onblocked=()=>reject(new Error('다른 판도 탭을 닫고 다시 시도해주세요.'));
    });}
    async function transaction(mode,operation){const db=await open();return new Promise((resolve,reject)=>{
      let result;const tx=db.transaction(STORE,mode);const request=operation(tx.objectStore(STORE));
      request.onsuccess=()=>{result=request.result;};
      tx.oncomplete=()=>{db.close();resolve(result);};
      tx.onabort=tx.onerror=()=>{db.close();reject(new Error(tx.error?.name==='QuotaExceededError'?'기기 저장 공간이 부족합니다. 불필요한 지도 팩을 삭제한 뒤 다시 시도해주세요.':'지도 팩을 저장하거나 읽지 못했습니다. 기존 작업과 지도 팩은 유지됩니다.'));};
    });}
    return {
      async list(){return (await transaction('readonly',s=>s.getAll())).map(({blob,...meta})=>meta).sort((a,b)=>a.name.localeCompare(b.name,'en'));},
      async put(file){if(!file||file.size>MAX_BYTES)throw new Error('100MB 이하의 개인용 지도 팩 JSON 파일을 선택해주세요.');const pack=parse(await file.text());const meta=metadata(pack,file.size);await transaction('readwrite',s=>s.put({...meta,blob:new Blob([JSON.stringify(pack)],{type:'application/json'})}));return meta;},
      async get(game){const record=await transaction('readonly',s=>s.get(game));if(!record)return null;return parse(await record.blob.text());},
      async blob(game){return (await transaction('readonly',s=>s.get(game)))?.blob||null;},
      async remove(game){await transaction('readwrite',s=>s.delete(game));}
    };
  }
  return {games,MAX_BYTES,validate,parse,metadata,openURL,createStore};
});
