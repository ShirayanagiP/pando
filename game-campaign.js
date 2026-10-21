/* Reversible campaign coloring; never modifies source geometry or game files. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./place-names.js'));
  else root.PandoCampaign=factory(root.PandoPlaceNames);
})(globalThis,Names=>{
  'use strict';
  const isTributary=type=>/tributary|tribute|조공/i.test(type||'');
  function roots(data){
    const countries=new Set(data.countries.filter(c=>c.mapColor&&c.tag!=='NONE').map(c=>c.id)),parents=new Map();
    for(const relation of data.campaign?.dependencies||[]){
      if(!isTributary(relation.type)&&relation.subject!==relation.overlord&&countries.has(relation.subject)&&countries.has(relation.overlord))parents.set(relation.subject,relation.overlord);
    }
    const result=new Map();
    for(const id of countries){
      const seen=new Set();let current=id;
      while(parents.has(current)&&!seen.has(current)){seen.add(current);current=parents.get(current);}
      result.set(id,seen.has(current)?id:current);
    }
    return result;
  }
  function apply(project,data){
    if(!data.game||!data.campaign)throw new Error('캠페인 데이터가 없는 지도입니다.');
    const collator=new Intl.Collator(project.settings?.placeLanguage==='en'?'en':'ko',{numeric:true});
    const countries=data.countries.filter(c=>c.mapColor&&c.tag!=='NONE')
      .sort((a,b)=>collator.compare(Names.countryName(a.id,project.settings)||a.name,Names.countryName(b.id,project.settings)||b.name)||a.id.localeCompare(b.id));
    const groups=countries.map(c=>({id:'campaign-'+c.tag,name:Names.countryName(c.id,project.settings)||c.name,displayName:'',color:c.mapColor,parentId:null,provinceId:null}));
    const groupByCountry=new Map(countries.map((c,i)=>[c.id,groups[i].id]));
    const leaders=roots(data);
    countries.forEach((c,i)=>{const leader=leaders.get(c.id);if(leader!==c.id)groups[i].parentId=groupByCountry.get(leader)||null;});
    if(!groups.length)throw new Error('시작 국가 색상을 찾지 못했습니다.');
    const assignments={};
    for(const region of data.regions){const group=groupByCountry.get(region.country);if(group)assignments[region.id]=group;}
    return {...project,groups,assignments,activeGroup:groups[0].id,
      settings:{...project.settings,mapView:'world',labelMode:'none',labels:false}};
  }
  return {apply,roots,isTributary};
});
