// Test-build gate only. No online licensing, expiration or hardware binding.
export const OFFLINE_LICENSE_KEY='zl.test.offline-license.v1';
export const TEST_ACTIVATION_CODE='ZL2026TESTA1B2C3D4E5';
export const normalizeCode=value=>String(value??'').trim().toUpperCase();
export function checkOfflineCode(value){const code=normalizeCode(value);if(!/^[A-Z0-9]{20}$/.test(code))return '请输入 20 位大写字母和数字组成的激活码。';return code===TEST_ACTIVATION_CODE?'':'激活码不正确，请检查后重试。'}
export function readOfflineLicense(storage){try{const r=JSON.parse(storage.getItem(OFFLINE_LICENSE_KEY));if(r?.version!==1||checkOfflineCode(r.code)||!Number.isFinite(r.activatedAt)||r.activatedAt<=0||r.activatedAt>Date.now()+60000)return null;return {version:1,code:r.code,activatedAt:r.activatedAt}}catch{return null}}
export function activateOffline(storage,value){const error=checkOfflineCode(value);if(error)throw Error(error);const prior=readOfflineLicense(storage);const record=prior||{version:1,code:normalizeCode(value),activatedAt:Date.now()};storage.setItem(OFFLINE_LICENSE_KEY,JSON.stringify(record));return record}
