/* Fuori Mappa · preferiti/passaporto solo account; Supabase con cache per utente autenticato */
(()=>{
'use strict';
if (!document.documentElement.classList.contains('fm-is-app')) return;
const PREFIX='fm-personal-v1';
const FAV=PREFIX+'-saved',VISITED=PREFIX+'-visited',WISH=PREFIX+'-wish';
let currentUid=null, cloudLoading=false, syncing=false;
let saveTimeout=null, queue=Promise.resolve(), requestVersion=0;
const fullKey=key=>currentUid?key+'::'+currentUid:null;
const uiSync=(message)=>{const n=document.getElementById('fm-cloud-status');if(n)n.textContent=message;};
const markLoading=on=>{cloudLoading=on;document.documentElement.classList.toggle('fm-cloud-loading',on);};

const storageOk=(()=>{try{localStorage.setItem(PREFIX+'-test','1');localStorage.removeItem(PREFIX+'-test');return true}catch(e){return false}})();
const notify=(msg)=>{const el=document.getElementById('fm-personal-status');if(el)el.textContent=msg;};
const get=(key)=>{if(!storageOk||!currentUid)return [];try{let v=JSON.parse(localStorage.getItem(fullKey(key))||'[]');return Array.isArray(v)?v:[]}catch(e){return []}};
const put=(key,list)=>{if(!currentUid){notify('Per salvare i tuoi viaggi devi prima accedere o registrarti.');return false;}if(cloudLoading){notify('Caricamento del tuo account in corso.');return false;}if(!storageOk){notify('Il salvataggio locale non è disponibile su questo dispositivo.');return false;}try{localStorage.setItem(fullKey(key),JSON.stringify(list));if(currentUid&&!cloudLoading)scheduleSync();return true}catch(e){notify('Non è stato possibile salvare sul dispositivo.');return false}};
const safePath=(s)=>{try{const u=new URL(s,location.href);if(u.origin!==location.origin)return null;return u.pathname+u.search}catch(e){return null}};
const norm=(s)=>{const p=safePath(s);return p?p.split('?')[0]:null};
const mySaved=()=>get(FAV);
function refreshButtons(){
 const items=mySaved();for(const btn of document.querySelectorAll('.fm-save-toggle')){
 const yes=items.some(item=>item.href===btn.dataset.href);btn.setAttribute('aria-pressed',String(yes));btn.textContent=yes?'♥':'♡';btn.title=!currentUid?'Accedi per salvare negli itinerari':(yes?'Rimuovi dai preferiti':'Aggiungi ai preferiti');
 const card=btn.parentElement?.querySelector('.journey-card h3');btn.setAttribute('aria-label',(yes?'Rimuovi dai preferiti: ':'Salva nei preferiti: ')+(card?.textContent||'itinerario'));
 }
}
function toggleFavorite(item){
 if(!currentUid){location.href='/il-mio-spazio.html#profilo';return;}
 if(cloudLoading){notify('Attendi il caricamento dei tuoi dati.');return;}
 let rows=mySaved(),i=rows.findIndex(row=>row.href===item.href);
 if(i>=0)rows.splice(i,1);else rows.unshift(item);
 if(put(FAV,rows)){refreshButtons();renderSaved();updateCounts()}
}
function enhanceCards(){
 document.querySelectorAll('#journey-catalogue a.journey-card').forEach(card=>{
   if(card.closest('.fm-save-frame'))return;
   const href=norm(card.getAttribute('href'));if(!href)return;
   const title=(card.querySelector('h3')?.textContent||card.querySelector('img')?.alt||'Itinerario').trim().replace(/\s+/g,' ');
   const subtitle=(card.querySelector('.journey-meta')?.textContent||'').trim().replace(/\s+/g,' ');
   const rawImg=card.querySelector('img')?.getAttribute('src')||'';
   const img=safePath(rawImg)||'';
   const frame=document.createElement('div');frame.className='fm-save-frame';frame.hidden=card.hidden;
   card.parentNode.insertBefore(frame,card);frame.append(card);
   const b=document.createElement('button');b.type='button';b.className='fm-save-toggle';b.dataset.href=href;b.addEventListener('click',()=>toggleFavorite({href,title,subtitle,img}));frame.append(b);
 });refreshButtons();
}
const mk=(t,cls,text)=>{const e=document.createElement(t);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
function renderSaved(){
 const root=document.getElementById('fm-my-saved');if(!root)return;root.replaceChildren();const rows=mySaved();
 if(!rows.length){const p=mk('p','fm-empty',currentUid?'Non hai ancora salvato itinerari. Tocca ♡ sulle cartoline che ti incuriosiscono.':'Accedi o registrati per salvare gli itinerari preferiti.');root.append(p);return}
 for(const item of rows){
  const href=norm(item.href);if(!href)continue;
  const article=mk('article','fm-personal-trip');const link=mk('a','fm-trip-link');link.href=href;
  if(item.img){const imgPath=safePath(item.img);if(imgPath){const pic=document.createElement('img');pic.loading='lazy';pic.alt='';pic.src=imgPath;link.append(pic)}}
  const info=mk('div','fm-trip-copy');info.append(mk('h3','',item.title));if(item.subtitle)info.append(mk('p','',item.subtitle));link.append(info);article.append(link);
  const b=mk('button','fm-remove','Rimuovi');b.type='button';b.setAttribute('aria-label','Rimuovi '+item.title+' dai preferiti');b.addEventListener('click',()=>toggleFavorite(item));article.append(b);root.append(article);
 }
}
const countries=window.FM_COUNTRIES||[];
function flag(code){return /^([A-Z]{2})$/.test(code)?Array.from(code).map(x=>String.fromCodePoint(x.charCodeAt(0)+127397)).join(''):'🌍'}
/* Carta geografica personalizzata: stessi codici e stesso storage di FM_PERSONAL, nessun duplicato. */
const mapNodes=new Map();
let mapSelected=null;
const MAP_W=960, MAP_H=510;
const mapSVG=(tag)=>document.createElementNS('http://www.w3.org/2000/svg',tag);
const mapNameByCode=new Map(countries);
let mapReady=false;
let mapView={x:0,y:0,w:MAP_W,h:MAP_H};
function mapBox(x,y,w){
 const width=Math.min(MAP_W,Math.max(MAP_W/9,w)),height=width*MAP_H/MAP_W;
 mapView={x:Math.min(MAP_W-width,Math.max(0,x)),y:Math.min(MAP_H-height,Math.max(0,y)),w:width,h:height};
 document.getElementById('fm-world-map')?.setAttribute('viewBox',`${mapView.x} ${mapView.y} ${mapView.w} ${mapView.h}`);
}
function mapZoom(factor,point){
 if(!mapReady)return;
 const focal=point||{x:mapView.x+mapView.w/2,y:mapView.y+mapView.h/2};
 const w=Math.min(MAP_W,Math.max(MAP_W/9,mapView.w/factor));
 const r=w/mapView.w;
 mapBox(focal.x-(focal.x-mapView.x)*r,focal.y-(focal.y-mapView.y)*r,w);
}
function mapPoint(clientX,clientY){
 const svg=document.getElementById('fm-world-map');
 const matrix=svg?.getScreenCTM();
 if(!matrix)return {x:mapView.x+mapView.w/2,y:mapView.y+mapView.h/2};
 try{const p=svg.createSVGPoint();p.x=clientX;p.y=clientY;const pt=p.matrixTransform(matrix.inverse());return {x:pt.x,y:pt.y}}catch(_){return {x:mapView.x+mapView.w/2,y:mapView.y+mapView.h/2}}
}
function mapClass(node,visited,wish){
 node.classList.toggle('is-visited',visited&&!wish);
 node.classList.toggle('is-wish',wish&&!visited);
 node.classList.toggle('is-both',visited&&wish);
}
function updateMapColors(){
 if(!mapReady)return;
 const visited=new Set(get(VISITED)),wish=new Set(get(WISH));
 for(const [code,els] of mapNodes){for(const el of els){mapClass(el,visited.has(code),wish.has(code));el.classList.toggle('is-selected',code===mapSelected)}}
 updateMapDetailButtons();
}
function updateMapDetailButtons(){
 if(!mapSelected)return;
 const v=get(VISITED).includes(mapSelected),w=get(WISH).includes(mapSelected);
 for(const [id,on] of [['fm-map-mark-visited',v],['fm-map-mark-wish',w]]){
  const el=document.getElementById(id);if(!el)continue;
  el.classList.toggle('is-active',on);el.setAttribute('aria-pressed',String(on));
  el.textContent=id==='fm-map-mark-visited'?(on?'✓ Visitato · rimuovi':'✓ Sono stata qui'):(on?'★ Da visitare · rimuovi':'★ Voglio andarci');
 }
}
function mapSelect(code){
 if(!mapNameByCode.has(code))return;
 mapSelected=code;
 const detail=document.getElementById('fm-map-detail');
 const name=document.getElementById('fm-map-selected-name');
 if(name)name.textContent=flag(code)+'  '+mapNameByCode.get(code);
 if(detail)detail.hidden=false;
 updateMapColors();
}
function mapClose(){mapSelected=null;const n=document.getElementById('fm-map-detail');if(n)n.hidden=true;updateMapColors()}
function mapFocus(code){
 if(!mapReady||!mapNodes.has(code))return;
 mapSelect(code);
 const items=mapNodes.get(code),svg=document.getElementById('fm-world-map');
 let extent=null;
 for(const el of items){
  try{const b=el.getBBox();if(!b.width&&!b.height)continue;
   if(!extent)extent={x:b.x,y:b.y,x2:b.x+b.width,y2:b.y+b.height};
   else{extent.x=Math.min(extent.x,b.x);extent.y=Math.min(extent.y,b.y);extent.x2=Math.max(extent.x2,b.x+b.width);extent.y2=Math.max(extent.y2,b.y+b.height)}
  }catch(_){}
 }
 if(extent){
  const cx=(extent.x+extent.x2)/2,cy=(extent.y+extent.y2)/2;
  const width=Math.min(MAP_W,Math.max(MAP_W/7,Math.max((extent.x2-extent.x)*2.2,(extent.y2-extent.y)*2.4*MAP_W/MAP_H)));
  mapBox(cx-width/2,cy-(width*MAP_H/MAP_W)/2,width);
 }
 svg?.scrollIntoView({behavior:'smooth',block:'center'});
}
function mapAttach(code,node){
 if(!code||!mapNameByCode.has(code))return;
 node.dataset.code=code;
 node.setAttribute('tabindex','0');
 node.setAttribute('role','button');
 node.setAttribute('aria-label',mapNameByCode.get(code)+', seleziona sulla mappa');
 const title=mapSVG('title');title.textContent=mapNameByCode.get(code);node.prepend(title);
 node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();mapSelect(code)}});
 if(!mapNodes.has(code))mapNodes.set(code,[]);
 mapNodes.get(code).push(node);
}
function initPassportMap(){
 const svg=document.getElementById('fm-world-map'),shell=document.getElementById('fm-map-shell');
 if(!svg||!shell)return;
 const features=window.FM_WORLD_SHAPES;
 if(!Array.isArray(features)||!features.length){
  shell.classList.add('is-unavailable');
  const hint=document.getElementById('fm-map-help');if(hint)hint.textContent='La mappa non è disponibile al momento. Puoi comunque usare l’elenco dei Paesi qui sotto.';
  return;
 }
 const grid=document.getElementById('fm-map-graticule');
 for(let lon=60;lon<960;lon+=160){const line=mapSVG('path');line.classList.add('fm-map-grid');line.setAttribute('d',`M ${lon} 0 V ${MAP_H}`);grid.append(line)}
 for(let lat=85;lat<510;lat+=85){const line=mapSVG('path');line.classList.add('fm-map-grid');line.setAttribute('d',`M 0 ${lat} H ${MAP_W}`);grid.append(line)}
 const root=document.getElementById('fm-map-countries');
 for(const {c,d} of features){
  const p=mapSVG('path');p.classList.add('fm-world-shape');p.setAttribute('d',d);
  mapAttach(c,p);root.append(p);
 }
 const pins=document.getElementById('fm-map-pins');
 for(const [code,x,y] of (window.FM_WORLD_PINS||[])){
  if(!mapNameByCode.has(code))continue;
  const g=mapSVG('g');g.classList.add('fm-world-pin');
  const visible=mapSVG('circle');visible.classList.add('fm-pin-visible');visible.setAttribute('cx',x);visible.setAttribute('cy',y);visible.setAttribute('r','3.3');
  const hit=mapSVG('circle');hit.classList.add('fm-pin-hit');hit.setAttribute('cx',x);hit.setAttribute('cy',y);hit.setAttribute('r','8');
  g.append(visible,hit);mapAttach(code,g);pins.append(g);
 }
 mapReady=true;mapBox(0,0,MAP_W);updateMapColors();
 document.getElementById('fm-map-zoom-in')?.addEventListener('click',()=>mapZoom(1.6));
 document.getElementById('fm-map-zoom-out')?.addEventListener('click',()=>mapZoom(1/1.6));
 document.getElementById('fm-map-reset')?.addEventListener('click',()=>mapBox(0,0,MAP_W));
 document.getElementById('fm-map-close')?.addEventListener('click',mapClose);
 document.getElementById('fm-map-mark-visited')?.addEventListener('click',()=>{if(mapSelected)toggleCountry(VISITED,mapSelected)});
 document.getElementById('fm-map-mark-wish')?.addEventListener('click',()=>{if(mapSelected)toggleCountry(WISH,mapSelected)});
 // Gesti touch/pointer: tocco=seleziona, trascinamento=sposta, due dita=zoom.
 const pointers=new Map();let pinching=false,afterPinch=false,previousPinchDistance=0;
 svg.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.pointerType==='mouse')return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,code:e.target.closest('[data-code]')?.dataset.code||null,moved:false});
  if(pointers.size>=2){pinching=true;afterPinch=true;previousPinchDistance=0;}
  try{svg.setPointerCapture(e.pointerId)}catch(_){}
  svg.classList.add('is-grabbing');
 });
 svg.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  const info=pointers.get(e.pointerId),old={x:info.x,y:info.y};
  const movement=Math.hypot(e.clientX-info.sx,e.clientY-info.sy);
  if(movement>6)info.moved=true;
  if(pointers.size>=2){
   info.x=e.clientX;info.y=e.clientY;
   const [p1,p2]=[...pointers.values()];const distance=Math.hypot(p1.x-p2.x,p1.y-p2.y);
   if(previousPinchDistance>0&&distance>0){const center=mapPoint((p1.x+p2.x)/2,(p1.y+p2.y)/2);mapZoom(distance/previousPinchDistance,center)}
   previousPinchDistance=distance;return;
  }
  if(info.moved&&!pinching){
   const prior=mapPoint(old.x,old.y),next=mapPoint(e.clientX,e.clientY);
   mapBox(mapView.x+prior.x-next.x,mapView.y+prior.y-next.y,mapView.w);
  }
  info.x=e.clientX;info.y=e.clientY;
 });
 const finish=e=>{
  const info=pointers.get(e.pointerId);if(!info)return;
  if(!info.moved&&!pinching&&!afterPinch&&info.code&&e.type==='pointerup')mapSelect(info.code);
  pointers.delete(e.pointerId);
  if(pointers.size<2){pinching=false;previousPinchDistance=0;}
  if(pointers.size===0){afterPinch=false;svg.classList.remove('is-grabbing')}
 };
 svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
 svg.addEventListener('wheel',e=>{
  if(!e.ctrlKey)return;
  e.preventDefault();mapZoom(e.deltaY>0?0.85:1.15,mapPoint(e.clientX,e.clientY));
 },{passive:false});
}

function updateCounts(){
 for(const [id,val] of [['fm-total-fav',mySaved().length],['fm-total-visited',get(VISITED).length],['fm-total-wish',get(WISH).length]]){
 const node=document.getElementById(id);if(node)node.textContent=String(val)
 }
}
function toggleCountry(key,code){if(!currentUid){location.href='/il-mio-spazio.html#profilo';return;}if(cloudLoading){notify('Attendi il caricamento dei dati.');return;}let list=get(key);list=list.includes(code)?list.filter(x=>x!==code):[...list,code];if(put(key,list)){renderCountries();updateCounts()}}
function renderCountries(){
 const root=document.getElementById('fm-country-list');if(!root)return;
 const visited=new Set(get(VISITED)),wish=new Set(get(WISH));let q=(document.getElementById('fm-country-search')?.value||'').toLocaleLowerCase('it').trim();
 let view=document.getElementById('fm-country-view')?.value||'all';root.replaceChildren();let matched=0;
 for(const [code,name] of countries){
  if(q&&!name.toLocaleLowerCase('it').includes(q))continue;
  if(view==='visited'&&!visited.has(code))continue;if(view==='wish'&&!wish.has(code))continue;
  matched++;const row=mk('div','fm-country-row');const label=mk('span','fm-country-label',flag(code)+'  '+name);row.append(label);
  const actions=mk('div','fm-country-actions');
  for(const [key,activeLabel,inactiveLabel,active] of [[VISITED,'✓ Visitato','Visitato',visited.has(code)],[WISH,'★ Sogno','Da visitare',wish.has(code)]]){
    const button=mk('button','fm-country-action'+(active?' is-active':''),active?activeLabel:inactiveLabel);button.type='button';button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',(active?'Rimuovi da ':'Aggiungi a ')+(key===VISITED?'Paesi visitati: ':'Da visitare: ')+name);button.addEventListener('click',()=>toggleCountry(key,code));actions.append(button)
  }
  row.append(actions);
  if(mapReady&&mapNodes.has(code)){
   const viewButton=mk('button','fm-country-map-link','⌖ Mappa');viewButton.type='button';viewButton.title='Mostra '+name+' sulla cartina';viewButton.setAttribute('aria-label','Mostra '+name+' sulla mappa');viewButton.addEventListener('click',()=>mapFocus(code));row.append(viewButton);
  }
  root.append(row)
 }
 if(!matched)root.append(mk('p','fm-empty','Nessun Paese trovato con questi filtri.'));
 const total=document.getElementById('fm-country-count');if(total)total.textContent=matched+' Paesi e territori';
 updateMapColors();
}
function setupBackup(){
 const exportButton=document.getElementById('fm-export');if(exportButton)exportButton.addEventListener('click',()=>{if(!currentUid){notify('Accedi prima di esportare i dati.');return;}
  const data={app:'Fuori Mappa',version:1,saved:get(FAV),visited:get(VISITED),wish:get(WISH)};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='fuori-mappa-i-miei-viaggi.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
 });
 const inp=document.getElementById('fm-import');if(inp)inp.addEventListener('change',async()=>{
  try{if(!currentUid)throw Error('Account necessario');if(cloudLoading)throw Error('Caricamento in corso');const file=inp.files?.[0];if(!file)return;if(file.size>1500000)throw Error('File troppo grande');const obj=JSON.parse(await file.text());if(obj.app!=='Fuori Mappa'||obj.version!==1||!Array.isArray(obj.saved)||!Array.isArray(obj.visited)||!Array.isArray(obj.wish))throw Error('Formato non valido');
  const validCodes=new Set(countries.map(x=>x[0]));const favs=obj.saved.filter(x=>x&&typeof x.title==='string'&&typeof x.href==='string'&&norm(x.href)).slice(0,500).map(x=>({title:x.title.slice(0,150),href:norm(x.href),subtitle:String(x.subtitle||'').slice(0,350),img:safePath(x.img)||''}));
  const vis=[...new Set(obj.visited.filter(x=>validCodes.has(x)))],wish=[...new Set(obj.wish.filter(x=>validCodes.has(x)))];
  if(!window.confirm('Importare il backup? Sostituirà preferiti e passaporto salvati su questo dispositivo.'))return;
  if(put(FAV,favs)&&put(VISITED,vis)&&put(WISH,wish)){refreshButtons();renderSaved();renderCountries();updateCounts();notify('Backup importato correttamente.')} 
  }catch(e){notify('Non è stato possibile importare il backup: formato non valido.')}finally{inp.value=''}
 });
}

const snapshot=()=>({saved:get(FAV),visited:get(VISITED),wish:get(WISH)});
const writeCached=(data)=>{for(const [key,rows] of [[FAV,data.saved],[VISITED,data.visited],[WISH,data.wish]]){
  localStorage.setItem(fullKey(key),JSON.stringify(Array.isArray(rows)?rows:[]));
 }};
const refresh=()=>{refreshButtons();renderSaved();renderCountries();updateCounts();};
const dirtyKey=id=>'fm-cloud-dirty::'+id;
function scheduleSync(){
 if(!currentUid||cloudLoading)return;
 try{localStorage.setItem(dirtyKey(currentUid),'1')}catch(_){}
 clearTimeout(saveTimeout);
 saveTimeout=setTimeout(()=>syncCloud(currentUid),600);
}
function syncCloud(uid){
 queue=queue.catch(()=>{}).then(async()=>{
  if(!uid||uid!==currentUid||cloudLoading)return;
  const client=window.FMAuth?.getClient();if(!client)return;
  const data=snapshot();syncing=true;uiSync('Sincronizzazione in corso…');
  try{
   const {error}=await client.from('fm_user_data').upsert({user_id:uid,saved:data.saved,visited:data.visited,wish:data.wish,updated_at:new Date().toISOString()},{onConflict:'user_id'});
   if(error)throw error;
   if(uid===currentUid){localStorage.removeItem(dirtyKey(uid));uiSync('Preferiti e passaporto sincronizzati ✓');}
  }catch(e){if(uid===currentUid)uiSync('Non sincronizzato: dati conservati su questo dispositivo. '+String(e.message||''));}
  finally{syncing=false;}
 });return queue;
}
async function switchAccount(user){
 const uid=user?.id||null;
 if(uid===currentUid)return;
 clearTimeout(saveTimeout);const ver=++requestVersion;
 const old=currentUid;
 if(!uid){
   if(old&&!localStorage.getItem(dirtyKey(old))){
     for(const k of [FAV,VISITED,WISH])localStorage.removeItem(k+'::'+old);
   }
   currentUid=null;markLoading(false);refresh();return;
 }
 currentUid=uid;markLoading(true);refresh();uiSync('Caricamento del tuo spazio personale…');
 const client=window.FMAuth?.getClient();if(!client){markLoading(false);uiSync('Impossibile contattare Supabase.');return;}
 try{
   const dirty=localStorage.getItem(dirtyKey(uid))==='1';
   if(dirty){
     markLoading(false);refresh();uiSync('Ripristino delle modifiche locali non ancora sincronizzate…');await syncCloud(uid);return;
   }
   const {data,error}=await client.from('fm_user_data').select('saved,visited,wish').eq('user_id',uid).maybeSingle();
   if(error)throw error;
   if(ver!==requestVersion||currentUid!==uid)return;
   if(data){writeCached(data);markLoading(false);refresh();uiSync('Il tuo passaporto e i preferiti sono sincronizzati ✓');}
   else{
      // Nuovo account: il passaporto parte vuoto. Nessun dato anonimo viene importato.
      writeCached({saved:[],visited:[],wish:[]});markLoading(false);refresh();scheduleSync();
      uiSync('Account pronto. Ora puoi salvare itinerari e iniziare il passaporto.');
   }
 }catch(e){
   if(ver!==requestVersion)return;
   markLoading(false);refresh();uiSync('Database non ancora pronto: '+String(e.message||e)+'. I dati restano su questo dispositivo.');
 }
}
function clearDeletedUserData(uid){
 if(!uid||uid!==currentUid)return;
 clearTimeout(saveTimeout);requestVersion++;
 for(const k of [FAV,VISITED,WISH]){
  try{localStorage.removeItem(k+'::'+uid);localStorage.removeItem(k);}catch(_){}
 }
 try{localStorage.removeItem(dirtyKey(uid));}catch(_){}
 currentUid=null;markLoading(false);refresh();uiSync('');
}
window.FMPersonal={hasUnsynced:()=>!!(currentUid&&localStorage.getItem(dirtyKey(currentUid))),clearDeletedUserData};
function setupAuthSync(){
 window.addEventListener('fm-auth-changed',event=>switchAccount(event.detail?.user||null));
 const readAuth=()=>{
   if(window.FMAuth?.ready){
     window.FMAuth.ready.then(user=>switchAccount(user));
   }else{
     notify('Non è stato possibile verificare il tuo account. Ricarica la pagina.');
   }
 };
 // La homepage carica solo fm-personale.js; carichiamo la sessione anche lì.
 if(window.FMAuth?.ready){readAuth();return;}
 const script=document.createElement('script');
 script.src='/fm-auth.js';
 script.async=true;
 script.onload=readAuth;
 script.onerror=()=>notify('Connessione al profilo non disponibile: riprova online.');
 document.head.appendChild(script);
}

function init(){
 // Le preferenze anonime della vecchia versione non devono essere utilizzate nella nuova app.
 try{for(const key of [FAV,VISITED,WISH])localStorage.removeItem(key);}catch(_){}
 enhanceCards();initPassportMap();renderSaved();renderCountries();updateCounts();setupBackup();setupAuthSync();
 const search=document.getElementById('fm-country-search');if(search)search.addEventListener('input',renderCountries);
 const filter=document.getElementById('fm-country-view');if(filter)filter.addEventListener('change',renderCountries);
 if(!storageOk)notify('Attenzione: il salvataggio locale non è disponibile in questa modalità.');
 window.addEventListener('storage',e=>{if([FAV,VISITED,WISH].includes(e.key)||[FAV,VISITED,WISH].some(k=>e.key===fullKey(k))){refreshButtons();renderSaved();renderCountries();updateCounts()}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
