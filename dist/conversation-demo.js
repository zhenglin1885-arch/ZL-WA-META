import {safeTranslationSettings,TRANSLATION_LANGUAGES} from './translation-config.js';
import {createMessageDraft,editMessageDraft,resetMessageDraft,beginMessageSend,finishMessageTranslation,changeDraftTranslationSettings} from './conversation-flow.js';

// Fixed, labelled examples for reviewing UI; no translation service or message transport.
const samples=[
 {'en':'Hello! How can I help you?','zh-CN':'你好！有什么可以帮你？','zh-TW':'你好！有什麼可以幫你？','pt-BR':'Olá! Como posso ajudar?','pt-PT':'Olá! Como posso ajudar?','es':'¡Hola! ¿Cómo puedo ayudarte?','fr':'Bonjour ! Comment puis-je vous aider ?','de':'Hallo! Wie kann ich Ihnen helfen?','it':'Ciao! Come posso aiutarti?','ja':'こんにちは！どのようなご用件でしょうか？','ko':'안녕하세요! 무엇을 도와드릴까요?','ru':'Здравствуйте! Чем могу помочь?','ar':'مرحباً! كيف يمكنني مساعدتك؟','hi':'नमस्ते! मैं आपकी कैसे मदद कर सकता हूँ?','id':'Halo! Ada yang bisa saya bantu?','ms':'Helo! Bagaimana saya boleh membantu?','th':'สวัสดี! มีอะไรให้ช่วยไหม?','vi':'Xin chào! Tôi có thể giúp gì cho bạn?','tr':'Merhaba! Size nasıl yardımcı olabilirim?','nl':'Hallo! Hoe kan ik u helpen?','pl':'Dzień dobry! W czym mogę pomóc?','uk':'Вітаю! Чим можу допомогти?'},
 {'en':'Thank you for your message.','zh-CN':'谢谢你的消息。','zh-TW':'謝謝你的訊息。','pt-BR':'Obrigado pela sua mensagem.','pt-PT':'Obrigado pela sua mensagem.','es':'Gracias por tu mensaje.','fr':'Merci pour votre message.','de':'Vielen Dank für Ihre Nachricht.','it':'Grazie per il tuo messaggio.','ja':'メッセージありがとうございます。','ko':'메시지 감사합니다.','ru':'Спасибо за ваше сообщение.','ar':'شكراً على رسالتك.','hi':'आपके संदेश के लिए धन्यवाद।','id':'Terima kasih atas pesan Anda.','ms':'Terima kasih atas mesej anda.','th':'ขอบคุณสำหรับข้อความของคุณ','vi':'Cảm ơn tin nhắn của bạn.','tr':'Mesajınız için teşekkür ederim.','nl':'Bedankt voor uw bericht.','pl':'Dziękuję za wiadomość.','uk':'Дякую за ваше повідомлення.'}
];
export const SAMPLE_DRAFT=samples[1]['zh-CN'];
export function sampleTranslation(text,target){
 const sample=samples.find(row=>Object.values(row).some(value=>value.trim()===text.trim()));
 if(!sample?.[target])throw new Error('真实翻译尚未接入。请点击“填入示例原文”体验流程；你的内容已保留。');
 return sample[target];
}
const wait=()=>new Promise(resolve=>setTimeout(resolve,550));
const languageName=id=>TRANSLATION_LANGUAGES.find(([code])=>code===id)?.[1]||id;

export function createConversationSession(initialConfig){
 const listeners=new Set();let sequence=0;
 const state={config:safeTranslationSettings(initialConfig),draft:createMessageDraft(),messages:[]};
 const emit=()=>listeners.forEach(listener=>listener());
 function addReceived(missed=false){
  const message={id:++sequence,direction:'received',text:samples[state.messages.filter(m=>m.direction==='received').length%2].en,translation:'',target:'',phase:'idle',error:'',generation:0,missed};
  state.messages.push(message);emit();if(state.config.receive.enabled&&!missed)translateReceived(message.id);return message;
 }
 async function translateReceived(id){
  const message=state.messages.find(m=>m.id===id&&m.direction==='received');if(!message||message.phase==='translating')return;
  const generation=++message.generation,target=state.config.receive.targetLanguage;message.phase='translating';message.error='';emit();
  await wait();
  if(message.generation!==generation)return;
  try{message.translation=sampleTranslation(message.text,target);message.target=target;message.phase='done';message.missed=false}
  catch(error){message.error=error.message;message.phase='error'}emit();
 }
 async function send(){
  const action=beginMessageSend(state.draft,state.config.send);
  if(action.type==='noop')return;
  if(action.type==='sent'){state.messages.push({id:++sequence,direction:'sent',text:action.text});emit();return}
  emit();await wait();let result;
  try{result={text:sampleTranslation(action.request.text,action.request.settings.targetLanguage)}}catch(error){result={error:error.message}}
  if(finishMessageTranslation(state.draft,action.request,result))emit();
 }
 function applyConfig(config){
  const next=safeTranslationSettings(config);
  if(JSON.stringify(next.send)!==JSON.stringify(state.config.send))changeDraftTranslationSettings(state.draft);
  const receiveChanged=JSON.stringify(next.receive)!==JSON.stringify(state.config.receive);state.config=next;
  if(receiveChanged){
   for(const message of state.messages.filter(m=>m.direction==='received')){
    message.generation++;message.phase='idle';message.translation='';message.error='';message.target='';
    if(next.receive.enabled&&!message.missed)translateReceived(message.id);
   }
  }emit();
 }
 addReceived();addReceived(true);
 return {state,cacheStats(){const translations=state.messages.filter(m=>m.direction==='received'&&m.translation).map(m=>m.translation);return {count:translations.length,bytes:new TextEncoder().encode(translations.join('')).length}},clearCache(){for(const m of state.messages.filter(m=>m.direction==='received')){m.generation++;m.translation='';m.target='';m.error='';m.phase='idle';m.missed=true}emit()},subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener)},send,translateReceived,addReceived,applyConfig,
  edit(text){return editMessageDraft(state.draft,text)},fillSample(){resetMessageDraft(state.draft,SAMPLE_DRAFT);emit()}};
}

function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
export function createConversationDemo(session,{accountName,onClose,icon,platformName='WhatsApp',chatName}){
 const root=node('section','conversation-demo');root.setAttribute('aria-label',platformName+' 翻译交互演示');root.classList.toggle('facebook-conversation',platformName==='Facebook Business');
 root.innerHTML=`<header class="conversation-header"><span class="conversation-avatar"></span><div><strong>示例联系人</strong><small class="conversation-account"></small></div><button class="button quiet conversation-add" type="button">接收示例</button><button class="icon-button conversation-close" type="button" aria-label="退出对话演示" title="返回登录区域"></button></header>
 <div class="conversation-demo-banner"><span>对话演示</span>固定示例译文 · 不连接 WhatsApp，不发送真实消息</div>
 <div class="conversation-messages" role="log" aria-label="示例消息"></div>
 <div class="conversation-composer"><div class="conversation-composer-meta"><span class="conversation-config"></span><button class="conversation-fill" type="button">填入示例原文</button></div><p class="conversation-send-status" role="status" aria-live="polite"></p><form class="conversation-input-row"><textarea rows="2" aria-label="对话消息输入框" placeholder="输入内容…"></textarea><button class="conversation-send" type="submit" aria-label="发送" title="发送"><span></span><small>发送</small></button></form><p class="conversation-key-hint">Enter 发送 · Shift + Enter 换行</p></div>`;
 const query=selector=>root.querySelector(selector),input=query('textarea'),sendButton=query('.conversation-send');
 query('.conversation-demo-banner').replaceChildren(node('span','','对话演示'),document.createTextNode('固定示例译文 · 不连接 '+platformName+'，不发送真实消息'));
 query('.conversation-header strong').textContent=chatName||(platformName==='Facebook Business'?'Facebook Business · 示例联系人':'示例联系人');
 query('.conversation-avatar').innerHTML=icon('person',23);query('.conversation-close').innerHTML=icon('close',16);sendButton.querySelector('span').innerHTML=icon('send',20);query('.conversation-account').textContent='当前账号：'+accountName;
 query('.conversation-close').onclick=onClose;query('.conversation-add').onclick=()=>session.addReceived();query('.conversation-fill').onclick=()=>{session.fillSample();input.focus()};
 input.oninput=()=>{session.edit(input.value);renderComposer()};
 input.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();if(!event.repeat)session.send()}};
 query('form').onsubmit=event=>{event.preventDefault();session.send()};
 function renderMessages(){
  const list=query('.conversation-messages'),nearEnd=list.scrollHeight-list.scrollTop-list.clientHeight<80;
  const focusedId=document.activeElement?.dataset?.messageId;list.replaceChildren();list.append(node('div','conversation-day','示例对话'));
  for(const message of session.state.messages){
   const bubble=node('article','conversation-bubble '+message.direction);bubble.append(node('p','conversation-original',message.text));
   if(message.direction==='received'){
    if(message.translation){const translated=node('div','conversation-translation');translated.append(node('small','',languageName(message.target)+' · 示例译文'),node('p','',message.translation));bubble.append(translated)}
    if(message.error)bubble.append(node('p','conversation-message-error',message.error));
    if(message.missed&&!message.translation)bubble.append(node('small','conversation-missed','漏译示例，可手动重试'));
    const bottom=node('div','conversation-bubble-bottom'),retry=node('button','conversation-translate-button');retry.type='button';retry.dataset.messageId=String(message.id);retry.disabled=message.phase==='translating';
    const symbol=node('span');symbol.innerHTML=icon('translate',14);retry.append(symbol,document.createTextNode(message.phase==='translating'?'翻译中…':message.translation?'重新翻译':message.error?'重试翻译':'点击翻译'));retry.onclick=()=>session.translateReceived(message.id);
    bottom.append(retry,node('small','','收到 · 示例'));bubble.append(bottom);
   }else bubble.append(node('small','conversation-sent-note','已加入演示对话 · 未实际发送'));
   list.append(bubble);
  }
  if(focusedId){const button=[...list.querySelectorAll('[data-message-id]')].find(el=>el.dataset.messageId===focusedId);if(button&&!button.disabled)button.focus({preventScroll:true})}
  if(nearEnd)list.scrollTop=list.scrollHeight;
 }
 function renderComposer(){
  const {draft,config}=session.state,locked=draft.phase==='translating';
  if(input.value!==draft.text)input.value=draft.text;input.readOnly=locked;input.setAttribute('aria-busy',String(locked));sendButton.disabled=locked||!draft.text.trim();query('.conversation-fill').disabled=locked;
  const status=query('.conversation-send-status');status.classList.toggle('error',Boolean(draft.error));status.classList.toggle('review',draft.phase==='review');
  status.textContent=draft.error||(locked?'翻译中…':draft.phase==='review'?'译文已替换输入内容。可自行校正，再次点击发送。':config.send.enabled?'第一次点击发送生成译文；检查后再次点击发送。':'发送翻译已关闭，点击发送直接加入演示对话。');
  query('.conversation-config').textContent='发送：'+(config.send.enabled?languageName(config.send.targetLanguage):'关闭')+' · 接收：'+(config.receive.enabled?languageName(config.receive.targetLanguage):'关闭');
 }
 const render=()=>{renderMessages();renderComposer()};const unsubscribe=session.subscribe(render);render();
 return {element:root,destroy:unsubscribe};
}
