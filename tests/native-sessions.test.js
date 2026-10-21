import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {AccountSessions,partitionFor,allowedURL,clampBounds,browserUserAgent,fitZoom}=require('../desktop/account-sessions.cjs');
function fixture(startMetadataMonitor){const attached=new Set(),views=[],statuses=[];class WC extends EventEmitter{constructor(s){super();this.session=s;this.urls=[]}loadURL(url){this.urls.push(url);return Promise.resolve()}getUserAgent(){return "Mozilla/5.0 Chrome/150.0.0.0 Electron/44.9.0 zl-multi-manager/0.2.0"}setUserAgent(ua){this.ua=ua}setZoomMode(mode){this.zoomMode=mode}setZoomFactor(factor){this.zoomFactor=factor}executeJavaScript(){return Promise.resolve(false)}setWindowOpenHandler(h){this.popup=h}isDestroyed(){return !!this.closed}close(){this.closed=true}reload(){this.reloaded=true}}
class View{constructor(o){this.options=o;this.webContents=new WC(o.webPreferences.session);views.push(this)}setBounds(b){this.bounds=b}}
const sessions=new Map();const session={fromPartition(p){if(!sessions.has(p))sessions.set(p,{setPermissionRequestHandler(){},setPermissionCheckHandler(){}});return sessions.get(p)}};
const win={getContentSize:()=>[1000,700],contentView:{addChildView:v=>attached.add(v),removeChildView:v=>attached.delete(v)}};
return {manager:new AccountSessions({win,WebContentsView:View,session,startMetadataMonitor,notify:s=>statuses.push(s)}),views,attached,statuses,sessions}}
const account=(id,platform='whatsapp')=>({id,platform,sleeping:false});
test('account partition is persistent, platform-scoped and deterministic',()=>{assert.match(partitionFor('whatsapp','a'),/^persist:/);assert.equal(partitionFor('whatsapp','a'),partitionFor('whatsapp','a'));assert.notEqual(partitionFor('whatsapp','a'),partitionFor('facebook','a'));assert.notEqual(partitionFor('whatsapp','a'),partitionFor('whatsapp','b'))});
test('real official URLs load in isolated views; switching never reloads background accounts',()=>{const f=fixture();f.manager.sync([account('a'),account('b'),account('a','facebook')]);assert.deepEqual(f.views.map(v=>v.webContents.urls[0]),['https://web.whatsapp.com/','https://web.whatsapp.com/','https://business.facebook.com/']);assert.equal(f.sessions.size,3);for(const v of f.views){assert.equal(v.options.webPreferences.sandbox,true);assert.equal(v.options.webPreferences.nodeIntegration,false);v.webContents.emit('dom-ready')}
f.manager.setLayout({key:'whatsapp:a',visible:true,bounds:{x:280,y:80,width:720,height:600}});assert.equal(f.attached.size,1);f.manager.setLayout({key:'whatsapp:b',visible:true,bounds:{x:280,y:80,width:720,height:600}});f.manager.sync([account('a'),account('b'),account('a','facebook')]);assert.equal(f.views.length,3);assert.equal(f.views[0].webContents.urls.length,1);assert.equal(f.views[0].webContents.closed,undefined);assert.ok(f.attached.has(f.views[1]))});
test('dialog hides embedded content without logging out or closing the session',()=>{const f=fixture();f.manager.sync([account('a')]);f.views[0].webContents.emit('dom-ready');f.manager.setLayout({key:'whatsapp:a',visible:true,bounds:{x:0,y:0,width:500,height:400}});f.manager.setLayout({key:'whatsapp:a',visible:false,bounds:{x:0,y:0,width:500,height:400}});assert.equal(f.attached.size,0);assert.equal(f.views[0].webContents.closed,undefined)});
test('sleep and removal close pages; waking reuses the same persisted session',()=>{const f=fixture();f.manager.sync([account('a')]);const original=f.views[0].webContents.session;f.manager.sync([{...account('a'),sleeping:true}]);assert.equal(f.views[0].webContents.closed,true);f.manager.sync([account('a')]);assert.equal(f.views[1].webContents.session,original);f.manager.reload('whatsapp','a');assert.equal(f.views[1].webContents.reloaded,true);f.manager.sync([]);assert.equal(f.views[1].webContents.closed,true)});
test('configured but unsupported proxy does not silently connect directly',()=>{const f=fixture();f.manager.sync([{...account('a'),proxyEnabled:true}]);assert.equal(f.views.length,0);assert.equal(f.statuses[0].state,'blocked');f.manager.sync([account('a')]);assert.equal(f.views.length,1)});
test('navigation rejects deceptive domains and unsafe protocols; bounds remain inside window',()=>{for(const url of ['https://whatsapp.com.evil.test/','https://whatsapp.com@evil.test/','http://web.whatsapp.com/','file:///etc/passwd','javascript:alert(1)'])assert.equal(allowedURL(url,'whatsapp'),false);assert.equal(allowedURL('https://web.whatsapp.com/','whatsapp'),true);assert.equal(allowedURL('https://www.facebook.com/login','facebook'),true);assert.deepEqual(clampBounds({x:900,y:650,width:600,height:600},[1000,700]),{x:900,y:650,width:100,height:50});assert.equal(clampBounds({x:NaN,y:0,width:1,height:1},[1000,700]),null)});

test('compatibility normalization preserves actual Chromium version and OS',()=>{const original='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 zl-multi-manager/0.2.0 Chrome/150.0.0.0 Electron/44.9.0 Safari/537.36';const ua=browserUserAgent(original);assert.match(ua,/Chrome\/150\.0\.0\.0/);assert.match(ua,/Windows NT 10.0/);assert.doesNotMatch(ua,/Electron|zl-multi-manager/)});
test('viewport fitting shrinks small content areas and never enlarges large ones',()=>{assert.equal(fitZoom({width:1600,height:1000}),1);assert.equal(fitZoom({width:770,height:546}),0.7);const f=fixture();f.manager.sync([account('a')]);f.views[0].webContents.emit('dom-ready');f.manager.setLayout({key:'whatsapp:a',visible:true,bounds:{x:0,y:0,width:880,height:624}});assert.equal(f.views[0].webContents.zoomFactor,0.8);assert.equal(f.views[0].webContents.zoomMode,'isolated')});
test('unsupported browser page is not reported as a usable login',async()=>{const f=fixture();f.manager.sync([account('a')]);f.views[0].webContents.executeJavaScript=()=>Promise.resolve(true);f.views[0].webContents.emit('dom-ready');await Promise.resolve();assert.equal(f.statuses.at(-1).state,'incompatible')});

test('page stays visible during post-login loading without a second dom-ready',()=>{
 const f=fixture();f.manager.sync([account('a')]);const view=f.views[0];
 f.manager.setLayout({key:'whatsapp:a',visible:true,bounds:{x:280,y:80,width:720,height:600}});
 view.webContents.emit('dom-ready');assert.ok(f.attached.has(view));
 view.webContents.emit('did-start-loading');assert.ok(f.attached.has(view),'loading must not detach the real page');
 view.webContents.emit('did-stop-loading');assert.equal(f.statuses.at(-1).state,'ready');assert.ok(f.attached.has(view));
});
test('loading completion does not erase a main-frame error or reveal a covered page',()=>{
 const f=fixture();f.manager.sync([account('a')]);const wc=f.views[0].webContents;
 f.manager.setLayout({key:'whatsapp:a',visible:false,bounds:{x:0,y:0,width:500,height:400}});
 wc.emit('did-start-loading');wc.emit('did-stop-loading');assert.equal(f.attached.size,0);
 wc.emit('did-start-loading');wc.emit('did-fail-load',{},-105,'name not resolved','https://web.whatsapp.com/',true);wc.emit('did-stop-loading');
 assert.equal(f.statuses.at(-1).state,'error');assert.equal(f.attached.size,0);
});


test('metadata stays account-scoped and stale callbacks cannot update a sleeping or recreated session',()=>{
 const callbacks=[],stops=[];const f=fixture((wc,cb)=>{callbacks.push(cb);return ()=>stops.push(wc)});
 f.manager.sync([account('a'),account('b')]);
 callbacks[0]({authenticated:true,accountId:'123456@c.us',nickname:'A',unreadCount:5});
 callbacks[1]({authenticated:true,accountId:'234567@c.us',nickname:'B',unreadCount:2});
 assert.equal(f.manager.items.get('whatsapp:a').metadata.unreadCount,5);
 assert.equal(f.manager.items.get('whatsapp:b').metadata.nickname,'B');
 f.manager.sync([{...account('a'),sleeping:true},account('b')]);assert.equal(stops.length,1);
 callbacks[0]({authenticated:true,nickname:'stale',unreadCount:99});assert.equal(f.manager.items.get('whatsapp:a').metadata.nickname,'A');
 f.manager.sync([account('a'),account('b')]);callbacks[0]({authenticated:true,unreadCount:99});assert.equal(f.manager.items.get('whatsapp:a').metadata.unreadCount,5);
 callbacks[2]({authenticated:false,nickname:'',unreadCount:0,avatarUrl:'',phoneNumber:''});assert.equal(f.manager.items.get('whatsapp:a').metadata.unreadCount,0);f.manager.dispose();assert.equal(stops.length,3);
});
