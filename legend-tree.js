/* Three-level legend hierarchy, shared by editing, geometry and captions. */
((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else root.PandoLegendTree=factory();})(globalThis,()=>{
  'use strict';
  function index(groups){return new Map(groups.map(g=>[g.id,g]));}
  function ancestors(group,groups){
    const byId=groups instanceof Map?groups:index(groups),path=[],seen=new Set();
    while(group&&!seen.has(group.id)){seen.add(group.id);path.unshift(group);group=byId.get(group.parentId);}
    return path;
  }
  const depth=(group,groups)=>Math.max(0,ancestors(group,groups).length-1);
  function descendants(id,groups){
    const children=new Map();for(const g of groups){if(!children.has(g.parentId))children.set(g.parentId,[]);children.get(g.parentId).push(g);}
    const result=[],seen=new Set();function visit(key){if(seen.has(key))return;seen.add(key);result.push(key);for(const g of children.get(key)||[])visit(g.id);}visit(id);return result;
  }
  function ordered(groups){const byId=index(groups);return groups.filter(g=>!g.parentId).flatMap(g=>descendants(g.id,groups).map(id=>byId.get(id)));}
  function canParent(id,parentId,groups){
    const byId=index(groups),group=byId.get(id);if(!group)return false;
    const members=new Set(descendants(id,groups));if(parentId&&(!byId.has(parentId)||members.has(parentId)))return false;
    const oldDepth=depth(group,byId),height=Math.max(...groups.filter(g=>members.has(g.id)).map(g=>depth(g,byId)-oldDepth));
    return (parentId?depth(byId.get(parentId),byId)+1:0)+height<3;
  }
  function validate(groups){
    const byId=index(groups);
    for(const g of groups){const seen=new Set();let current=g,count=0;
      while(current){if(seen.has(current.id)||++count>3)throw new Error('범례는 순환 없이 최대 3단계로 묶어주세요.');seen.add(current.id);if(current.parentId!==null&&current.parentId!==undefined&&!byId.has(current.parentId))throw new Error('범례의 상위 범례를 찾을 수 없습니다.');current=byId.get(current.parentId);}
    }
  }
  return {index,ancestors,depth,descendants,ordered,canParent,validate};
});
