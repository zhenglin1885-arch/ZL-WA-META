const {isIP}=require('node:net');
async function measureNetwork(fetch){
 const start=performance.now();
 const response=await fetch('https://api.ipify.org?format=json',{cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('网络检测失败');
 const {ip}=await response.json();if(typeof ip!=='string'||!isIP(ip))throw Error('IP 响应无效');
 return {ip,latency:Math.round(performance.now()-start)};
}
module.exports={measureNetwork};
