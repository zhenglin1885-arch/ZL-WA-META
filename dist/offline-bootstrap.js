import {activateOffline,readOfflineLicense} from './offline-license.js';
if(window.zlDesktop?.nativeTitlebar)document.documentElement.classList.add('native-titlebar');
const storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)};
const gate=document.createElement('main');gate.id='offlineLicenseGate';gate.innerHTML=`<section class="offline-license-card" aria-labelledby="offlineTitle"><div class="offline-logo">ZL</div><span class="offline-label">Multi Manager</span><h1 id="offlineTitle">激活软件</h1><p>输入激活码，即可在本机离线验证。</p><form><label for="offlineCode">20 位激活码</label><input id="offlineCode" type="text" maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="请输入 20 位激活码" required><p class="offline-error" role="status" aria-live="polite"></p><button type="submit">验证并进入软件</button></form><small>验证通过后本机记住激活状态。无需联网复检。</small></section>`;document.body.append(gate);
const input=gate.querySelector('input'),button=gate.querySelector('button'),error=gate.querySelector('.offline-error');
let starting=false;
async function start(){if(starting)return;starting=true;button.disabled=true;button.textContent='正在打开…';try{if(document.documentElement.dataset.entry==='bulk')await import('./bulk.js');else await import('./app.js');document.documentElement.classList.remove('license-locked');gate.remove()}catch{starting=false;button.disabled=false;button.textContent='重新打开软件';error.textContent='激活状态已保存，但程序加载失败。请刷新后重试。'}}
input.oninput=()=>{input.value=input.value.toUpperCase();error.textContent='';input.removeAttribute('aria-invalid')};
gate.querySelector('form').onsubmit=async e=>{e.preventDefault();if(starting)return;try{activateOffline(storage,input.value);await start()}catch(e){error.textContent=e.message==='激活码不正确，请检查后重试。'||e.message.startsWith('请输入')?e.message:'无法保存本机激活状态，请允许本地存储后重试。';input.setAttribute('aria-invalid','true');input.focus()}};
if(readOfflineLicense(storage))start();else input.focus();
