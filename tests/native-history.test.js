import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {taskStats,taskState} from '../dist/native-history.js';
const require=createRequire(import.meta.url),{googleFreeTranslate,createTranslationService}=require('../desktop/translation-service.cjs');
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('Google free request needs no key, preserves text, joins segments, fails explicitly on throttling',async()=>{
 const text='你好 & 世界?';assert.equal(await googleFreeTranslate(async(url,options)=>{const u=new URL(url);assert.equal(u.searchParams.get('q'),text);assert.equal(u.searchParams.get('tl'),'en');assert.ok(options.signal);assert.equal(options.headers,undefined);return {ok:true,json:async()=>[[['Hello '],['world']]]}},text,'en'),'Hello world');
 await assert.rejects(googleFreeTranslate(async()=>({ok:false,status:429}),'hello','zh-CN'),/限流/);
 await assert.rejects(googleFreeTranslate(async()=>({ok:true,json:async()=>({error:'bad'})}),'hello','en'),/有效译文/);
});
test('Google can be enabled without keys; DeepL still requires a key',()=>{const dir=mkdtempSync(join(tmpdir(),'zl-free-'));try{const svc=createTranslationService({directory:dir,safeStorage:{},fetch:()=>{}});const c={provider:'google',sendEnabled:true,receiveEnabled:true,sendLanguage:'en',receiveLanguage:'zh-CN'};assert.equal(svc.save('a',c,'').sendEnabled,true);assert.throws(()=>svc.save('a',{...c,provider:'deepl'},''),/API Key/)}finally{rmSync(dir,{force:true,recursive:true})}});
test('history progress does not count failures as submitted and interrupted tasks are not completed',()=>{const t={state:'running',results:[{state:'submitted'},{state:'failed'},{state:'submitting'}]};assert.deepEqual(taskStats(t),{total:3,submitted:1,failed:1,done:2});assert.equal(taskState(t),'interrupted');t.state='finished';assert.equal(taskState(t),'failed')});
import vm from 'node:vm';
const {pageAction,validateAction}=require('../desktop/whatsapp-actions.cjs');
test('revoke checks own message and chat; rejection cannot be counted as success',async()=>{
 const request={accountId:'a',action:'revoke',chatId:'123@c.us',messageId:'true_123@c.us_ABC'};validateAction(request);assert.throws(()=>validateAction({...request,messageId:'true_456@c.us_ABC'}));
 let called=0;const WPP={isReady:true,conn:{isAuthenticated:()=>true},chat:{get:async()=>({}),getMessageById:async()=>({id:{fromMe:false,remote:'123@c.us'}}),deleteMessage:async()=>{called++;return {isRevoked:false}}}};
 const ctx=vm.createContext({WPP,request});const run=()=>vm.runInContext('('+pageAction.toString()+')(request)',ctx);await assert.rejects(run(),/自己发送/);assert.equal(called,0);WPP.chat.getMessageById=async()=>({id:{fromMe:true,remote:'123@c.us'}});await assert.rejects(run(),/未确认撤回/);assert.equal(called,1);WPP.chat.deleteMessage=async()=>({isRevoked:true});assert.equal((await run()).revoked,true);
});
