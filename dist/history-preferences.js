import {validateCacheDirectory} from './system-settings-model.js';
export const HISTORY_KEY='zl.history.preferences.v1';
export function normalizeHistory(p={}){return {enabled:p?.enabled===true,autoExport:p?.autoExport===true,time:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(p?.time)?p.time:'23:30',directory:typeof p?.directory==='string'&&!validateCacheDirectory(p.directory)?p.directory.trim():'',retention:['30','90','180','365','forever'].includes(p?.retention)?p.retention:'365'}}
export function readHistory(storage){try{return normalizeHistory(JSON.parse(storage.getItem(HISTORY_KEY)))}catch{return normalizeHistory()}}
export function saveHistory(storage,p){const error=validateCacheDirectory(p.directory||'');if(error)throw Error(error);const result=normalizeHistory(p);storage.setItem(HISTORY_KEY,JSON.stringify(result));return result}
