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
   const job={id:++s.seq,kind:'send',chat,text,input,editable:input.getAttribute('contenteditable')};s.jobs.set(job.id,job);s.queue.unshift(job.id);input.setAttribute('contenteditable','false');note('翻译中…完成后请检查译文，再次发送。');
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
 const readingKey=JSON.stringify([config.receiveEnabled,config.receiveLanguage,config.provider,config.model]);
 if(s.readingKey!==readingKey){
  for(const j of [...s.jobs.values()])if(j.kind==='receive')s.jobs.delete(j.id);
  for(const e of document.querySelectorAll('.zl-received-translation'))e.remove();
  s.seen.clear();s.readingKey=readingKey;
 }
 if(!config.previewEnabled)for(const j of [...s.jobs.values()])if(j.kind==='receive'&&j.automatic){s.jobs.delete(j.id);if(j.block)j.block.pending=false}
 if(config.receiveEnabled){const chat=active();let autoBudget=2;
  if(chat)for(const row of [...document.querySelectorAll('[data-id]')].slice(-200)){
   if(!row.querySelector('.message-in,.message-out')&&!row.closest('.message-in,.message-out'))continue;
   const source=row.querySelector('[data-testid="msg-text"],span.selectable-text');if(!source||!source.innerText?.trim())continue;
   const text=source.innerText,key=chat+'|'+row.getAttribute('data-id')+'|'+readingKey+'|'+text;
   let block=row.querySelector('.zl-received-translation');
   if(block&&block.translationKey!==key){block.remove();block=null}
   if(!block){
    block=document.createElement('div');block.className='zl-received-translation';block.translationKey=key;
    block.style.cssText='border-top:1px solid #ffffff22;margin-top:6px;padding:5px 0;font-size:12px;white-space:pre-wrap;color:#65adff;text-align:left';
    const output=document.createElement('div'),button=document.createElement('button');
    button.type='button';button.textContent='点击翻译';button.style.cssText='display:inline-block;background:#155eef;color:white;border:0;border-radius:4px;padding:5px 9px;margin-top:4px;font-size:12px;cursor:pointer';
    block.append(output,button);block.output=output;block.button=button;
    const host=source.closest('[data-pre-plain-text]')||source.parentElement;host.append(block);
    block.enqueue=automatic=>{
     if(block.pending||!s.config.receiveEnabled||s.readingKey!==readingKey||!source.isConnected||source.innerText!==text)return;
     block.pending=true;button.disabled=true;button.textContent='翻译中…';output.textContent='';
     const job={id:++s.seq,kind:'receive',chat,text,key,row,source,block,readingKey,automatic};s.jobs.set(job.id,job);
     if(automatic)s.queue.push(job.id);else s.queue.unshift(job.id);
    };
    button.onclick=e=>{e.preventDefault();e.stopPropagation();block.enqueue(false)};
   }
   const cached=s.seen.get(key);
   if(!block.pending){
    block.button.disabled=false;block.output.textContent=cached?.text||cached?.error||'';
    block.output.style.color=cached?.error?'#edb16d':'#65adff';block.button.textContent=cached?.text?'重新翻译':'点击翻译';
    if(config.previewEnabled&&!cached&&autoBudget>0){block.enqueue(true);autoBudget--}
   }
  }
 }

 const jobs=[];while(s.queue.length&&jobs.length<3){const job=s.jobs.get(s.queue.shift());if(job)jobs.push({id:job.id,kind:job.kind,text:job.text,chat:job.chat})}return jobs;
}
async function apply(result){
 const s=globalThis.__zlTranslation,job=s?.jobs.get(result.id);if(!job)return;
 if(job.kind==='send'){
  if(job.input?.isConnected)job.input.setAttribute('contenteditable',job.editable||'true');
  if(result.error){const n=document.getElementById('zl-translation-status');if(n)n.textContent=result.error+'；原文未发送，请重试。';s.jobs.delete(job.id);return}
  job.translated=result.text;return;
 }
 const valid=s.config.receiveEnabled&&s.readingKey===job.readingKey&&(!job.automatic||s.config.previewEnabled);
 if(valid){
  const cached=result.error?{error:result.error}:{text:result.text};s.seen.set(job.key,cached);
  if(s.seen.size>1000)s.seen.delete(s.seen.keys().next().value);
  if(job.source?.isConnected&&job.source.innerText===job.text&&job.block?.isConnected&&job.block.translationKey===job.key){
   job.block.pending=false;job.block.output.textContent=cached.text||cached.error;job.block.output.style.color=result.error?'#edb16d':'#65adff';job.block.button.disabled=false;job.block.button.textContent=result.error?'点击翻译':'重新翻译';
  }
 }
 s.jobs.delete(job.id);
}
function startTranslationMonitor(wc,accountId,service){let stopped=false,busy=false,generation=0,initialized=false;const nav=()=>generation++;wc.on('did-start-navigation',nav);
 const poll=async()=>{if(stopped||busy||wc.isDestroyed())return;const c=service.get(accountId);if(!c.sendEnabled&&!c.receiveEnabled&&!initialized)return;initialized=true;busy=true;const ticket=generation;
  try{const jobs=await wc.executeJavaScript('('+collect.toString()+')('+JSON.stringify(c)+')');for(const j of jobs){if(stopped||ticket!==generation)break;let result={id:j.id};try{result.text=await service.translate(accountId,j.kind,j.text)}catch(e){result.error=e.message}if(JSON.stringify(service.get(accountId))!==JSON.stringify(c))result={id:j.id,error:'翻译设置已变化，请重新翻译'};if(!stopped&&ticket===generation&&!wc.isDestroyed())await wc.executeJavaScript('('+apply.toString()+')('+JSON.stringify(result)+')')}}catch{}finally{busy=false}};
 const timer=setInterval(poll,1000);timer.unref?.();return ()=>{stopped=true;clearInterval(timer);wc.removeListener('did-start-navigation',nav)};
}
module.exports={startTranslationMonitor,collect,apply};
