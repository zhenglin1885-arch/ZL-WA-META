export const SETTINGS_KEY='zl.system.preferences.v1';
export const ACTIVATION_RECHECK_HOURS=6;
export function readPreferences(storage){try{const p=JSON.parse(storage.getItem(SETTINGS_KEY));return {autoStart:p?.autoStart===true,closeBehavior:p?.closeBehavior==='exit'?'exit':'tray',cacheDirectory:typeof p?.cacheDirectory==='string'?p.cacheDirectory:''}}catch{return {autoStart:false,closeBehavior:'tray',cacheDirectory:''}}}
export function validateCacheDirectory(value){const path=value.trim();if(!path)return '';if(!/^(?:[a-zA-Z]:\\|\\\\[^\\]+\\[^\\]+)/.test(path)||/[<>"|?*\x00-\x1f]/.test(path)||path.slice(2).includes(':'))return '请填写完整的 Windows 目录，例如 D:\\ZLCache。';return ''}
export function savePreferences(storage,prefs){const p={autoStart:prefs.autoStart===true,closeBehavior:prefs.closeBehavior==='exit'?'exit':'tray',cacheDirectory:String(prefs.cacheDirectory||'').trim()};const error=validateCacheDirectory(p.cacheDirectory);if(error)throw new Error(error);storage.setItem(SETTINGS_KEY,JSON.stringify(p));return p}
export function activationFormatError(code){return /^[A-Z0-9]{8}$/.test(code)&&/[A-Z]/.test(code)?'':'请输入 8 位大写字母或数字组成的激活码，不能为纯数字。'}
