/* Search-only navigation. Drawing units, country IDs and saved paint stay intact. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./place-names.js'));
  else root.PandoRegionSearch=factory(root.PandoPlaceNames);
})(globalThis,Names=>{
  'use strict';
  // Relationships come from the bundled country metadata. Limit the families
  // to overseas/associated areas; a disputed or leased area is not a dependency.
  const FAMILIES={
    'United Kingdom':'gbr','Netherlands':'nld','United States of America':'usa',
    'France':'fra','Denmark':'dnk','Australia':'aus','New Zealand':'nzl','Finland':'fin','Norway':'nor'
  };
  // ISO codes of the subjects already present in the map, including the source
  // map's two Crimean units. This index never adds or reassigns map geometry.
  const FEDERAL_DISTRICTS=[
    ['central','중앙 연방관구','Central Federal District','Центральный федеральный округ','BEL BRY IVA KLU KOS KRS LIP MOS MOW ORL RYA SMO TAM TVE TUL VLA VOR YAR'],
    ['northwestern','북서 연방관구','Northwestern Federal District','Северо-Западный федеральный округ','ARK VLG KGD KR KO LEN MUR NEN NGR PSK SPE'],
    ['southern','남부 연방관구','Southern Federal District','Южный федеральный округ','AD AST VGG KL KDA ROS UA-43 UA-40'],
    ['north-caucasian','북캅카스 연방관구','North Caucasian Federal District','Северо-Кавказский федеральный округ','DA IN KB KC SE CE STA'],
    ['volga','볼가 연방관구','Volga Federal District','Приволжский федеральный округ','BA ME MO TA UD CU PER KIR NIZ ORE PNZ SAM SAR ULY'],
    ['ural','우랄 연방관구','Ural Federal District','Уральский федеральный округ','KGN SVE TYU KHM CHE YAN'],
    ['siberia','시베리아 연방관구','Siberian Federal District','Сибирский федеральный округ','AL ALT TY KK KYA IRK KEM NVS OMS TOM'],
    ['far-east','극동 연방관구','Far Eastern Federal District','Дальневосточный федеральный округ','BU SA ZAB KAM PRI KHA AMU MAG SAK YEV CHU']
  ].map(([id,ko,en,native,codes])=>({id,ko,en,native,codes:codes.split(' ').map(code=>code.startsWith('UA-')?code:'RU-'+code)}));
  const districtByCode=new Map(FEDERAL_DISTRICTS.flatMap(d=>d.codes.map(code=>[code,d.id])));
  const localized=(entry,settings)=>entry[settings?.nativeNames?'native':settings?.placeLanguage==='en'?'en':'ko'];
  const collator=settings=>new Intl.Collator(settings?.placeLanguage==='en'?'en':'ko',{numeric:true,sensitivity:'base'});
  const sortSettings=settings=>({...settings,nativeNames:false});

  function create(data){
    const countryById=new Map((data.countries||[]).map(c=>[c.id,c]));
    const countryMembers=new Map(),scopeMembers=new Map(),scopeCountries=new Map(),parentCache=new Map();
    for(const r of data.regions){if(!countryMembers.has(r.country))countryMembers.set(r.country,[]);countryMembers.get(r.country).push(r);}
    for(const c of data.countries||[]){
      const family=data.id==='world'?FAMILIES[c.sovereignName]:null;
      const root=family&&countryById.has(family)?family:c.id;
      if(!scopeMembers.has(root)){scopeMembers.set(root,[]);scopeCountries.set(root,[]);}
      scopeCountries.get(root).push(c.id);scopeMembers.get(root).push(...(countryMembers.get(c.id)||[]));
    }
    const countryName=(id,settings)=>Names.countryName(id,settings)||countryById.get(id)?.name||id;
    function countryOptions(settings={}){
      const compare=collator(settings).compare,sorting=sortSettings(settings);
      return [...scopeMembers].map(([id,members])=>({id,name:countryName(id,settings),count:members.length}))
        .sort((a,b)=>compare(countryName(a.id,sorting),countryName(b.id,sorting))||compare(a.id,b.id));
    }
    function parents(country=''){
      if(parentCache.has(country))return parentCache.get(country);
      const members=country?scopeMembers.get(country)||[]:data.regions;
      let entries=[];
      if(data.mode==='micro'||data.id!=='world'){
        if(country||data.mode==='micro'||data.game){
          const provinces=new Map((data.provinces||[]).map(p=>[p.id,p])),groups=new Map();
          const allowed=data.game?new Set(members.map(r=>r.provinceId)):null;
          for(const r of data.game?data.regions:members){if(allowed&&!allowed.has(r.provinceId))continue;if(!groups.has(r.provinceId))groups.set(r.provinceId,[]);groups.get(r.provinceId).push(r);}
          entries=[...groups].map(([id,regions])=>({id:'province:'+id,kind:'province',source:provinces.get(id)||regions[0],members:regions}));
        }
      }else if(country==='russia'){
        entries=FEDERAL_DISTRICTS.map(d=>({id:'district:'+d.id,kind:'district',source:d,members:members.filter(r=>(r.federalDistrict||districtByCode.get(r.iso3166_2))===d.id)})).filter(e=>e.members.length);
      }else if((scopeCountries.get(country)||[]).length>1){
        entries=scopeCountries.get(country).map(id=>({id:'country:'+id,kind:'country',source:countryById.get(id),members:countryMembers.get(id)||[]}));
      }else if(country){
        entries=members.map(r=>({id:'region:'+r.id,kind:'region',source:r,members:[r]}));
      }
      const result=new Map(entries.map(e=>[e.id,e]));parentCache.set(country,result);return result;
    }
    function parentName(entry,settings){
      if(entry.kind==='country')return countryName(entry.source.id,settings);
      if(entry.kind==='district')return localized(entry.source,settings);
      return entry.kind==='region'?Names.regionName(entry.source,settings):Names.provinceName(entry.source,settings);
    }
    function parentOptions(country='',settings={}){
      const compare=collator(settings).compare,sorting=sortSettings(settings);
      return [...parents(country).values()].sort((a,b)=>compare(parentName(a,sorting),parentName(b,sorting))||compare(a.id,b.id))
        .map(e=>({id:e.id,name:parentName(e,settings),count:e.members.length,kind:e.kind}));
    }
    function members(country='',parent=''){
      if(parent)return parents(country).get(parent)?.members||[];
      return country?scopeMembers.get(country)||[]:data.regions;
    }
    let sortedKey=null,sortedRegions=[];
    function results({country='',parent='',query='',settings={}}={}){
      const key=JSON.stringify([settings.placeLanguage,settings.nativeNames]);
      if(key!==sortedKey){
        const compare=collator(settings).compare,sorting=sortSettings(settings);
        sortedRegions=[...data.regions].sort((a,b)=>compare(Names.regionName(a,sorting),Names.regionName(b,sorting))||compare(Names.regionLocation(a,sorting),Names.regionLocation(b,sorting))||compare(a.id,b.id));
        sortedKey=key;
      }
      const selected=new Set(members(country,parent).map(r=>r.id));
      return sortedRegions.filter(r=>selected.has(r.id)&&Names.matchesRegion(r,query));
    }
    return {countryOptions,parentOptions,members,results};
  }
  return {create};
});
