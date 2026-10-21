let frame=null,ready=false,opener=null;
const dialog=()=>document.getElementById('bulkDialog');
function fit(){
 const box=dialog();if(!box.open)return;
 const bounds=document.querySelector('.app-shell').getBoundingClientRect();
 const left=Math.max(0,bounds.left),top=Math.max(0,bounds.top);
 const availableWidth=Math.max(0,Math.min(innerWidth,bounds.right)-left),availableHeight=Math.max(0,Math.min(innerHeight,bounds.bottom)-top);
 const width=Math.max(0,Math.min(1440,availableWidth-24)),height=Math.max(0,Math.min(900,availableHeight-24));
 Object.assign(box.style,{width:width+'px',height:height+'px',left:(left+(availableWidth-width)/2)+'px',top:(top+(availableHeight-height)/2)+'px'});
}
function finishClose(){dialog().close();frame?.remove();frame=null;ready=false;if(opener?.isConnected)opener.focus()}
function requestClose(){if(!frame||!ready){finishClose();return}frame.contentWindow.postMessage({type:'zl-bulk-request-close'},location.origin)}
export function openBulkDialog(){
 if(dialog().open){frame?.focus();return}
 opener=document.activeElement;ready=false;frame=document.createElement('iframe');frame.title='转发与群发工作窗口';frame.src='./bulk.html?embedded=1';
 document.getElementById('bulkFrameHost').replaceChildren(frame);dialog().showModal();fit();frame.focus();
}
document.getElementById('closeBulkDialog').onclick=requestClose;
dialog().addEventListener('cancel',event=>{event.preventDefault();requestClose()});
window.addEventListener('resize',fit);
new ResizeObserver(fit).observe(document.querySelector('.app-shell'));
window.addEventListener('message',event=>{
 if(!frame||event.origin!==location.origin||event.source!==frame.contentWindow)return;
 if(event.data?.type==='zl-bulk-ready')ready=true;
 if(event.data?.type==='zl-bulk-closed')finishClose();
});
