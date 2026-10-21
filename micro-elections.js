/* Editable districts, optional electoral regions, and party seat assignments. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PandoElections=factory();
})(globalThis,()=>{
  'use strict';
  const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
  const copyDistrict=d=>({id:d.id,name:d.name,sido:d.sido||'',memberIds:[...d.memberIds],regionId:null});
  const initialParties=()=>[{id:'party1',name:'정당 1',color:'#779bb3'},{id:'party2',name:'정당 2',color:'#d99774'},{id:'party3',name:'정당 3',color:'#5d9785'},{id:'independent',name:'무소속',color:'#a59d8b'}];
  const sortParties=parties=>parties.sort((a,b)=>Number(a.id==='independent')-Number(b.id==='independent'));
  const emptyProportional=()=>({national:{},unregionalized:{},regions:{}});
  const strokeWidth=value=>typeof value==='number'&&Number.isFinite(value)?Math.round(Math.max(0,Math.min(8,value))*100)/100:.65;
  function createConfiguration(data){return {districts:data.elections.districts.map(copyDistrict),regions:[],parties:initialParties(),partyAssignments:{},mapPaint:{},proportionalRegional:false,proportionalSeats:emptyProportional(),borderColor:'#586f60',borderWidth:.65,activeDistrictId:null,activePartyId:'party1',activeShade:0,detailPainting:false,stage:'legend',showBorders:true,showRegionBorders:false};}
  const configuration=(project,data)=>project.elections||(project.elections=createConfiguration(data));
  const districtFor=(data,id,project=null)=>(project?configuration(project,data):data.elections)?.districts.find(d=>d.id===id);
  function membership(project,data){const result=new Map();for(const d of configuration(project,data).districts)for(const id of d.memberIds)result.set(id,d.id);return result;}
  const unassigned=(project,data)=>{const own=membership(project,data);return data.regions.filter(r=>!own.has(r.id)).map(r=>r.id);};
  const eligible=project=>project.elections.districts.filter(d=>d.memberIds.length);
  function uniqueId(prefix,items){let index=1;while(items.some(x=>x.id===prefix+index))index++;return prefix+index;}
  function validateConfiguration(input,data){
    if(input===undefined)return createConfiguration(data);
    if(!input||!Array.isArray(input.districts)||!Array.isArray(input.regions)||!Array.isArray(input.parties)||!input.parties.length)throw new Error('선거구·권역·정당 구성이 올바르지 않습니다.');
    const regions=new Set(data.regions.map(r=>r.id)),seen=new Set(),districtIds=new Set(),regionIds=new Set(),partyIds=new Set();
    const entry=(value,ids,label)=>{
      if(!value||!validId(value.id)||ids.has(value.id)||typeof value.name!=='string'||!value.name.trim()||value.name.length>60)throw new Error(label+' 이름 또는 ID가 올바르지 않습니다.');
      ids.add(value.id);return {id:value.id,name:value.name.trim()};
    };
    const broad=input.regions.map(r=>entry(r,regionIds,'권역'));
    const districts=input.districts.map(d=>{
      const result=entry(d,districtIds,'선거구');
      if(typeof d.sido!=='string'||d.sido.length>60||!Array.isArray(d.memberIds)||d.regionId!==null&&d.regionId!==undefined&&!regionIds.has(d.regionId))throw new Error('선거구의 시도·권역 정보가 올바르지 않습니다.');
      for(const id of d.memberIds){if(!regions.has(id)||seen.has(id))throw new Error('존재하지 않거나 중복 배정된 읍면동입니다.');seen.add(id);}
      return {...result,sido:d.sido,memberIds:[...d.memberIds],regionId:d.regionId||null};
    });
    const parties=sortParties(input.parties.map(p=>{const result=entry(p,partyIds,'정당');if(!/^#[0-9a-f]{6}$/i.test(p.color))throw new Error('정당 색상이 올바르지 않습니다.');return {...result,color:p.color.toLowerCase()};}));
    if(!input.partyAssignments||typeof input.partyAssignments!=='object'||Array.isArray(input.partyAssignments))throw new Error('의석 배정 정보가 올바르지 않습니다.');
    const partyAssignments={};
    for(const [id,party]of Object.entries(input.partyAssignments)){
      if(!districtIds.has(id)||!partyIds.has(party)||!districts.find(d=>d.id===id).memberIds.length)throw new Error('존재하지 않는 선거구·정당 또는 빈 선거구에 의석이 배정되었습니다.');partyAssignments[id]=party;
    }
    const mapPaint={};
    if(input.mapPaint!==undefined&&(!input.mapPaint||typeof input.mapPaint!=='object'||Array.isArray(input.mapPaint)))throw new Error('지도 색칠 정보가 올바르지 않습니다.');
    for(const [id,paint] of Object.entries(input.mapPaint||{})){
      if(!regions.has(id)||!paint||!partyIds.has(paint.partyId)||!Number.isInteger(paint.shade)||Math.abs(paint.shade)>3)throw new Error('지도 색칠의 지역·정당·명도가 올바르지 않습니다.');
      mapPaint[id]={partyId:paint.partyId,shade:paint.shade};
    }
    const proportionalSeats=emptyProportional(),source=input.proportionalSeats;
    const seatRecord=value=>{
      if(value===undefined)return {};
      if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('비례대표 의석 정보가 올바르지 않습니다.');
      const result={};for(const [id,count] of Object.entries(value)){if(!partyIds.has(id)||!Number.isSafeInteger(count)||count<0)throw new Error('비례대표 의석은 0 이상의 정수로 입력해주세요.');if(count)result[id]=count;}return result;
    };
    if(source!==undefined){
      if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('비례대표 의석 정보가 올바르지 않습니다.');
      proportionalSeats.national=seatRecord(source.national);proportionalSeats.unregionalized=seatRecord(source.unregionalized);
      if(source.regions!==undefined&&(!source.regions||typeof source.regions!=='object'||Array.isArray(source.regions)))throw new Error('비례대표 권역 정보가 올바르지 않습니다.');
      for(const [id,counts] of Object.entries(source.regions||{})){if(!regionIds.has(id))throw new Error('존재하지 않는 비례대표 권역입니다.');proportionalSeats.regions[id]=seatRecord(counts);}
    }
    if(input.borderColor!==undefined&&!/^#[0-9a-f]{6}$/i.test(input.borderColor))throw new Error('선거구 경계 색상이 올바르지 않습니다.');
    return {districts,regions:broad,parties,partyAssignments,mapPaint,proportionalSeats,proportionalRegional:input.proportionalRegional===true,borderColor:input.borderColor?.toLowerCase()||'#586f60',borderWidth:strokeWidth(input.borderWidth),activeDistrictId:districtIds.has(input.activeDistrictId)?input.activeDistrictId:null,
      activePartyId:partyIds.has(input.activePartyId)?input.activePartyId:parties[0].id,activeShade:Number.isInteger(input.activeShade)&&Math.abs(input.activeShade)<=3?input.activeShade:0,
      detailPainting:input.detailPainting===true,stage:['legend','election','regions','seats'].includes(input.stage)?input.stage:'legend',showBorders:input.showBorders!==false,showRegionBorders:input.showRegionBorders===true};
  }
  function moveMembers(project,data,ids,targetId){
    const c=configuration(project,data),target=targetId?districtFor(data,targetId,project):null;
    if(targetId&&!target)throw new Error('옮길 선거구를 선택해주세요.');
    const known=new Set(data.regions.map(r=>r.id)),selected=new Set(ids);if([...selected].some(id=>!known.has(id)))throw new Error('이 지도에 없는 읍면동입니다.');
    const previousSeat=target?c.partyAssignments[target.id]:null;
    for(const d of c.districts){d.memberIds=d.memberIds.filter(id=>!selected.has(id));if(!d.memberIds.length)delete c.partyAssignments[d.id];}
    if(target){target.memberIds.push(...selected);if(previousSeat&&target.memberIds.length)c.partyAssignments[target.id]=previousSeat;}
  }
  function addDistrict(project,data,name,sido='',ids=[]){
    const c=configuration(project,data);if(!name.trim()||name.length>60)throw new Error('선거구 이름을 입력해주세요.');
    const d={id:uniqueId('custom-district-',c.districts),name:name.trim(),sido,memberIds:[],regionId:null};c.districts.push(d);moveMembers(project,data,ids,d.id);c.activeDistrictId=d.id;return d;
  }
  function renameDistrict(project,data,id,name){if(!name.trim()||name.length>60)throw new Error('선거구 이름은 1~60자로 입력해주세요.');const d=districtFor(data,id,project);if(d)d.name=name.trim();}
  function deleteDistrict(project,data,id){const c=configuration(project,data);c.districts=c.districts.filter(d=>d.id!==id);delete c.partyAssignments[id];if(c.activeDistrictId===id)c.activeDistrictId=null;}
  function resetDistricts(project,data){const c=configuration(project,data);c.districts=data.elections.districts.map(copyDistrict);c.partyAssignments={};c.activeDistrictId=null;}
  function addRegion(project,data,name){
    const c=configuration(project,data);if(!name.trim()||name.length>60)throw new Error('권역 이름을 입력해주세요.');
    const r={id:uniqueId('electoral-region-',c.regions),name:name.trim()};c.regions.push(r);return r;
  }
  function deleteRegion(project,data,id){
    const c=configuration(project,data);c.regions=c.regions.filter(r=>r.id!==id);for(const d of c.districts)if(d.regionId===id)d.regionId=null;
    const seats=c.proportionalSeats?.regions[id];if(seats){for(const [party,count] of Object.entries(seats))c.proportionalSeats.unregionalized[party]=(c.proportionalSeats.unregionalized[party]||0)+count;delete c.proportionalSeats.regions[id];}
  }
  function assignRegion(project,data,ids,regionId){
    const c=configuration(project,data);if(regionId&&!c.regions.some(r=>r.id===regionId))throw new Error('권역을 선택해주세요.');
    const selected=new Set(ids);for(const d of c.districts)if(selected.has(d.id))d.regionId=regionId||null;
  }
  function assignParty(project,data,id,partyId){
    const c=configuration(project,data),d=districtFor(data,id,project);if(!d?.memberIds.length)return false;
    if(!partyId){delete c.partyAssignments[id];return true;}
    if(!c.parties.some(p=>p.id===partyId))return false;c.partyAssignments[id]=partyId;return true;
  }
  function addParty(project,data,name,color='#779bb3'){
    const c=configuration(project,data);
    if(typeof name!=='string'||!name.trim()||name.length>60||!/^#[0-9a-f]{6}$/i.test(color))throw new Error('정당 이름과 색상을 확인해주세요.');
    const party={id:uniqueId('custom-party-',c.parties),name:name.trim(),color:color.toLowerCase()};
    c.parties.push(party);sortParties(c.parties);c.activePartyId=party.id;c.activeShade=0;return party;
  }
  function deleteParty(project,data,id){
    const c=configuration(project,data);if(id==='independent')throw new Error('무소속은 고정 항목입니다.');
    if(!c.parties.some(p=>p.id===id))return false;if(c.parties.length===1)throw new Error('정당 항목은 하나 이상 있어야 합니다.');
    c.parties=c.parties.filter(p=>p.id!==id);sortParties(c.parties);
    for(const [district,party] of Object.entries(c.partyAssignments))if(party===id)delete c.partyAssignments[district];
    for(const [region,paint] of Object.entries(c.mapPaint||{}))if(paint.partyId===id)delete c.mapPaint[region];
    if(c.proportionalSeats)for(const counts of [c.proportionalSeats.national,c.proportionalSeats.unregionalized,...Object.values(c.proportionalSeats.regions)])delete counts[id];
    if(c.activePartyId===id){c.activePartyId=c.parties[0].id;c.activeShade=0;}return true;
  }
  function setProportionalSeats(project,data,scope,regionId,partyId,value){
    const c=configuration(project,data),count=typeof value==='string'&&value.trim()===''?0:Number(value);
    if(!c.parties.some(p=>p.id===partyId)||!Number.isSafeInteger(count)||count<0)throw new Error('비례대표 의석은 0 이상의 정수로 입력해주세요.');
    if(!['national','unregionalized','region'].includes(scope)||scope==='region'&&!c.regions.some(r=>r.id===regionId))throw new Error('비례대표 권역을 확인해주세요.');
    c.proportionalSeats??=emptyProportional();const counts=scope==='region'?(c.proportionalSeats.regions[regionId]??={}):c.proportionalSeats[scope];
    if(count)counts[partyId]=count;else delete counts[partyId];
  }
  function shades(color){
    const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    return [-3,-2,-1,0,1,2,3].map(shade=>({shade,name:shade<0?'옅게 '+Math.abs(shade):shade>0?'진하게 '+shade:'기본색',
      color:'#'+channels.map(n=>Math.round(shade<0?n+(255-n)*Math.abs(shade)*.24:n*(1-shade*.2)).toString(16).padStart(2,'0')).join('')}));
  }
  function paintMap(project,data,ids,partyId,shade=0){
    const c=configuration(project,data),known=new Set(data.regions.map(r=>r.id));
    if(ids.some(id=>!known.has(id))||partyId&&!c.parties.some(p=>p.id===partyId)||!Number.isInteger(shade)||Math.abs(shade)>3)throw new Error('색칠할 지역·정당·명도를 확인해주세요.');
    c.mapPaint??={};let changed=false;
    for(const id of ids){const old=c.mapPaint[id];if(partyId){if(old?.partyId!==partyId||old?.shade!==shade){c.mapPaint[id]={partyId,shade};changed=true;}}else if(old){delete c.mapPaint[id];changed=true;}}
    return changed;
  }
  function paintSeatMap(project,data,id,erase=false){
    const c=configuration(project,data),party=erase?null:c.activePartyId;
    if(c.detailPainting)return {changed:paintMap(project,data,[id],party,c.activeShade||0),ids:[id]};
    const district=c.districts.find(d=>d.memberIds.includes(id));if(!district)return {changed:false,ids:[]};
    const previous=c.partyAssignments[district.id]||null,changed=paintMap(project,data,district.memberIds,party,c.activeShade||0);
    assignParty(project,data,district.id,party);return {changed:changed||previous!==party,ids:district.memberIds};
  }
  function seatTotals(project,data){
    const c=configuration(project,data),count=list=>{
      const byParty=Object.fromEntries(c.parties.map(p=>[p.id,0]));let assigned=0;
      for(const d of list){const party=c.partyAssignments[d.id];if(party&&Object.hasOwn(byParty,party)){byParty[party]++;assigned++;}}
      return {total:list.length,assigned,unassigned:list.length-assigned,byParty};
    },valid=eligible(project);
    const pr=c.proportionalSeats||emptyProportional(),proportional=record=>{const byParty=Object.fromEntries(c.parties.map(p=>[p.id,record?.[p.id]||0])),total=Object.values(byParty).reduce((a,b)=>a+b,0);return {total,assigned:total,unassigned:0,byParty};};
    const combine=counts=>{const byParty=Object.fromEntries(c.parties.map(p=>[p.id,counts.reduce((sum,c)=>sum+(c.byParty[p.id]||0),0)]));return {total:counts.reduce((sum,c)=>sum+c.total,0),assigned:counts.reduce((sum,c)=>sum+c.assigned,0),unassigned:counts.reduce((sum,c)=>sum+c.unassigned,0),byParty};};
    const regions=c.regions.map(r=>{const district=count(valid.filter(d=>d.regionId===r.id)),extra=proportional(pr.regions[r.id]);return {...r,...district,proportional:extra};});
    const unregionalized={...count(valid.filter(d=>!d.regionId)),proportional:proportional(pr.unregionalized)},districtNational=count(valid),proportionalNational=c.proportionalRegional?combine([...regions.map(r=>r.proportional),unregionalized.proportional]):proportional(pr.national);
    return {national:combine([districtNational,proportionalNational]),districtNational,proportionalNational,regions,unregionalized};
  }
  function displayProject(project,data,stage){
    if(stage==='legend')return project;
    const c=configuration(project,data),assignments={},parties=c.parties.map(p=>({...p,parentId:null,provinceId:null,displayName:''})),groups=[...parties];
    if(stage==='seats')for(const d of c.districts){const party=c.partyAssignments[d.id];if(party)for(const id of d.memberIds)assignments[id]=party;}
    if(stage==='seats'){
      const used=new Map();
      for(const [id,paint] of Object.entries(c.mapPaint||{})){
        const party=c.parties.find(p=>p.id===paint.partyId);if(!party)continue;
        const key=paint.shade?`paint-${party.id}-${paint.shade+3}`:party.id;assignments[id]=key;
        if(paint.shade&&!used.has(key)){const tone=shades(party.color).find(s=>s.shade===paint.shade);used.set(key,{id:key,name:party.name+' | '+tone.name,color:tone.color,parentId:null,provinceId:null,displayName:''});}
      }
      groups.push(...used.values());
    }
    const totals=seatTotals(project,data).national;
    return {...project,groups:stage==='seats'?groups:[],legendGroups:stage==='seats'?parties:[],assignments,forceRegionBorders:true,
      settings:{...project.settings,labels:false,labelMode:'none',borders:false,regionBorders:c.showRegionBorders===true,familyBorders:false,legend:stage==='seats'&&project.settings.legend},
      electionStage:stage,seatCounts:stage==='seats'?totals.byParty:null,seatSummary:stage==='seats'?totals:null};
  }
  function borderChunks(project,data,options={}){
    const c=configuration(project,data);if(!c.showBorders||!strokeWidth(c.borderWidth)||!data.rendering)return [];
    const owners=membership(project,data),map=data.regions.map(r=>owners.get(r.id)),chunks=[];let lines=[];
    const level=options.level??2,views=options.views;
    for(const chain of data.rendering.chains){
      if(views&&!views.some(b=>chain.bounds[0]<=b[2]&&chain.bounds[2]>=b[0]&&chain.bounds[1]<=b[3]&&chain.bounds[3]>=b[1]))continue;
      const own=chain.owners.map(i=>map[i]);if(!own.some(Boolean)||own.length>1&&own.every(id=>id===own[0]))continue;
      lines.push(chain.paths[level]);if(lines.length>=192){chunks.push({id:String(chunks.length),d:lines.join('')});lines=[];}
    }
    if(lines.length)chunks.push({id:String(chunks.length),d:lines.join('')});return chunks;
  }
  return {createConfiguration,configuration,validateConfiguration,districtFor,membership,unassigned,eligible,moveMembers,addDistrict,renameDistrict,deleteDistrict,resetDistricts,addRegion,deleteRegion,assignRegion,assignParty,addParty,deleteParty,setProportionalSeats,shades,paintMap,paintSeatMap,seatTotals,displayProject,borderChunks,strokeWidth};
});
