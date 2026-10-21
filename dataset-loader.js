/* Keep each level's geometry out of the other level's initial load. Also works file://. */
(async()=>{
  'use strict';
  const selection=window.PandoMapCatalog.resolve(location.search),chosen=selection.mode;
  document.documentElement.dataset.mode=chosen;
  if(chosen==='catalog'){
    document.getElementById('map-picker').hidden=false;
    document.getElementById('dataset-loading').hidden=true;
    document.title='지도 선택 — 판도';
    document.querySelector('.header-description').textContent='개인 지도 작업실';
    return;
  }
  for(const link of document.querySelectorAll('.mode-navigation [data-mode]')){
    if(link.dataset.mode===chosen)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  if(chosen==='macro'){
    document.getElementById('macro-map-navigation').hidden=false;
    const select=document.getElementById('macro-map');
    for(const map of window.PandoMapCatalog.maps){const option=document.createElement('option');option.value=map.id;option.textContent=map.name;select.appendChild(option);}
    try{for(const pack of await window.PandoPrivateMaps.createStore().list()){const option=document.createElement('option');option.value='pack:'+pack.game;option.textContent=pack.name+' | 개인용 지도 팩';select.appendChild(option);}}catch{/* Built-in maps work even when local storage is unavailable. */}
    select.value=selection.map;
  }
  const loading=document.getElementById('dataset-loading'),layout=document.querySelector('.app-layout');
  const script=src=>new Promise((resolve,reject)=>{
    const element=document.createElement('script');element.src=src;element.onload=resolve;element.onerror=()=>reject(new Error(src));document.head.appendChild(element);
  });
  try{
    if(selection.privatePack){
      const pack=await window.PandoPrivateMaps.createStore().get(selection.privatePack);
      if(!pack)throw new Error('이 브라우저에 해당 지도 팩이 없습니다. 지도 목록에서 개인용 지도 팩을 먼저 불러와주세요.');
      window.PANDO_MAP=pack.map;
      window.PANDO_MAP.creditFile='PRIVATE_MAPS.md';
    }
    await script('./legend-tree.js');
    await script('./legend-order.js');
    await script('./export-regions.js');
    await script('./world-insets.js');
    await script('./export-files.js');
    await Promise.all([...(selection.privatePack?[]:[script('./'+selection.source)]),...['place-names-data.js','vendor/opentype.min.js','font-data.js','cjk-font-data.js','color-tools.js','territory-geometry.js','map-renderer.js',...(chosen==='macro'?['world-font-data.js']:[]),...(chosen==='micro'?['micro-elections.js']:[])].map(src=>script('./'+src))]);
    for(const src of ['webfonts.js','label-layout.js','place-names.js','region-search.js','map-captions.js','project-model.js','project-svg.js',...(window.PANDO_MAP.game?['game-campaign.js']:[]),...(chosen==='micro'?['micro-workflow.js']:[]),'app.js']){
      await script('./'+src);
      if(src==='place-names.js'&&window.PANDO_MAP.placeNames)window.PandoPlaceNames.register(window.PANDO_MAP.placeNames);
    }
    loading.hidden=true;layout.removeAttribute('aria-busy');
  }catch(error){
    loading.textContent=selection.privatePack?error.message:'지도 파일을 열지 못했습니다. 이 폴더의 파일이 모두 있는지 확인한 뒤 다시 열어주세요.';
    const back=document.createElement('a');back.href='./index.html';back.textContent='지도 목록으로 돌아가기';back.className='dataset-back';loading.appendChild(back);
    layout.hidden=true;loading.setAttribute('role','alert');
    if(!selection.privatePack)console.error('PANDO map load:',error);
  }
})();
