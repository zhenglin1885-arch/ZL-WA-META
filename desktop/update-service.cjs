const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const REPO='zhenglin1885-arch/ZL-WA-META',ASSET='ZL-Multi-Manager-Setup.exe';
function versionParts(v){const m=/^v?(\d+)\.(\d+)\.(\d+)(?:-R(\d+))?$/i.exec(v||'');if(!m)throw Error('发布版本号格式无效');return m.slice(1).map(x=>Number(x||0))}
function newer(a,b){const x=versionParts(a),y=versionParts(b);for(let i=0;i<4;i++)if(x[i]!==y[i])return x[i]>y[i];return false}
function assetURL(value){const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='github.com'||!u.pathname.startsWith('/'+REPO+'/releases/download/')||u.username||u.password)throw Error('更新下载地址不属于发布仓库');return u.href}
function createUpdateService({fetch,directory,currentVersion,launch,quit}){
 let release=null,busy=false;
 async function check(){if(busy)throw Error('更新下载正在进行');const r=await fetch('https://api.github.com/repos/'+REPO+'/releases/latest',{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});release=null;if(r.status===404)return {available:false,currentVersion,message:'GitHub 尚未发布可用安装包'};if(!r.ok)throw Error('GitHub 更新检查失败：HTTP '+r.status);const data=await r.json();if(data.draft||data.prerelease)throw Error('最新发布不是正式版本');const available=newer(data.tag_name,currentVersion),exe=data.assets?.find(a=>a.name===ASSET),sum=data.assets?.find(a=>a.name==='SHA256SUMS.txt');if(available&&(!exe||!sum))throw Error('发布缺少安装包或 SHA256SUMS.txt');if(available)release={version:data.tag_name,url:assetURL(exe.browser_download_url),checksum:assetURL(sum.browser_download_url),size:exe.size};return {available,currentVersion,version:data.tag_name,message:available?'发现新版本 '+data.tag_name:'当前已是最新版本'}}
 async function install(progress=()=>{}){if(busy)throw Error('更新正在进行');if(!release)throw Error('请先检查可用更新');busy=true;const selected={...release};let temp;try{
  fs.mkdirSync(directory,{recursive:true});const sums=await fetch(selected.checksum,{signal:AbortSignal.timeout(15000)});if(!sums.ok)throw Error('无法读取安装包校验值');const line=(await sums.text()).split(/\r?\n/).find(l=>l.trim().endsWith(ASSET));const hash=/^\s*([a-f0-9]{64})\s+\*?ZL-Multi-Manager-Setup\.exe\s*$/i.exec(line||'')?.[1]?.toLowerCase();if(!hash)throw Error('安装包校验值格式错误');
  temp=path.join(directory,'ZL-update.part');const final=path.join(directory,'ZL-update-'+selected.version.replace(/^v/,'')+'.exe');const r=await fetch(selected.url,{signal:AbortSignal.timeout(600000)});if(!r.ok||!r.body)throw Error('安装包下载失败');const fd=fs.openSync(temp,'w'),digest=createHash('sha256');let size=0;try{for await(const chunk of r.body){size+=chunk.length;if(size>600*1024*1024)throw Error('安装包超过大小限制');fs.writeSync(fd,chunk);digest.update(chunk);progress({received:size,total:selected.size||0})}}finally{fs.closeSync(fd)}
  if((selected.size&&size!==selected.size)||digest.digest('hex')!==hash)throw Error('安装包校验失败，未启动安装');fs.renameSync(temp,final);temp=null;await launch(final);quit();return true;
 }finally{busy=false;if(temp)try{fs.unlinkSync(temp)}catch{}}}
 return {check,install};
}
module.exports={createUpdateService,newer,assetURL};
