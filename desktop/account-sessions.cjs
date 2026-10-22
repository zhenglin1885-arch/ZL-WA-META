const {createHash}=require('node:crypto');
const URLS={whatsapp:'https://web.whatsapp.com/',facebook:'https://business.facebook.com/'};
function keyOf(platform,id){if(!Object.hasOwn(URLS,platform)||typeof id!=='string'||!id||id.length>150)throw Error('Invalid account');return platform+':'+id}
function partitionFor(platform,id){return 'persist:zl-'+createHash('sha256').update(keyOf(platform,id)).digest('hex')}
function allowedURL(value,platform){try{const u=new URL(value);const hosts=platform==='whatsapp'?['whatsapp.com']:['facebook.com','instagram.com','meta.com'];return u.protocol==='https:'&&!u.username&&!u.password&&hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))}catch{return false}}
function clampBounds(rect,size){if(!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k])))return null;const x=Math.max(0,Math.min(size[0],Math.round(rect.x))),y=Math.max(0,Math.min(size[1],Math.round(rect.y)));const width=Math.max(0,Math.min(size[0]-x,Math.round(rect.width))),height=Math.max(0,Math.min(size[1]-y,Math.round(rect.height)));return width>0&&height>0?{x,y,width,height}:null}
// Keep the real Chromium version and OS; remove only desktop application product tokens.
function browserUserAgent(value){return String(value).replace(/\s(?:Electron|zl[- ]?multi[- ]?manager)\/[^\s]+/gi,'')}
function unsupportedBrowserHeading(text){return /Chrome\s*100\s*\+/i.test(text)&&/(works with|support|支持|更高版本|newer)/i.test(text)}
function fitZoom(bounds){return Math.max(0.7,Math.min(1,bounds.width/1100,bounds.height/780))}
class AccountSessions{
 constructor({win,WebContentsView,session,notify,startMetadataMonitor,startTranslationMonitor,configureProxy}){Object.assign(this,{win,WebContentsView,session,notify,startMetadataMonitor,startTranslationMonitor,configureProxy});this.items=new Map();this.metadata=new Map();this.layout=null;this.attached=null}
 emit(item,state,message=''){item.state=state;item.message=message;this.notify({key:item.key,platform:item.platform,id:item.id,state,message,metadata:item.metadata,metadataSync:item.metadataSync});this.paint()}
 sync(accounts){
  if(!Array.isArray(accounts))throw Error('Invalid accounts');
  const seen=new Set();for(const a of accounts){const key=keyOf(a.platform,a.id);if(seen.has(key))throw Error('Duplicate account');seen.add(key)}
  for(const [key,item] of this.items)if(!seen.has(key)){this.destroy(item);this.metadata.delete(key)}
  for(const a of accounts){const key=keyOf(a.platform,a.id),blocked=!!a.proxyEnabled&&!this.configureProxy;let item=this.items.get(key);
   if(item&&(!!item.sleeping!==!!a.sleeping||item.blocked!==blocked||item.proxyRevision!==a.proxyRevision)){this.destroy(item);item=null}
   if(item)continue;
   item={key,id:a.id,platform:a.platform,sleeping:!!a.sleeping,blocked,proxyRevision:a.proxyRevision,metadata:this.metadata.get(key),popups:new Set()};this.items.set(key,item);
   if(a.sleeping){this.emit(item,'sleeping','当前会话已休眠，登录数据保留。');continue}
   if(blocked){this.emit(item,'blocked','该账号启用了尚未接入的代理。为避免改用直连，已停止加载；请关闭此账号的代理设置后重试。');continue}
   const ses=this.session.fromPartition(partitionFor(a.platform,a.id));
   ses.setUserAgent(browserUserAgent(ses.getUserAgent()));
   ses.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
   ses.setPermissionCheckHandler(()=>false);
   const view=new this.WebContentsView({webPreferences:{session:ses,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false}});item.view=view;
   const wc=view.webContents;wc.setUserAgent(browserUserAgent(wc.getUserAgent()));wc.setZoomMode('isolated');this.secure(wc,item);
   wc.on('did-start-loading',()=>{if(this.items.get(key)===item)this.emit(item,'loading','正在加载官方页面…')});
   // Loading can stop without another top-level dom-ready (for example in-page navigation).
   wc.on('did-stop-loading',()=>{if(this.items.get(key)===item&&item.state==='loading')this.emit(item,'ready','页面已打开，登录状态以 WhatsApp 页面为准。')});
   wc.on('dom-ready',async()=>{if(this.items.get(key)!==item)return;this.emit(item,'ready','页面已打开，等待确认登录。');
    // Return only a boolean; never send page text, credentials or chat content to the app.
    try{const unsupported=await wc.executeJavaScript(`Array.from(document.querySelectorAll('h1,h2,[role="heading"]')).some(e=>(${unsupportedBrowserHeading.toString()})(e.textContent||''))`);if(unsupported&&this.items.get(key)===item)this.emit(item,'incompatible','内置浏览器兼容性异常，当前无法登录。')}catch{}
   });
   wc.on('did-fail-load',(_e,code,_description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3&&this.items.get(key)===item)this.emit(item,'error','官方页面加载失败（'+code+'）。请检查网络后点击重新加载。')});
   wc.on('render-process-gone',()=>{if(this.items.get(key)===item)this.emit(item,'error','页面进程已停止，请重新加载。')});
   if(a.platform==='whatsapp'&&this.startMetadataMonitor)item.stopMetadata=this.startMetadataMonitor(wc,data=>{
    if(this.items.get(key)!==item)return;
    const next=data.authenticated&&data.accountId===item.metadata?.accountId?{...item.metadata,...data}:data;
    const wasSynced=item.metadataSync==='synced';item.metadataSync='synced';
    if(wasSynced&&JSON.stringify(item.metadata)===JSON.stringify(next))return;
    item.metadata=next;this.metadata.set(key,next);this.emit(item,item.state,item.message);
   },()=>{if(this.items.get(key)===item&&item.metadataSync!=='unavailable'){item.metadataSync='unavailable';this.emit(item,item.state,item.message)}});
   if(a.platform==='whatsapp'&&this.startTranslationMonitor)item.stopTranslation=this.startTranslationMonitor(wc,a.id);
   this.emit(item,'loading','正在加载官方页面…');
   if(this.configureProxy){Promise.resolve().then(()=>this.configureProxy(ses,a,item)).then(()=>{if(this.items.get(key)!==item){item.closeProxy?.();return}wc.loadURL(URLS[a.platform]).catch(()=>{})}).catch(()=>{if(this.items.get(key)===item)this.emit(item,'blocked','代理应用失败，请重新检测并保存代理；未切换直连。')})}
   else wc.loadURL(URLS[a.platform]).catch(()=>{});
  }
  return [...this.items.values()].map(({key,id,platform,state,message,metadata})=>({key,id,platform,state,message,metadata}));
 }
 secure(wc,item){
  wc.on('will-navigate',(e,url)=>{if(!allowedURL(url,item.platform)){e.preventDefault();this.notify({key:item.key,platform:item.platform,id:item.id,state:'notice',message:'已阻止离开官方站点的跳转。'})}});
  wc.on('will-redirect',(e,url)=>{if(!allowedURL(url,item.platform))e.preventDefault()});
  wc.setWindowOpenHandler(({url})=>allowedURL(url,item.platform)?{action:'allow',overrideBrowserWindowOptions:{width:1000,height:760,autoHideMenuBar:true,webPreferences:{session:wc.session,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}}}:{action:'deny'});
  wc.on('did-create-window',popup=>{item.popups.add(popup);this.secure(popup.webContents,item);popup.on('closed',()=>item.popups.delete(popup))});
 }
 setLayout(layout){this.layout=layout;this.paint()}
 paint(){
  const item=this.items.get(this.layout?.key),bounds=clampBounds(this.layout?.bounds,this.win.getContentSize());
  const view=this.layout?.visible&&bounds&&['loading','ready','incompatible'].includes(item?.state)?item.view:null;
  if(this.attached&&this.attached!==view){this.win.contentView.removeChildView(this.attached);this.attached=null}
  if(view){view.setBounds(bounds);const zoom=fitZoom(bounds);if(item.zoom!==zoom){view.webContents.setZoomFactor(zoom);item.zoom=zoom}if(this.attached!==view){this.win.contentView.addChildView(view);this.attached=view}}
 }
 reload(platform,id){const item=this.items.get(keyOf(platform,id));if(!item?.view)throw Error(item?.message||'会话尚未运行');item.view.webContents.reload()}
 destroy(item){item.destroyed=true;item.closeProxy?.()?.catch(()=>{});item.stopMetadata?.();item.stopTranslation?.();if(this.attached===item.view){this.win.contentView.removeChildView(item.view);this.attached=null}this.items.delete(item.key);for(const p of item.popups)p.destroy();if(item.view&&!item.view.webContents.isDestroyed())item.view.webContents.close({waitForBeforeUnload:false})}
 dispose(){for(const item of [...this.items.values()])this.destroy(item)}
}
module.exports={AccountSessions,keyOf,partitionFor,allowedURL,clampBounds,browserUserAgent,fitZoom,unsupportedBrowserHeading};
