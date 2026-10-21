import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultTranslationSettings,safeTranslationSettings,applyTranslationSettings} from '../dist/translation-config.js';
import {createMessageDraft,editMessageDraft,resetMessageDraft,beginMessageSend,finishMessageTranslation,changeDraftTranslationSettings} from '../dist/conversation-flow.js';
import {createConversationSession,SAMPLE_DRAFT} from '../dist/conversation-demo.js';
import {defaultConfig,initialState,validateDraft,parseProxy,createProfile,serializableState,restoreState,accountCardView,archiveProfile,proxySettings,validateProxyConfig,applyProxySettings} from '../dist/core.js';
function draft(overrides={}){return {name:'巴西业务 01',remark:'客户跟进',groupId:'default',config:defaultConfig(),...overrides};}

test('发送需两次操作：翻译期间锁定，完成只替换输入，可校正后发送',()=>{
 const draft=createMessageDraft(),settings={...defaultTranslationSettings().send,enabled:true};
 assert.equal(beginMessageSend(draft,settings).type,'noop');editMessageDraft(draft,'原文');
 const action=beginMessageSend(draft,settings);assert.equal(action.type,'translate');assert.equal(draft.phase,'translating');
 assert.equal(beginMessageSend(draft,settings).type,'noop');assert.equal(editMessageDraft(draft,'不能覆盖'),false);assert.equal(draft.text,'原文');
 assert.equal(finishMessageTranslation(draft,action.request,{text:'Translated text'}),true);assert.equal(draft.phase,'review');assert.equal(draft.text,'Translated text');
 editMessageDraft(draft,'Corrected translation');assert.equal(draft.phase,'review');
 assert.deepEqual(beginMessageSend(draft,settings),{type:'sent',text:'Corrected translation'});assert.equal(draft.text,'');assert.equal(draft.phase,'original');
});
test('翻译失败保留原文，关闭发送翻译直接发送，过时结果不覆盖新草稿',()=>{
 const draft=createMessageDraft(),settings={...defaultTranslationSettings().send,enabled:true};resetMessageDraft(draft,'原始内容');
 let action=beginMessageSend(draft,settings);finishMessageTranslation(draft,action.request,{error:'服务未接入'});assert.equal(draft.text,'原始内容');assert.equal(draft.phase,'original');assert.equal(draft.error,'服务未接入');
 action=beginMessageSend(draft,settings);changeDraftTranslationSettings(draft);editMessageDraft(draft,'新草稿');assert.equal(finishMessageTranslation(draft,action.request,{text:'过时译文'}),false);assert.equal(draft.text,'新草稿');
 assert.deepEqual(beginMessageSend(draft,{...settings,enabled:false}),{type:'sent',text:'新草稿'});
});
test('账号独立的异步对话：翻译完成不自动发送，漏译可按条重试',async()=>{
 const configA=defaultTranslationSettings();configA.send.enabled=true;configA.receive.enabled=true;
 const configB=defaultTranslationSettings();configB.send.enabled=true;configB.send.targetLanguage='pt-BR';configB.receive.targetLanguage='pt-BR';
 const a=createConversationSession(configA),b=createConversationSession(configB);a.fillSample();b.fillSample();
 await Promise.all([a.send(),b.send()]);
 assert.equal(a.state.draft.phase,'review');assert.equal(a.state.draft.text,'Thank you for your message.');assert.equal(b.state.draft.text,'Obrigado pela sua mensagem.');
 assert.equal(a.state.messages.filter(m=>m.direction==='sent').length,0);assert.equal(b.state.messages.filter(m=>m.direction==='sent').length,0);
 assert.equal(a.state.messages[0].translation,'你好！有什么可以帮你？');assert.equal(a.state.messages[1].translation,'');assert.equal(b.state.messages[0].translation,'');
 await a.translateReceived(a.state.messages[1].id);assert.equal(a.state.messages[1].translation,'谢谢你的消息。');assert.equal(b.state.messages[1].translation,'');
 a.edit('Thanks, I will reply soon.');await a.send();assert.equal(a.state.messages.at(-1).text,'Thanks, I will reply soon.');assert.equal(b.state.draft.phase,'review');
 b.fillSample();const inFlight=b.send();const changed=safeTranslationSettings(configB);changed.send.targetLanguage='ja';b.applyConfig(changed);await inFlight;
 assert.equal(b.state.draft.text,SAMPLE_DRAFT);assert.equal(b.state.draft.phase,'original');assert.equal(b.state.messages.filter(m=>m.direction==='sent').length,0);
});

test('翻译绑定打开时的账号，发送与接收互不影响，不覆盖代理或其他账号',()=>{
 const state=initialState(),a=createProfile(state,draft()),b=createProfile(state,draft({name:'环境 02'}));
 const other=JSON.stringify(b),config=JSON.stringify(a.config),settings=defaultTranslationSettings();
 settings.send={enabled:true,provider:'openai',sourceLanguage:'zh-CN',targetLanguage:'pt-BR'};
 settings.receive={enabled:true,provider:'deepl',sourceLanguage:'auto',targetLanguage:'zh-TW'};
 applyTranslationSettings(state,a.id,settings);
 assert.equal(state.activeId,b.id);assert.equal(JSON.stringify(b),other);assert.equal(JSON.stringify(a.config),config);
 settings.send.targetLanguage='en';assert.equal(a.translation.send.targetLanguage,'pt-BR');
 const saved=safeTranslationSettings(a.translation);saved.send.enabled=false;applyTranslationSettings(state,a.id,saved);
 assert.equal(a.translation.send.targetLanguage,'pt-BR');assert.equal(a.translation.send.provider,'openai');assert.equal(a.translation.receive.enabled,true);
 const restored=restoreState(JSON.stringify(serializableState(state)));assert.deepEqual(restored.profiles[0].translation,a.translation);
 const before=JSON.stringify(state);assert.throws(()=>applyTranslationSettings(state,'missing',saved));
 saved.receive.targetLanguage='auto';assert.throws(()=>applyTranslationSettings(state,a.id,saved));assert.equal(JSON.stringify(state),before);
});
test('旧账号迁移翻译默认值，独立对象不串号，未知字段及密钥不会持久化',()=>{
 const state=initialState(),a=createProfile(state,draft()),b=createProfile(state,draft({name:'环境 02'}));
 delete a.translation;
 b.translation={send:{enabled:true,provider:'gemini',sourceLanguage:'auto',targetLanguage:'en',apiKey:'secret-direction-key'},receive:{enabled:'true',provider:'unknown',sourceLanguage:'bad',targetLanguage:'auto'},apiKey:'secret-translation-key'};
 const encoded=JSON.stringify(serializableState(state));assert.equal(encoded.includes('secret-'),false);
 const restored=restoreState(encoded);assert.deepEqual(restored.profiles[0].translation,defaultTranslationSettings());
 assert.deepEqual(restored.profiles[1].translation.receive,defaultTranslationSettings().receive);
 restored.profiles[0].translation.send.targetLanguage='ja';assert.equal(restored.profiles[1].translation.send.targetLanguage,'en');assert.equal(restored.profiles[0].translation.receive.targetLanguage,'zh-CN');
 for(const invalid of [null,undefined,'text',[],{send:null,receive:42}])assert.deepEqual(safeTranslationSettings(invalid),defaultTranslationSettings());
 archiveProfile(restored,b.id);const archived=restoreState(JSON.stringify(serializableState(restored))).archivedProfiles[0];
 assert.equal(archived.translation.send.provider,'gemini');assert.equal(archived.translation.send.enabled,true);
});

test('创建环境后选中账号、展开分组并保持独立配置',()=>{
 const state=initialState();state.groups[0].collapsed=true;
 const a=createProfile(state,draft());const b=createProfile(state,draft({name:'环境 02'}));
 assert.notEqual(a.id,b.id);assert.equal(state.activeId,b.id);assert.equal(state.groups[0].collapsed,false);
 a.config.language='pt-BR';assert.equal(b.config.language,'system');assert.equal(a.remark,'客户跟进');
 const restored=restoreState(JSON.stringify(serializableState(state)));
 assert.equal(restored.profiles.length,2);assert.equal(restored.profiles[0].config.language,'pt-BR');assert.equal(restored.nextNumber,3);
});
test('未设置固定账号数量上限',()=>{
 const state=initialState();for(let i=0;i<130;i++)createProfile(state,draft({name:'环境 '+i}));
 assert.equal(state.profiles.length,130);assert.equal(state.nextNumber,131);
});
test('环境名称、代理端口和代理主机需有效',()=>{
 const state=initialState(),d=draft();d.name=' ';assert.equal(validateDraft(d,state.groups).tab,'basic');d.name='环境';
 d.config.proxyEnabled=true;d.config.proxyType='socks5';d.config.proxyHost='127.0.0.1';d.config.proxyPort='65536';assert.equal(validateDraft(d,state.groups).field,'proxyPort');
 d.config.proxyPort='1080';assert.equal(validateDraft(d,state.groups),null);d.config.proxyHost='https://bad/path';assert.equal(validateDraft(d,state.groups).field,'proxyHost');
});
test('解析代理链接含编码凭据、默认端口和 IPv6',()=>{
 const parsed=parseProxy('socks5://test%40name:p%3Ass@[::1]:1080');
 assert.equal(parsed.proxyUsername,'test@name');assert.equal(parsed.password,'p:ss');assert.equal(parsed.proxyHost,'[::1]');assert.equal(parsed.proxyPort,'1080');
 assert.equal(parseProxy('https://proxy.example').proxyPort,'443');assert.equal(parseProxy('http://proxy.example:80').proxyPort,'80');
 for(const invalid of ['ftp://example.com:21','socks5://example.com','http://example.com/path','https://example.com?password=secret','not a URL'])assert.throws(()=>parseProxy(invalid));
});
test('代理密码和链接不进入持久化配置',()=>{
 const state=initialState(),d=draft();d.config.proxyPassword='do-not-save';d.config.password='do-not-save';d.config.proxyImport='do-not-save';
 createProfile(state,d);const encoded=JSON.stringify(serializableState(state));assert.equal(encoded.includes('do-not-save'),false);assert.equal(encoded.includes('proxyPassword'),false);
});
test('校验自定义 UA、时区、GPU 和地理位置',()=>{
 const groups=initialState().groups,d=draft();d.config.uaMode='custom';assert.equal(validateDraft(d,groups).field,'userAgent');d.config.userAgent='Example UA';
 d.config.timezoneMode='custom';d.config.timezone='not-a-timezone';assert.equal(validateDraft(d,groups).field,'timezone');d.config.timezone='America/Bahia';
 d.config.webgl='custom';assert.equal(validateDraft(d,groups).field,'webglVendor');d.config.webglVendor='test';d.config.webglRenderer='test';
 d.config.geolocation='custom';d.config.latitude='91';d.config.longitude='0';assert.equal(validateDraft(d,groups).field,'latitude');d.config.latitude='-12.9';d.config.longitude='-38.5';assert.equal(validateDraft(d,groups),null);
 d.config.fingerprintEnabled=false;d.config.userAgent='';assert.equal(validateDraft(d,groups),null);
});
test('损坏数据回退；默认分组置顶；孤立账号回到默认分组',()=>{
 assert.equal(restoreState('{broken').profiles.length,0);const state=initialState();const p=createProfile(state,draft());p.groupId='missing';state.groups.unshift({id:'custom',name:'业务',collapsed:true});
 const restored=restoreState(JSON.stringify(state));assert.equal(restored.groups[0].id,'default');assert.equal(restored.profiles[0].groupId,'default');
});
test('WhatsApp 资料与本地备注分开；登录资料更新不覆盖备注',()=>{
 const state=initialState(),p=createProfile(state,draft());
 const pending=accountCardView(p);assert.equal(pending.nickname,'未登录账号');assert.equal(pending.phoneNumber,'—');assert.equal(pending.remark,'客户跟进');assert.equal(pending.avatarUrl,null);
 p.whatsappProfile={loggedIn:true,nickname:'Test account',phoneNumber:'+00 000 000000',avatarUrl:'https://example.com/avatar.jpg'};
 let view=accountCardView(p);assert.equal(view.nickname,'Test account');assert.equal(view.phoneNumber,'+00 000 000000');assert.equal(view.status,'online');assert.equal(view.remark,'客户跟进');
 p.remark='新的本地备注';view=accountCardView(p);assert.equal(view.nickname,'Test account');assert.equal(view.phoneNumber,'+00 000 000000');assert.equal(view.remark,'新的本地备注');
 p.whatsappProfile.nickname='Updated account';view=accountCardView(p);assert.equal(view.nickname,'Updated account');assert.equal(view.remark,'新的本地备注');
 assert.equal(accountCardView(restoreState(JSON.stringify(serializableState(state))).profiles[0]).remark,'新的本地备注');
});
test('卡片示例不改变登录状态或持久化资料；休眠优先显示灰点',()=>{
 const state=initialState(),p=createProfile(state,draft()),before=JSON.stringify(serializableState(state));
 const preview=accountCardView(p,{sample:true});assert.equal(preview.isSample,true);assert.equal(preview.authenticated,false);assert.equal(preview.status,'sample');assert.ok(preview.nickname.includes('示例'));assert.ok(preview.avatarUrl.endsWith('sample-avatar.svg'));
 assert.equal(JSON.stringify(serializableState(state)),before);assert.equal(accountCardView(p).nickname,'未登录账号');
 p.sleeping=true;assert.equal(accountCardView(p,{sample:true}).status,'sleep');
 p.whatsappProfile={loggedIn:true,nickname:'Test',avatarUrl:'javascript:alert(1)'};assert.equal(accountCardView(p).avatarUrl,null);
});
test('未读数量为零时隐藏，超过 99 显示 99+；示例已读不覆盖真实计数',()=>{
 const state=initialState(),p=createProfile(state,draft());
 assert.equal(accountCardView(p).unreadLabel,'');
 for(const [value,label] of [[1,'1'],[99,'99'],[100,'99+'],[128,'99+'],[0,''],[-2,''],[NaN,''],[1.5,''],['12','']]){
  p.unreadCount=value;assert.equal(accountCardView(p).unreadLabel,label);
 }
 p.unreadCount=8;const before=JSON.stringify(serializableState(state));
 assert.equal(accountCardView(p,{sampleUnreadCount:120}).unreadLabel,'99+');
 const read=accountCardView(p,{sampleUnreadCount:0});assert.equal(read.unreadLabel,'');assert.equal(read.isUnreadSample,true);
 assert.equal(accountCardView(p).unreadCount,8);assert.equal(JSON.stringify(serializableState(state)),before);
 p.sleeping=true;assert.equal(accountCardView(p).unreadCount,8);
});
test('删除会话保留原配置与身份，其他账号的选择和未读不受影响',()=>{
 const state=initialState(),a=createProfile(state,draft()),b=createProfile(state,draft({name:'环境 02'}));
 a.config.language='pt-BR';a.whatsappProfile={loggedIn:true,nickname:'真实资料',phoneNumber:'+00 123'};a.unreadCount=12;b.unreadCount=7;
 archiveProfile(state,a.id);assert.deepEqual(state.profiles.map(p=>p.id),[b.id]);assert.equal(state.activeId,b.id);assert.equal(b.unreadCount,7);
 const saved=restoreState(JSON.stringify(serializableState(state))),archived=saved.archivedProfiles[0];
 assert.equal(archived.id,a.id);assert.equal(archived.config.language,'pt-BR');assert.equal(archived.whatsappProfile.nickname,'真实资料');assert.equal(archived.remark,a.remark);assert.equal(archived.unreadCount,12);assert.ok(archived.removedAt);
 const c=createProfile(saved,draft({name:'环境 03'}));assert.equal(c.number,3);assert.notEqual(c.id,a.id);assert.equal(saved.archivedProfiles.length,1);
});
test('删除当前及最后一个会话后选择有效；旧配置兼容并保留已归档环境序号',()=>{
 const state=initialState(),a=createProfile(state,draft()),b=createProfile(state,draft({name:'环境 02'}));
 archiveProfile(state,b.id);assert.equal(state.activeId,a.id);archiveProfile(state,a.id);assert.equal(state.activeId,null);assert.equal(state.profiles.length,0);
 const before=JSON.stringify(state);assert.equal(archiveProfile(state,'missing'),null);assert.equal(JSON.stringify(state),before);
 state.nextNumber=1;assert.equal(restoreState(JSON.stringify(serializableState(state))).nextNumber,3);
 const legacy=initialState(),p=createProfile(legacy,draft());delete legacy.archivedProfiles;delete p.unreadCount;
 const restored=restoreState(JSON.stringify(legacy));assert.deepEqual(restored.archivedProfiles,[]);assert.equal(restored.profiles[0].unreadCount,0);
});
test('代理配置绑定指定账号，选中其他账号后保存也不串号或覆盖其他设置',()=>{
 const state=initialState(),a=createProfile(state,draft()),b=createProfile(state,draft({name:'环境 02'}));
 a.config.language='pt-BR';a.unreadCount=7;const other=JSON.stringify(b);
 const settings={proxyEnabled:true,proxyType:'socks5',proxyHost:'proxy.example',proxyPort:'1080',proxyUsername:'account-a',proxyPassword:'private-password',proxyRefreshUrl:'https://example.com/?token=private-url',proxyImport:'private-link'};
 applyProxySettings(state,a.id,settings);
 assert.equal(state.activeId,b.id);assert.equal(JSON.stringify(b),other);assert.equal(a.config.language,'pt-BR');assert.equal(a.unreadCount,7);assert.equal(a.config.proxyHost,'proxy.example');assert.equal(a.config.proxyEnabled,true);
 const saved=JSON.stringify(serializableState(state));for(const secret of ['private-password','private-url','private-link'])assert.equal(saved.includes(secret),false);
 assert.equal(restoreState(saved).profiles[0].config.proxyUsername,'account-a');
});
test('关闭代理保留配置，再次启用恢复；无效配置与已移除账号不会写入',()=>{
 const state=initialState(),p=createProfile(state,draft());
 applyProxySettings(state,p.id,{proxyEnabled:true,proxyType:'https',proxyHost:'proxy.example',proxyPort:'443',proxyUsername:'saved-user'});
 const configured=proxySettings(p.config);applyProxySettings(state,p.id,{...configured,proxyEnabled:false});
 assert.equal(p.config.proxyEnabled,false);assert.equal(p.config.proxyType,'https');assert.equal(p.config.proxyHost,'proxy.example');assert.equal(p.config.proxyUsername,'saved-user');
 const restored=restoreState(JSON.stringify(serializableState(state)));assert.equal(restored.profiles[0].config.proxyEnabled,false);
 applyProxySettings(restored,p.id,{...proxySettings(restored.profiles[0].config),proxyEnabled:true});assert.equal(restored.profiles[0].config.proxyEnabled,true);
 const before=JSON.stringify(restored);assert.throws(()=>applyProxySettings(restored,p.id,{...configured,proxyPort:'65536'}));assert.equal(JSON.stringify(restored),before);
 assert.throws(()=>applyProxySettings(restored,'missing',configured));assert.equal(JSON.stringify(restored),before);
 assert.equal(validateProxyConfig({...configured,proxyEnabled:false,proxyHost:'',proxyPort:''}),null);
});
test('旧代理配置自动继承启用状态；新的直接连接账号默认关闭',()=>{
 const state=initialState(),p=createProfile(state,draft());assert.equal(p.config.proxyEnabled,false);
 p.config.proxyType='http';p.config.proxyHost='legacy.example';p.config.proxyPort='80';delete p.config.proxyEnabled;
 let restored=restoreState(JSON.stringify(state));assert.equal(restored.profiles[0].config.proxyEnabled,true);assert.equal(restored.profiles[0].config.proxyHost,'legacy.example');
 p.config.proxyType='direct';restored=restoreState(JSON.stringify(state));assert.equal(restored.profiles[0].config.proxyEnabled,false);
});
