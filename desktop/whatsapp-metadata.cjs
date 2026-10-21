const fs=require('node:fs'),path=require('node:path');
let library;
// This function executes in the official page. Only our own identity and an aggregate
// unread count cross into the app; no contacts, message bodies or credentials do.
async function readSnapshot(){
 const w=globalThis.WPP;if(!w?.isReady)return null;
 if(!w.conn.isAuthenticated())return {authenticated:false};
 const me=w.conn.getMyUserId();if(!me)return null;
 let phoneWid=me;try{phoneWid=w.conn.getMyUserWid?.()||me}catch{}
 const user=String(phoneWid.user||'');
 const phoneNumber=phoneWid.server==='c.us'&&/^\d{5,16}$/.test(user)?'+'+user:'';
 const out={authenticated:true,offline:globalThis.navigator?.onLine===false,accountId:String(me.toString()),nickname:String(w.profile.getMyProfileName()||'').slice(0,150),phoneNumber};
 try{const chats=await w.chat.list({ignoreGroupMetadata:true});out.unreadCount=chats.reduce((sum,c)=>sum+(Number.isSafeInteger(c.unreadCount)&&c.unreadCount>0?c.unreadCount:0),0)}catch{}
 // Avatar requests are cached per logged-in identity, not per selected account.
 const identity=String(me.toString()),now=Date.now();
 let cache=globalThis.__zlOwnAvatar;
 const ttl=cache?.status==='ready'?60000:10000;
 if(!cache||cache.identity!==identity||now-cache.time>ttl){
  const previous=cache?.identity===identity?cache.value:null;
  cache={identity,time:now,value:previous,status:'pending',source:'none'};globalThis.__zlOwnAvatar=cache;
  try{
   let raw;try{const pic=await w.profile.getMyProfilePicture?.();raw=pic?.img||pic?.imgFull||pic?.previewEurl||pic?.eurl}catch{}
   raw||=await w.contact.getProfilePictureUrl(me,false);
   if(!raw){try{const lid=w.conn.getMyUserLid?.();if(lid)raw=await w.contact.getProfilePictureUrl(lid,false)}catch{}}
   if(!raw){
    // Only the user's own profile controls, never a contact or active-chat avatar.
    const own=globalThis.document?.querySelector?.('[data-testid="my-photo"] img, [data-testid="menu-bar-profile"] img, button[aria-label="Profile"] img, button[aria-label="个人头像"] img, [title="个人头像"] img');
    raw=own?.currentSrc||own?.src;
   }
   if(!raw){cache.value='';cache.status='no-image'}else{
    const u=new URL(raw);cache.source=['blob:','data:','https:'].includes(u.protocol)?u.protocol.slice(0,-1):'other';
    const localBlob=u.protocol==='blob:'&&u.origin==='https://web.whatsapp.com';
    const remote=u.protocol==='https:'&&!u.username&&!u.password&&['whatsapp.net','whatsapp.com','fbcdn.net','fbsbx.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));
    if(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw)&&raw.length<700000){cache.value=raw;cache.status='ready'}
    else if(localBlob||remote){
     cache.status='fetch-failed';
     const response=await fetch(u.href,{credentials:localBlob?'same-origin':'omit',signal:AbortSignal.timeout(5000)});
     if(!response.ok){cache.status='http-error'}else{
      let blob=await response.blob();
      if(blob.size>512000){cache.status='too-large'}else{
       let type=blob.type.split(';')[0].trim().toLowerCase();
       if(!/^image\/(jpeg|png|webp)$/.test(type)){
        // Some cached images have an empty or generic MIME; identify only raster formats.
        const bytes=new Uint8Array(await blob.slice(0,12).arrayBuffer());
        if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)type='image/jpeg';
        else if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))type='image/png';
        else if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')type='image/webp';
       }
       if(/^image\/(jpeg|png|webp)$/.test(type)){
        if(blob.type!==type)blob=new Blob([blob],{type});
        cache.value=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});cache.status='ready';
       }else cache.status='unsupported-image';
      }
     }
    }else cache.status='unsupported-source';
   }
  }catch{if(cache.status==='pending')cache.status='lookup-failed'}
 }
 if(typeof cache.value==='string')out.avatarUrl=cache.value;
 out.avatarStatus=cache.status;out.avatarSource=cache.source;
 return out;
}
function sanitizeSnapshot(value){
 if(!value||typeof value.authenticated!=='boolean')return null;
 if(!value.authenticated)return {authenticated:false,nickname:'',phoneNumber:'',avatarUrl:'',unreadCount:0};
 const out={authenticated:true};
 if(typeof value.offline==='boolean')out.offline=value.offline;
 if(['ready','no-image','fetch-failed','http-error','too-large','unsupported-image','unsupported-source','lookup-failed'].includes(value.avatarStatus))out.avatarStatus=value.avatarStatus;
 if(['blob','data','https','none','other'].includes(value.avatarSource))out.avatarSource=value.avatarSource;
 if(typeof value.accountId==='string'&&/^\d{5,30}@(c\.us|lid)$/.test(value.accountId))out.accountId=value.accountId;
 if(typeof value.nickname==='string')out.nickname=value.nickname.slice(0,150);
 if(typeof value.phoneNumber==='string'&&/^(?:\+\d{5,16})?$/.test(value.phoneNumber))out.phoneNumber=value.phoneNumber;
 if(Number.isSafeInteger(value.unreadCount)&&value.unreadCount>=0)out.unreadCount=Math.min(value.unreadCount,1000000000);
 if(typeof value.avatarUrl==='string'&&value.avatarUrl.length<700000&&(value.avatarUrl===''||/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.avatarUrl)))out.avatarUrl=value.avatarUrl;
 return out;
}
function startMetadataMonitor(wc,onSnapshot,onFailure){
 let stopped=false,busy=false,generation=0;
 const navigation=()=>{generation++};wc.on('did-start-navigation',navigation);
 async function poll(){
  if(stopped||busy||wc.isDestroyed())return;busy=true;const ticket=generation;let timeout;
  try{
   const url=new URL(wc.getURL());if(url.protocol!=='https:'||url.hostname!=='web.whatsapp.com')return;
   const run=async()=>{
    if(!await wc.executeJavaScript('Boolean(globalThis.WPP)')){
     library??=fs.readFileSync(path.join(__dirname,'vendor/wppconnect-wa.js'),'utf8');
     await wc.executeJavaScript(library+'\n;void 0;');
    }
    return sanitizeSnapshot(await wc.executeJavaScript('('+readSnapshot.toString()+')()'));
   };
   const result=await Promise.race([run(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('timeout')),12000)})]);
   if(!stopped&&ticket===generation&&result)onSnapshot(result);
  }catch{if(!stopped&&ticket===generation)onFailure?.()}finally{clearTimeout(timeout);busy=false}
 }
 const timer=setInterval(poll,3000);timer.unref?.();wc.on('dom-ready',poll);wc.on('did-stop-loading',poll);
 return ()=>{stopped=true;clearInterval(timer);wc.removeListener('dom-ready',poll);wc.removeListener('did-stop-loading',poll);wc.removeListener('did-start-navigation',navigation)};
}
module.exports={startMetadataMonitor,sanitizeSnapshot,readSnapshot};
