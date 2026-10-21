import {TRANSLATION_PROVIDERS,TRANSLATION_LANGUAGES,safeTranslationSettings} from './translation-config.js';

function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node}

function createLanguagePicker({id,label,allowAuto,onChange,icon}){
 const choices=allowAuto?[['auto','自动识别','Automatic'],...TRANSLATION_LANGUAGES]:TRANSLATION_LANGUAGES;
 const button=element('button','translation-language-trigger');button.type='button';button.id=id;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
 const valueLabel=element('span'),chevron=element('span');chevron.innerHTML=icon('chevron',14);button.append(valueLabel,chevron);
 let value=choices[0][0],popup=null;
 function close(restoreFocus=false){
  if(!popup)return;popup.remove();popup=null;button.setAttribute('aria-expanded','false');
  document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);window.removeEventListener('resize',onResize);window.removeEventListener('scroll',onScroll,true);
  if(restoreFocus&&button.isConnected)button.focus();
 }
 function outside(event){if(!button.contains(event.target)&&!popup?.contains(event.target))close()}
 function onResize(){close()}
 function onScroll(event){if(!popup?.contains(event.target))close()}
 function setValue(next){value=next;valueLabel.textContent=choices.find(([id])=>id===value)?.[1]||value;button.setAttribute('aria-label',label+'：'+valueLabel.textContent)}
 function open(){
  if(popup){close();return}
  popup=element('div','translation-language-dropdown');popup.id=id+'-popup';popup.setAttribute('role','dialog');popup.setAttribute('aria-label','选择'+label);button.setAttribute('aria-controls',popup.id);button.setAttribute('aria-expanded','true');
  const search=element('input','translation-language-search');search.type='search';search.placeholder='搜索语言 / Search';search.setAttribute('aria-label','搜索'+label);search.autocomplete='off';
  const list=element('div','translation-language-options');list.setAttribute('role','listbox');list.setAttribute('aria-label',label);
  function renderOptions(){
   list.replaceChildren();const query=search.value.trim().toLocaleLowerCase();
   const matches=choices.filter(choice=>choice.join(' ').toLocaleLowerCase().includes(query));
   for(const [id,title] of matches){
    const option=element('button','translation-language-option'+(id===value?' selected':''));option.type='button';option.setAttribute('role','option');option.setAttribute('aria-selected',String(id===value));
    option.append(element('span','',title),element('small','',id==='auto'?'AUTO':id));
    option.onclick=()=>{setValue(id);onChange();close(true)};list.append(option);
   }
   if(!matches.length)list.append(element('p','translation-language-empty','未找到语言，试试中文或英文名称。'));
  }
  search.addEventListener('input',renderOptions);
  popup.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    const options=[...list.querySelectorAll('button')];if(!options.length)return;
    event.preventDefault();const index=options.indexOf(document.activeElement),next=index<0?(event.key==='ArrowDown'?0:options.length-1):(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next].focus();
   }
  });
  popup.append(search,list);document.body.append(popup);renderOptions();
  const rect=button.getBoundingClientRect(),below=innerHeight-rect.bottom-10,above=rect.top-10,openBelow=below>=200||below>=above;
  popup.style.width=Math.min(Math.max(rect.width,230),innerWidth-20)+'px';popup.style.maxHeight=Math.min(254,Math.max(100,openBelow?below:above))+'px';
  popup.style.left=Math.max(10,Math.min(rect.left,innerWidth-popup.offsetWidth-10))+'px';
  if(openBelow)popup.style.top=rect.bottom+5+'px';else popup.style.bottom=innerHeight-rect.top+5+'px';
  document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);window.addEventListener('resize',onResize);window.addEventListener('scroll',onScroll,true);search.focus();
 }
 button.onclick=open;button.onkeydown=event=>{if(event.key==='ArrowDown'){event.preventDefault();open()}};
 return {element:button,getValue:()=>value,setValue,setDisabled(disabled){button.disabled=disabled;if(disabled)close()},close,destroy:()=>close()};
}

export function createTranslationPanel(profile,{onSave,onConfigureKeys,onDemo,getCredentials,icon}){
 const form=element('form','translation-panel');form.noValidate=true;form.onsubmit=event=>event.preventDefault();
 form.innerHTML=`<div class="translation-panel-scroll">
  <div class="translation-account"><span>当前账号</span><strong></strong><small>独立配置</small></div>
  <div class="translation-directions"></div>
  <div class="translation-service-settings"><div><strong>API Key 设置</strong><p>OpenAI / Gemini · 全局共用密钥</p></div><button class="button quiet translation-configure-keys" type="button">配置</button></div>
 </div><div class="translation-panel-footer"><div class="translation-apply-actions"><button class="button quiet translation-chat-demo" type="button">对话演示</button><button class="button blue translation-apply" type="submit">保存并应用</button></div><p class="translation-save-status" role="status" aria-live="polite">仅应用于当前账号</p><p class="translation-demo-note">配置演示 · 真实翻译服务尚未连接</p></div>`;
 const query=selector=>form.querySelector(selector);query('.translation-account strong').textContent=profile.remark||profile.name;query('.translation-account strong').title=profile.name;
 const controls={},pickers=[];let saved=safeTranslationSettings(profile.translation),draft=safeTranslationSettings(saved);
 function read(){
  return Object.fromEntries(['send','receive'].map(direction=>{const c=controls[direction];return [direction,{enabled:c.enabled.checked,provider:c.provider.value,sourceLanguage:c.source.getValue(),targetLanguage:c.target.getValue()}]}));
 }
 function refreshCredentials(){
  const credentials=getCredentials();
  for(const direction of ['send','receive']){
   const c=controls[direction],provider=TRANSLATION_PROVIDERS.find(p=>p.id===c.provider.value);
   c.providerStatus.classList.toggle('needs-key',!provider.builtin&&!credentials[provider.id]);
   c.providerStatus.textContent=provider.builtin?'内置服务 · 无需填写 API Key':credentials[provider.id]?'API Key 已设置 · 尚未验证':'需要配置 '+provider.label+' API Key';
  }
 }
 function sync(){
  for(const direction of ['send','receive']){
   const c=controls[direction],value=draft[direction];c.enabled.checked=value.enabled;c.provider.value=value.provider;c.source.setValue(value.sourceLanguage);c.target.setValue(value.targetLanguage);
   c.fields.disabled=!value.enabled;c.section.classList.toggle('is-disabled',!value.enabled);c.source.setDisabled(!value.enabled);c.target.setDisabled(!value.enabled);
   c.hint.textContent=value.enabled?(direction==='send'?'先翻译，校正后再次点击发送':'译文显示在原消息下方'):'关闭时保留已选服务和语言';
  }
  refreshCredentials();
 }
 function isDirty(){return JSON.stringify(read())!==JSON.stringify(saved)}
 function change(){draft=read();sync();const status=query('.translation-save-status');status.classList.remove('save-error');status.textContent=isDirty()?'有未保存的修改，请点击保存并应用':'仅应用于当前账号'}
 function save(){
  const settings=read(),status=query('.translation-save-status');
  try{
   if(onSave(profile.id,settings)===false)throw new Error('保存失败，请检查浏览器存储后重试。');
   saved=safeTranslationSettings(settings);draft=safeTranslationSettings(saved);status.textContent='已保存并应用到此账号的演示';status.classList.remove('save-error');
  }catch(error){status.textContent=error.message;status.classList.add('save-error')}
  sync();
 }
 for(const [direction,title,symbol] of [['send','发送自动翻译','send'],['receive','接收自动翻译','translate']]){
  const section=element('section','translation-section');
  section.innerHTML=`<div class="translation-section-heading"><span class="translation-direction-icon"></span><div><label></label><p></p></div><label class="switch"><input type="checkbox"><span></span></label></div><fieldset class="translation-fields"><legend class="visually-hidden"></legend><div class="translation-field"><label>翻译通道</label><select></select><p class="translation-provider-status"></p></div></fieldset>`;
  const enabled=section.querySelector('input'),headingLabel=section.querySelector('.translation-section-heading>div>label'),hint=section.querySelector('.translation-section-heading p');
  enabled.id='translation-'+direction+'-enabled';enabled.setAttribute('aria-label',title);headingLabel.htmlFor=enabled.id;headingLabel.textContent=title;section.querySelector('.translation-direction-icon').innerHTML=icon(symbol,16);
  const fields=section.querySelector('fieldset');fields.querySelector('legend').textContent=title+'配置';
  const provider=fields.querySelector('select');provider.id='translation-'+direction+'-provider';fields.querySelector('label').htmlFor=provider.id;
  for(const item of TRANSLATION_PROVIDERS){const option=element('option','',item.label+(item.builtin?' · 内置':''));option.value=item.id;provider.append(option)}
  const providerStatus=fields.querySelector('.translation-provider-status');
  function languageField(key,title,allowAuto){
   const row=element('div','translation-field'),label=element('label','',title),id='translation-'+direction+'-'+key;label.htmlFor=id;
   const picker=createLanguagePicker({id,label:(direction==='send'?'发送':'接收')+title,allowAuto,onChange:change,icon});row.append(label,picker.element);fields.append(row);pickers.push(picker);return picker;
  }
  const source=languageField('source','源语言',true),target=languageField('target','目标语言',false);
  controls[direction]={enabled,provider,source,target,providerStatus,fields,section,hint};enabled.onchange=change;provider.onchange=change;query('.translation-directions').append(section);
 }
 form.onsubmit=event=>{event.preventDefault();save()};query('.translation-chat-demo').onclick=onDemo;
 query('.translation-configure-keys').onclick=()=>{pickers.forEach(p=>p.close());onConfigureKeys()};sync();
 return {element:form,profileId:profile.id,refreshCredentials,isDirty,destroy:()=>pickers.forEach(p=>p.destroy())};
}

export function createTranslationKeyForm({credentials,onSave,onCancel,icon}){
 const form=element('form','translation-key-form');form.autocomplete='off';
 form.innerHTML=`<p class="translation-key-intro">谷歌翻译、DeepL 为内置选项，无需在此填写密钥。</p><p class="translation-key-scope">OpenAI 和 Gemini 共用这里的密钥；每个账号独立选择翻译服务及语言。</p><div class="translation-key-fields"></div><p class="translation-key-note">演示中，密钥仅保留在当前页面，刷新后需重填；不会发送或验证。</p><p class="translation-key-error" role="alert"></p><div class="translation-key-actions"><button class="button quiet" type="button">取消</button><button class="button blue" type="submit">保存</button></div>`;
 const inputs={};
 for(const [id,title] of [['openai','OpenAI'],['gemini','Gemini']]){
  const field=element('div','translation-key-field'),heading=element('div','translation-key-heading'),label=element('label','',title+' API Key'),status=element('small','',credentials[id]?'已设置 · 未验证':'未设置');
  label.htmlFor='translation-key-'+id;heading.append(label,status);
  const wrap=element('div','translation-key-input'),input=element('input');input.id=label.htmlFor;input.type='password';input.value=credentials[id]||'';input.autocomplete='new-password';input.spellcheck=false;input.placeholder='请输入 '+title+' API Key';
  const show=element('button','icon-button');show.type='button';show.setAttribute('aria-label','显示 '+title+' API Key');show.setAttribute('aria-pressed','false');show.innerHTML=icon('eye',16);
  show.onclick=()=>{const visible=input.type==='password';input.type=visible?'text':'password';show.setAttribute('aria-pressed',String(visible));show.setAttribute('aria-label',(visible?'隐藏 ':'显示 ')+title+' API Key');show.innerHTML=icon(visible?'eyeOff':'eye',16)};
  input.oninput=()=>{status.textContent=input.value.trim()?'待保存 · 未验证':'未设置'};
  wrap.append(input,show);field.append(heading,wrap);form.querySelector('.translation-key-fields').append(field);inputs[id]=input;
 }
 form.querySelector('.translation-key-actions button').onclick=onCancel;
 form.onsubmit=event=>{event.preventDefault();onSave({openai:inputs.openai.value.trim(),gemini:inputs.gemini.value.trim()})};
 return form;
}
