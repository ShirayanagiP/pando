/* Real bundled webfont data is shared by the browser and SVG outline exporter. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./font-data.js'),require('./vendor/opentype.min.js'),require('./cjk-font-data.js'),require('./world-font-data.js'));
  else root.PandoFonts=factory(root.PANDO_FONTS,root.opentype,root.PANDO_CJK_FONT,root.PANDO_WORLD_FONTS);
})(globalThis,(sources,OpenType,cjkSource,worldSources)=>{
  'use strict';
  worldSources=worldSources||[];
  const parsed=new Map(),glyphCache=new Map();
  let revision=0;
  const families=sources.map((source,index)=>({name:source.family,label:source.label,cssFamily:'PandoWebFont'+index}));
  function normalize(name){
    if(typeof name!=='string')return 'Pretendard';
    if(families.some(f=>f.name===name))return name;
    if(/^local-[a-f0-9]{16}$/.test(name))return name;
    if(/바탕|명조|batang|gungsuh|georgia|serif/i.test(name||''))return 'Gowun Batang';
    if(/dotum|돋움/i.test(name||''))return 'Gowun Dodum';
    return 'Pretendard';
  }
  function family(settings={}){return families.find(f=>f.name===normalize(settings.fontFamily))||families[0];}
  function cssFamily(settings){return `"${family(settings).cssFamily}", sans-serif`;}
  function font(settings){
    let name=normalize(settings?.fontFamily);
    if(name.startsWith('local-')&&!parsed.has(name))name='Pretendard';
    if(!parsed.has(name)){
      const source=sources.find(f=>f.family===name);
      const bytes=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(source.data,'base64')):Uint8Array.from(atob(source.data),c=>c.charCodeAt(0));
      parsed.set(name,OpenType.parse(bytes.buffer));
    }
    return parsed.get(name);
  }
  function glyph(char,settings){
    const key=normalize(settings?.fontFamily)+'|'+char;
    if(!glyphCache.has(key)){
      let face=font(settings),shape=face.charToGlyph(char);
      if(!shape.index&&char.trim()){
        face=font({fontFamily:'Pretendard'});shape=face.charToGlyph(char);
        if(!shape.index&&cjkSource){
          if(!parsed.has('__cjk')){
            const bytes=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(cjkSource.data,'base64')):Uint8Array.from(atob(cjkSource.data),c=>c.charCodeAt(0));
            parsed.set('__cjk',OpenType.parse(bytes.buffer));
          }
          face=parsed.get('__cjk');shape=face.charToGlyph(char);
        }
        if(!shape.index)for(const source of worldSources){
          const candidate=worldFont(source.id),candidateGlyph=candidate.charToGlyph(char);
          if(candidateGlyph.index){face=candidate;shape=candidateGlyph;break;}
        }
      }
      const advance=(shape.advanceWidth||face.unitsPerEm)/face.unitsPerEm;
      const path=shape.getPath(-advance/2,.35,1),bounds=path.getBoundingBox();
      glyphCache.set(key,{char,advance,d:path.toPathData(5),width:Math.max(advance,bounds.x2-bounds.x1)+.12,
        height:Math.max(1.2,Math.abs(bounds.y1)*2,Math.abs(bounds.y2)*2)+.12});
    }
    return glyphCache.get(key);
  }
  function worldFont(id){
    if(!parsed.has(id)){
      const source=worldSources.find(s=>s.id===id);if(!source)return null;
      const bytes=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(source.data,'base64')):Uint8Array.from(atob(source.data),c=>c.charCodeAt(0));
      parsed.set(id,OpenType.parse(bytes.buffer));
    }
    return parsed.get(id);
  }
  function run(text,settings){
    text=text.replace(/\p{Cf}/gu,'');
    // Keep joining RTL words together. OpenType supplies Arabic contextual forms;
    // a whole run also avoids inserting Latin tracking between joined letters.
    const rtl=/[\u0600-\u06ff]/.test(text)?'noto-arabic':/[\u0590-\u05ff]/.test(text)?'noto-hebrew':null;
    if(rtl&&worldSources.length){
      const key=normalize(settings?.fontFamily)+'|run|'+text;
      if(!glyphCache.has(key)){
        let face=font(settings);if(Array.from(text).some(c=>c.trim()&&!face.charToGlyph(c).index))face=worldFont(rtl);
        const value=rtl==='noto-hebrew'?Array.from(text).reverse().join(''):text;
        const advance=face.getAdvanceWidth(value,1),path=face.getPath(value,-advance/2,.35,1),bounds=path.getBoundingBox();
        glyphCache.set(key,{char:text,advance,d:path.toPathData(5),width:Math.max(advance,bounds.x2-bounds.x1)+.12,height:Math.max(1.2,Math.abs(bounds.y1)*2,Math.abs(bounds.y2)*2)+.12});
      }
      return [glyphCache.get(key)];
    }
    return Array.from(text).map(char=>glyph(char,settings));
  }
  function measure(text,settings){return run(text,settings).reduce((sum,g)=>sum+g.advance,0);}
  async function install(){
    if(typeof document==='undefined')return;
    await Promise.all(sources.map(async(source,index)=>{
      const face=new FontFace(families[index].cssFamily,`url(data:${source.mime};base64,${source.data}) format('${source.format}')`,{weight:'400',style:'normal'});
      await face.load();document.fonts.add(face);
    }));
  }
  function register(buffer,label){
    const bytes=buffer instanceof ArrayBuffer?new Uint8Array(buffer):new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength);
    if(!bytes.length||bytes.length>40*1024*1024)throw new Error('40MB 이하의 TTF·OTF·WOFF 글꼴을 선택해주세요.');
    const copy=bytes.slice().buffer;
    let face;
    try{face=OpenType.parse(copy);}catch{throw new Error('이 글꼴을 읽지 못했어요. TTF·OTF·WOFF 형식을 사용해주세요.');}
    let a=2166136261,b=0x9e3779b9;
    for(const byte of bytes){a=Math.imul(a^byte,16777619);b=Math.imul(b^byte,2246822519);}
    const hash=[a,b].map(n=>(n>>>0).toString(16).padStart(8,'0')).join(''),name='local-'+hash;
    const fullName=face.names.fullName||face.names.fontFamily||{};
    const title=String(label||fullName.ko||fullName.en||Object.values(fullName)[0]||'설치 글꼴').replace(/[\x00-\x1f]/g,'').slice(0,100);
    let entry=families.find(f=>f.name===name);
    if(!entry){entry={name,label:title,cssFamily:'PandoLocal'+hash,local:true};families.push(entry);}
    parsed.set(name,face);glyphCache.clear();revision++;
    return {entry,buffer:copy};
  }
  function database(){
    return new Promise((resolve,reject)=>{
      if(typeof indexedDB==='undefined'){reject(new Error('글꼴 자동 보관을 지원하지 않는 브라우저입니다.'));return;}
      const request=indexedDB.open('pando-local-fonts',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('fonts',{keyPath:'name'});
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
  }
  async function installLocal(registered){
    if(typeof FontFace==='undefined')return;
    const face=new FontFace(registered.entry.cssFamily,registered.buffer);
    await face.load();document.fonts.add(face);
  }
  async function loadLocal(buffer,label){
    const registered=register(buffer,label);await installLocal(registered);
    let saved=true,db;
    try{
      db=await database();
      await new Promise((resolve,reject)=>{
        const transaction=db.transaction('fonts','readwrite');
        transaction.objectStore('fonts').put({name:registered.entry.name,label:registered.entry.label,buffer:registered.buffer});
        transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
      });
    }catch{saved=false;}finally{db?.close();}
    return {...registered.entry,saved};
  }
  async function restoreLocal(){
    let db;
    try{
      db=await database();
      const rows=await new Promise((resolve,reject)=>{const request=db.transaction('fonts').objectStore('fonts').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      for(const row of rows){try{await installLocal(register(row.buffer,row.label));}catch{/* A damaged cache must not prevent opening the map. */}}
    }catch{/* The file picker still works when browser storage is unavailable. */}finally{db?.close();}
  }
  const available=name=>families.some(f=>f.name===normalize(name));
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const unescape=value=>value.replace(/&(amp|lt|gt|quot|apos);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key]));
  function outlineSVG(svg,settings={}){
    settings=settings||{};
    return svg.replace(/<text\b([^>]*)>([^<]*)<\/text>/g,(_,attrs,encoded)=>{
      const attr=name=>attrs.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))?.[1];
      const value=unescape(encoded),size=Number(attr('font-size'))||12,x=Number(attr('x'))||0,y=Number(attr('y'))||0;
      const glyphs=run(value,settings),tracking=Number(attr('letter-spacing'))||0,total=glyphs.reduce((n,g)=>n+g.advance*size,0)+Math.max(0,glyphs.length-1)*tracking;
      const anchor=attr('text-anchor'),start=x-(anchor==='end'?total:anchor==='middle'?total/2:0),bold=Number(attr('font-weight'))>=600;
      let cursor=start;const paths=[];
      for(const g of glyphs){paths.push(`<path d="${g.d}" transform="translate(${(cursor+g.advance*size/2).toFixed(3)} ${(y-.35*size).toFixed(3)}) scale(${size})"${bold?' stroke="currentColor" stroke-width=".025" paint-order="stroke"':''}/>`);cursor+=g.advance*size+tracking;}
      const fill=attr('fill')||'#365344';
      return `<g${attrs} data-font-text="${escape(normalize(settings.fontFamily))}" aria-label="${escape(value)}" color="${fill}"><title>${escape(value)}</title>${paths.join('')}</g>`;
    });
  }
  return {families,normalize,cssFamily,font,glyph,run,measure,outlineSVG,install,register,loadLocal,restoreLocal,available,revision:()=>revision};
});
