const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{isIP}=require('node:net');
const {Server}=require('proxy-chain');
function normalize(v){
 const c={proxyEnabled:v.proxyEnabled===true,proxyType:v.proxyType,proxyHost:String(v.proxyHost||'').trim(),proxyPort:String(v.proxyPort||''),proxyUsername:String(v.proxyUsername||''),proxyPassword:String(v.proxyPassword||'')};
 if(!c.proxyEnabled)return {...c,proxyType:'direct'};
 if(!['http','https','socks5'].includes(c.proxyType)||!/^\d+$/.test(c.proxyPort)||+c.proxyPort<1||+c.proxyPort>65535||!c.proxyHost||c.proxyHost.length>253||/[\s/@?#\\]/.test(c.proxyHost))throw Error('代理类型、主机或端口无效');
 const u=new URL(c.proxyType+'://'+c.proxyHost+':'+c.proxyPort);if(u.hostname!==c.proxyHost)throw Error('代理主机格式无效');
 if(c.proxyUsername.length>255||c.proxyPassword.length>255)throw Error('代理账号或密码过长');return c;
}
async function bridge(config){
 const c=normalize(config);if(!c.proxyEnabled)return null;
 const url=new URL(c.proxyType+'://'+c.proxyHost+':'+c.proxyPort);url.username=c.proxyUsername;url.password=c.proxyPassword;
 const server=new Server({host:'127.0.0.1',port:0,verbose:false,prepareRequestFunction:()=>({upstreamProxyUrl:url.toString()})});
 await server.listen();return {rule:'http://127.0.0.1:'+server.port,close:()=>server.close(true)};
}
function createProxyService({directory,safeStorage,session}){
 const file=path.join(directory,'account-proxies.json');let data={};try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch{}
 function get(key){if(!data[key])return null;try{return JSON.parse(safeStorage.decryptString(Buffer.from(data[key].encrypted,'base64')))}catch{throw Error('无法解密代理配置，请重新输入并保存')}}
 function save(key,value){const c=normalize(value);if(!safeStorage.isEncryptionAvailable())throw Error('系统凭据加密不可用，未保存代理');const next={...data,[key]:{revision:randomUUID(),encrypted:safeStorage.encryptString(JSON.stringify(c)).toString('base64')}};fs.writeFileSync(file+'.tmp',JSON.stringify(next));fs.renameSync(file+'.tmp',file);data=next;return true}
 async function apply(ses,a,item){if(item.destroyed)return;const c=a.proxyEnabled?get(a.platform+':'+a.id):{proxyEnabled:false};if(!c?.proxyEnabled&&a.proxyEnabled)throw Error('请在代理设置中重新保存完整代理信息');const b=await bridge(c);item.closeProxy=()=>b?.close();if(item.destroyed){await b?.close();return}try{await ses.closeAllConnections();await ses.setProxy(b?{mode:'fixed_servers',proxyRules:b.rule,proxyBypassRules:'<-loopback>'}:{mode:'direct'});await ses.closeAllConnections()}catch(e){await b?.close();throw Error('代理应用失败，未切换到直连')}}
 const queues=new Map();function configure(ses,a,item){const key=a.platform+':'+a.id;const job=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(()=>apply(ses,a,item));queues.set(key,job);return job}
 async function test(value){const c=normalize(value),b=await bridge(c),ses=session.fromPartition('zl-proxy-test-'+randomUUID(),{cache:false});try{await ses.setProxy(b?{mode:'fixed_servers',proxyRules:b.rule,proxyBypassRules:'<-loopback>'}:{mode:'direct'});const begin=Date.now(),r=await ses.fetch('https://api.ipify.org?format=json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const {ip}=await r.json();if(!isIP(ip))throw Error();return {ip,latency:Date.now()-begin}}catch{throw Error('代理检测失败或超时，请检查协议、端口、账号密码及代理可用性；未切换直连')}finally{await ses.closeAllConnections();await b?.close()}}
 return {get,save,test,configure,revision:key=>data[key]?.revision||''};
}
module.exports={normalize,bridge,createProxyService};
