/* Two-finger map navigation, separate from mouse input and the page's scroll. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PandoMapTouch=factory();
})(globalThis,()=>{
  'use strict';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  function pinchView(start,anchor,center,startDistance,currentDistance){
    const k=Math.max(.75,Math.min(250,start.k*currentDistance/Math.max(1,startDistance))),ratio=k/start.k;
    return {k,x:center.x-(anchor.x-start.x)*ratio,y:center.y-(anchor.y-start.y)*ratio};
  }
  function create(options){
    const points=new Map();let session=null;
    const position=e=>({x:e.clientX,y:e.clientY});
    function pinch(){
      if(session?.type==='paint')options.cancelStroke();
      const [a,b]=[...points.values()];
      session={type:'pinch',view:{...options.getView()},anchor:options.point(midpoint(a,b)),distance:distance(a,b)};
      options.hideTooltip();
    }
    function down(e){
      if(e.pointerType!=='touch')return false;
      points.set(e.pointerId,position(e));options.hideTooltip();
      if(points.size>=2){pinch();return true;}
      const start=position(e),id=options.regionAt(start),tool=options.getTool();
      session={type:tool==='pan'||!id?'pan':'pending',tool,id,start,base:options.point(start),view:{...options.getView()}};
      return true;
    }
    function move(e){
      if(e.pointerType!=='touch'||!points.has(e.pointerId))return false;
      const p=position(e);points.set(e.pointerId,p);
      if(session?.type==='pinch'){
        if(points.size<2)return true;
        const [a,b]=[...points.values()];
        options.setView(pinchView(session.view,session.anchor,options.point(midpoint(a,b)),session.distance,distance(a,b)));
      }else if(session?.type==='pan'){
        const base=options.point(p);options.setView({...session.view,x:session.view.x+base.x-session.base.x,y:session.view.y+base.y-session.base.y});
      }else if(session?.type==='pending'&&distance(p,session.start)>=8){
        if(session.tool==='picker')return true;
        session.type='paint';options.startStroke(session.id,session.tool==='eraser');
        const id=options.regionAt(p);if(id)options.moveStroke(id);
      }else if(session?.type==='paint'){
        const id=options.regionAt(p);if(id)options.moveStroke(id);
      }
      return true;
    }
    function up(e){
      if(e.pointerType!=='touch'||!points.has(e.pointerId))return false;
      const ended=session;points.delete(e.pointerId);
      if(ended?.type==='pinch'||ended?.type==='blocked'){
        session=points.size?{type:'blocked'}:null;
        if(points.size>=2)pinch();
        return true;
      }
      session=null;
      if(e.type!=='pointerup'){if(ended?.type==='paint')options.cancelStroke();return true;}
      if(ended?.type==='paint')options.endStroke();
      else if(ended?.type==='pending'){
        if(ended.tool==='picker')options.pick(ended.id);
        else{options.startStroke(ended.id,ended.tool==='eraser');options.endStroke();}
      }
      return true;
    }
    function cancel(){if(session?.type==='paint')options.cancelStroke();points.clear();session=null;}
    return {down,move,up,cancel};
  }
  return {create,pinchView};
});
