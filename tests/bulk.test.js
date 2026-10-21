import test from 'node:test';
import assert from 'node:assert/strict';
import {filterRecipients,toggleVisible,selectionState,sampleRecipients,validateContent,messagePayload,MESSAGE_TYPES} from '../dist/bulk-model.js';
const content={type:'text',text:'你好',name:'',phone:'',file:null};
test('分类全选只作用于当前列表，并保留隐藏分类的选择',()=>{
 const rows=sampleRecipients('account-a'),groups=filterRecipients(rows,'group'),privates=filterRecipients(rows,'private');
 let selected=toggleVisible(new Set(),groups,true);assert.equal(selected.size,4);
 selected.add(privates[0].id);selected=toggleVisible(selected,groups,false);assert.deepEqual([...selected],[privates[0].id]);
 assert.deepEqual(selectionState(selected,privates),{count:1,checked:false,indeterminate:true});
 const search=filterRecipients(rows,'all','Ana');assert.equal(search.length,1);selected=toggleVisible(selected,search,true);assert.equal(selected.size,1);
 assert.equal(filterRecipients(rows,'group','Ana').length,0);assert.equal(selectionState(new Set(),[]).checked,false);
});
test('账号对象 ID 独立，已选对象不串到其他账号',()=>{
 const a=sampleRecipients('a'),b=sampleRecipients('b'),selected=toggleVisible(new Set(),a,true);assert.equal(selectionState(selected,b).count,0);
});
test('图文生成一条带 caption 的图片消息，纯图片不携带旧文字',()=>{
 const file=new File(['picture'],'photo.png',{type:'image/png'});
 const payload=messagePayload({...content,type:'caption',file});assert.equal(payload.kind,'image');assert.equal(payload.caption,'你好');assert.equal(payload.file,file);assert.equal(Array.isArray(payload),false);
 assert.equal(messagePayload({...content,type:'image',file}).caption,'');
 assert.equal(messagePayload({...content,type:'video',file:new File(['movie'],'video.mp4',{type:'video/mp4'})}).caption,'');
});
test('文件类型及空内容校验阻止无效任务，语音不在消息类型中',()=>{
 assert.ok(validateContent({...content,text:' '}));assert.ok(validateContent({...content,type:'image'}));assert.ok(validateContent({...content,type:'video',file:new File(['a'],'pic.png',{type:'image/png'})}));
 assert.ok(validateContent({...content,type:'caption',text:'',file:new File(['a'],'pic.png',{type:'image/png'})}));assert.equal(MESSAGE_TYPES.length,6);assert.ok(!MESSAGE_TYPES.some(([id])=>id==='audio'));
});
test('联系人生成独立名片载荷并转义昵称，拒绝无效号码',()=>{
 const c={...content,type:'contact',name:'A;B\nC',phone:'+5511999999999'},p=messagePayload(c);assert.equal(p.kind,'contact');assert.ok(p.vcard.includes('FN:A\\;B\\nC\r\n'));assert.ok(p.vcard.endsWith('END:VCARD'));assert.ok(validateContent({...c,phone:'bad'}));
});
