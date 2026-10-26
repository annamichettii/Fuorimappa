/* Fuori Mappa · OneSignal Web Push v16 · accesso PWA, richiesta facoltativa post-login.
   OneSignal App ID: PUBBLICO. Non mettere mai la API key di invio nel codice client.
   Le notifiche non sono la newsletter email: sono opzionali e si gestiscono qui. */
(()=>{
'use strict';
if(!document.documentElement.classList.contains('fm-is-app'))return;
const APP_ID='08f8793c-9b02-4986-a8a1-f71234c02513';
const PREFIX='fm-push-choice-v1:';
const $=id=>document.getElementById(id);
let user=null,api=null,apiStarted=false,apiReady=false,loading=null,linkedUserId=null;
let initFailed=false,working=false,modalUser=null;
const consentInSession=new Set();
function choice(uid){try{return localStorage.getItem(PREFIX+uid)||'';}catch(_){return '';}}
function setChoice(uid,value){try{localStorage.setItem(PREFIX+uid,value);}catch(_){}}
function iosDevice(){return /iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);}
function standalone(){return navigator.standalone===true||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches;}
function tell(message){if($('fm-push-status'))$('fm-push-status').textContent=message;}
function tellModal(message){if($('fm-push-welcome-status'))$('fm-push-welcome-status').textContent=message;}
function permission(){return (typeof Notification!=='undefined'&&Notification.permission)||'default';}
function supported(){return typeof isSecureContext==='boolean'&&isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window;}
function pendingPermission(){return permission()==='default';}
function currentOn(){return user&&choice(user.id)==='yes';}
function update(){
 const b=$('fm-push-toggle');if(!b||!user)return;
 const on=currentOn();
 b.textContent=on?'Disattiva notifiche':'Attiva notifiche';b.disabled=working;
 if(iosDevice()&&!standalone())tell('Su iPhone installa Fuori Mappa nella schermata Home e aprila dall’icona per ricevere le notifiche.');
 else if(!supported())tell('Questo browser o dispositivo non supporta le notifiche web.');
 else if(permission()==='denied')tell('Le notifiche sono bloccate nelle impostazioni del dispositivo/browser: autorizzale da lì.');
 else if(on&&api?.User?.PushSubscription?.optedIn)tell('Notifiche attive! Ti avviseremo quando pubblicheremo un nuovo itinerario.');
 else if(on)tell('Hai richiesto le notifiche: se non arrivano, verifica il permesso nelle impostazioni del dispositivo.');
 else tell('Le notifiche sono disattivate. Puoi attivarle quando vuoi.');
}
function close(){const el=$('fm-push-welcome');if(el)el.hidden=true;modalUser=null;tellModal('');}
function showWelcome(){
 if(!user||choice(user.id))return;
 if(iosDevice()&&!standalone())return; // solo app installata iOS
 if(!supported())return;
 const el=$('fm-push-welcome');if(!el)return;
 modalUser=user.id;el.hidden=false;
 $('fm-push-allow')?.focus({preventScroll:true});
}
function loadSDK(){
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
   window.OneSignalDeferred=window.OneSignalDeferred||[];
   window.OneSignalDeferred.push(async function(OneSignal){
     api=OneSignal;
     try{
       // Vietata la raccolta OneSignal prima della scelta positiva dell'utente.
       OneSignal.setConsentRequired(true);
       if(user&&(choice(user.id)==='yes'||consentInSession.has(user.id)))OneSignal.setConsentGiven(true);
       apiStarted=true;
       await OneSignal.init({
         appId:APP_ID,
         serviceWorkerPath:'push/onesignal/OneSignalSDKWorker.js',
         serviceWorkerParam:{scope:'/push/onesignal/'},
         notifyButton:{enable:false},
         requiresUserPrivacyConsent:true,
         welcomeNotification:{disable:true}
       });
       apiReady=true;initFailed=false;
       OneSignal.Notifications.addEventListener('permissionChange',()=>update());
       OneSignal.User.PushSubscription.addEventListener('change',()=>update());
       if(user&&choice(user.id)==='yes')await linkUser(user.id);
       resolve(OneSignal);
     }catch(err){initFailed=true;console.warn('Fuori Mappa notifiche: inizializzazione non riuscita',err);reject(err);}
   });
   const script=document.createElement('script');
   script.src='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';script.async=true;
   script.onerror=()=>{initFailed=true;reject(Error('SDK OneSignal non raggiungibile'));};
   document.head.append(script);
 });
 loading.catch(()=>{loading=null;});
 return loading;
}
async function linkUser(uid){
 if(!apiReady||!api||!user||uid!==user.id||choice(uid)!=='yes')return;
 if(linkedUserId===uid)return;
 try{await api.login(uid);linkedUserId=uid;
   if(api.User.PushSubscription.id && permission()==='granted')await api.User.PushSubscription.optIn();
 }catch(e){console.warn('Fuori Mappa: associazione delle notifiche non riuscita',e);}
 update();
}
async function activate(){
 if(!user||working)return;
 const uid=user.id;
 if(iosDevice()&&!standalone()){tell('Su iPhone apri la versione installata di Fuori Mappa, non Safari.');tellModal('Apri Fuori Mappa dalla schermata Home.');return;}
 if(!supported()){tell('Notifiche non supportate su questo dispositivo.');tellModal('Questo dispositivo non supporta le notifiche web.');return;}
 if(permission()==='denied'){
   tell('Le notifiche sono bloccate. Vai nelle impostazioni del dispositivo o browser per consentirle.');
   tellModal('Le notifiche sono bloccate nelle impostazioni del telefono.');return;
 }
 // La scelta positiva è esplicita e memorizzata solo per questo account sul dispositivo.
 consentInSession.add(uid);
 if(!api){
   // In alcuni browser il caricamento SDK interromperebbe il gesto richiesto da iOS;
   // non fingiamo che il permesso sia stato chiesto: dopo il caricamento un secondo tocco.
   tellModal('Prepariamo le notifiche… poi tocca ancora «Attiva notifiche».');
   tell('Prepariamo il servizio: premi ancora «Attiva notifiche» quando sarà pronto.');
   try{await loadSDK();}catch(_){tellModal('Connessione a OneSignal non riuscita. Riprova.');tell('Connessione notifiche non disponibile: riprova.');return;}
   update();tell('Servizio pronto: premi di nuovo «Attiva notifiche» per la richiesta del telefono.');tellModal('Servizio pronto! Tocca ancora «Attiva notifiche» per consentire le notifiche.');return;
 }
 // Se init è ancora in attesa del consenso, sblocchiamolo ora.
 api.setConsentGiven(true);
 if(!apiReady){
   tellModal('Un istante: premi di nuovo «Attiva notifiche» per autorizzarle.');
   tell('Appena completata la preparazione, premi nuovamente Attiva notifiche.');
   return;
 }
 working=true;update();
 try{
   // La richiesta nativa deve partire direttamente da questo evento click (iOS incluso).
   // Non inserire await prima di requestPermission().
   const native= pendingPermission() ? api.Notifications.requestPermission() : null;
   if(native && typeof native.then==='function')await native;
   if(!user||user.id!==uid)return;
   if(permission()==='granted'){
     setChoice(uid,'yes');
     // Opt-in per le sottoscrizioni già esistenti e identificazione dell'account.
     await api.User.PushSubscription.optIn();
     await linkUser(uid);
     tellModal('Notifiche attivate! 🌍');close();
   }else{
     tellModal('Non hai autorizzato le notifiche. Puoi cambiare idea dal Profilo o dalle impostazioni del telefono.');
     setChoice(uid,'off');consentInSession.delete(uid);
     try{await api.User.PushSubscription.optOut();api.setConsentGiven(false);}catch(_){}
   }
 }catch(e){console.warn('Fuori Mappa: permesso notifiche',e);tellModal('Non è stato possibile attivare le notifiche. Riprova dal Profilo.');setChoice(uid,'off');consentInSession.delete(uid);try{api.setConsentGiven(false);}catch(_){}}
 finally{working=false;update();}
}
async function deactivate(){
 if(!user||working)return;
 const uid=user.id;setChoice(uid,'off');consentInSession.delete(uid);close();
 if(api){
   try{if(apiReady)await api.User.PushSubscription.optOut(); api.setConsentGiven(false);}catch(e){console.warn('Fuori Mappa: disattivazione notifiche',e);}
 }
 update();tell('Notifiche disattivate per questo dispositivo.');
}
async function onAuth(next){
 const old=user?.id||null;user=next||null;
 if(!user){
   close();consentInSession.clear();update();
   if(api){try{if(apiReady){await api.User.PushSubscription.optOut();await api.logout();}api.setConsentGiven(false);}catch(_){}}
   linkedUserId=null;return;
 }
 if(old!==user.id){linkedUserId=null;
   // Se l'account aveva già consentito a OneSignal, ripristina la sottoscrizione.
   if(choice(user.id)==='yes'){
     try{const os=await loadSDK();if(user&&user.id===next.id){os.setConsentGiven(true);await linkUser(user.id);}}catch(_){tell('Le notifiche non sono raggiungibili: riprova dal Profilo.');}
   }
   // Non scaricare OneSignal prima del consenso: nemmeno una chiamata al CDN.
   if(user&&user.id===next.id)showWelcome();
 }
 update();
}

// Assicura che la sottoscrizione su questo dispositivo sia disattivata PRIMA di uscire.
// Il cancellamento dell'utente su TUTTI i dispositivi avviene nella Edge Function protetta.
async function disconnectForExit(options={}){
 const uid=user?.id||window.FMAuth?.getUser?.()?.id||null;
 if(!uid)return;
 const wasEnabled=choice(uid)==='yes';
 if(wasEnabled && !apiReady){
   // Il consenso era gia' stato dato: e' lecito caricare il servizio per revocarlo.
   await loadSDK();
 }
 if(apiReady&&api){
   if(wasEnabled||api.User?.PushSubscription?.optedIn){
     await api.User.PushSubscription.optOut();
   }
   await api.logout();
   api.setConsentGiven(false);
 }
 linkedUserId=null;
 consentInSession.delete(uid);
 if(options.forgetChoice){
   try{localStorage.removeItem(PREFIX+uid);}catch(_){/* memoria disabilitata */}
 }
}
window.FMNotifications={disconnectForExit};

function attach(){
 const toggle=$('fm-push-toggle'),yes=$('fm-push-allow'),later=$('fm-push-later');
 if(!toggle||!yes||!later)return;
 toggle.addEventListener('click',()=>currentOn()?deactivate():activate());
 yes.addEventListener('click',()=>activate());
 later.addEventListener('click',()=>{if(user)setChoice(user.id,'later');close();update();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('fm-push-welcome')?.hidden){if(user)setChoice(user.id,'later');close();update();}});
 window.addEventListener('fm-auth-changed',e=>{onAuth(e.detail?.user||null).catch(()=>{});});
 Promise.resolve(window.FMAuth?.ready).then(()=>onAuth(window.FMAuth?.getUser?.()||null)).catch(()=>{});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
})();
