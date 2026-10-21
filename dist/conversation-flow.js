export function createMessageDraft(){return {text:'',original:'',phase:'original',generation:0,request:null,error:''}}
export function editMessageDraft(draft,text){
 if(draft.phase==='translating')return false;
 draft.text=text;draft.error='';if(!text.trim())draft.phase='original';return true;
}
export function resetMessageDraft(draft,text=''){
 draft.generation++;draft.text=text;draft.original='';draft.phase='original';draft.request=null;draft.error='';
}
export function beginMessageSend(draft,settings){
 if(draft.phase==='translating'||!draft.text.trim())return {type:'noop'};
 if(!settings.enabled||draft.phase==='review'){
  const text=draft.text;resetMessageDraft(draft);return {type:'sent',text};
 }
 draft.original=draft.text;draft.phase='translating';draft.error='';
 const request={generation:++draft.generation,text:draft.text,settings:{...settings}};draft.request=request;
 return {type:'translate',request};
}
export function finishMessageTranslation(draft,request,{text,error}){
 if(draft.phase!=='translating'||draft.request?.generation!==request.generation)return false;
 draft.request=null;
 if(error||typeof text!=='string'||!text.trim()){
  draft.phase='original';draft.text=draft.original;draft.error=error||'未获得译文，请重试。';return true;
 }
 draft.text=text;draft.phase='review';draft.error='';return true;
}
export function changeDraftTranslationSettings(draft){
 if(draft.phase==='translating'){const original=draft.original;resetMessageDraft(draft,original)}
 else if(draft.phase==='review'){draft.phase='original';draft.original=''}
 draft.error=draft.text?'翻译设置已更改，请检查内容后重新点击发送。':'';
}
