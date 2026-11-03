// Browser integration test double, served only by tests/serve.mjs at /__qa__/.
// This file is outside dist and is never included in the deployed application.
(() => {
  const values = new Map();
  Object.defineProperty(window,'localStorage',{value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}});
  class Events {
    constructor(){this.listeners={};}
    addListener(name,fn){(this.listeners[name] ||= new Set()).add(fn);return {remove:()=>this.listeners[name].delete(fn)};}
    emit(name,value){for(const fn of [...(this.listeners[name]||[])]) fn(value);}
  }
  class LatLng {
    constructor(p,lng){this.p=typeof p==='object'?{lat:p.lat,lng:p.lng}:{lat:p,lng};}
    toJSON(){return {...this.p};}
    lat(){return this.p.lat;}
    lng(){return this.p.lng;}
  }
  class MapDouble extends Events {
    constructor(el,opts){super();this.el=el;this.options=opts;this.zoom=opts.zoom;this.center=opts.center;el.style.cssText='height:100%;position:relative;background:repeating-linear-gradient(0deg,#d5dfcc 0px,#d5dfcc 49px,#a9b8a2 50px,#a9b8a2 51px)';const label=document.createElement('p');label.textContent='테스트용 지도 · 실제 Google 지도 아님';label.style.cssText='position:absolute;top:8px;left:12px;font-size:11px;color:#243520';el.append(label);this.layer=document.createElement('div');this.layer.style.cssText='position:absolute;inset:0;pointer-events:none';el.append(this.layer);el.addEventListener('click',e=>{const r=el.getBoundingClientRect();this.emit('click',{latLng:new LatLng({lat:35+(r.height/2-(e.clientY-r.top))*.01,lng:135+(e.clientX-r.left-r.width/2)*.01})});});}
    setOptions(o){Object.assign(this.options,o);}
    setCenter(c){this.center=c;}
    panTo(c){this.center=c;}
    setZoom(z){this.zoom=z;setTimeout(()=>this.emit('idle'),10);}
    getZoom(){return this.zoom;}
    fitBounds(b){this.bounds=b;this.zoom=8;setTimeout(()=>this.emit('idle'),10);}
  }
  let panoCounter=0;
  class ServiceDouble {
    getPanorama(request,callback){panoCounter++;const latLng=new LatLng({lat:35.01+panoCounter*.004,lng:135.75});setTimeout(()=>callback({location:{pano:`fixture-${panoCounter}`,latLng,description:'테스트 출발점 (실제 거리뷰 아님)'},links:[{pano:'fixture-next'}],imageDate:'2025-01'},'OK'),90);}
  }
  class PanoramaDouble extends Events {
    constructor(el){super();this.el=el;this.status=null;this.pov={heading:45,pitch:0};this.zoom=0;el.style.cssText='height:100%;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(#95aaa0 48%,#4e6750 48%,#263c30 62%);text-align:center';const title=document.createElement('h3');title.textContent='테스트용 거리뷰 · 실제 Google 이미지 아님';title.style.cssText='background:#12271f;padding:15px;color:#e9f3e4';this.label=document.createElement('p');const move=document.createElement('button');move.textContent='거리뷰에서 이동 (테스트)';move.className='button button-primary';move.type='button';move.onclick=()=>this.setPano('fixture-moved');el.append(title,this.label,move);}
    setPano(p){this.pano=p;this.status=null;this.label.textContent=`파노라마: ${p}`;setTimeout(()=>{this.status='OK';this.emit('status_changed');},40);}
    getPano(){return this.pano;}
    getStatus(){return this.status;}
    setPov(p){this.pov=p;}
    getPov(){return this.pov;}
    setZoom(z){this.zoom=z;}
    setVisible(v){this.visible=v;}
    getPosition(){return new LatLng(this.pano==='fixture-moved'?{lat:36,lng:136}:{lat:35.014,lng:135.75});}
  }
  class OverlayDouble {
    setMap(map){if(this.map)this.onRemove?.();this.map=map;if(map){this.onAdd?.();this.draw?.();}}
    getPanes(){return {floatPane:this.map.layer};}
    getProjection(){return {fromLatLngToDivPixel:ll=>({x:this.map.el.clientWidth/2+(ll.lng()-135)*100,y:this.map.el.clientHeight/2-(ll.lat()-35)*100})};}
  }
  class PolylineDouble{constructor(options){this.options=options;}setMap(map){this.map=map;}}
  window.google={maps:{Map:MapDouble,StreetViewPanorama:PanoramaDouble,StreetViewService:ServiceDouble,OverlayView:OverlayDouble,Polyline:PolylineDouble,LatLng,StreetViewSource:{GOOGLE:'google',OUTDOOR:'outdoor'},StreetViewPreference:{BEST:'best'},event:{addListenerOnce(target,name,fn){const handle=target.addListener(name,(...args)=>{handle.remove();fn(...args);});return handle;}}}};
  const append=HTMLHeadElement.prototype.append;
  HTMLHeadElement.prototype.append=function(...nodes){for(const node of nodes){if(node instanceof HTMLScriptElement&&node.src.startsWith('https://maps.googleapis.com/maps/api/js')){setTimeout(()=>window.__streetlensMapsReady?.(),50);}else append.call(this,node);}};
})();
