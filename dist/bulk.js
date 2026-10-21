import {restoreState,accountCardView} from './core.js';
import {MESSAGE_TYPES,filterRecipients,toggleVisible,selectionState,validateContent,messagePayload,sampleRecipients,readTasks,saveTask} from './bulk-model.js';
const $=id=>document.getElementById(id), STORAGE='zl.environment.demo.v1';
const embedded=window.parent!==window&&new URLSearchParams(location.search).get('embedded')==='1';
if(embedded)document.body.classList.add('embedded-bulk');
const tellParent=type=>{if(embedded)window.parent.postMessage({type},location.origin)};
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const button=(text,fn,cls='button')=>{const b=node('button',cls,text);b.type='button';b.onclick=fn;return b};
const paths={text:'<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6"/>',image:'<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 6-5 4 4 4-6 4 7"/>',video:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',file:'<path d="M3 6h7l2 3h9v11H3V6Z"/>',person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>'};
const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
const symbol=name=>{const s=node('span');s.innerHTML=icon(name);return s};
let accounts=[],accountId=null,tab='all',tasks=[],page='editor',toastTimer,busy=false;
let content=freshContent(),activeDraft=false;const demoAccounts=[],book=new Map(),selections=new Map(),previewURLs=[];
function freshContent(){return {type:'text',text:'',name:'',phone:'',file:null}}
function notify(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
function setError(text){$('formError').textContent=text}
function selected(){if(!selections.has(accountId))selections.set(accountId,new Set());return selections.get(accountId)}
function recipients(){return book.get(accountId)||[]}
function account(){return accounts.find(a=>a.id===accountId)}
function loadAccounts(){
 let state;try{state=restoreState(localStorage.getItem(STORAGE))}catch{state=restoreState(null)}
 accounts=state.profiles.map(p=>{const v=accountCardView(p);return {id:p.id,name:v.authenticated?v.nickname:p.name,phone:v.phoneNumber,remark:p.remark,status:p.sleeping?'休眠中':v.authenticated?'已登录':'尚未登录',sample:false}}).concat(demoAccounts);
 if(!accounts.some(a=>a.id===accountId))accountId=accounts.find(a=>a.id===state.activeId)?.id||accounts[0]?.id||null;
 renderAccounts();renderRecipients();updateSummary();
}
function renderAccounts(){
 const list=$('accountList');list.replaceChildren();
 for(const a of accounts){const row=node('label','account-row'+(a.id===accountId?' selected':''));const radio=node('input');radio.type='radio';radio.name='account';radio.checked=a.id===accountId;radio.value=a.id;radio.onchange=()=>{accountId=a.id;renderAccounts();renderRecipients();updateSummary();setError('')};
 const who=node('div','identity');who.append(node('strong','',a.name),node('small','',a.phone+' · '+(a.sample?'示例':a.status)));if(a.remark)who.append(node('small','remark',a.remark));row.append(radio,node('span','avatar',a.name.slice(0,1)),who);list.append(row)}
 if(!accounts.length){const empty=node('div','empty');empty.append(node('p','','还没有账号环境'),node('p','subtle','可在主界面新增会话，或使用下方示例账号体验。'));list.append(empty)}
 $('sampleAccounts').hidden=demoAccounts.length>0;
}
$('sampleAccounts').onclick=()=>{demoAccounts.push({id:'demo-account-1',name:'工作账号 · 示例',phone:'—',remark:'客户沟通',status:'示例',sample:true},{id:'demo-account-2',name:'备用账号 · 示例',phone:'—',remark:'合作伙伴',status:'示例',sample:true});accountId=demoAccounts[0].id;loadAccounts();loadSamples()};
function loadSamples(){if(!accountId)return;if(!book.has(accountId))book.set(accountId,sampleRecipients(accountId));renderRecipients();updateSummary()}
function emptyRecipients(title,description,load=false){const e=node('div','empty');e.append(node('div','empty-symbol','◎'),node('p','',title),node('p','subtle',description));if(load)e.append(button('载入示例对象',loadSamples));return e}
function renderRecipients(){
 const a=account(),all=recipients(),visible=filterRecipients(all,tab,$('recipientSearch').value),pick=selected(),stats=selectionState(pick,visible),list=$('recipientList');list.replaceChildren();
 $('recipientAccount').textContent=a?'当前账号：'+(a.remark||a.name):'请先选择左侧账号';
 for(const r of visible){
  const row=node('div','recipient-row'),label=node('label','recipient-label'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=pick.has(r.id);checkbox.onchange=()=>{if(checkbox.checked)pick.add(r.id);else pick.delete(r.id);updateSelection();updateSummary();setError('')};
  const who=node('div','identity');who.append(node('strong','',r.name),node('small','',r.phone));label.append(checkbox,node('span','avatar',r.kind==='group'?'群':r.name.slice(0,1)),who,node('span','kind',r.kind==='group'?'群聊':'私聊'));row.append(label);
  const remark=node('div','remark-line');if(r.remark)remark.append(node('span','',r.remark));const edit=button('✎',()=>{if(row.querySelector('form'))return;const form=node('form','remark-edit'),input=node('input');input.value=r.remark;input.maxLength=100;input.placeholder='填写本地备注';input.setAttribute('aria-label',r.name+'的备注');const save=button('保存',()=>{});save.type='submit';save.onclick=null;form.append(input,save);form.onsubmit=e=>{e.preventDefault();r.remark=input.value.trim();renderRecipients()};row.append(form);input.focus()},'link');edit.setAttribute('aria-label','编辑'+r.name+'的备注');remark.append(edit);row.append(remark);list.append(row);
 }
 if(!a)list.append(emptyRecipients('请先选择账号','选择后显示该账号的群聊和私聊。'));
 else if(!book.has(accountId))list.append(emptyRecipients('尚未读取 WhatsApp 对象','当前演示未连接 WhatsApp，可载入明确标注的示例列表。',true));
 else if(!visible.length)list.append(emptyRecipients('没有匹配的对象','请调整分类或搜索条件。'));
 $('recipientFooter').textContent=book.has(accountId)?'当前为示例对象，仅用于体验选择流程。切换分类保留选择；全选只选中当前列表。':'正式桌面版将读取所选账号的私聊和群组，无需导入联系人。';
 $('recipientTabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));
 $('selectAll').checked=stats.checked;$('selectAll').indeterminate=stats.indeterminate;$('selectAll').disabled=visible.length===0;$('visibleCount').textContent=stats.count+' / '+visible.length;$('totalSelected').textContent='已选 '+pick.size;
}
function updateSelection(){const visible=filterRecipients(recipients(),tab,$('recipientSearch').value),s=selectionState(selected(),visible);$('selectAll').checked=s.checked;$('selectAll').indeterminate=s.indeterminate;$('visibleCount').textContent=s.count+' / '+visible.length;$('totalSelected').textContent='已选 '+selected().size}
$('selectAll').onchange=()=>{selections.set(accountId,toggleVisible(selected(),filterRecipients(recipients(),tab,$('recipientSearch').value),$('selectAll').checked));renderRecipients();updateSummary();setError('')};
$('clearSelection').onclick=()=>{selections.set(accountId,new Set());renderRecipients();updateSummary()};
$('recipientSearch').oninput=renderRecipients;
$('recipientTabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;tab=b.dataset.tab;renderRecipients()};
$('recipientTabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const buttons=[...$('recipientTabs').querySelectorAll('button')],i=buttons.indexOf(document.activeElement),b=buttons[(i+(e.key==='ArrowRight'?1:2))%3];b.click();b.focus()};
$('refreshAccounts').onclick=()=>{loadAccounts();notify('账号环境列表已刷新；尚未连接 WhatsApp。')};
function updateSummary(){const a=account(),n=selected().size;$('taskSummary').textContent=a?(a.remark||a.name)+' · 已选 '+n+' 个对象 · 每个对象 1 条消息':'请先选择账号和接收对象';$('createTask').disabled=busy||!a||n===0}
function renderTypes(){const root=$('messageTypes');root.replaceChildren();for(const [id,label,glyph]of MESSAGE_TYPES){const b=button('',()=>{content.type=id;if(content.file&&((['image','caption'].includes(id)&&!content.file.type.startsWith('image/'))||(id==='video'&&!content.file.type.startsWith('video/'))))content.file=null;setError('');renderTypes();renderContent();renderPreview()});b.append(symbol(glyph),node('span','',label));b.setAttribute('aria-pressed',String(content.type===id));root.append(b)}}
function textarea(){const wrap=node('div'),input=node('textarea'),count=node('div','counter');input.value=content.text;input.maxLength=65535;input.placeholder=content.type==='caption'?'填写图片说明，与图片合并为一条消息':'请输入文本内容';input.setAttribute('aria-label',content.type==='caption'?'图片说明':'文本内容');count.textContent=input.value.length+' / 65535';input.oninput=()=>{content.text=input.value;count.textContent=input.value.length+' / 65535';setError('');renderPreview()};wrap.append(input,count);return wrap}
function acceptFile(file){if(!file)return;const error=validateContent({...content,file,text:content.text||'临时校验文字'});if(error){setError(error);return}content.file=file;setError('');renderContent();renderPreview()}
function renderContent(){
 const root=$('contentEditor');root.replaceChildren();
 if(['image','caption','video','file'].includes(content.type)){
  if(content.file){const line=node('div','file-controls');line.append(node('span','',content.file.name+' · '+fileSize(content.file.size)),button('移除',()=>{content.file=null;renderContent();renderPreview()},'link'));root.append(line)}
  const zone=node('label','upload-zone'),input=node('input');input.type='file';input.multiple=false;input.accept=['image','caption'].includes(content.type)?'image/*':content.type==='video'?'video/*':'';input.setAttribute('aria-label','选择'+typeLabel(content.type));input.onchange=()=>acceptFile(input.files[0]);zone.append(symbol('upload'),node('span','',content.file?'点击更换，或拖拽文件到这里':'点击上传或拖拽'+(content.type==='caption'?'图片':typeLabel(content.type))),node('small','',content.type==='caption'?'一张图片 + 文字说明，合并为一条消息':'每条消息选择一个文件'),input);
  for(const event of ['dragenter','dragover'])zone.addEventListener(event,e=>{e.preventDefault();zone.classList.add('dragging')});zone.ondragleave=()=>zone.classList.remove('dragging');zone.ondrop=e=>{e.preventDefault();zone.classList.remove('dragging');if(e.dataTransfer.files.length>1){setError('每条消息只能选择一个文件。');return}acceptFile(e.dataTransfer.files[0])};root.append(zone);
 }
 if(['text','caption'].includes(content.type))root.append(textarea());
 if(content.type==='contact'){
  const group=node('div','contact-inputs'),fields=node('div');for(const [key,label,placeholder]of [['name','昵称（可选）','填写联系人昵称'],['phone','电话号码','包含国家区号，例如 +5511999999999']]){const lab=node('label','',label),input=node('input');input.value=content[key];input.placeholder=placeholder;input.maxLength=key==='phone'?16:100;if(key==='phone'){input.type='tel';input.inputMode='tel'}input.oninput=()=>{content[key]=input.value;setError('');renderPreview()};lab.append(input);fields.append(lab)}group.append(node('span','avatar','人'),fields);root.append(group,node('p','subtle','将作为 WhatsApp 联系人名片发送，而不是普通文字。'));
 }
}
function fileSize(bytes){return bytes<1048576?Math.max(1,Math.round(bytes/1024))+' KB':(bytes/1048576).toFixed(1)+' MB'}
function typeLabel(type){return MESSAGE_TYPES.find(([id])=>id===type)?.[1]||type}
function releaseURLs(){for(const url of previewURLs)URL.revokeObjectURL(url);previewURLs.length=0}
function bubbleFor(c){
 const bubble=node('div','bubble');
 if(c.type==='text'){if(!c.text.trim())return node('p','preview-placeholder','输入内容后在这里预览');bubble.append(node('p','',c.text))}
 else if(c.type==='contact'){const row=node('div','contact-card'),who=node('div');who.append(node('strong','',c.name||'联系人姓名'),node('small','',c.phone||'电话号码'));row.append(symbol('person'),who);bubble.append(row,node('div','contact-footer','联系人名片'))}
 else{
  if(!c.file)return node('p','preview-placeholder','选择'+(c.type==='caption'?'图片':typeLabel(c.type))+'后在这里预览');
  if(c.type==='file'){const row=node('div','contact-card'),who=node('div');who.append(node('strong','',c.file.name),node('small','',fileSize(c.file.size)));row.append(symbol('file'),who);bubble.append(row)}
  else {const media=node(c.type==='video'?'video':'img'),url=URL.createObjectURL(c.file);previewURLs.push(url);media.src=url;if(c.type==='video'){media.controls=true;media.preload='metadata'}else media.alt='群发图片预览';bubble.append(media);if(c.type==='caption'&&c.text)bubble.append(node('p','',c.text))}
 }
 bubble.append(node('div','preview-meta','单条消息 · 未发送'));return bubble;
}
function renderPreview(){releaseURLs();$('messagePreview').replaceChildren(bubbleFor(content))}
function hasDraft(){return !!(content.text.trim()||content.file||content.name.trim()||content.phone.trim()||[...selections.values()].some(s=>s.size))}
function openEditor(reset=false){
 if(reset&&activeDraft&&hasDraft()&&!window.confirm('开始新建转发将清空当前未保存的内容和选择，是否继续？'))return;
 if(reset){content=freshContent();selections.clear();tab='all';$('recipientSearch').value='';activeDraft=true}
 page='editor';$('history').hidden=true;$('editor').hidden=false;$('showHistory').hidden=tasks.length===0;setError('');renderAccounts();renderRecipients();renderTypes();renderContent();renderPreview();updateSummary();
}
function showHistory(){page='history';$('editor').hidden=true;$('history').hidden=false;renderHistory()}
function contentSummary(c){return c.type==='text'?c.text:c.type==='caption'?(c.text||c.file?.name||'图文'):c.type==='contact'?(c.name||c.phone):c.file?.name||typeLabel(c.type)}
function renderHistory(){
 const q=$('historySearch').value.trim().toLocaleLowerCase(),list=tasks.filter(t=>[contentSummary(t.content),t.account.name,t.account.remark,t.content.file?.name].join(' ').toLocaleLowerCase().includes(q)),rows=$('historyRows');rows.replaceChildren();$('historyCount').textContent=tasks.length+' 条记录';$('historyEmpty').hidden=list.length>0;
 for(const task of list){const tr=node('tr'),first=node('td'),acc=node('td'),status=node('td'),progress=node('td'),actions=node('td');first.append(node('strong','',contentSummary(task.content)),node('small','',typeLabel(task.content.type)));first.title=contentSummary(task.content);acc.append(node('strong','',task.account.remark||task.account.name),node('small','',task.account.name));status.append(node('span','task-state','未发送 · 演示'));progress.append(node('span','',`0 / ${task.recipients.length}`),node('small','','成功 — · 失败 —'));const group=node('div','task-actions');group.append(button('详情',()=>showDetail(task),'link'),button('再建一条',()=>copyTask(task),'link'));actions.append(group);tr.append(first,acc,status,progress,node('td','',new Date(task.createdAt).toLocaleString('zh-CN',{hour12:false})),node('td','','—'),actions);rows.append(tr)}
}
async function createTask(){
 if(busy)return;setError('');const a=account(),picked=recipients().filter(r=>selected().has(r.id));if(!a||!picked.length){setError('请选择账号和至少一个接收对象。');return}const error=validateContent(content);if(error){setError(error);return}
 busy=true;$('createTask').textContent='正在保存…';updateSummary();
 try{const snapshot=structuredClone(content);const task={id:crypto.randomUUID(),createdAt:Date.now(),status:'demo_unsent',account:structuredClone(a),recipients:structuredClone(picked),content:snapshot,message:messagePayload(snapshot),success:null,failed:null};await saveTask(task);tasks=await readTasks();activeDraft=false;content=freshContent();selections.clear();showHistory();notify('演示任务已保存，未发送任何 WhatsApp 消息。')}
 catch{setError('任务未能保存，请检查浏览器存储空间或减小附件后重试。')}
 finally{busy=false;$('createTask').textContent='创建演示任务';updateSummary()}
}
function showDetail(task){
 releaseURLs();const root=$('detailContent');root.replaceChildren();const meta=node('div','detail-meta');meta.append(node('p','','账号：'+(task.account.remark||task.account.name)),node('p','','消息类型：'+typeLabel(task.content.type)+' · 接收对象：'+task.recipients.length+' 个'),node('p','','创建时间：'+new Date(task.createdAt).toLocaleString('zh-CN')),node('span','task-state','未发送 · 演示'));root.append(meta);const preview=node('div','message-preview');preview.append(bubbleFor(task.content));root.append(preview,node('h3','','接收对象'));const chips=node('div','detail-recipients');for(const r of task.recipients)chips.append(node('span','recipient-chip',(r.kind==='group'?'群聊':'私聊')+' · '+r.name));root.append(chips,node('h3','','任务日志'));const log=node('div','detail-log');log.append(node('p','','已保存任务内容、附件及接收对象快照。'),node('p','','尚未连接 WhatsApp，任务未进入发送队列；没有成功或失败发送记录。'));root.append(log);$('detailDialog').showModal();
}
function copyTask(task){
 if(activeDraft&&hasDraft()&&!window.confirm('载入这条记录将替换当前未保存的转发草稿，是否继续？'))return;
 content=structuredClone(task.content);activeDraft=true;const available=accounts.find(a=>a.id===task.account.id);
 if(available){accountId=available.id;book.set(accountId,structuredClone(task.recipients));selections.set(accountId,new Set(task.recipients.map(r=>r.id)))}
 else {accountId=null;selections.clear();notify('原账号已不在当前列表，请重新选择账号及对象。')}
 tab='all';$('recipientSearch').value='';openEditor();
}
$('showHistory').onclick=showHistory;$('newTask').onclick=()=>openEditor(true);$('historySearch').oninput=renderHistory;$('createTask').onclick=createTask;$('closeDetail').onclick=()=>$('detailDialog').close();$('detailDialog').addEventListener('close',()=>{releaseURLs();$('detailContent').replaceChildren();if(page==='editor')renderPreview()});
$('maximize').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{notify('请使用浏览器窗口的最大化按钮。')}};
function closeWorkspace(){if(busy){notify('正在保存任务，请稍候再关闭。');return}if(activeDraft&&hasDraft()&&!window.confirm('关闭窗口将丢弃尚未创建的转发草稿，是否继续？'))return;activeDraft=false;if(embedded){tellParent('zl-bulk-closed');return}window.close();notify('可关闭当前标签页返回主界面。')}
$('closeWindow').onclick=closeWorkspace;
window.addEventListener('message',event=>{if(embedded&&event.origin===location.origin&&event.source===window.parent&&event.data?.type==='zl-bulk-request-close')closeWorkspace()});
document.addEventListener('keydown',event=>{if(embedded&&event.key==='Escape'&&!event.isComposing&&!$('detailDialog').open){event.preventDefault();closeWorkspace()}});
document.querySelectorAll('[data-close-window]').forEach(b=>b.onclick=closeWorkspace);
window.addEventListener('beforeunload',e=>{if(activeDraft&&hasDraft()){e.preventDefault();e.returnValue=''}});
window.addEventListener('storage',e=>{if(e.key===STORAGE)loadAccounts()});
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
async function start(){loadAccounts();try{tasks=await readTasks()}catch{notify('浏览器暂时无法读取任务记录；创建任务时会再次尝试。')}$('loading').hidden=true;if(tasks.length)showHistory();else openEditor(true)}
tellParent('zl-bulk-ready');
start();
