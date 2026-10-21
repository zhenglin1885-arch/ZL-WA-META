export const MESSAGE_TYPES=[['text','文本','text'],['image','图片','image'],['caption','图文','image'],['video','视频','video'],['file','文件','file'],['contact','名片','person']];
export function filterRecipients(items,tab='all',query=''){
 const q=query.trim().toLocaleLowerCase();
 return items.filter(r=>(tab==='all'||r.kind===tab)&&[r.name,r.phone,r.remark].join(' ').toLocaleLowerCase().includes(q));
}
export function toggleVisible(selected,visible,checked){const next=new Set(selected);for(const r of visible){if(checked)next.add(r.id);else next.delete(r.id)}return next}
export function selectionState(selected,visible){const count=visible.filter(r=>selected.has(r.id)).length;return {count,checked:visible.length>0&&count===visible.length,indeterminate:count>0&&count<visible.length}}
export function validateContent(c){
 if(c.type==='text'&&!c.text.trim())return '请输入文本内容。';
 if(['image','caption','video','file'].includes(c.type)&&!c.file)return '请选择要发送的文件。';
 if(['image','caption'].includes(c.type)&&c.file&&!c.file.type.startsWith('image/'))return '请选择图片文件。';
 if(c.type==='video'&&c.file&&!c.file.type.startsWith('video/'))return '请选择视频文件。';
 if(c.type==='caption'&&!c.text.trim())return '请填写与图片一起发送的文字。';
 if(c.type==='contact'&&!/^\+?[1-9]\d{4,14}$/.test(c.phone.trim()))return '请填写包含国家区号的电话号码，5–15 位数字。';
 if(!MESSAGE_TYPES.some(([id])=>id===c.type))return '请选择消息类型。';
 return '';
}
const vEscape=value=>String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function messagePayload(c){
 if(validateContent(c))throw new Error(validateContent(c));
 if(c.type==='contact')return {kind:'contact',name:c.name.trim(),phone:c.phone.trim(),vcard:['BEGIN:VCARD','VERSION:3.0','FN:'+vEscape(c.name.trim()||c.phone.trim()),'TEL;TYPE=CELL:'+c.phone.trim(),'END:VCARD'].join('\r\n')};
 if(c.type==='text')return {kind:'text',text:c.text};
 return {kind:c.type==='caption'?'image':c.type,file:c.file,caption:c.type==='caption'?c.text:''};
}
export function sampleRecipients(accountId){
 const rows=[['group','巴西客户交流群','群聊 · 示例'],['group','产品交流小组','群聊 · 示例'],['group','售后服务群','群聊 · 示例'],['group','合作伙伴群','群聊 · 示例'],['private','Ana · 示例','+55 00 00000-0001'],['private','Lucas · 示例','+55 00 00000-0002'],['private','Marina · 示例','+55 00 00000-0003'],['private','Pedro · 示例','+55 00 00000-0004']];
 return rows.map(([kind,name,phone],i)=>({id:accountId+':sample:'+i,kind,name,phone,remark:'',sample:true}));
}
export function openTaskStore(){return new Promise((resolve,reject)=>{
 const req=indexedDB.open('zl-bulk-demo-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('tasks',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
})}
export async function readTasks(){const db=await openTaskStore();return new Promise((resolve,reject)=>{const tx=db.transaction('tasks','readonly'),req=tx.objectStore('tasks').getAll();tx.oncomplete=()=>{db.close();resolve(req.result.sort((a,b)=>b.createdAt-a.createdAt))};tx.onerror=()=>{db.close();reject(tx.error)}})}
export async function saveTask(task){const db=await openTaskStore();return new Promise((resolve,reject)=>{const tx=db.transaction('tasks','readwrite');tx.objectStore('tasks').put(task);tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>{db.close();reject(tx.error)}})}
