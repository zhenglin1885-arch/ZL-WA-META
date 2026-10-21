import {defaultTranslationSettings,safeTranslationSettings} from './translation-config.js';
export const DEFAULT_GROUP = 'default';
export function newId(){return globalThis.crypto?.randomUUID?.() || 'env-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
export function defaultConfig(){return {fingerprintEnabled:true,os:'windows',uaMode:'auto',userAgent:'',language:'system',timezoneMode:'system',timezone:'',screen:'real',webgl:'real',webglVendor:'',webglRenderer:'',webgpu:'real',webglImage:'real',canvas:'real',audio:'real',webrtc:'default',geolocation:'ask',latitude:'',longitude:'',cpu:'real',memory:'real',proxyEnabled:false,proxyType:'direct',proxyHost:'',proxyPort:'',proxyUsername:''};}
export function initialState(){return {version:1,groups:[{id:DEFAULT_GROUP,name:'默认分组',collapsed:false}],profiles:[],archivedProfiles:[],activeId:null,nextNumber:1};}
function safeUnreadCount(value){return Number.isSafeInteger(value)&&value>0?value:0;}
const SAMPLE_WHATSAPP_PROFILE={nickname:'Ana · 示例',phoneNumber:'+55 00 00000-0000',avatarUrl:'./assets/sample-avatar.svg'};
export function accountCardView(profile,{sample=false,sampleUnreadCount,platform='whatsapp'}={}){
 const data=platform==='facebook'?profile.facebookProfile:profile.whatsappProfile;
 const authenticated=data?.loggedIn===true;
 const sampleData=platform==='facebook'?{nickname:'Meta Business · 示例',phoneNumber:'—',avatarUrl:null}:SAMPLE_WHATSAPP_PROFILE;
 const account=sample?sampleData:authenticated?data:null;
 const text=value=>typeof value==='string'?value.trim():'';
 const candidate=text(account?.avatarUrl);
 const avatarUrl=/^(https:\/\/|\.\/assets\/|data:image\/(png|jpeg|webp);base64,)/i.test(candidate)?candidate:null;
 const unreadCount=safeUnreadCount(sampleUnreadCount===undefined?profile.unreadCount:sampleUnreadCount);
 return {nickname:account?text(account.nickname)||(platform==='facebook'?'Facebook Business 账号':'WhatsApp 账号'):'未登录账号',phoneNumber:account?text(account.phoneNumber)||'—':'—',avatarUrl,remark:typeof profile.remark==='string'?profile.remark:'',authenticated,isSample:sample,status:profile.sleeping?'sleep':sample?'sample':authenticated?'online':'offline',unreadCount,unreadLabel:unreadCount>99?'99+':unreadCount?String(unreadCount):'',isUnreadSample:sampleUnreadCount!==undefined};
}
export function parseSmartProxy(text,defaultType='http'){
 const raw=String(text).trim();if(raw.includes('://'))return parseProxy(raw);
 const labelled={};for(const line of raw.split(/[\n,，;；]+/)){const m=line.trim().match(/^(ip|host|主机|地址|端口|port|账号|账户|用户名|user(?:name)?|密码|pass(?:word)?)\s*[:：=]\s*(.+)$/i);if(m)labelled[m[1].toLowerCase()]=m[2].trim()}
 let host=labelled.ip||labelled.host||labelled['主机']||labelled['地址'],port=labelled.port||labelled['端口'],user=labelled.user||labelled.username||labelled['账号']||labelled['账户']||labelled['用户名']||'',password=labelled.password||labelled.pass||labelled['密码']||'';
 if(!host||!port){const m=raw.match(/^(\[[^\]]+\]|[^:\s,;]+):(\d+)(?::([^:]*):(.*))?$/s);if(m){[,host,port,user='',password='']=m}else{const parts=raw.split(/[\s,，;；]+/);if(parts.length!==2&&parts.length!==4)throw Error('请输入 IP:端口:账号:密码，或用空格/换行分隔四项；也支持完整代理链接。');[host,port,user='',password='']=parts}}
 const type=['http','https','socks5'].includes(defaultType)?defaultType:'http';return parseProxy(type+'://'+(user||password?encodeURIComponent(user)+':'+encodeURIComponent(password)+'@':'')+host+':'+port);
}
export function parseProxy(text){
 let url;try{url=new URL(text.trim())}catch{throw new Error('代理链接格式不正确，请使用 scheme://user:pass@host:port。')}
 const type=url.protocol.slice(0,-1);
 if(!['http','https','socks5'].includes(type))throw new Error('仅支持 HTTP、HTTPS 和 SOCKS5。');
 if(!url.hostname||url.pathname&&url.pathname!=='/'||url.search||url.hash)throw new Error('请填写只包含主机、端口和可选认证信息的代理链接。');
 const port=url.port||(type==='http'?'80':type==='https'?'443':'');
 if(!port||Number(port)<1||Number(port)>65535)throw new Error('请填写 1 ~ 65535 之间的端口。');
 try{return {proxyType:type,proxyHost:url.hostname,proxyPort:port,proxyUsername:decodeURIComponent(url.username),password:decodeURIComponent(url.password)}}catch{throw new Error('用户名或密码的 URL 编码不正确。')}
}
export function validateDraft(draft,groups){
 if(!draft.name.trim())return {tab:'basic',field:'environmentName',message:'请填写环境名称。'};
 if(!groups.some(g=>g.id===draft.groupId))return {tab:'basic',field:'environmentGroup',message:'请选择有效分组。'};
 const c=draft.config;
 if(c.fingerprintEnabled){
  if(c.uaMode==='custom'&&!c.userAgent.trim())return {tab:'fingerprint',field:'userAgent',message:'请填写自定义 User Agent，或选择自动生成。'};
  if(c.webgl==='custom'&&(!c.webglVendor.trim()||!c.webglRenderer.trim()))return {tab:'fingerprint',field:'webglVendor',message:'请填写 WebGL 厂商与渲染器。'};
  if(c.timezoneMode==='custom'){
   try{if(!c.timezone.trim())throw new Error();new Intl.DateTimeFormat('en',{timeZone:c.timezone})}catch{return {tab:'fingerprint',field:'timezone',message:'请填写有效的 IANA 时区，例如 America/Sao_Paulo。'}}
  }
  if(c.geolocation==='custom'&&(c.latitude===''||c.longitude===''||!Number.isFinite(Number(c.latitude))||!Number.isFinite(Number(c.longitude))||Math.abs(Number(c.latitude))>90||Math.abs(Number(c.longitude))>180))return {tab:'fingerprint',field:'latitude',message:'请输入有效经纬度：纬度 −90 ~ 90，经度 −180 ~ 180。'};
 }
 const proxyError=validateProxyConfig(c);return proxyError?{...proxyError,tab:'proxy'}:null;
}
export function safeConfig(config={}){const result={...defaultConfig()};for(const key of Object.keys(result))if(config[key]!==undefined)result[key]=config[key];result.proxyEnabled=typeof config.proxyEnabled==='boolean'?config.proxyEnabled:result.proxyType!=='direct';return result;}
export function proxySettings(config={}){
 const c=safeConfig(config);return {proxyEnabled:c.proxyEnabled,proxyType:c.proxyType,proxyHost:c.proxyHost,proxyPort:String(c.proxyPort),proxyUsername:c.proxyUsername};
}
export function validateProxyConfig(config){
 const c=proxySettings(config);
 if(!['direct','http','https','socks5'].includes(c.proxyType))return {field:'proxyType',message:'请选择有效的代理类型。'};
 if(!c.proxyEnabled||c.proxyType==='direct')return null;
 if(typeof c.proxyHost!=='string'||!c.proxyHost.trim()||/[\s/?#@]/.test(c.proxyHost))return {field:'proxyHost',message:'请填写有效的代理主机地址，不要包含协议或认证信息。'};
 if(!/^\d+$/.test(c.proxyPort)||Number(c.proxyPort)<1||Number(c.proxyPort)>65535)return {field:'proxyPort',message:'代理端口需为 1 ~ 65535 的整数。'};
 return null;
}
export function applyProxySettings(state,profileId,settings){
 const profile=state.profiles.find(p=>p.id===profileId);if(!profile)throw new Error('账号不存在，请重新选择。');
 const error=validateProxyConfig(settings);if(error)throw new Error(error.message);
 const values=proxySettings(settings);values.proxyEnabled=values.proxyEnabled&&values.proxyType!=='direct';
 values.proxyHost=String(values.proxyHost||'').trim();values.proxyPort=String(values.proxyPort||'').trim();values.proxyUsername=String(values.proxyUsername||'');
 profile.config=safeConfig({...profile.config,...values});return profile;
}
export function createProfile(state,draft,{platform='whatsapp'}={}){
 const error=validateDraft(draft,state.groups);if(error)throw new Error(error.message);
 const profile={id:newId(),number:state.nextNumber,name:draft.name.trim(),remark:draft.remark.trim(),groupId:draft.groupId,config:safeConfig(draft.config),translation:defaultTranslationSettings(),[platform==='facebook'?'facebookProfile':'whatsappProfile']:null,sleeping:false,unreadCount:0,createdAt:Date.now()};
 state.nextNumber++;state.profiles.push(profile);state.activeId=profile.id;
 const group=state.groups.find(g=>g.id===profile.groupId);group.collapsed=false;
 return profile;
}
export function archiveProfile(state,id){
 const index=state.profiles.findIndex(p=>p.id===id);if(index<0)return null;
 const [profile]=state.profiles.splice(index,1);
 state.archivedProfiles=[...(state.archivedProfiles||[]).filter(p=>p.id!==id),{...profile,removedAt:Date.now()}];
 if(state.activeId===id)state.activeId=state.profiles[index]?.id||state.profiles[index-1]?.id||null;
 return profile;
}
export function serializableState(state){const safeProfile=p=>({...p,unreadCount:safeUnreadCount(p.unreadCount),config:safeConfig(p.config||{}),translation:safeTranslationSettings(p.translation)});return {...state,profiles:state.profiles.map(safeProfile),archivedProfiles:(state.archivedProfiles||[]).map(safeProfile)};}
export function restoreState(raw){
 try{
  const s=JSON.parse(raw);if(s.version!==1||!Array.isArray(s.groups)||!Array.isArray(s.profiles))return initialState();
  const seen=new Set();let groups=s.groups.filter(g=>g&&typeof g.id==='string'&&typeof g.name==='string'&&!seen.has(g.id)&&seen.add(g.id)).map(g=>({id:g.id,name:g.name,collapsed:!!g.collapsed}));
  const pinned=groups.find(g=>g.id===DEFAULT_GROUP)||{id:DEFAULT_GROUP,name:'默认分组',collapsed:false};pinned.name='默认分组';groups=[pinned,...groups.filter(g=>g.id!==DEFAULT_GROUP)];
  const ids=new Set(),validProfile=p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&!ids.has(p.id)&&ids.add(p.id);
  const normalizeProfile=(p,i)=>({...p,number:Number.isInteger(p.number)&&p.number>0?p.number:i+1,remark:typeof p.remark==='string'?p.remark:'',groupId:groups.some(g=>g.id===p.groupId)?p.groupId:DEFAULT_GROUP,sleeping:!!p.sleeping,unreadCount:safeUnreadCount(p.unreadCount),config:safeConfig(p.config||{}),translation:safeTranslationSettings(p.translation)});
  const profiles=s.profiles.filter(validProfile).map(normalizeProfile);
  const archivedProfiles=(Array.isArray(s.archivedProfiles)?s.archivedProfiles:[]).filter(validProfile).map(normalizeProfile);
  return {version:1,groups,profiles,archivedProfiles,activeId:profiles.some(p=>p.id===s.activeId)?s.activeId:profiles[0]?.id||null,nextNumber:Math.max(Number(s.nextNumber)||1,...[...profiles,...archivedProfiles].map(p=>p.number+1))};
 }catch{return initialState()}
}
