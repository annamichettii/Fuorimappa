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
function updateUI(){
 const user=!!currentUser;
 const guest=$('fm-account-guest'), account=$('fm-account-user');
 if(guest)guest.hidden=user;
 if(account)account.hidden=!user;
 if(user&&$('fm-account-email'))$('fm-account-email').textContent=currentUser.email||'Account collegato';
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
function mode(signup){$('fm-login-form').hidden=signup;$('fm-signup-form').hidden=!signup;$('fm-show-login').setAttribute('aria-pressed',String(!signup));$('fm-show-signup').setAttribute('aria-pressed',String(signup));status('');}
function setupForms(){
 if(!$('fm-account-guest'))return;
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
    const {data:out,error}=await client.auth.signUp({email:String(data.get('email')).trim(),password,options:{emailRedirectTo:'https://www.fuorimappa.it/il-mio-spazio.html'}});
    if(error)throw error;
    form.reset();
    status(out.session?'Account creato e accesso effettuato.':'Controlla la posta e conferma l’indirizzo. Poi torna nell’app e accedi con email e password.');
  }catch(err){status(errorMessage(err));}finally{busy(form,false);}
 });
 $('fm-password-forgot').addEventListener('click',async()=>{
   if(!client)return;
   const input=$('fm-login-form').querySelector('input[type=email]');
   const email=(input.value||'').trim();
   if(!email){status('Inserisci prima la tua email nel campo di accesso.');input.focus();return;}
   try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:'https://www.fuorimappa.it/recupera-password.html'});if(error)throw error;status('Se l’indirizzo è registrato, riceverai un’email con le istruzioni per cambiare password.');}
   catch(err){status(errorMessage(err));}
 });
 $('fm-logout').addEventListener('click',async()=>{
   if(!client)return;status('Uscita in corso…');
   const dirty=window.FMPersonal?.hasUnsynced?.();
   if(dirty&&!confirm('Ci sono modifiche non ancora sincronizzate. Vuoi uscire comunque?')){status('Uscita annullata.');return;}
   const {error}=await client.auth.signOut();status(error?errorMessage(error):'Hai effettuato la disconnessione.');
 });
 $('fm-import-guest').addEventListener('click',()=>{
  if(!currentUser)return;
  if(!window.FMPersonal?.mergeGuest){status('La sincronizzazione si sta ancora preparando.');return;}
  window.FMPersonal.mergeGuest();
 });
}
function injectSDK(){return new Promise((resolve,reject)=>{
 if(window.supabase?.createClient){resolve();return;}
 const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';script.async=true;
 script.onload=()=>window.supabase?.createClient?resolve():reject(Error('Libreria Supabase non disponibile'));
 script.onerror=()=>reject(Error('Connessione alla libreria Supabase non riuscita'));document.head.append(script);
});}
async function init(){
 setupForms();status('Collegamento sicuro in corso…');
 try{
  await injectSDK();
  client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit',storageKey:'fuorimappa.auth.v1'}});
  client.auth.onAuthStateChange((event,session)=>{
   queueMicrotask(()=>{setUser(session?.user||null);if(event==='PASSWORD_RECOVERY')status('Per cambiare password usa il link ricevuto via email.');});
  });
  const {data,error}=await client.auth.getSession();if(error)throw error;
  setUser(data?.session?.user||null);readyResolve(currentUser);status('');
 }catch(err){readyResolve(null);status('Accesso non disponibile al momento: '+errorMessage(err));}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
