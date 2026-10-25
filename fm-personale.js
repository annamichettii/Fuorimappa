/* Fuori Mappa · dati locali · niente account o tracciamento (v1) */
(()=>{
'use strict';
const PREFIX='fm-personal-v1';
const FAV=PREFIX+'-saved',VISITED=PREFIX+'-visited',WISH=PREFIX+'-wish';
const storageOk=(()=>{try{localStorage.setItem(PREFIX+'-test','1');localStorage.removeItem(PREFIX+'-test');return true}catch(e){return false}})();
const notify=(msg)=>{const el=document.getElementById('fm-personal-status');if(el)el.textContent=msg;};
const get=(key)=>{if(!storageOk)return [];try{let v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}};
const put=(key,list)=>{if(!storageOk){notify('Il salvataggio locale non è disponibile su questo dispositivo.');return false}try{localStorage.setItem(key,JSON.stringify(list));return true}catch(e){notify('Non è stato possibile salvare sul dispositivo.');return false}};
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
function toggleCountry(key,code){let list=get(key);list=list.includes(code)?list.filter(x=>x!==code):[...list,code];if(put(key,list)){renderCountries();updateCounts()}}
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
  try{const file=inp.files?.[0];if(!file)return;if(file.size>1500000)throw Error('File troppo grande');const obj=JSON.parse(await file.text());if(obj.app!=='Fuori Mappa'||obj.version!==1||!Array.isArray(obj.saved)||!Array.isArray(obj.visited)||!Array.isArray(obj.wish))throw Error('Formato non valido');
  const validCodes=new Set(countries.map(x=>x[0]));const favs=obj.saved.filter(x=>x&&typeof x.title==='string'&&typeof x.href==='string'&&norm(x.href)).slice(0,500).map(x=>({title:x.title.slice(0,150),href:norm(x.href),subtitle:String(x.subtitle||'').slice(0,350),img:safePath(x.img)||''}));
  const vis=[...new Set(obj.visited.filter(x=>validCodes.has(x)))],wish=[...new Set(obj.wish.filter(x=>validCodes.has(x)))];
  if(!window.confirm('Importare il backup? Sostituirà preferiti e passaporto salvati su questo dispositivo.'))return;
  if(put(FAV,favs)&&put(VISITED,vis)&&put(WISH,wish)){refreshButtons();renderSaved();renderCountries();updateCounts();notify('Backup importato correttamente.')} 
  }catch(e){notify('Non è stato possibile importare il backup: formato non valido.')}finally{inp.value=''}
 });
}
function init(){enhanceCards();renderSaved();renderCountries();updateCounts();setupBackup();
 const search=document.getElementById('fm-country-search');if(search)search.addEventListener('input',renderCountries);
 const filter=document.getElementById('fm-country-view');if(filter)filter.addEventListener('change',renderCountries);
 if(!storageOk)notify('Attenzione: il salvataggio locale non è disponibile in questa modalità.');
 window.addEventListener('storage',e=>{if([FAV,VISITED,WISH].includes(e.key)){refreshButtons();renderSaved();renderCountries();updateCounts()}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
