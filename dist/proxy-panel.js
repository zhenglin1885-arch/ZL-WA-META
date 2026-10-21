import {parseSmartProxy,proxySettings,validateProxyConfig} from './core.js';

export function createProxyPanel(profile,{credentials={},platform='whatsapp',onSave,onCancel,icon}){
 const form=document.createElement('form');form.className='proxy-panel';form.noValidate=true;
 form.innerHTML=`
  <div class="proxy-panel-scroll">
   <div class="proxy-account"><span>当前账号</span><strong class="proxy-account-name"></strong><small>仅用于此账号</small></div>
   <div class="proxy-enable-row"><div><label for="accountProxyEnabled">启用代理</label><p class="proxy-enable-hint"></p></div><label class="switch"><input id="accountProxyEnabled" name="proxyEnabled" type="checkbox" aria-label="启用当前账号的代理"><span></span></label></div>
   <div class="proxy-config-fields">
    <div class="proxy-field"><label for="accountProxyType"><em>*</em> 代理类型</label><select id="accountProxyType" name="proxyType"><option value="direct">不使用代理</option><option value="http">HTTP</option><option value="https">HTTPS</option><option value="socks5">Socks5</option></select></div>
    <div class="proxy-field"><label for="accountProxyHost"><em>*</em> 代理服务器</label><div class="proxy-server-input"><input id="accountProxyHost" name="proxyHost" placeholder="IP / 主机" autocomplete="off"><span>:</span><input name="proxyPort" inputmode="numeric" placeholder="端口" aria-label="代理端口" maxlength="5" autocomplete="off"></div></div>
    <div class="proxy-field"><label for="accountProxyUsername">代理账号</label><input id="accountProxyUsername" name="proxyUsername" placeholder="请输入代理账号（可选）" autocomplete="off"></div>
    <div class="proxy-field"><label for="accountProxyPassword">代理密码</label><div class="proxy-password-input"><input id="accountProxyPassword" name="proxyPassword" type="password" placeholder="请输入代理密码（可选）" autocomplete="new-password"><button class="icon-button proxy-password-toggle" type="button" aria-label="显示代理密码" aria-pressed="false" title="显示密码"></button></div></div>
    <div class="proxy-field"><div class="proxy-field-heading"><label for="accountProxyRefreshUrl">刷新 URL</label><button class="icon-button proxy-refresh-url" type="button" title="刷新代理 IP（桌面版）" aria-label="刷新代理 IP"></button></div><input id="accountProxyRefreshUrl" name="proxyRefreshUrl" type="url" placeholder="请输入刷新 URL（可选）" autocomplete="off"></div>
    <details class="proxy-import-details"><summary>智能输入</summary><div class="proxy-import-row"><textarea name="proxyImport" rows="3" placeholder="IP:端口:账号:密码，或空格/换行分隔；也支持代理链接" aria-label="智能输入代理信息"></textarea><button class="button quiet proxy-import-button" type="button">识别并填写</button></div></details>
   </div>
   <div class="proxy-network-status" role="status" aria-live="polite"><strong></strong><p></p></div>
  </div>
  <div class="proxy-panel-footer"><button class="button blue proxy-test-button" type="button">网络检测</button><div><button class="button quiet proxy-cancel-button" type="button">取消</button><button class="button blue" type="submit">确定</button></div></div>
  <p class="proxy-demo-note">代理配置尚未生效。密码及刷新 URL 仅在本页保留。</p>`;
 const field=name=>form.elements.namedItem(name),query=selector=>form.querySelector(selector);
 const original=proxySettings(profile.config);
 for(const [key,value] of Object.entries(original)){const input=field(key);if(input.type==='checkbox')input.checked=value;else input.value=value}
 field('proxyPassword').value=credentials.password||'';field('proxyRefreshUrl').value=credentials.refreshUrl||'';
 query('.proxy-account-name').textContent=profile.remark||profile.name;
 query('.proxy-account-name').title=profile.name;
 query('.proxy-password-toggle').innerHTML=icon('eye',15);query('.proxy-refresh-url').innerHTML=icon('refresh',15);

 function readDraft(){
  return {...Object.fromEntries(['proxyType','proxyHost','proxyPort','proxyUsername','proxyPassword','proxyRefreshUrl'].map(key=>[key,field(key).value])),proxyEnabled:field('proxyEnabled').checked};
 }
 let baseline=JSON.stringify(readDraft());
 function showStatus(tone,title,message){
  const status=query('.proxy-network-status');status.className='proxy-network-status '+tone;status.querySelector('strong').textContent=title;status.querySelector('p').textContent=message;
 }
 function resetStatus(){showStatus('idle','尚未检测','代理出口 IP：—　延迟：—')}
 function syncEnabled(){
  const enabled=field('proxyEnabled').checked;query('.proxy-config-fields').hidden=!enabled;
  query('.proxy-enable-hint').textContent=enabled?'仅为当前账号配置代理':'关闭后，直接使用本机网络';
 }
 function reportError(error){
  showStatus('error','请检查配置',error.message);const input=field(error.field);if(input){input.setAttribute('aria-invalid','true');input.focus()}
 }
 function validate(values){
  const error=validateProxyConfig(values);if(error)return error;
  if(values.proxyEnabled&&values.proxyRefreshUrl.trim()){
   try{const url=new URL(values.proxyRefreshUrl.trim());if(!['http:','https:'].includes(url.protocol))throw new Error()}catch{return {field:'proxyRefreshUrl',message:'刷新 URL 需为有效的 HTTP 或 HTTPS 地址。'}}
  }
  return null;
 }
 form.addEventListener('input',e=>{e.target.removeAttribute('aria-invalid');resetStatus()});
 field('proxyEnabled').addEventListener('change',()=>{if(field('proxyEnabled').checked&&field('proxyType').value==='direct')field('proxyType').value='http';syncEnabled();resetStatus()});
 field('proxyType').addEventListener('change',()=>{if(field('proxyType').value==='direct')field('proxyEnabled').checked=false;syncEnabled();resetStatus()});
 query('.proxy-password-toggle').onclick=()=>{
  const input=field('proxyPassword'),button=query('.proxy-password-toggle'),visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'隐藏代理密码':'显示代理密码');button.title=visible?'隐藏密码':'显示密码';button.innerHTML=icon(visible?'eyeOff':'eye',15);
 };
 query('.proxy-import-button').onclick=()=>{
  try{
   const parsed=parseSmartProxy(field('proxyImport').value,field('proxyType').value);for(const key of ['proxyType','proxyHost','proxyPort','proxyUsername'])field(key).value=parsed[key];field('proxyPassword').value=parsed.password;field('proxyEnabled').checked=true;field('proxyImport').value='';syncEnabled();showStatus('info','代理信息已导入','请点击“确定”保存到此账号。')
  }catch(error){reportError({field:'proxyImport',message:error.message})}
 };
 query('.proxy-test-button').onclick=async()=>{
  const values=readDraft(),error=validate(values);if(error){reportError(error);return}
  if(!window.zlDesktop?.proxyTest){showStatus('error','无法检测','请在 Windows 应用中使用代理检测');return}
  const button=query('.proxy-test-button');button.disabled=true;showStatus('info','正在检测','通过当前配置请求出口 IP…');
  try{const result=await window.zlDesktop.proxyTest(values);showStatus('info','检测成功','出口 IP：'+result.ip+'　延迟：'+result.latency+' ms（HTTP 请求耗时）')}catch(e){showStatus('error','检测失败',e.message)}finally{button.disabled=false}

 };
 query('.proxy-refresh-url').onclick=()=>{
  const values=readDraft();if(!values.proxyRefreshUrl.trim()){reportError({field:'proxyRefreshUrl',message:'请先填写刷新 URL。'});return}
  const error=validate(values);if(error){reportError(error);return}showStatus('warning','刷新 URL 尚未调用','当前不会调用此链接；代理 IP 刷新需桌面版接入。');
 };
 query('.proxy-cancel-button').onclick=onCancel;
 form.onsubmit=async e=>{
  e.preventDefault();const values=readDraft(),error=validate(values);if(error){reportError(error);return}
  const submit=form.querySelector('[type=submit]');submit.disabled=true;
  try{if(await onSave(profile.id,proxySettings(values),{password:values.proxyPassword,refreshUrl:values.proxyRefreshUrl.trim()})===false)showStatus('error','配置未保存','请检查浏览器存储后重试。')}catch(error){showStatus('error','配置未保存',error.message)}finally{submit.disabled=false}
 };
 syncEnabled();resetStatus();
 if(window.zlDesktop?.proxyGet){
  query('.proxy-demo-note').textContent='保存后仅重载当前账号；密码在本机加密保存。代理失败不会自动切换直连。';
  const controls=[...form.querySelectorAll('input,select,button,textarea')];controls.forEach(e=>e.disabled=true);
  window.zlDesktop.proxyGet({platform,id:profile.id}).then(c=>{if(c){for(const key of ['proxyType','proxyHost','proxyPort','proxyUsername','proxyPassword'])field(key).value=c[key]||'';field('proxyEnabled').checked=c.proxyEnabled;baseline=JSON.stringify(readDraft());syncEnabled()}}).catch(e=>showStatus('error','读取失败',e.message)).finally(()=>controls.forEach(e=>e.disabled=false));
 }

 return {element:form,profileId:profile.id,isDirty:()=>JSON.stringify(readDraft())!==baseline||Boolean(field('proxyImport').value)};
}
