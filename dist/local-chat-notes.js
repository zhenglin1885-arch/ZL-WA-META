export function chatNoteKey(platform,accountId,chatId){return ['zl.chat-note.v1',platform,accountId,chatId].map(encodeURIComponent).join(':')}
export function createLocalChatNotes({storage,platform,accountId}){
 return {get(chatId){try{const value=JSON.parse(storage.getItem(chatNoteKey(platform,accountId,chatId)));return typeof value==='string'?value:''}catch{return ''}},set(chatId,value){if(typeof chatId!=='string'||!chatId||typeof value!=='string')throw new Error('备注格式无效');const text=value.replace(/[\r\n]+/g,' ').trim();storage.setItem(chatNoteKey(platform,accountId,chatId),JSON.stringify(text));return text}};
}
