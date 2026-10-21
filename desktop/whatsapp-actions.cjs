// Executed only in the selected, authenticated WhatsApp WebContents.
async function pageAction(request){
 const w=globalThis.WPP;if(!w?.isReady||!w.conn.isAuthenticated())throw Error('请先登录此 WhatsApp 账号，并等待资料同步。');
 if(request.action==='list'){
  const chats=await w.chat.list({onlyGroups:request.groups===true,ignoreGroupMetadata:request.groups!==true});
  const result=[];for(const c of chats){const id=c.id.toString();if(!/@(?:c\.us|lid|g\.us)$/.test(id))continue;
   const row={id,name:String(c.name||c.formattedTitle||c.contact?.pushname||c.contact?.name||id),kind:id.endsWith('@g.us')?'group':'private'};
   if(request.groups){row.closed=typeof c.groupMetadata?.announce==='boolean'?c.groupMetadata.announce:null;try{row.admin=await w.group.iAmAdmin(id)}catch{row.admin=false}}
   result.push(row);
  }return result;
 }
 const chat=await w.chat.get(request.chatId);if(!chat)throw Error('当前账号中找不到所选聊天。');
 if(request.action==='group-mode'){
  if(!request.chatId.endsWith('@g.us')||!await w.group.iAmAdmin(request.chatId))throw Error('当前账号不是该群管理员。');
  const ok=await w.group.setProperty(request.chatId,'announcement',request.closed);if(ok===false)throw Error('WhatsApp 未接受群组设置。');return {closed:request.closed};
 }
 if(request.action==='send'){
  const c=request.content;let result;
  if(c.type==='text')result=await w.chat.sendTextMessage(request.chatId,c.text,{waitForAck:true});
  else if(c.type==='contact')result=await w.chat.sendVCardContactMessage(request.chatId,{id:c.phone.replace(/^\+/,'')+'@c.us',name:c.name||c.phone},{waitForAck:true});
  else result=await w.chat.sendFileMessage(request.chatId,c.data,{type:c.type==='file'?'document':c.type==='caption'?'image':c.type,caption:c.type==='caption'?c.text:'',filename:c.filename,mimetype:c.mime,waitForAck:true});
  return {id:String(result?.id||''),ack:typeof result?.ack==='number'?result.ack:null};
 }
 throw Error('不支持的操作');
}
function validateAction(request){
 if(!request||!['list','group-mode','send'].includes(request.action))throw Error('操作无效');
 if(typeof request.accountId!=='string'||!request.accountId||request.accountId.length>150)throw Error('账号无效');
 if(request.action==='list')return;
 if(typeof request.chatId!=='string'||!/^[-\d]+@(?:c\.us|lid|g\.us)$/.test(request.chatId))throw Error('聊天无效');
 if(request.action==='group-mode'){if(typeof request.closed!=='boolean')throw Error('群组设置无效');return}
 const c=request.content;if(!c||!['text','image','caption','video','file','contact'].includes(c.type))throw Error('消息类型无效');
 if(['text','caption'].includes(c.type)&&(typeof c.text!=='string'||!c.text.trim()||c.text.length>60000))throw Error('请填写有效文本，最多 60000 字符');
 if(c.type==='contact'&&(!/^\+?[1-9]\d{4,14}$/.test(c.phone)||typeof c.name!=='string'||c.name.length>150))throw Error('名片号码或姓名无效');
 if(['image','caption','video','file'].includes(c.type)){
  if(typeof c.data!=='string'||c.data.length>36000000||!/^data:[\w.+/-]+;base64,[A-Za-z0-9+/=]+$/.test(c.data))throw Error('文件无效或超过 25 MB');
  if(typeof c.filename!=='string'||c.filename.length>250||typeof c.mime!=='string'||c.mime.length>100)throw Error('文件信息无效');
  if(['image','caption'].includes(c.type)&&!c.mime.startsWith('image/'))throw Error('请选择图片');
  if(c.type==='video'&&!c.mime.startsWith('video/'))throw Error('请选择视频');
 }
}
async function runAction(accounts,request){
 validateAction(request);const item=accounts.items.get('whatsapp:'+request.accountId);
 if(!item?.view||item.sleeping||item.blocked)throw Error('账号已休眠、代理受阻或未启动。');
 return item.view.webContents.executeJavaScript('('+pageAction.toString()+')('+JSON.stringify(request)+')');
}
module.exports={runAction,validateAction,pageAction};
