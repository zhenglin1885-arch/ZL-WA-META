const {AccountSessions,partitionFor,browserUserAgent}=require('./account-sessions.cjs');
const {startMetadataMonitor}=require('./whatsapp-metadata.cjs');
const {app,BrowserWindow,protocol,net,ipcMain,Tray,Menu,WebContentsView,session,Notification,nativeTheme,dialog,shell,clipboard,safeStorage}=require('electron');
const {createTranslationService}=require('./translation-service.cjs');
const {startTranslationMonitor}=require('./translation-runtime.cjs');
const {createProxyService}=require('./proxy-service.cjs');
const {bindAccountNotification}=require('./account-notifications.cjs');
const {createUpdateService}=require('./update-service.cjs');
const {createHistoryService}=require('./history-service.cjs');
const {spawn}=require('node:child_process');
const {measureNetwork}=require('./network-status.cjs');
const {runAction,validateAction}=require('./whatsapp-actions.cjs');
const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const originalUserData=app.getPath('userData');app.setName('ZL Multi Manager');app.setPath('userData',originalUserData);
// Apply after branding changes, before creating any sessions or windows.
app.userAgentFallback=browserUserAgent(app.userAgentFallback);
protocol.registerSchemesAsPrivileged([{scheme:'zl',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let win,tray,quitting=false,prefs={closeBehavior:'tray',autoStart:false};
if(!app.requestSingleInstanceLock())app.quit();
else {
 app.on('second-instance',(_event,argv)=>{if(argv.includes('--quit-for-maintenance')){quitting=true;app.quit();return}win?.show();win?.focus()});
 app.on('before-quit',()=>quitting=true);
 app.whenReady().then(()=>{
  if(process.argv.includes('--quit-for-maintenance')){app.quit();return}
  app.setAppUserModelId('ZL.MultiManager');
  if(process.platform==='win32'){try{const shortcut=path.join(app.getPath('appData'),'Microsoft/Windows/Start Menu/Programs/ZL Multi Manager/ZL Multi Manager.lnk');shell.writeShortcutLink(shortcut,'update',{target:process.execPath,description:'ZL Multi Manager',icon:path.join(path.dirname(process.execPath),'icon.ico'),iconIndex:0,appUserModelId:'ZL.MultiManager'})}catch{}}
  let lastNetwork=null;ipcMain.handle('network-status',async e=>{trusted(e);try{lastNetwork=await measureNetwork((url,options)=>net.fetch(url,options));return lastNetwork}catch{lastNetwork=null;throw Error('公网 IP 检测失败，请检查网络')}});
  ipcMain.handle('copy-network-ip',e=>{trusted(e);if(lastNetwork)clipboard.writeText(lastNetwork.ip)});
  const notificationStates=new Map(),accountNotifications=new Set();
  function notifyAccount(status){
   const previous=notificationStates.get(status.key),now={unread:status.metadata?.unreadCount,failed:['error','blocked','incompatible'].includes(status.state),authenticated:status.metadata?.authenticated};notificationStates.set(status.key,now);
   if(!Notification.isSupported()||status.state==='sleeping'||!previous)return;
   const unread=Number.isInteger(now.unread)&&Number.isInteger(previous.unread)&&now.unread>previous.unread;
   const lost=(now.failed&&!previous.failed)||(previous.authenticated===true&&now.authenticated===false);
   if(!unread&&!lost)return;
   const n=new Notification({title:lost?'WhatsApp 连接异常':'WhatsApp 新消息',body:lost?'点击查看对应账号。':(status.metadata?.nickname||'WhatsApp 账号')+' 有 '+now.unread+' 条未读消息',icon:path.join(__dirname,'icon.png')});
   accountNotifications.add(n);bindAccountNotification(n,win,status,item=>accountNotifications.delete(item));n.show();
  }
  const translationService=createTranslationService({directory:app.getPath('userData'),safeStorage,fetch:(url,options)=>net.fetch(url,options)});
  ipcMain.handle('translation-get',(e,id)=>{trusted(e);return translationService.publicConfig(id)});
  ipcMain.handle('translation-save',(e,value)=>{trusted(e);return translationService.save(value.accountId,value.config,value.apiKey)});
  ipcMain.handle('translation-test',(e,id)=>{trusted(e);return translationService.translate(id,'send','Hello, how are you?')});
  ipcMain.handle('notification-test',e=>{trusted(e);if(!Notification.isSupported())throw Error('当前系统不支持桌面通知');new Notification({title:'ZL Multi Manager',body:'Windows 通知已接入',icon:path.join(__dirname,'icon.png')}).show();return true});
  const prefFile=path.join(app.getPath('userData'),'desktop-settings.json');
  try{const p=JSON.parse(fs.readFileSync(prefFile,'utf8'));prefs={...prefs,closeBehavior:p.closeBehavior==='exit'?'exit':'tray',autoStart:p.autoStart===true,theme:['system','light','dark'].includes(p.theme)?p.theme:(prefs.theme||'system')}}catch{}
  protocol.handle('zl',request=>{
   const url=new URL(request.url),root=path.join(__dirname,'ui');
   let file;try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname))}catch{return new Response('',{status:400})}
   if(url.host!=='app'||!file.startsWith(root+path.sep))return new Response('',{status:403});
   return net.fetch(pathToFileURL(file).href);
  });
  nativeTheme.themeSource=prefs.theme||'system';
  win=new BrowserWindow({width:1280,height:850,minWidth:900,minHeight:600,show:false,frame:true,...(process.platform==='win32'?{titleBarStyle:'hidden',titleBarOverlay:{color:'#111310',symbolColor:'#d2d6cf',height:30}}:{}),title:'ZL Multi Manager',icon:path.join(__dirname,'icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  function paintTitlebar(){if(process.platform==='win32'&&!win.isDestroyed())win.setTitleBarOverlay({color:nativeTheme.shouldUseDarkColors?'#111310':'#f5f7fa',symbolColor:nativeTheme.shouldUseDarkColors?'#d2d6cf':'#26364b',height:30})}
  nativeTheme.on('updated',paintTitlebar);paintTitlebar();
  ipcMain.handle('theme-set',(e,value)=>{trusted(e);if(!['system','light','dark'].includes(value))throw Error('Invalid theme');nativeTheme.themeSource=value;prefs.theme=value;fs.writeFileSync(prefFile,JSON.stringify(prefs));paintTitlebar();return true});
  win.setMenuBarVisibility(false);
  // Bounded local diagnostics: application states only, never page text, cookies or messages.
  const sessionDiagnostics=[];
  function recordSessionStatus(status){
   sessionDiagnostics.push({time:new Date().toISOString(),account:partitionFor(status.platform,status.id),state:status.state,message:status.message,metadataSync:status.metadataSync,avatarStatus:status.metadata?.avatarStatus,avatarSource:status.metadata?.avatarSource});
   if(sessionDiagnostics.length>200)sessionDiagnostics.shift();
   try{fs.writeFileSync(path.join(app.getPath('userData'),'session-diagnostics.json'),JSON.stringify({build:'0.2.0-R11',electron:process.versions.electron,chrome:process.versions.chrome,events:sessionDiagnostics},null,2))}catch{}
  }
  const proxyService=createProxyService({directory:app.getPath('userData'),safeStorage,session});let lastAccounts=[];
  const accounts=new AccountSessions({configureProxy:proxyService.configure,win,WebContentsView,session,startMetadataMonitor,startTranslationMonitor:(wc,id)=>startTranslationMonitor(wc,id,translationService),notify:status=>{recordSessionStatus(status);notifyAccount(status);if(!win.isDestroyed())win.webContents.send('account-status',status)}});
  const history=createHistoryService({directory:app.getPath('userData'),defaultExport:path.join(app.getPath('documents'),'ZL-Chat-Exports'),safeStorage,accounts,translation:translationService});
  app.on('before-quit',()=>history.close());
  ipcMain.handle('history-get',e=>{trusted(e);return history.get()});
  ipcMain.handle('history-save',(e,v)=>{trusted(e);return history.save(v)});
  ipcMain.handle('history-directory',async e=>{trusted(e);const r=await dialog.showOpenDialog(win,{properties:['openDirectory','createDirectory']});return r.canceled?null:r.filePaths[0]});
  ipcMain.handle('history-open',async e=>{trusted(e);const directory=history.get().directory;fs.mkdirSync(directory,{recursive:true});const error=await shell.openPath(directory);if(error)throw Error(error);return true});
  ipcMain.handle('history-sync',(e,v)=>{trusted(e);return history.sync(v.ids,v.days)});
  ipcMain.handle('history-export',async(e,v)=>{trusted(e);const result=history.exportHTML(v?.date);const error=await shell.openPath(result.directory);return {...result,openError:error||''}});
  ipcMain.handle('cache-stats',e=>{trusted(e);return translationService.cacheStats()});
  ipcMain.handle('cache-clear',async e=>{trusted(e);translationService.clearCache();for(const item of accounts.items.values())if(item.platform==='whatsapp'&&item.view)try{await item.view.webContents.executeJavaScript("globalThis.__zlTranslation?.seen.clear();document.querySelectorAll('.zl-received-translation').forEach(e=>e.remove())")}catch{}return true});
  ipcMain.handle('performance-get',e=>{trusted(e);const metrics=app.getAppMetrics();return {cpu:metrics.reduce((n,m)=>n+(m.cpu?.percentCPUUsage||0),0),memory:metrics.reduce((n,m)=>n+(m.memory?.workingSetSize||0)*1024,0),processes:metrics.length,uptime:process.uptime()}});
  const updater=createUpdateService({fetch:(u,o)=>net.fetch(u,o),directory:path.join(app.getPath('userData'),'updates'),currentVersion:'0.2.0-R11',launch:file=>new Promise((resolve,reject)=>{if(process.platform!=='win32'){reject(Error('在线安装仅支持 Windows'));return}const child=spawn(file,[],{detached:true,stdio:'ignore'});child.once('error',()=>reject(Error('无法启动更新安装程序')));child.once('spawn',()=>{child.unref();resolve()})}),quit:()=>{quitting=true;app.quit()}});
  ipcMain.handle('update-check',e=>{trusted(e);return updater.check()});
  ipcMain.handle('update-install',e=>{trusted(e);return updater.install(progress=>{if(!win.isDestroyed())win.webContents.send('update-progress',progress)})});
  for(const event of ['resize','move','maximize','unmaximize','restore'])win.on(event,()=>{accounts.paint();win.webContents.send('layout-request')});
  app.on('before-quit',()=>accounts.dispose());
  ipcMain.handle('accounts-sync',(e,items)=>{trusted(e);lastAccounts=items;return accounts.sync(items.map(a=>({...a,proxyRevision:proxyService.revision(a.platform+':'+a.id)})))});
  const proxyKey=v=>{partitionFor(v.platform,v.id);return v.platform+':'+v.id};
  ipcMain.handle('proxy-get',(e,v)=>{trusted(e);return proxyService.get(proxyKey(v))});
  ipcMain.handle('proxy-test',(e,v)=>{trusted(e);return proxyService.test(v)});
  ipcMain.handle('proxy-save',(e,v)=>{trusted(e);proxyService.save(proxyKey(v),v.config);lastAccounts=lastAccounts.map(a=>a.id===v.id&&a.platform===v.platform?{...a,proxyEnabled:v.config.proxyEnabled}:a);accounts.sync(lastAccounts.map(a=>({...a,proxyRevision:proxyService.revision(a.platform+':'+a.id)})));return true});
  ipcMain.handle('accounts-layout',(e,layout)=>{trusted(e);accounts.setLayout(layout)});
  ipcMain.handle('whatsapp-action',(e,request)=>{trusted(e);return runAction(accounts,request)});
  ipcMain.handle('validate-message',(e,request)=>{trusted(e);validateAction(request);return true});
  ipcMain.handle('task-complete',(e,counts)=>{trusted(e);if(Notification.isSupported()){new Notification({title:'转发任务完成',body:'已提交 '+Math.max(0,Number(counts.submitted)||0)+'；失败 '+Math.max(0,Number(counts.failed)||0),icon:path.join(__dirname,'icon.png')}).show()}});
  ipcMain.handle('accounts-reload',(e,platform,id)=>{trusted(e);accounts.reload(platform,id)});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('zl://app/'))e.preventDefault()});
  win.webContents.session.setPermissionRequestHandler((wc,permission,callback)=>callback(false));
  function trusted(e){if(e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame||!e.senderFrame.url.startsWith('zl://app/'))throw Error('Untrusted sender')}
  ipcMain.handle('window-control',(e,command)=>{trusted(e);if(command==='minimize')win.minimize();else if(command==='maximize')win.isMaximized()?win.unmaximize():win.maximize();else if(command==='close')win.close()});
  ipcMain.handle('preferences',(e,p)=>{trusted(e);prefs={...prefs,closeBehavior:p.closeBehavior==='exit'?'exit':'tray',autoStart:p.autoStart===true,theme:['system','light','dark'].includes(p.theme)?p.theme:(prefs.theme||'system')};fs.writeFileSync(prefFile,JSON.stringify(prefs));if(process.platform==='win32')app.setLoginItemSettings({openAtLogin:prefs.autoStart});return prefs});
  tray=new Tray(path.join(__dirname,'icon.png'));tray.setToolTip('ZL Multi Manager');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'打开 ZL',click:()=>win.show()},{label:'退出软件',click:()=>app.quit()}]));tray.on('double-click',()=>win.show());
  win.on('close',e=>{if(!quitting&&prefs.closeBehavior==='tray'){e.preventDefault();win.hide()}});
  win.once('ready-to-show',()=>win.show());win.loadURL('zl://app/index.html');
 });
 app.on('window-all-closed',()=>app.quit());
}
