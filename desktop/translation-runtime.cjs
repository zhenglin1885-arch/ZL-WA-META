// No IPC, credentials or Node access are exposed to WhatsApp. The host polls this queue.
async function collect(config){
 if(!globalThis.WPP?.isReady)return [];
 let s=globalThis.__zlTranslation;
 const active=()=>globalThis.WPP.chat.getActiveChat()?.id?.toString();
 const editor=()=>document.querySelector('footer [contenteditable="true"][role="textbox"],footer [contenteditable="true"]');
 function note(text){let e=document.getElementById('zl-translation-status');if(!e){e=document.createElement('div');e.id='zl-translation-status';e.style.cssText='font-size:12px;color:#e9b95a;padding:4px 12px';document.querySelector('footer')?.prepend(e)}e.textContent=text}
 if(!s){
  s={config,jobs:new Map(),queue:[],ready:new Set(),seen:new Map(),seq:0};globalThis.__zlTranslation=s;
  const send=event=>{
   if(!s.config.sendEnabled||event.isComposing||event.keyCode===229)return;
   const input=editor(),footer=document.querySelector('footer');if(!input||!footer?.contains(event.target))return;
   const isEnter=event.type==='keydown'&&event.key==='Enter'&&!event.shiftKey&&!event.ctrlKey&&!event.altKey;
   const b=event.target.closest?.('button,[role="button"]');const isButton=event.type==='click'&&b?.querySelector('[data-icon="send"],[data-icon="wds-ic-send-filled"]');
   if(!isEnter&&!isButton)return;if(isEnter&&event.repeat){event.preventDefault();event.stopImmediatePropagation();return}const chat=active(),text=input.innerText;if(!chat||!text.trim())return;
   if(s.ready.has(chat)){s.ready.delete(chat);note('');return}
   event.preventDefault();event.stopImmediatePropagation();
   if([...s.jobs.values()].some(j=>j.kind==='send'&&j.chat===chat))return;
   const job={id:++s.seq,kind:'send',chat,text,input,editable:input.getAttribute('contenteditable')};s.jobs.set(job.id,job);s.queue.push(job.id);input.setAttribute('contenteditable','false');note('翻译中…完成后请检查译文，再次发送。');
  };
  document.addEventListener('keydown',send,true);document.addEventListener('click',send,true);
 }
 s.config=config;
 for(const job of [...s.jobs.values()])if((job.kind==='send'&&!config.sendEnabled)||(job.kind==='receive'&&!config.receiveEnabled)){if(job.input?.isConnected)job.input.setAttribute('contenteditable',job.editable||'true');s.jobs.delete(job.id);if(job.key)s.seen.delete(job.key)}
 if(!config.sendEnabled)s.ready.clear();
 // Restore an editor when the user switches chats while translation is in flight.
 for(const j of s.jobs.values())if(j.kind==='send'&&j.chat!==active()&&j.input?.isConnected)j.input.setAttribute('contenteditable',j.editable||'true');
 for(const j of [...s.jobs.values()])if(j.kind==='send'&&j.translated!==undefined&&j.chat===active()){
  const input=editor();if(input&&input.innerText===j.text){await WPP.chat.setInputText(j.translated,j.chat);s.ready.add(j.chat);note('译文已填入，请检查后再次发送。')}else note('原文已变化，未覆盖当前输入，请重新翻译。');s.jobs.delete(j.id);
 }
 if(config.receiveEnabled){const chat=active();if(chat)for(const row of [...document.querySelectorAll('[data-id]')].slice(-40)){
  if(!row.querySelector('.message-in')&&!row.closest('.message-in'))continue;
  const source=row.querySelector('[data-testid="msg-text"],span.selectable-text');if(!source||!source.innerText?.trim())continue;
  const key=chat+'|'+row.getAttribute('data-id')+'|'+config.receiveLanguage+'|'+config.provider+'|'+source.innerText;
  if(s.seen.has(key))continue;s.seen.set(key,true);if(s.seen.size>1000)s.seen.delete(s.seen.keys().next().value);
  const job={id:++s.seq,kind:'receive',chat,text:source.innerText,key,row,source};s.jobs.set(job.id,job);s.queue.push(job.id);
 }}
 const jobs=[];while(s.queue.length&&jobs.length<3){const job=s.jobs.get(s.queue.shift());if(job)jobs.push({id:job.id,kind:job.kind,text:job.text,chat:job.chat})}return jobs;
}
async function apply(result){
 const s=globalThis.__zlTranslation,job=s?.jobs.get(result.id);if(!job)return;
 if(job.kind==='send'){
  if(job.input?.isConnected)job.input.setAttribute('contenteditable',job.editable||'true');
  if(result.error){const n=document.getElementById('zl-translation-status');if(n)n.textContent=result.error+'；原文未发送，请重试。';s.jobs.delete(job.id);return}
  job.translated=result.text;return;
 }
 if(job.source?.isConnected){let block=job.row.querySelector('.zl-received-translation');if(!block){block=document.createElement('div');block.className='zl-received-translation';block.style.cssText='border-top:1px solid #ffffff22;margin-top:4px;padding-top:4px;font-size:12px;color:#65adff;white-space:pre-wrap';job.source.parentElement.append(block)}block.replaceChildren();if(result.error){block.style.color='#edb16d';block.append(document.createTextNode(result.error+' '));const retry=document.createElement('button');retry.textContent='重试翻译';retry.onclick=()=>{s.seen.delete(job.key);block.remove()};block.append(retry)}else{block.style.color='#65adff';block.textContent=result.text}}
 if(!job.source?.isConnected)s.seen.delete(job.key);s.jobs.delete(job.id);
}
function startTranslationMonitor(wc,accountId,service){let stopped=false,busy=false,generation=0,initialized=false;const nav=()=>generation++;wc.on('did-start-navigation',nav);
 const poll=async()=>{if(stopped||busy||wc.isDestroyed())return;const c=service.get(accountId);if(!c.sendEnabled&&!c.receiveEnabled&&!initialized)return;initialized=true;busy=true;const ticket=generation;
  try{const jobs=await wc.executeJavaScript('('+collect.toString()+')('+JSON.stringify(c)+')');for(const j of jobs){if(stopped||ticket!==generation)break;let result={id:j.id};try{result.text=await service.translate(accountId,j.kind,j.text)}catch(e){result.error=e.message}if(!stopped&&ticket===generation&&!wc.isDestroyed())await wc.executeJavaScript('('+apply.toString()+')('+JSON.stringify(result)+')')}}catch{}finally{busy=false}};
 const timer=setInterval(poll,1000);timer.unref?.();return ()=>{stopped=true;clearInterval(timer);wc.removeListener('did-start-navigation',nav)};
}
module.exports={startTranslationMonitor,collect,apply};
