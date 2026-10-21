((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else root.PandoColors=factory();})(globalThis,()=>{
  'use strict';
  const BASE=['#5d9785','#8cb59b','#b4c79a','#dfc268','#d99774','#cc7d79','#779bb3','#97b7c9','#9c91b6','#b8a6bd','#a59d8d','#d0cbc0',
    '#31594a','#4f7e68','#7f9851','#b7943c','#bd704a','#a44859','#3f6887','#5b9eaa','#705c91','#976b91','#71665b','#4d5966'];
  const generated=[...BASE],seen=new Set(BASE);
  function hsl(h,s,l){
    s/=100;l/=100;
    const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};
    return '#'+[f(0),f(8),f(4)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  let sequence=0;
  function palette(count=24){
    while(generated.length<count){
      const i=sequence++,color=hsl((i*137.507764+18)%360,36+(Math.floor(i/12)%5)*9,42+(Math.floor(i/5)%6)*7);
      if(!seen.has(color)){seen.add(color);generated.push(color);}
    }
    return generated.slice(0,count);
  }
  const nextCount=count=>count<60?60:count+12;
  function parseHex(value){
    const hex=String(value).trim().replace(/^#/,'');
    if(/^[0-9a-f]{3}$/i.test(hex))return '#'+[...hex].map(c=>c+c).join('').toLowerCase();
    return /^[0-9a-f]{6}$/i.test(hex)?'#'+hex.toLowerCase():null;
  }
  function fromRGB(values){
    if(values.length!==3||values.some(v=>String(v).trim()===''||!Number.isInteger(Number(v))||Number(v)<0||Number(v)>255))return null;
    return '#'+values.map(v=>Number(v).toString(16).padStart(2,'0')).join('');
  }
  function toRGB(value){const hex=parseHex(value);return hex?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)):null;}
  return {palette,nextCount,parseHex,fromRGB,toRGB};
});
