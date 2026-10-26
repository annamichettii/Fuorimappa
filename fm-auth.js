/* Fuori Mappa · Login Supabase · solo interfaccia PWA installata.
   La publishable key e l'URL del progetto sono pubblici per definizione.
   Mai inserire service_role, database password, Google OAuth secret qui. */
(()=>{
'use strict';
if(!document.documentElement.classList.contains('fm-is-app')) return;
const url='https://otyhjkwysfssmipfhwzn.supabase.co';
const key='sb_publishable_B3aPB9yJb-IarCfzD6ZZkw_E8yAVwlO';
let client=null, currentUser=null;
let readyResolve;
const ready=new Promise(resolve=>{readyResolve=resolve;});
window.FMAuth={ready,getUser:()=>currentUser,getClient:()=>client};
const $=id=>document.getElementById(id);
function status(message){const n=$('fm-auth-status');if(n)n.textContent=message||'';}
const resetNoticeKey='fm-reset-request-v1';
function showResetNotice(scroll=false){
 const el=$('fm-reset-confirmation');if(!el)return;
 el.hidden=false;
 if(scroll){el.scrollIntoView({behavior:'smooth',block:'center'});el.focus({preventScroll:true});}
}
function hideResetNotice(clearStored=false){
 const el=$('fm-reset-confirmation');if(el)el.hidden=true;
 if(clearStored){try{localStorage.removeItem(resetNoticeKey);}catch(_){}}
}
function updateUI(){
 const user=!!currentUser;
 if(user){
  try{localStorage.removeItem('fm-pending-email-v1');}catch(_){}
  hideResetNotice(true);
 }
 const guest=$('fm-account-guest'), account=$('fm-account-user');
 if(guest)guest.hidden=user;
 if(account)account.hidden=!user;
 if(user&&$('fm-account-email'))$('fm-account-email').textContent=currentUser.email||'Account collegato';
 if(user&&$('fm-profile-name'))$('fm-profile-name').textContent='Ciao, '+(currentUser.user_metadata?.full_name||currentUser.user_metadata?.name||currentUser.email?.split('@')[0]||'viaggiatore')+' ✦';
 document.querySelectorAll('.fm-protected').forEach(node=>{node.hidden=!user;});
 const guestGate=$('fm-guest-gate');if(guestGate)guestGate.hidden=user;
 if(!user&&$('fm-cloud-status'))$('fm-cloud-status').textContent='';
}
function announce(){updateUI();window.dispatchEvent(new CustomEvent('fm-auth-changed',{detail:{user:currentUser}}));}
function setUser(u){
 const before=currentUser?.id||null, after=u?.id||null;
 currentUser=u||null;
 updateUI();
 if(before!==after)announce();
}
function errorMessage(err){
 const m=String(err?.message||err||'Errore sconosciuto');
 if(/invalid login credentials/i.test(m))return 'Email o password non corretti, oppure indirizzo non ancora verificato.';
 if(/email not confirmed/i.test(m))return 'Devi prima verificare l’email che hai ricevuto.';
 if(/rate limit/i.test(m))return 'Troppi tentativi: riprova più tardi.';
 if(/email address not authorized/i.test(m))return 'Supabase non è ancora configurato per inviare email pubbliche: occorre collegare il servizio SMTP.';
 return m.length>190?m.slice(0,190):m;
}
function busy(form,on){if(!form)return;form.querySelectorAll('button[type=submit]').forEach(b=>{b.disabled=on;});}
function mode(signup){$('fm-login-form').hidden=signup;$('fm-signup-form').hidden=!signup;$('fm-show-login').setAttribute('aria-pressed',String(!signup));$('fm-show-signup').setAttribute('aria-pressed',String(signup));if(signup&&$('fm-signup-confirmation'))$('fm-signup-confirmation').hidden=true;if(signup)hideResetNotice(true);status('');}
function guardPersonalLinks(){
 document.querySelectorAll('.fm-app-tabs a[href*="#preferiti"], .fm-app-tabs a[href*="#passaporto"]').forEach(a=>{
  a.addEventListener('click',e=>{
   if(currentUser)return;
   e.preventDefault();location.hash='#profilo';
   $('fm-account-shell')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
 });
}
function moveGuestToProfile(){
 if(!currentUser&&['#preferiti','#passaporto'].includes(location.hash)){
   history.replaceState(null,'',location.pathname+'#profilo');
   $('fm-account-shell')?.scrollIntoView({behavior:'auto',block:'start'});
 }
}
function setupForms(){
 if(!$('fm-account-guest'))return;
 try{
   const resetAt=Number(localStorage.getItem(resetNoticeKey));
   if(resetAt&&Date.now()-resetAt<30*60*1000){showResetNotice();}
   else localStorage.removeItem(resetNoticeKey);
 }catch(_){}
 try{
   const time=Number(localStorage.getItem('fm-pending-email-v1'));
   if(time&&Date.now()-time<48*60*60*1000){
     const box=$('fm-signup-confirmation');if(box){box.hidden=false;}
     const email=$('fm-signup-email');if(email)email.textContent='che hai indicato';
   }else localStorage.removeItem('fm-pending-email-v1');
 }catch(_){}
 $('fm-show-login').addEventListener('click',()=>mode(false));
 $('fm-show-signup').addEventListener('click',()=>mode(true));
 $('fm-login-google').addEventListener('click',async()=>{
  if(!client){status('Connessione in corso, riprova.');return;}
  status('Apertura accesso Google…');
  try{const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://www.fuorimappa.it/il-mio-spazio.html'}});if(error)throw error;}
  catch(e){status('Google: '+errorMessage(e));}
 });
 $('fm-login-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!client)return;
  const form=e.currentTarget, data=new FormData(form);
  busy(form,true);status('Accesso in corso…');
  try{const {error}=await client.auth.signInWithPassword({email:String(data.get('email')).trim(),password:String(data.get('password'))});if(error)throw error;form.reset();status('Accesso effettuato!');}
  catch(err){status(errorMessage(err));}finally{busy(form,false);}
 });
 $('fm-signup-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!client)return;
  const form=e.currentTarget,data=new FormData(form);
  const password=String(data.get('password'));
  if(password.length<10){status('Usa una password di almeno 10 caratteri.');return;}
  if(password!==String(data.get('confirm'))){status('Le due password non coincidono.');return;}
  busy(form,true);status('Registrazione in corso…');
  try{
    const email=String(data.get('email')).trim();
    const {data:out,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:'https://www.fuorimappa.it/il-mio-spazio.html'}});
    if(error)throw error;
    form.reset();
    if(out.session){
      status('Account creato e accesso effettuato!');
    }else{
      // Conferma ben visibile, anche dopo il ritorno alla scheda "Accedi".
      // Non svelare se un'email è già registrata: Supabase può offuscare questa informazione.
      mode(false);
      try{localStorage.setItem('fm-pending-email-v1',String(Date.now()));}catch(_){}
      const notice=$('fm-signup-confirmation');
      if(notice){
        $('fm-signup-email').textContent=email;
        notice.hidden=false;
        notice.scrollIntoView({behavior:'smooth',block:'center'});
      }
      $('fm-login-form').querySelector('input[type=email]').value=email;
      status('Controlla la posta (anche Spam/Indesiderata). Dopo aver cliccato sul link, torna nell’app e accedi con la password.');
    }
  }catch(err){status(errorMessage(err));}finally{busy(form,false);}
 });
 $('fm-password-forgot').addEventListener('click',async()=>{
   if(!client){status('Connessione in corso, riprova tra poco.');return;}
   const input=$('fm-login-form').querySelector('input[type=email]');
   const email=(input.value||'').trim();
   if(!email){status('Inserisci prima la tua email nel campo di accesso.');input.focus();return;}
   const button=$('fm-password-forgot');
   button.disabled=true;
   hideResetNotice(true);
   status('Richiesta di recupero in corso…');
   try{
     const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:'https://www.fuorimappa.it/recupera-password.html'});
     if(error)throw error;
     try{localStorage.setItem(resetNoticeKey,String(Date.now()));}catch(_){}
     showResetNotice(true);
     status('Controlla la tua posta, anche Spam / Posta indesiderata.');
   }catch(err){status(errorMessage(err));}
   finally{button.disabled=false;}
 });
 $('fm-logout').addEventListener('click',async()=>{
   if(!client)return;status('Uscita in corso…');
   const dirty=window.FMPersonal?.hasUnsynced?.();
   if(dirty&&!confirm('Ci sono modifiche non ancora sincronizzate. Vuoi uscire comunque?')){status('Uscita annullata.');return;}
   const {error}=await client.auth.signOut();status(error?errorMessage(error):'Hai effettuato la disconnessione.');
 });
 const deleteButton=$('fm-delete-account');
 if(deleteButton)deleteButton.addEventListener('click',async()=>{
   if(!client||!currentUser){status('Accedi prima di eliminare il tuo account.');return;}
   if(window.FMPersonal?.hasUnsynced?.()){
     status('Ci sono modifiche non sincronizzate: attendi o esporta prima i tuoi dati.');return;
   }
   if(!confirm('Vuoi eliminare il tuo account Fuori Mappa e tutti i suoi dati online? Non potrai recuperarli.'))return;
   const input=prompt('Per confermare, scrivi ELIMINA in maiuscolo.');
   if(input!=='ELIMINA'){status('Eliminazione annullata.');return;}
   deleteButton.disabled=true;status('Eliminazione protetta in corso…');
   const oldId=currentUser.id;
   try{
     const {data,error}=await client.functions.invoke('fm-delete-account',{body:{confirm:'ELIMINA'}});
     if(error)throw error;
     if(!data?.ok)throw Error('La richiesta non è stata confermata dal server.');
     window.FMPersonal?.clearDeletedUserData?.(oldId);
     const {error:exitError}=await client.auth.signOut({scope:'local'});
     if(exitError){console.warn('Logout locale dopo eliminazione:',exitError);}
     setUser(null);
     status('Account eliminato. I dati locali di Fuori Mappa sono stati cancellati da questo dispositivo.');
   }catch(err){status('Eliminazione non riuscita. Controlla che la funzione protetta sia stata attivata su Supabase. '+errorMessage(err));}
   finally{deleteButton.disabled=false;}
 });
}
function injectSDK(){return new Promise((resolve,reject)=>{
 if(window.supabase?.createClient){resolve();return;}
 const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';script.async=true;
 script.onload=()=>window.supabase?.createClient?resolve():reject(Error('Libreria Supabase non disponibile'));
 script.onerror=()=>reject(Error('Connessione alla libreria Supabase non riuscita'));document.head.append(script);
});}
async function init(){
 setupForms();guardPersonalLinks();status('Collegamento sicuro in corso…');
 try{
  await injectSDK();
  client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit',storageKey:'fuorimappa.auth.v1'}});
  client.auth.onAuthStateChange((event,session)=>{
   queueMicrotask(()=>{setUser(session?.user||null);if(event==='PASSWORD_RECOVERY')status('Per cambiare password usa il link ricevuto via email.');});
  });
  const {data,error}=await client.auth.getSession();if(error)throw error;
  setUser(data?.session?.user||null);moveGuestToProfile();readyResolve(currentUser);status('');
 }catch(err){readyResolve(null);status('Accesso non disponibile al momento: '+errorMessage(err));}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
