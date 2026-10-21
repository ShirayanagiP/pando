/* Offline display names and a language-independent search index. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./place-names-data.js'));
  else root.PandoPlaceNames=factory(root.PANDO_PLACE_NAMES);
})(globalThis,data=>{
  'use strict';
  const countries={
    south:{ko:'남한',en:'South Korea',native:'대한민국',aliases:['한국','Republic of Korea','ROK']},
    north:{ko:'북한',en:'North Korea',native:'조선민주주의인민공화국',aliases:['DPRK','조선']},
    china:{ko:'중국',en:'China',native:'中国',aliases:['중화인민공화국','中國','PRC']},
    mongolia:{ko:'몽골',en:'Mongolia',native:'Монгол',aliases:['몽고']},
    japan:{ko:'일본',en:'Japan',native:'日本',aliases:['Nippon','Nihon']},
    taiwan:{ko:'대만',en:'Taiwan',native:'臺灣',aliases:['타이완','台湾']},
    russia:{ko:'러시아',en:'Russia',native:'Россия',aliases:['Russian Federation','로씨야']}
  };
  for(const [id,entry] of Object.entries(data.countries||{}))countries[id]={...countries[id],...entry,aliases:[...new Set([...(countries[id]?.aliases||[]),...(entry.aliases||[])])]};
  let searchCache=new WeakMap();
  function register(entries){
    for(const type of ['regions','provinces','contexts','countries'])Object.assign(data[type]||(data[type]={}),entries[type]||{});
    Object.assign(countries,entries.countries||{});searchCache=new WeakMap();
  }
  const placeSettings=(settings={})=>({placeLanguage:settings?.placeLanguage==='en'?'en':'ko',nativeNames:settings?.nativeNames===true});
  const selected=(entry,settings,fallback='')=>entry?.[settings?.nativeNames?'native':settings?.placeLanguage==='en'?'en':'ko']||fallback;
  const regionName=(region,settings)=>selected(data.regions[region.id]||{ko:region.nameKo||region.name,en:region.englishName,native:region.nativeName||region.name},settings,region.name||'');
  const provinceName=(province,settings)=>selected(data.provinces[province.provinceId||province.id]||{ko:province.provinceKo||province.nameKo||province.province||province.name,en:province.provinceEnglishName||province.englishName,native:province.province||province.name},settings,province.province||province.name||'');
  const countryName=(country,settings)=>selected(countries[country],settings,'');
  const contextName=(native,settings)=>selected(data.contexts[native],settings,native||'');
  const regionLocation=(region,settings)=>[...new Set([countryName(region.country,settings),provinceName(region,settings),contextName(region.subprefecture,settings)].filter(Boolean))].join(' ');
  function viewName(view,settings){
    if(!view)return '';
    if(view.scopedName)return settings?.nativeNames?(view.nameNative||view.name):(settings?.placeLanguage==='en'?(view.nameEn||view.name):view.name);
    if(countries[view.id])return countryName(view.id,settings);
    if(view.id==='eastasia')return settings?.placeLanguage==='en'?'East Asia':'동아시아 전체';
    if(view.id==='peninsula')return settings?.placeLanguage==='en'?'Korean Peninsula':'한반도';
    return settings?.placeLanguage==='en'?(view.nameEn||view.name||''):(view.name||'');
  }
  function normalizeSearch(value){
    return String(value).normalize('NFKC').toLowerCase()
      .replace(/[\u00c0-\u024f]/g,c=>c.normalize('NFD').replace(/\p{M}/gu,''))
      .replace(/[량룡녕린락리라류]/g,c=>({'량':'양','룡':'용','녕':'영','린':'인','락':'낙','리':'이','라':'나','류':'유'}[c]))
      .replace(/[^\p{L}\p{N}]/gu,'');
  }
  const terms=entry=>entry?[entry.ko,entry.en,entry.native,...(entry.aliases||[])]:[];
  function searchText(region){
    if(!searchCache.has(region))searchCache.set(region,normalizeSearch([
      ...terms(data.regions[region.id]),...terms(data.provinces[region.provinceId]),
      ...terms(data.contexts[region.subprefecture]),...terms(countries[region.country]),
      region.name,region.province,region.subprefecture||'',region.nativeName||'',region.nameKo||'',
      region.sourceName||'',region.englishName||'',...(region.aliases||[])
    ].filter(Boolean).join(' ')));
    return searchCache.get(region);
  }
  function matchesRegion(region,query='',province='',country=''){
    if(province&&region.provinceId!==province||country&&region.country!==country)return false;
    const tokens=String(query).trim().split(/\s+/).map(normalizeSearch).filter(Boolean);
    return !tokens.length||tokens.every(token=>searchText(region).includes(token));
  }
  return {placeSettings,regionName,provinceName,countryName,contextName,regionLocation,viewName,matchesRegion,register};
});
