import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {nativeAccountView} from '../dist/native-account-view.js';
const require=createRequire(import.meta.url);
const {readSnapshot,sanitizeSnapshot}=require('../desktop/whatsapp-metadata.cjs');
function page({chats=[],authenticated=true,user='123456789',server='c.us'}={}){
 const id={user,server,toString:()=>user+'@'+server};
 const context={WPP:{isReady:true,conn:{isAuthenticated:()=>authenticated,getMyUserId:()=>id,getMyUserWid:()=>id},profile:{getMyProfileName:()=>'<real name>'},contact:{getProfilePictureUrl:async()=>null},chat:{list:async()=>chats}},URL,Date};
 return vm.runInNewContext('('+readSnapshot.toString()+')()',context).then(s=>JSON.parse(JSON.stringify(s)));
}
test('snapshot returns own profile and sum of actual unread messages without chat contents',async()=>{
 const s=await page({chats:[{unreadCount:4,body:'private'},{unreadCount:2},{unreadCount:-1},{unreadCount:0}]});
 assert.equal(s.phoneNumber,'+123456789');assert.equal(s.nickname,'<real name>');assert.equal(s.unreadCount,6);assert.equal(s.avatarUrl,'');assert.ok(!JSON.stringify(s).includes('private'));
});
test('LID is never displayed as a phone number, logout clears old profile and unread',async()=>{
 assert.equal((await page({server:'lid'})).phoneNumber,'');
 const s=sanitizeSnapshot(await page({authenticated:false}));assert.equal(s.authenticated,false);assert.equal(s.avatarUrl,'');assert.equal(s.unreadCount,0);
});
test('snapshot rejects remote avatar URLs, invalid counts and unrequested fields',()=>{
 const s=sanitizeSnapshot({authenticated:true,phoneNumber:'secret',avatarUrl:'https://evil.test/tracker',unreadCount:-2,cookie:'secret'});
 assert.deepEqual(s,{authenticated:true});assert.equal(sanitizeSnapshot({authenticated:true,avatarUrl:'data:image/svg+xml;base64,AAAA'}).avatarUrl,undefined);
});
test('real sidebar values preserve remarks; cap badge only, never clear unread on selecting',()=>{
 const profile={name:'环境 01',remark:'本地备注'},status={state:'ready',metadata:{authenticated:true,nickname:'真实昵称',phoneNumber:'+123456789',unreadCount:123,avatarUrl:'data:image/png;base64,AAAA'}};
 const a=nativeAccountView(profile,status),b=nativeAccountView({...profile,selected:true},status);
 assert.equal(a.unreadCount,123);assert.equal(a.unreadLabel,'99+');assert.equal(a.nickname,'真实昵称');assert.equal(a.remark,'本地备注');assert.equal(a.status,'green');assert.equal(b.unreadCount,123);
 const read=nativeAccountView(profile,{...status,metadata:{...status.metadata,unreadCount:0}});assert.equal(read.unreadLabel,'');
});

test('own same-origin blob avatar is converted inside its WhatsApp page',async()=>{
 let fetched='';const context={WPP:{isReady:true,conn:{isAuthenticated:()=>true,getMyUserId:()=>({user:'123456',server:'c.us',toString:()=> '123456@c.us'})},profile:{getMyProfileName:()=> 'A',getMyProfilePicture:async()=>({img:'blob:https://web.whatsapp.com/own-avatar'})},contact:{getProfilePictureUrl:async()=> 'blob:https://web.whatsapp.com/own-avatar'},chat:{list:async()=>[]}},URL,Date,AbortSignal,fetch:async url=>{fetched=url;return {ok:true,blob:async()=>({type:'image/png',size:3})}},FileReader:class{readAsDataURL(){this.result='data:image/png;base64,AAAA';this.onload()}}};
 const s=await vm.runInNewContext('('+readSnapshot.toString()+')()',context);
 assert.equal(s.avatarUrl,'data:image/png;base64,AAAA');assert.equal(fetched,'blob:https://web.whatsapp.com/own-avatar');
});
