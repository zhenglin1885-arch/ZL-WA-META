import test from 'node:test';
import assert from 'node:assert/strict';
import {readPreferences,savePreferences,SETTINGS_KEY,validateCacheDirectory,activationFormatError,ACTIVATION_RECHECK_HOURS} from '../dist/system-settings-model.js';
import {createConversationSession,SAMPLE_DRAFT} from '../dist/conversation-demo.js';
import {defaultTranslationSettings} from '../dist/translation-config.js';
test('系统偏好持久保存，但不包含授权标志或激活码',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 assert.deepEqual(readPreferences(storage),{autoStart:false,closeBehavior:'tray',cacheDirectory:''});savePreferences(storage,{autoStart:true,cacheDirectory:'D:\\ZLCache',activated:true,code:'ABC12345'});
 assert.deepEqual(readPreferences(storage),{autoStart:true,closeBehavior:'tray',cacheDirectory:'D:\\ZLCache'});assert.ok(!values.get(SETTINGS_KEY).includes('activated'));assert.ok(!values.get(SETTINGS_KEY).includes('ABC12345'));
 assert.throws(()=>savePreferences({setItem:()=>{throw Error('quota')}},{autoStart:true,cacheDirectory:''}));
});
test('缓存目录校验和激活码格式不伪造激活结果',()=>{
 assert.equal(validateCacheDirectory('D:\\ZLCache'),'');assert.equal(validateCacheDirectory(''),'');assert.ok(validateCacheDirectory('relative/path'));assert.ok(validateCacheDirectory('C:\\bad?name'));
 assert.equal(ACTIVATION_RECHECK_HOURS,6);assert.equal(activationFormatError('AB12CD34'),'');assert.ok(activationFormatError('12345678'));assert.ok(activationFormatError('abcd1234'));
});
test('清理译文缓存保留原消息与发送草稿，阻止旧接收翻译回填',async()=>{
 const config=defaultTranslationSettings();config.receive.enabled=false;const session=createConversationSession(config);session.fillSample();await session.translateReceived(1);assert.equal(session.cacheStats().count,1);assert.ok(session.cacheStats().bytes>0);
 const original=session.state.messages.map(m=>m.text);const pending=session.translateReceived(2);session.clearCache();await pending;
 assert.deepEqual(session.state.messages.map(m=>m.text),original);assert.equal(session.state.draft.text,SAMPLE_DRAFT);assert.deepEqual(session.cacheStats(),{count:0,bytes:0});
});

test('关闭行为兼容旧偏好并独立持久保存',()=>{
 let value=JSON.stringify({autoStart:true,cacheDirectory:''});const storage={getItem:()=>value,setItem:(_,v)=>value=v};
 assert.equal(readPreferences(storage).closeBehavior,'tray');
 for(const closeBehavior of ['exit','tray']){savePreferences(storage,{...readPreferences(storage),closeBehavior});assert.equal(readPreferences(storage).closeBehavior,closeBehavior);savePreferences(storage,{...readPreferences(storage),autoStart:false});assert.equal(readPreferences(storage).closeBehavior,closeBehavior)}
 value=JSON.stringify({closeBehavior:'unknown'});assert.equal(readPreferences(storage).closeBehavior,'tray');
});
