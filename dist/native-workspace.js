export function createNativeWorkspace({getAccounts,getActive,onStatus,onError}){
 const api=window.zlDesktop;if(!api?.syncAccounts)return null;
 const states=new Map();let signature='',scheduled=false;
 function layout(){scheduled=false;const stage=document.getElementById('stage'),active=getActive();const covered=!!document.querySelector('dialog[open]')||['toolDrawer'].some(id=>{const e=document.getElementById(id);return e&&!e.hidden&&e.getClientRects().length>0});const r=stage.getBoundingClientRect();api.layoutAccounts({key:active?.key,visible:!!active&&!covered,bounds:{x:r.x,y:r.y,width:r.width,height:r.height}}).catch(onError)}
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(layout)}}
 function receive(s){if(s.state==='notice'){onError(s.message);return}states.set(s.key,s);const label=document.getElementById('nativeSessionMessage');if(label&&getActive()?.key===s.key)label.textContent=s.message;onStatus();schedule()}
 api.onAccountStatus(receive);
 new ResizeObserver(schedule).observe(document.getElementById('stage'));
 new MutationObserver(schedule).observe(document.body,{subtree:true,attributes:true,childList:true,attributeFilter:['hidden','open','class','style']});
 window.addEventListener('resize',schedule);window.addEventListener('focus',schedule);window.addEventListener('pointerup',schedule);api.onLayoutRequest?.(schedule);
 function sync(){const accounts=getAccounts(),value=JSON.stringify(accounts);if(value===signature){schedule();return}signature=value;api.syncAccounts(accounts).then(result=>{result.forEach(receive);schedule()}).catch(e=>{signature='';onError('会话启动失败：'+e.message)})}
 function render(stage,p,platform){const wrap=document.createElement('div');wrap.className='empty-stage';const title=document.createElement('h2');title.textContent=p.sleeping?'当前会话已休眠':platform==='whatsapp'?'WhatsApp 官方页面':'Meta Business 官方页面';const message=document.createElement('p');message.id='nativeSessionMessage';message.textContent=states.get(platform+':'+p.id)?.message||'正在启动独立会话…';wrap.append(title,message);if(!p.sleeping){const retry=document.createElement('button');retry.className='button blue';retry.textContent='重新加载';retry.onclick=()=>api.reloadAccount(platform,p.id).catch(e=>onError(e.message));wrap.append(retry)}stage.append(wrap);sync()}
 document.title='ZL Multi Manager';document.querySelector('.brand .demo-tag').remove();document.querySelectorAll('#environmentDialog .demo-tag').forEach(e=>e.remove());
 return {sync,render,status:(platform,id)=>states.get(platform+':'+id),refresh:(platform,id)=>api.reloadAccount(platform,id).catch(e=>onError(e.message))};
}
