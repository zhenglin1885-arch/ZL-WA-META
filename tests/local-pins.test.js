import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalChatPins,pinStorageKey} from '../dist/local-chat-pins.js';
import {createPinnedConversationWorkspace} from '../dist/pinned-conversations.js';
import {defaultTranslationSettings} from '../dist/translation-config.js';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
test('可置顶超过3个会话，刷新恢复，取消后恢复普通排序且不修改来源对象',()=>{
 const store=storage(),options={storage:store,platform:'whatsapp',accountId:'a'},pins=createLocalChatPins(options),chats=Array.from({length:12},(_,i)=>({id:'chat-'+i,officialPinned:false}));
 for(let i=8;i>=3;i--)pins.set(chats[i].id,true);
 assert.equal(pins.ids.length,6);assert.deepEqual(createLocalChatPins(options).ids,pins.ids);assert.deepEqual(pins.sort(chats).slice(0,6).map(c=>c.id),pins.ids);
 pins.set('chat-5',false);assert.equal(pins.has('chat-5'),false);assert.deepEqual(pins.sort(chats).slice(5).map(c=>c.id),['chat-0','chat-1','chat-2','chat-5','chat-9','chat-10','chat-11']);assert.ok(chats.every(c=>c.officialPinned===false));
});
test('不同账号和平台分别保存；写入失败不假装置顶成功',()=>{
 const store=storage(),a=createLocalChatPins({storage:store,platform:'whatsapp',accountId:'a'});a.set('chat',true);
 for(const [platform,accountId]of [['whatsapp','b'],['facebook','a']])assert.equal(createLocalChatPins({storage:store,platform,accountId}).has('chat'),false);
 const broken=createLocalChatPins({storage:{getItem:()=>null,setItem:()=>{throw new Error('quota')}},platform:'whatsapp',accountId:'a'});assert.throws(()=>broken.set('chat',true));assert.equal(broken.has('chat'),false);
 assert.notEqual(pinStorageKey('a:b','c'),pinStorageKey('a','b:c'));
});
test('切换并置顶其他会话时，异步翻译仍回到原会话且不自动发送',async()=>{
 const config=defaultTranslationSettings();config.send.enabled=true;const workspace=createPinnedConversationWorkspace(config,{storage:storage(),accountId:'account'}),first=workspace.session();first.fillSample();const pending=first.send();
 workspace.select('sample-sales');const second=workspace.session();second.edit('群聊草稿');workspace.pins.set('sample-sales',true);await pending;
 assert.equal(first.state.draft.phase,'review');assert.equal(second.state.draft.text,'群聊草稿');assert.equal(second.state.draft.phase,'original');assert.equal(first.state.messages.filter(m=>m.direction==='sent').length,0);
 workspace.select('sample-ana');assert.equal(workspace.session(),first);assert.equal(workspace.activeId,'sample-ana');
});
