/** Electron MAIN process only. Inject OS-backed secret storage and stable device SHA-256. */
export class LicenseClient {
 constructor({baseUrl,deviceId,deviceName='',readToken,writeToken,onInvalid,onUnavailable=()=>{},onValid=()=>{}}){
  const url=new URL(baseUrl);if(url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Activation server requires HTTPS');
  if(!/^[a-f0-9]{64}$/.test(deviceId))throw Error('deviceId must be SHA-256');
  Object.assign(this,{baseUrl:url.origin,deviceId,deviceName,readToken,writeToken,onInvalid,onUnavailable,onValid});this.timer=null;this.stopped=true;this.epoch=0;
 }
 async request(path,body,token){const r=await fetch(this.baseUrl+'/api/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok){const e=Error(data.message||'License server error');e.code=data.error;e.authoritative=r.status===403&&['disabled','expired','invalid_token','device_mismatch','invalid_code'].includes(data.error);throw e}if(data.valid!==true)throw Error('Invalid license response');return data}
 async activate(code){if(!/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{8}$/.test(code))throw Error('请输入8位大写字母和数字组合');const data=await this.request('activate',{code,device_id:this.deviceId,device_name:this.deviceName});await this.writeToken(data.device_token);await this.start();return data}
 stop(){this.stopped=true;this.epoch++;clearTimeout(this.timer)}
 async start(){this.stop();this.stopped=false;return this.check(this.epoch)}
 schedule(ms,epoch){if(!this.stopped&&epoch===this.epoch)this.timer=setTimeout(()=>this.check(epoch),ms)}
 async check(epoch){
  try{const token=await this.readToken();if(!token){this.stop();await this.onInvalid({code:'activation_required'});return false}
   const data=await this.request('verify',{device_id:this.deviceId},token);if(this.stopped||epoch!==this.epoch)return false;
   await this.onValid(data);this.schedule(Math.max(1000,Math.min(data.recheck_after_seconds*1000,(data.valid_until-data.server_time)*1000,21600000)),epoch);return true;
  }catch(e){if(this.stopped||epoch!==this.epoch)return false;if(e.authoritative){this.stop();await this.writeToken(null);await this.onInvalid(e)}else{await this.onUnavailable(e);this.schedule(60000,epoch)}return false}
 }
}
