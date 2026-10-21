const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e};
const button=(text,fn)=>{const b=el('button','button quiet',text);b.type='button';b.onclick=fn;return b};
const STORE='zl-real-forward-history-v1';
function history(){try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return []}}
function save(task){const all=history().filter(t=>t.id!==task.id);all.unshift(task);localStorage.setItem(STORE,JSON.stringify(all.slice(0,100)))}
export function openNativeTool(tool,state,status){
 if(document.getElementById('nativeTool'))return;
 const api=window.zlDesktop,groups=tool==='groups',d=el('dialog','bulk-dialog group-manager');d.id='nativeTool';
 d.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);margin:0;width:min(1280px,calc(100vw - 28px));height:min(780px,calc(100dvh - 90px));max-width:none;max-height:none';
 d.innerHTML='<header class="bulk-dialog-heading"><strong></strong><div class="nt-header"></div></header><div class="gm-columns"><section class="gm-column"><h3>WhatsApp 账户</h3><div class="nt-accounts gm-scroll"></div></section><section class="gm-column"><h3>选择对象</h3><div class="nt-tabs gm-tabs"></div><input class="nt-search" placeholder="搜索名称"><label class="gm-row"><input type="checkbox" class="nt-all">全选当前列表</label><div class="nt-list gm-scroll"></div></section><section class="gm-column"><h3>操作详情</h3><div class="nt-selection gm-scroll" style="max-height:120px"></div><div class="nt-compose"></div><p class="nt-status" role="status"></p></section></div><div class="nt-history gm-scroll" hidden></div>';
 const q=s=>d.querySelector(s);q('strong').textContent=groups?'WhatsApp · 群组管理':'WhatsApp · 转发';
 let id=state.activeId||state.profiles[0]?.id,rows=[],filter='all',selected=new Set(),busy=false,epoch=0,cancelled=false;
 const feedback=t=>q('.nt-status').textContent=t;
 const run=req=>api.whatsAppAction({accountId:id,...req});
 function visible(){const term=q('.nt-search').value.toLowerCase();return rows.filter(r=>r.name.toLowerCase().includes(term)&&(filter==='all'||(groups?(filter==='closed'?r.closed===true:r.closed===false):r.kind===filter)))}
 function draw(){const host=q('.nt-list');host.replaceChildren();const list=visible();for(const r of list){const label=el('label','gm-row'),check=el('input');check.type='checkbox';check.checked=selected.has(r.id);check.disabled=busy;check.onchange=()=>{check.checked?selected.add(r.id):selected.delete(r.id);draw()};label.append(check,el('span','',r.name+(groups?' · '+(r.closed===null?'权限待同步':r.closed?'已闭群':'已开群')+(r.admin?'':' · 非管理员'):'')));host.append(label)}if(!list.length)host.append(el('p','gm-empty','当前列表为空'));const count=list.filter(r=>selected.has(r.id)).length;const all=q('.nt-all');all.checked=!!list.length&&count===list.length;all.indeterminate=count>0&&count<list.length;all.disabled=busy||!list.length;const detail=q('.nt-selection');detail.replaceChildren(...rows.filter(r=>selected.has(r.id)).map(r=>el('p','',r.name)));q('.nt-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)))}
 async function load(){const ticket=++epoch;rows=[];selected.clear();draw();feedback('正在读取真实聊天列表…');try{const result=await run({action:'list',groups});if(ticket!==epoch)return;rows=result;draw();feedback('已读取 '+rows.length+' 个对象')}catch(e){if(ticket===epoch)feedback(e.message)}}
 function accounts(){const host=q('.nt-accounts');host.replaceChildren();for(const p of state.profiles){const m=status(p.id)?.metadata,b=button((m?.nickname||p.name)+(p.remark?' · '+p.remark:''),()=>{if(busy)return;id=p.id;accounts();load()});b.disabled=p.sleeping||busy;b.setAttribute('aria-pressed',String(id===p.id));host.append(b)}}
 for(const [value,label] of groups?[['all','全部'],['open','已开群'],['closed','已闭群']]:[['all','全部'],['group','群聊'],['private','私聊']]){const b=button(label,()=>{filter=value;draw()});b.dataset.filter=value;q('.nt-tabs').append(b)}
 q('.nt-search').oninput=draw;q('.nt-all').onchange=e=>{for(const r of visible())e.target.checked?selected.add(r.id):selected.delete(r.id);draw()};
 q('.nt-header').append(button('刷新列表',()=>{if(!busy)load()}),button('关闭',()=>d.close()));
 async function apply(closed){if(busy)return;const targets=rows.filter(r=>selected.has(r.id));if(!targets.length){feedback('请先选择群组');return}busy=true;accounts();draw();let ok=0;const errors=[];for(const r of targets){try{await run({action:'group-mode',chatId:r.id,closed});r.closed=closed;ok++}catch(e){errors.push(r.name+'：'+e.message)}}busy=false;accounts();draw();feedback('完成 '+ok+' / '+targets.length+'。'+errors.join('；'))}
 if(groups){q('.nt-compose').append(button('全员禁言',()=>apply(true)),button('开启发言',()=>apply(false)))}else{
  const type=el('select'),text=el('textarea'),file=el('input'),name=el('input'),phone=el('input');text.placeholder='消息内容';text.rows=5;file.type='file';name.placeholder='名片姓名';phone.placeholder='含国家区号的电话号码';
  for(const [value,label] of [['text','文本'],['image','图片'],['caption','图文'],['video','视频'],['file','文件'],['contact','名片']]){const o=el('option','',label);o.value=value;type.append(o)}
  function fields(){text.hidden=!['text','caption'].includes(type.value);file.hidden=!['image','caption','video','file'].includes(type.value);name.hidden=phone.hidden=type.value!=='contact';file.accept=['image','caption'].includes(type.value)?'image/*':type.value==='video'?'video/*':''}type.onchange=fields;fields();
  const send=button('发送到已选对象',async()=>{
   if(busy)return;const targets=rows.filter(r=>selected.has(r.id));if(!targets.length){feedback('请选择发送对象');return}
   let content={type:type.value,text:text.value,name:name.value,phone:phone.value};
   try{if(!file.hidden){const f=file.files[0];if(!f||f.size>25*1024*1024)throw Error('请选择不超过 25 MB 的文件');content.data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f)});content.filename=f.name;content.mime=f.type||'application/octet-stream';if(!f.type)content.data=content.data.replace(/^data:[^;]*;/,'data:application/octet-stream;')}
    await api.validateMessage({accountId:id,action:'send',chatId:targets[0].id,content});
   }catch(e){feedback(e.message);return}
   busy=true;cancelled=false;send.disabled=true;[type,text,file,name,phone].forEach(e=>e.disabled=true);accounts();draw();const task={id:crypto.randomUUID(),createdAt:Date.now(),accountId:id,type:content.type,state:'running',results:targets.map(r=>({id:r.id,name:r.name,state:'pending'}))};
   try{save(task)}catch{busy=false;feedback('无法保存任务记录，未发送消息');return}
   for(const r of task.results){if(cancelled){r.state='cancelled';continue}r.state='submitting';save(task);try{const result=await run({action:'send',chatId:r.id,content});r.state='submitted';r.messageId=result.id;r.ack=result.ack}catch(e){r.state='failed';r.error=e.message}save(task);feedback('已处理 '+task.results.filter(r=>!['pending','submitting'].includes(r.state)).length+' / '+targets.length)}
   task.state='finished';save(task);busy=false;send.disabled=false;[type,text,file,name,phone].forEach(e=>e.disabled=false);accounts();draw();feedback('已提交 '+task.results.filter(r=>r.state==='submitted').length+'；失败 '+task.results.filter(r=>r.state==='failed').length+'。可查看历史记录。');api.taskComplete({submitted:task.results.filter(r=>r.state==='submitted').length,failed:task.results.filter(r=>r.state==='failed').length});
  });
  q('.nt-compose').append(type,text,file,name,phone,send,button('停止后续发送',()=>{cancelled=true}));
  function showHistory(){if(busy)return;const h=q('.nt-history');h.hidden=false;q('.gm-columns').hidden=true;h.replaceChildren();for(const t of history()){const card=el('section','gm-detail');card.append(el('strong','',new Date(t.createdAt).toLocaleString()+' · '+t.type));for(const r of t.results)card.append(el('p','',r.name+'：'+({submitted:'已提交，送达情况以 WhatsApp 回执为准',failed:'失败：'+r.error,cancelled:'已取消',pending:'未提交',submitting:'结果未确认，请核对后再发送'}[r.state]||r.state)));h.append(card)}if(!h.children.length)h.append(el('p','','暂无转发记录'))}
  q('.nt-header').prepend(button('新建转发',()=>{q('.nt-history').hidden=true;q('.gm-columns').hidden=false}),button('历史记录',showHistory));if(history().length)showHistory();
 }
 d.onclose=()=>{epoch++;d.remove()};document.body.append(d);d.showModal();accounts();load();
}
