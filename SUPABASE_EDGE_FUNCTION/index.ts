// Fuori Mappa: cancellazione protetta account Supabase + utente OneSignal.
// Secrets Supabase necessari: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ONESIGNAL_REST_API_KEY (stessa App API Key usata per GitHub Actions).
import { createClient } from 'npm:@supabase/supabase-js@2';
const ALLOWED=new Set(['https://www.fuorimappa.it','https://fuorimappa.it']);
const APP_ID='08f8793c-9b02-4986-a8a1-f71234c02513';
const projectUrl=Deno.env.get('SUPABASE_URL')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const onesignalKey=Deno.env.get('ONESIGNAL_REST_API_KEY')||'';
const admin=projectUrl&&serviceKey ? createClient(projectUrl,serviceKey,{
  auth:{autoRefreshToken:false,persistSession:false}
}) : null;
function reply(status:number,body:Record<string,unknown>,origin:string){
  return new Response(JSON.stringify(body),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Vary':'Origin'
  }});
}
Deno.serve(async req=>{
  const origin=req.headers.get('origin')||'';
  if(!ALLOWED.has(origin))return new Response('Forbidden origin',{status:403});
  if(req.method==='OPTIONS')return reply(200,{ok:true},origin);
  if(req.method!=='POST')return reply(405,{error:'Method not allowed'},origin);
  try{
    if(!admin||!onesignalKey)return reply(503,{error:'Server not configured'},origin);
    const header=req.headers.get('authorization')||'';
    if(!header.startsWith('Bearer '))return reply(401,{error:'Login required'},origin);
    const token=header.slice(7).trim();
    const {data:{user},error:authError}=await admin.auth.getUser(token);
    if(authError||!user)return reply(401,{error:'Invalid session'},origin);
    const body=await req.json().catch(()=>null);
    if(body?.confirm!=='ELIMINA')return reply(400,{error:'Confirmation required'},origin);
    // Si usa solo l'ID ottenuto da JWT autenticato, MAI un ID inviato dal browser.
    // 404 = l'account non aveva notifiche, ed e' una condizione legittima.
    const endpoint=`https://api.onesignal.com/apps/${APP_ID}/users/by/external_id/${encodeURIComponent(user.id)}`;
    let response:Response;
    try{
      response=await fetch(endpoint,{
        method:'DELETE',
        headers:{'Authorization':`Key ${onesignalKey}`,'Accept':'application/json'},
        signal:AbortSignal.timeout(12000)
      });
    }catch(e){
      console.error('OneSignal non raggiungibile:',e);
      return reply(503,{error:'Push cleanup temporarily unavailable'},origin);
    }
    if(!response.ok&&response.status!==404){
      console.error('OneSignal cleanup HTTP',response.status);
      return reply(502,{error:'Push cleanup failed'},origin);
    }
    const {error:deleteError}=await admin.auth.admin.deleteUser(user.id);
    if(deleteError){
      console.error('Supabase account deletion failed',deleteError.message);
      return reply(500,{error:'Account deletion failed'},origin);
    }
    return reply(200,{ok:true},origin);
  }catch(e){
    console.error('Delete account unexpected error',e);
    return reply(500,{error:'Internal error'},origin);
  }
});
