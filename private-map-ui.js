/* Catalog controls for local-only map packs; no network uploads. */
(()=>{
  'use strict';
  const Packs=window.PandoPrivateMaps,store=Packs.createStore();
  const input=document.getElementById('private-map-file'),button=document.getElementById('private-map-import'),list=document.getElementById('private-map-list'),status=document.getElementById('private-map-status');
  let busy=false,refreshVersion=0;
  const node=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
  const message=(text,error=false)=>{status.textContent=text;status.setAttribute('role',error?'alert':'status');};
  async function refresh(){
    const version=++refreshVersion,packs=await store.list();
    if(version!==refreshVersion)return;
    list.replaceChildren();
    for(const pack of packs){
      const card=node('article',null,'map-choice private-map-card');
      card.append(node('span','이 브라우저에 저장됨','map-choice-kind'),node('h3',pack.name),node('p',`${pack.regions.toLocaleString()}개 지역 | ${pack.gameVersion}`));
      const actions=node('div',null,'private-map-actions'),open=node('a','지도 열기 ↗','button secondary');open.href=Packs.openURL(location.href,pack.game);actions.append(open);
      const download=node('button','지도 팩 저장','text-button');download.type='button';download.addEventListener('click',async()=>{try{const blob=await store.blob(pack.game);if(!blob)throw new Error('지도 팩을 다시 불러와주세요.');const a=node('a');a.href=URL.createObjectURL(blob);a.download=pack.game+'.pandomap.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(error){message(error.message,true);}});
      const remove=node('button','삭제','text-button'),cancel=node('button','취소','text-button');remove.type=cancel.type='button';cancel.hidden=true;let confirming=false;
      remove.addEventListener('click',async()=>{if(!confirming){confirming=true;remove.textContent='지도 팩 삭제 확인';cancel.hidden=false;message('이 기기의 지도 팩만 삭제합니다. 색칠한 작업의 자동 저장은 유지됩니다.');return;}try{await store.remove(pack.game);await refresh();message(pack.name+' 지도 팩을 이 브라우저에서 삭제했습니다.');}catch(error){message(error.message,true);}});
      cancel.addEventListener('click',()=>{confirming=false;remove.textContent='삭제';cancel.hidden=true;message('삭제를 취소했습니다.');});
      actions.append(download,remove,cancel);card.append(actions);list.append(card);
    }
    if(!list.children.length)list.append(node('p','저장된 개인용 지도 팩이 없습니다.','private-map-empty'));
  }
  button.addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file=input.files[0];if(!file||busy)return;busy=true;button.disabled=true;message('지도 팩을 확인하고 이 브라우저에 저장하는 중…');
    try{
      // Give the loading status a frame before parsing a large JSON on mobile.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const pack=await store.put(file);await refresh();message(`${pack.name} 지도 팩을 저장했습니다. ‘지도 열기’로 시작하세요. 같은 게임의 지도 팩은 새 파일로 교체됩니다.`);
    }catch(error){message(error.message,true);}finally{busy=false;button.disabled=false;input.value='';}
  });
  window.addEventListener('pageshow',()=>{if(!busy)refresh().catch(error=>message(error.message,true));});
  refresh().catch(error=>message(error.message,true));
})();
