/* Reorder siblings without changing paint or the three-level hierarchy. */
((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory(require('./legend-tree.js'));else root.PandoLegendOrder=factory(root.PandoLegendTree);})(globalThis,Tree=>{
  'use strict';
  const options=value=>({key:['name','regions','children'].includes(value?.key)?value.key:'name',direction:value?.direction==='desc'?'desc':'asc',scope:value?.scope==='siblings'?'siblings':'all'});
  const offset=value=>({x:typeof value?.x==='number'&&Number.isFinite(value.x)?Math.round(Math.max(-4000,Math.min(4000,value.x))):0,y:typeof value?.y==='number'&&Number.isFinite(value.y)?Math.round(Math.max(-4000,Math.min(4000,value.y))):0});
  function move(groups,id,step){
    const group=groups.find(g=>g.id===id);if(!group)return groups;
    const siblings=groups.filter(g=>(g.parentId||null)===(group.parentId||null)),i=siblings.findIndex(g=>g.id===id),j=i+step;
    if(j<0||j>=siblings.length)return groups;
    [siblings[i],siblings[j]]=[siblings[j],siblings[i]];let next=0;
    return Tree.ordered(groups.map(g=>(g.parentId||null)===(group.parentId||null)?siblings[next++]:g));
  }
  // Dragging changes tree membership/order, never SVG coordinates.
  function place(groups,id,{parentId=null,beforeId=null,afterId=null}={}){
    parentId=parentId||null;
    if(!Tree.canParent(id,parentId,groups))return groups;
    const members=new Set(Tree.descendants(id,groups)),branch=Tree.ordered(groups).filter(g=>members.has(g.id)),rest=Tree.ordered(groups).filter(g=>!members.has(g.id));
    if(beforeId===id||afterId===id)return groups;
    const anchorId=beforeId||afterId,anchor=rest.find(g=>g.id===anchorId);
    if(anchorId&&(!anchor||(anchor.parentId||null)!==parentId))return groups;
    let at=rest.length;
    if(beforeId)at=rest.findIndex(g=>g.id===beforeId);
    else if(afterId){const tail=new Set(Tree.descendants(afterId,rest));at=rest.findLastIndex(g=>tail.has(g.id))+1;}
    else if(parentId){const family=new Set(Tree.descendants(parentId,rest));at=rest.findLastIndex(g=>family.has(g.id))+1;}
    const source=branch[0],changed=(source.parentId||null)!==parentId;
    const moved=branch.map(g=>{const next={...g};delete next.captionOffset;if(g.id===id){next.parentId=parentId;if(changed){next.provinceId=null;delete next.microRegionId;if(parentId)delete next.electionDistrictId;}}return next;});
    const result=[...rest.slice(0,at),...moved,...rest.slice(at)];
    return result.every((g,i)=>g.id===groups[i]?.id&&(g.parentId||null)===(groups[i]?.parentId||null))?groups:result;
  }
  function sort(project,key='name',direction='asc',parent=undefined){
    const byId=Tree.index(project.groups),counts=new Map(project.groups.map(g=>[g.id,0]));
    for(const id of Object.values(project.assignments))for(const g of Tree.ancestors(byId.get(id),byId))counts.set(g.id,(counts.get(g.id)||0)+1);
    const collator=new Intl.Collator(project.settings?.placeLanguage==='en'?'en':'ko',{numeric:true,sensitivity:'base'}),sign=direction==='desc'?-1:1;
    const value=g=>key==='regions'?counts.get(g.id)||0:Tree.descendants(g.id,project.groups).length-1;
    const buckets=new Map();for(const g of project.groups){const id=g.parentId||null;if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(g);}
    for(const [id,groups]of buckets)if(parent===undefined||id===parent)groups.sort((a,b)=>sign*(key==='name'?collator.compare(a.name,b.name):value(a)-value(b)));
    const result=[];function visit(id){for(const g of buckets.get(id)||[]){result.push({...g,captionOffset:{x:0,y:0}});visit(g.id);}}visit(null);return result;
  }
  return {move,place,sort,offset,options};
});
