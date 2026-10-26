/* Fuori Mappa · dati locali · niente account o tracciamento (v1) */
(()=>{
'use strict';
if (!document.documentElement.classList.contains('fm-is-app')) return;
const PREFIX='fm-personal-v1';
const FAV=PREFIX+'-saved',VISITED=PREFIX+'-visited',WISH=PREFIX+'-wish';
let currentUid=null, cloudLoading=false, syncing=false;
let saveTimeout=null, queue=Promise.resolve(), requestVersion=0;
const fullKey=key=>currentUid?key+'::'+currentUid:key;
const uiSync=(message)=>{const n=document.getElementById('fm-cloud-status');if(n)n.textContent=message;};
const markLoading=on=>{cloudLoading=on;document.documentElement.classList.toggle('fm-cloud-loading',on);};

const storageOk=(()=>{try{localStorage.setItem(PREFIX+'-test','1');localStorage.removeItem(PREFIX+'-test');return true}catch(e){return false}})();
const notify=(msg)=>{const el=document.getElementById('fm-personal-status');if(el)el.textContent=msg;};
const get=(key)=>{if(!storageOk)return [];try{let v=JSON.parse(localStorage.getItem(fullKey(key))||'[]');return Array.isArray(v)?v:[]}catch(e){return []}};
const put=(key,list)=>{if(!storageOk){notify('Il salvataggio locale non è disponibile su questo dispositivo.');return false}try{localStorage.setItem(fullKey(key),JSON.stringify(list));if(currentUid&&!cloudLoading)scheduleSync();return true}catch(e){notify('Non è stato possibile salvare sul dispositivo.');return false}};
const safePath=(s)=>{try{const u=new URL(s,location.href);if(u.origin!==location.origin)return null;return u.pathname+u.search}catch(e){return null}};
const norm=(s)=>{const p=safePath(s);return p?p.split('?')[0]:null};
const mySaved=()=>get(FAV);
function refreshButtons(){
 const items=mySaved();for(const btn of document.querySelectorAll('.fm-save-toggle')){
 const yes=items.some(item=>item.href===btn.dataset.href);btn.setAttribute('aria-pressed',String(yes));btn.textContent=yes?'♥':'♡';btn.title=yes?'Rimuovi dai preferiti':'Aggiungi ai preferiti';
 const card=btn.parentElement?.querySelector('.journey-card h3');btn.setAttribute('aria-label',(yes?'Rimuovi dai preferiti: ':'Salva nei preferiti: ')+(card?.textContent||'itinerario'));
 }
}
function toggleFavorite(item){
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
 if(!rows.length){const p=mk('p','fm-empty','Non hai ancora salvato itinerari. Tocca ♡ sulle cartoline che ti incuriosiscono.');root.append(p);return}
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
function updateCounts(){
 for(const [id,val] of [['fm-total-fav',mySaved().length],['fm-total-visited',get(VISITED).length],['fm-total-wish',get(WISH).length]]){
 const node=document.getElementById(id);if(node)node.textContent=String(val)
 }
}
function toggleCountry(key,code){if(cloudLoading){notify('Attendi il caricamento dei dati.');return;}let list=get(key);list=list.includes(code)?list.filter(x=>x!==code):[...list,code];if(put(key,list)){renderCountries();updateCounts()}}
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
  row.append(actions);root.append(row)
 }
 if(!matched)root.append(mk('p','fm-empty','Nessun Paese trovato con questi filtri.'));
 const total=document.getElementById('fm-country-count');if(total)total.textContent=matched+' Paesi e territori';
}
function setupBackup(){
 const exportButton=document.getElementById('fm-export');if(exportButton)exportButton.addEventListener('click',()=>{
  const data={app:'Fuori Mappa',version:1,saved:get(FAV),visited:get(VISITED),wish:get(WISH)};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='fuori-mappa-i-miei-viaggi.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
 });
 const inp=document.getElementById('fm-import');if(inp)inp.addEventListener('change',async()=>{
  try{if(cloudLoading)throw Error('Caricamento in corso');const file=inp.files?.[0];if(!file)return;if(file.size>1500000)throw Error('File troppo grande');const obj=JSON.parse(await file.text());if(obj.app!=='Fuori Mappa'||obj.version!==1||!Array.isArray(obj.saved)||!Array.isArray(obj.visited)||!Array.isArray(obj.wish))throw Error('Formato non valido');
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
      // First login: automatically copy guest data, but only if this account has no data yet.
      const guest={saved:getGuest(FAV),visited:getGuest(VISITED),wish:getGuest(WISH)};
      writeCached(guest);markLoading(false);refresh();scheduleSync();
      uiSync('Primo accesso: stiamo salvando i tuoi preferiti e passaporto già presenti sul telefono.');
   }
 }catch(e){
   if(ver!==requestVersion)return;
   markLoading(false);refresh();uiSync('Database non ancora pronto: '+String(e.message||e)+'. I dati restano su questo dispositivo.');
 }
}
function getGuest(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch(_){return []}}
async function mergeGuest(){
 if(!currentUid||cloudLoading){notify('Attendi il caricamento dell’account.');return;}
 const guest={saved:getGuest(FAV),visited:getGuest(VISITED),wish:getGuest(WISH)};
 if(!guest.saved.length&&!guest.visited.length&&!guest.wish.length){notify('Non ci sono vecchi dati da importare.');return;}
 if(!confirm('Aggiungere ai tuoi dati dell’account i preferiti e i Paesi che avevi salvato su questo telefono?'))return;
 const all=snapshot();const seen=new Set(all.saved.map(x=>x.href));
 for(const f of guest.saved){if(f&&typeof f.href==='string'&&!seen.has(f.href)){all.saved.push(f);seen.add(f.href)}}
 all.saved=all.saved.slice(0,500);
 all.visited=[...new Set([...all.visited,...guest.visited])].slice(0,300);
 all.wish=[...new Set([...all.wish,...guest.wish])].slice(0,300);
 writeCached(all);refresh();scheduleSync();notify('Dati aggiunti. Sincronizzazione avviata.');
}
window.FMPersonal={hasUnsynced:()=>!!(currentUid&&localStorage.getItem(dirtyKey(currentUid))),mergeGuest};
function setupAuthSync(){
 window.addEventListener('fm-auth-changed',event=>switchAccount(event.detail?.user||null));
 if(window.FMAuth?.ready)window.FMAuth.ready.then(user=>switchAccount(user));
}

function init(){enhanceCards();renderSaved();renderCountries();updateCounts();setupBackup();setupAuthSync();
 const search=document.getElementById('fm-country-search');if(search)search.addEventListener('input',renderCountries);
 const filter=document.getElementById('fm-country-view');if(filter)filter.addEventListener('change',renderCountries);
 if(!storageOk)notify('Attenzione: il salvataggio locale non è disponibile in questa modalità.');
 window.addEventListener('storage',e=>{if([FAV,VISITED,WISH].includes(e.key)||[FAV,VISITED,WISH].some(k=>e.key===fullKey(k))){refreshButtons();renderSaved();renderCountries();updateCounts()}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
