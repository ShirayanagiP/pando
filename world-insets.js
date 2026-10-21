/* Small-country panels share the real world region IDs and paint assignments. */
((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else root.PandoWorldInsets=factory();})(globalThis,()=>{
  'use strict';
  const presets=[
    {id:'lesser-antilles',name:'소안틸레스',nameEn:'Lesser Antilles',countries:['vgb','vir','aia','maf','sxm','blm','atg','kna','msr','dma','lca','vct','brb','grd','tto','abw','cuw'],regionIds:['WORLD-FRA-GP','WORLD-FRA-MQ','WORLD-NLD-5147','WORLD-NLD-5148','WORLD-NLD-5149']},
    {id:'western-europe',name:'서유럽',nameEn:'Western Europe',countries:['and','mco','smr','vat','gib','mlt','lie','lux','ggy','jey','imn']},
    {id:'pacific',name:'태평양 군도',nameEn:'Pacific Islands',countries:['plw','fsm','mhl','kir','nru','tuv','ton','wsm','asm','cok','niu','wlf','ncl','pyf','gum','mnp','nfk','pcn','umi','fji','vut','slb']},
    {id:'gulf',name:'걸프',nameEn:'Gulf',countries:['qat','bhr','kwt','are']},
    {id:'african-islands',name:'아프리카 군도',nameEn:'African Islands',countries:['syc','stp','com','mus','cpv']},
    {id:'other',name:'기타 지역',nameEn:'Other Regions',countries:['mdv','sgp','brn']}
  ];
  const available=data=>data?.id==='world'&&!data.game;
  const settings=value=>Object.fromEntries(presets.map(p=>[p.id,value?.[p.id]===true]));
  const enabled=(project,data)=>available(data)?presets.filter(p=>settings(project.settings?.worldInsets)[p.id]):[];
  function hiddenSettings(value){
    const panelIds=new Set(presets.map(p=>p.id)),tileIds=new Set(presets.flatMap(p=>[...p.countries,...p.regionIds||[]].map(id=>p.id+'/'+id)));
    return {panels:[...new Set(Array.isArray(value?.panels)?value.panels.filter(id=>panelIds.has(id)):[])],tiles:[...new Set(Array.isArray(value?.tiles)?value.tiles.filter(id=>tileIds.has(id)):[])]};
  }
  const tileHidden=(project,preset,tile)=>hiddenSettings(project.settings?.worldInsetHidden).tiles.includes(preset.id+'/'+tile.id);
  const visibleTiles=(project,data,preset)=>countryTiles(data,preset).filter(tile=>!tileHidden(project,preset,tile));
  const exportable=(project,data)=>enabled(project,data).filter(p=>!hiddenSettings(project.settings?.worldInsetHidden).panels.includes(p.id)&&visibleTiles(project,data,p).length);
  function toggleHidden(value,kind,id){const next=hiddenSettings(value),key=kind==='panel'?'panels':'tiles',items=new Set(next[key]);if(items.has(id))items.delete(id);else items.add(id);next[key]=[...items];return hiddenSettings(next);}
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const font=()=>typeof module==='object'&&module.exports?require('./webfonts.js'):globalThis.PandoFonts;
  const name=(entry,s)=>s?.nativeNames?entry.countryNameNative||entry.nativeName||entry.name:s?.placeLanguage==='en'?entry.countryNameEnglish||entry.englishName||entry.name:entry.countryNameKo||entry.nameKo||entry.name;
  const text=(x,y,value,size,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" ${extra}>${esc(value)}</text>`;
  const cache=new WeakMap();
  function countryTiles(data,preset){
    if(!cache.has(data))cache.set(data,new Map());const stored=cache.get(data);if(stored.has(preset.id))return stored.get(preset.id);
    const period=data.wrap?.period,left=data.wrap?.left||0,tiles=[];
    const entries=preset.countries.map(country=>({country,id:country,regions:data.regions.filter(r=>r.country===country),meta:data.countries.find(c=>c.id===country)}));
    for(const id of preset.regionIds||[]){const r=data.regions.find(r=>r.id===id);if(r)entries.push({id,country:r.country,regions:[r],meta:{name:r.nameKo||r.name,englishName:r.englishName,nativeName:r.nativeName}});}
    for(const {country,id,regions,meta} of entries){
      if(!regions.length)continue;const xs=[];
      for(const r of regions)for(const match of (r.insetD||r.d).matchAll(/(-?\d+(?:\.\d+)?),-?\d+(?:\.\d+)?/g)){const x=Number(match[1]);xs.push(period?((x-left)%period+period)%period+left:x);}
      xs.sort((a,b)=>a-b);let x1=xs[0],x2=xs.at(-1);
      if(period&&xs.length){let gap=-1,start=0;for(let i=0;i<xs.length;i++){const next=i+1<xs.length?xs[i+1]:xs[0]+period,d=next-xs[i];if(d>gap){gap=d;start=(i+1)%xs.length;}}x1=xs[start];x2=x1+period-gap;}
      const top=Math.min(...regions.map(r=>(r.insetBounds||r.bounds)[1])),bottom=Math.max(...regions.map(r=>(r.insetBounds||r.bounds)[3])),w=Math.max(.01,x2-x1),h=Math.max(.01,bottom-top),pad=Math.max(w,h)*.1;
      tiles.push({id,country,meta:meta||regions[0],regions,frame:[x1-pad,top-pad,w+pad*2,h+pad*2]});
    }
    stored.set(preset.id,tiles);return tiles;
  }
  function panel(project,data,preset,width=600,prefix='inset',options={}){
    const editor=options.editor===true,tiles=editor?countryTiles(data,preset):visibleTiles(project,data,preset),columns=Math.max(1,Math.floor(width/145)),gap=10,pad=12,tileWidth=(width-pad*2-gap*(columns-1))/columns,tileHeight=Math.max(114,Math.min(170,tileWidth*.78))+(editor?24:0),top=46;
    const height=top+Math.ceil(tiles.length/columns)*(tileHeight+gap)+32,colors=new Map(project.groups.map(g=>[g.id,g.color])),sea=project.settings.seaColor||'#f1f5ee',empty=project.settings.emptyColor||'#dce6db';
    const out=[`<rect x=".5" y=".5" width="${width-1}" height="${height-1}" rx="8" fill="#fbfcf8" stroke="#dce5d5"/>`,text(pad,27,project.settings.placeLanguage==='en'?preset.nameEn:preset.name,17,'font-weight="700" fill="#315744"')];
    tiles.forEach((tile,i)=>{
      const x=pad+(i%columns)*(tileWidth+gap),y=top+Math.floor(i/columns)*(tileHeight+gap),mapY=y+29,mapHeight=tileHeight-37-(editor?24:0),[fx,fy,fw,fh]=tile.frame,scale=Math.min((tileWidth-16)/fw,mapHeight/fh),dx=x+tileWidth/2-(fx+fw/2)*scale,dy=mapY+mapHeight/2-(fy+fh/2)*scale;
      const clip=prefix+'-'+preset.id+'-'+tile.id,label=name(tile.meta,project.settings),size=Math.min(12,(tileWidth-12)/Math.max(1,font().measure(label,project.settings)));
      const key=preset.id+'/'+tile.id,hidden=editor&&tileHidden(project,preset,tile);
      out.push(`<g data-inset-country="${tile.country}" data-inset-tile="${key}"${hidden?' class="inset-tile-hidden"':''}><g data-inset-content="true"><rect x="${x}" y="${y}" width="${tileWidth}" height="${tileHeight}" rx="4" fill="${sea}" stroke="#d8e2d1"/>`,text(x+8,y+19,label,size,'fill="#536c49" font-weight="600"'),`<defs><clipPath id="${clip}"><rect x="${x+5}" y="${mapY}" width="${tileWidth-10}" height="${mapHeight}"/></clipPath></defs><g clip-path="url(#${clip})"><g transform="translate(${dx} ${dy}) scale(${scale})">`);
      const offsets=data.wrap?[-data.wrap.period,0,data.wrap.period]:[0];
      for(const offset of offsets)for(const r of tile.regions){
        const bounds=r.insetBounds||r.bounds;if(bounds[2]+offset<fx||bounds[0]+offset>fx+fw)continue;
        const color=colors.get(project.assignments[r.id])||empty,title=label+' '+(r.nameKo||r.name),border=project.settings.regionBorders!==false?'#8d9e82':color;
        out.push(`<path data-inset-region="${esc(r.id)}" d="${r.insetD||r.d}" transform="translate(${offset} 0)" fill="${color}" fill-rule="evenodd" stroke="${border}" stroke-width=".7" vector-effect="non-scaling-stroke" tabindex="0" role="button" aria-label="${esc(title)} 색칠"><title>${esc(title)}</title></path>`);
        if((r.insetArea||r.area)*scale*scale<32){const center=r.insetCenter||r.center,cx=center[0]+offset,cy=center[1];if(cx>=fx&&cx<=fx+fw)out.push(`<circle data-inset-region="${esc(r.id)}" data-inset-marker="true" cx="${cx}" cy="${cy}" r="${3.5/scale}" fill="${color}" stroke="#718663" stroke-width="1" vector-effect="non-scaling-stroke" role="button" tabindex="0" aria-label="${esc(title)} 위치 표시 및 색칠"><title>${esc(title)} | 작은 지역 위치 표시</title></circle>`);}
      }
      out.push('</g></g></g>');
      if(editor){out.push(`<g data-inset-hide-tile="${key}" role="button" tabindex="0" aria-label="${esc(label)} ${hidden?'이미지에 표시하기':'이미지에서 숨기기'}" aria-pressed="${hidden}" class="inset-hide-button"><rect x="${x+tileWidth-65}" y="${y+tileHeight-23}" width="58" height="18" rx="3" fill="#fffefa" stroke="#becdb4"/>`,text(x+tileWidth-36,y+tileHeight-11,hidden?'표시하기':'숨기기',9,'text-anchor="middle" fill="#536c49"'),'</g>');if(hidden)out.push(text(x+7,y+tileHeight-10,'이미지 제외',8,'fill="#9a7d61"'));}
      out.push('</g>');
    });
    out.push(text(pad,height-13,'각 칸은 다른 축척 | 점은 아주 작은 구역의 위치 표시',10,'fill="#8b9c80"'));
    const body=font().outlineSVG(out.join(''),project.settings);
    return {width,height,body,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(preset.name)} 확대 지도"><g font-family="${esc(font().cssFamily(project.settings))}" stroke="none">${body}</g></svg>`};
  }
  function combined(project,data,width=1210){
    const selected=exportable(project,data);if(!selected.length)return {height:0,body:''};
    const columns=selected.length===1?1:2,gap=16,w=(width-gap*(columns-1))/columns,heights=Array(columns).fill(0),out=[];
    for(const [i,preset]of selected.entries()){const c=i%columns,p=panel(project,data,preset,w,'output-inset');out.push(`<g data-world-inset="${preset.id}" transform="translate(${c*(w+gap)} ${heights[c]})">${p.body}</g>`);heights[c]+=p.height+gap;}
    return {height:Math.max(...heights),body:out.join('')};
  }
  return {presets,available,settings,enabled,hiddenSettings,toggleHidden,tileHidden,visibleTiles,exportable,countryTiles,panel,combined,name};
});
