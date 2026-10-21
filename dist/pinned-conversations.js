import {createConversationSession,createConversationDemo} from './conversation-demo.js';
import {createLocalChatPins} from './local-chat-pins.js';
import {createLocalChatNotes} from './local-chat-notes.js';
export const SAMPLE_CHATS=[{id:'sample-ana',name:'Ana',kind:'私聊'},{id:'sample-sales',name:'客户交流群',kind:'群聊'},{id:'sample-lucas',name:'Lucas',kind:'私聊'},{id:'sample-service',name:'售后服务群',kind:'群聊'},{id:'sample-marina',name:'Marina',kind:'私聊'},{id:'sample-partners',name:'合作伙伴群',kind:'群聊'}];
export function createPinnedConversationWorkspace(config,{storage,accountId}){
 let settings=config,activeId=SAMPLE_CHATS[0].id;const sessions=new Map();const pins=createLocalChatPins({storage,platform:'whatsapp',accountId});const notes=createLocalChatNotes({storage,platform:'whatsapp',accountId});
 return {pins,notes,cacheStats(){return [...sessions.values()].reduce((total,session)=>{const stats=session.cacheStats();return {count:total.count+stats.count,bytes:total.bytes+stats.bytes}},{count:0,bytes:0})},clearCache(){for(const session of sessions.values())session.clearCache()},preview(id){return sessions.get(id)?.state.messages.at(-1)?.text||'Thank you for your message.'},chats:SAMPLE_CHATS,get activeId(){return activeId},select(id){if(!SAMPLE_CHATS.some(c=>c.id===id))return false;activeId=id;return true},session(id=activeId){if(!sessions.has(id))sessions.set(id,createConversationSession(settings));return sessions.get(id)},applyConfig(next){settings=next;for(const session of sessions.values())session.applyConfig(next)}};
}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
const pinSVG='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 3 9 9m-7-7-4 6-3 1 8 8 1-3 6-4M9 15l-6 6"/></svg>';
export function createPinnedConversationDemo(workspace,options){
 const root=node('section','pinned-chat-workspace'),sidebar=node('aside','local-chat-sidebar'),heading=node('div','local-chat-heading'),list=node('div','local-chat-list'),main=node('div','local-chat-main'),status=node('p','local-pin-status');
 sidebar.setAttribute('aria-label','示例会话列表');status.setAttribute('role','status');heading.append(node('strong','','会话'),node('small','','本地置顶 · 不限数量'));sidebar.append(heading,node('p','local-chat-scope','仅在 ZL 软件内排序，不同步到 WhatsApp。'),list,status,node('p','local-chat-demo-note','以下 6 个会话均为示例'));root.append(sidebar,main);let view=null,previewUnsubscribe=null,editingNoteId=null,noteDraft='';
 function renderList(){
  const focused=document.activeElement?.dataset?.pinChat;list.replaceChildren();
  for(const chat of workspace.pins.sort(workspace.chats)){
   const pinned=workspace.pins.has(chat.id),row=node('div','local-chat-row has-customer-note'+(chat.id===workspace.activeId?' selected':'')+(pinned?' pinned':'')),select=node('button','local-chat-select'),identity=node('span','local-chat-identity');select.type='button';select.setAttribute('aria-pressed',String(chat.id===workspace.activeId));
   identity.append(node('strong','',chat.name));select.append(node('span','local-chat-avatar',chat.kind==='群聊'?'群':chat.name.slice(0,1)),identity);select.title=chat.kind+' · 示例'+(pinned?' · 本地置顶':'');select.onclick=()=>{workspace.select(chat.id);renderList();renderChat()};
   const content=node('div','local-chat-content'),noteText=workspace.notes.get(chat.id),note=node('button','customer-note'+(noteText?'':' empty'));
   note.type='button';note.dataset.noteChat=chat.id;note.title=noteText||'填写客户情况备注';note.setAttribute('aria-label','编辑 '+chat.name+' 的客户备注');const pen=node('span','customer-note-pen');pen.innerHTML='<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 16 11-11 4 4L8 20H4v-4ZM13 7l4 4"/></svg>';note.append(pen);if(noteText)note.append(node('span','customer-note-text',noteText));
   note.onclick=()=>{editingNoteId=chat.id;noteDraft=workspace.notes.get(chat.id);renderList();list.querySelector('.customer-note-input')?.focus()};
   const preview=node('button','local-chat-message-preview',workspace.preview(chat.id));preview.type='button';preview.dataset.previewChat=chat.id;preview.title=workspace.preview(chat.id);preview.onclick=select.onclick;content.append(select,note,preview);
   const pin=node('button','local-chat-pin');pin.type='button';pin.dataset.pinChat=chat.id;pin.innerHTML=pinSVG;pin.title=pinned?'取消本地置顶':'本地置顶';pin.setAttribute('aria-label',(pinned?'取消本地置顶：':'本地置顶：')+chat.name);pin.setAttribute('aria-pressed',String(pinned));
   pin.onclick=()=>{try{workspace.pins.set(chat.id,!pinned);status.classList.remove('error');status.textContent=pinned?'已取消本地置顶':'已置顶 '+workspace.pins.ids.length+' 个会话，仅本软件生效';renderList()}catch{status.classList.add('error');status.textContent='置顶未能保存，请检查浏览器存储后重试。'}};
   row.append(content,pin);
   if(editingNoteId===chat.id){
    const input=node('input','customer-note-input');input.type='text';input.value=noteDraft;input.setAttribute('aria-label',chat.name+'的客户情况');input.title='Enter 保存，Esc 取消；离开输入框自动保存';input.oninput=()=>{noteDraft=input.value};
    let finished=false;
    const finish=(save,focus=false)=>{if(finished)return;try{if(save)workspace.notes.set(chat.id,input.value)}catch{input.setAttribute('aria-invalid','true');status.classList.add('error');status.textContent='备注保存失败，请重试。';return}finished=true;editingNoteId=null;noteDraft='';const value=workspace.notes.get(chat.id);note.classList.toggle('empty',!value);note.title=value||'填写客户情况备注';note.replaceChildren(pen);if(value)note.append(node('span','customer-note-text',value));input.replaceWith(note);status.textContent='';status.classList.remove('error');if(focus)note.focus({preventScroll:true})};
    input.onkeydown=e=>{e.stopPropagation();if(e.isComposing||e.keyCode===229)return;if(e.key==='Enter'){e.preventDefault();finish(true,true)}else if(e.key==='Escape'){e.preventDefault();finish(false,true)}};
    input.onblur=()=>{if(input.isConnected)finish(true)};
    note.replaceWith(input);
   }
   list.append(row);
  }
  if(focused)[...list.querySelectorAll('[data-pin-chat]')].find(b=>b.dataset.pinChat===focused)?.focus({preventScroll:true});
 }
 function renderChat(){
  view?.destroy();previewUnsubscribe?.();const chat=workspace.chats.find(c=>c.id===workspace.activeId);view=createConversationDemo(workspace.session(),{...options,chatName:chat.name+' · '+chat.kind+'示例'});main.replaceChildren(view.element);previewUnsubscribe=workspace.session().subscribe(()=>{const preview=[...list.querySelectorAll('[data-preview-chat]')].find(b=>b.dataset.previewChat===chat.id);if(preview){preview.textContent=workspace.preview(chat.id);preview.title=preview.textContent}});
 }
 renderList();renderChat();return {element:root,destroy(){previewUnsubscribe?.();view?.destroy()}};
}
