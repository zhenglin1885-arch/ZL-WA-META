export function startNetworkStatus(){
 const api=window.zlDesktop;if(!api?.networkStatus)return;
 const bar=document.querySelector('.network'),ip=bar.querySelector('span'),delay=bar.querySelectorAll(':scope > span')[1],refresh=document.getElementById('networkRefresh');let busy=false,lastIP='';
 ip.style.maxWidth='160px';ip.style.overflow='hidden';ip.style.textOverflow='ellipsis';ip.style.whiteSpace='nowrap';ip.style.cursor='copy';ip.style.webkitAppRegion='no-drag';
 refresh.title='刷新公网 IP 与 HTTP 往返耗时';refresh.setAttribute('aria-label',refresh.title);
 async function update(){if(busy)return;busy=true;refresh.disabled=true;refresh.classList.add('network-pending');
  try{const result=await api.networkStatus();lastIP=result.ip;ip.textContent='IP: '+result.ip;ip.title=result.ip+'（双击复制）';const dot=document.createElement('i');dot.className='status-dot';dot.style.background=result.latency<300?'#15c46a':result.latency<1000?'#e9ba55':'#df5555';delay.replaceChildren(dot,document.createTextNode(' '+result.latency+' ms'));delay.title='到公网 IP 检测服务的 HTTP 往返耗时，非 ICMP Ping';}
  catch{lastIP='';ip.textContent='IP: —';ip.title='检测失败，点击刷新重试';delay.textContent='— ms'}finally{busy=false;refresh.disabled=false;refresh.classList.remove('network-pending')}
 }
 ip.ondblclick=async()=>{if(!lastIP)return;await api.copyNetworkIP();ip.textContent='已复制';setTimeout(()=>{ip.textContent='IP: '+lastIP},1500)};refresh.onclick=update;update();setInterval(update,30000);
}
