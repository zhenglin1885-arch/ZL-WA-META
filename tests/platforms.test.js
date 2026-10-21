import test from 'node:test';
import assert from 'node:assert/strict';
import {PLATFORMS,loadPlatform,savePlatform,createPlatformRuntime} from '../dist/platforms.js';
import {initialState,defaultConfig,createProfile,accountCardView,archiveProfile} from '../dist/core.js';
import {createConversationSession,SAMPLE_DRAFT} from '../dist/conversation-demo.js';
import {defaultTranslationSettings} from '../dist/translation-config.js';
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
const draft=(name,groupId='default')=>({name,groupId,remark:name+'备注',config:defaultConfig()});
test('新增、修改、归档 Facebook 账号不改变已有 WhatsApp 的数据或选择',()=>{
 const store=storage(),wa=initialState();createProfile(wa,draft('WhatsApp 原账号'));savePlatform(store,'whatsapp',wa);const original=store.getItem('zl.environment.demo.v1');
 const fb=loadPlatform(store,'facebook');assert.equal(fb.profiles.length,0);fb.groups.push({id:'business',name:'业务组',collapsed:true});const p=createProfile(fb,draft('FB账号','business'),{platform:'facebook'});p.translation.send.enabled=true;p.config.proxyEnabled=true;p.config.proxyHost='proxy.example';savePlatform(store,'facebook',fb);
 const restored=loadPlatform(store,'facebook');assert.equal(restored.activeId,p.id);assert.equal(restored.groups[1].collapsed,false);assert.equal(restored.profiles[0].remark,'FB账号备注');assert.equal(restored.profiles[0].translation.send.enabled,true);assert.equal(restored.profiles[0].facebookProfile,null);assert.equal(restored.profiles[0].whatsappProfile,undefined);
 archiveProfile(restored,p.id);savePlatform(store,'facebook',restored);assert.equal(loadPlatform(store,'facebook').archivedProfiles.length,1);assert.equal(store.getItem('zl.environment.demo.v1'),original);assert.equal(loadPlatform(store,'whatsapp').activeId,wa.activeId);
});
test('Facebook 资料与示例不读取 WhatsApp 的昵称、手机号或登录状态',()=>{
 const p={remark:'本地备注',whatsappProfile:{loggedIn:true,nickname:'WA用户',phoneNumber:'+12345678'}};
 assert.equal(accountCardView(p,{platform:'facebook'}).authenticated,false);assert.equal(accountCardView(p,{platform:'facebook',sample:true}).phoneNumber,'—');
 p.facebookProfile={loggedIn:true,nickname:'Meta业务账号'};assert.equal(accountCardView(p,{platform:'facebook'}).nickname,'Meta业务账号');assert.equal(accountCardView(p).nickname,'WA用户');
});
test('旧 WhatsApp 数据键兼容，Facebook 不具备转发能力且侧栏配置分开',()=>{
 assert.equal(PLATFORMS.whatsapp.storage,'zl.environment.demo.v1');assert.equal(PLATFORMS.whatsapp.forward,true);assert.equal(PLATFORMS.facebook.forward,false);assert.notEqual(PLATFORMS.whatsapp.sidebarStorage,PLATFORMS.facebook.sidebarStorage);
 const store=storage();store.setItem(PLATFORMS.facebook.storage,'invalid');assert.deepEqual(loadPlatform(store,'facebook'),initialState());assert.throws(()=>loadPlatform(store,'unknown'));
});
test('平台运行状态及进行中的翻译隔离，即使账号 ID 相同也不串号',async()=>{
 const wa=createPlatformRuntime(),fb=createPlatformRuntime();const config=defaultTranslationSettings();config.send.enabled=true;
 wa.proxyCredentialsByProfile.set('same',{password:'wa-secret'});fb.proxyCredentialsByProfile.set('same',{password:'fb-secret'});
 wa.conversationSessions.set('same',createConversationSession(config));fb.conversationSessions.set('same',createConversationSession(config));
 const a=wa.conversationSessions.get('same'),b=fb.conversationSessions.get('same');a.fillSample();const pending=a.send();b.edit('FB 未发送草稿');await pending;
 assert.equal(a.state.draft.phase,'review');assert.notEqual(a.state.draft.text,SAMPLE_DRAFT);assert.equal(b.state.draft.text,'FB 未发送草稿');assert.equal(b.state.draft.phase,'original');assert.equal(a.state.messages.filter(m=>m.direction==='sent').length,0);assert.equal(fb.proxyCredentialsByProfile.get('same').password,'fb-secret');
});
