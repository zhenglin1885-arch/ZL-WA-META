// Only application-local ordering. No WhatsApp transport or official pin mutation.
export function pinStorageKey(platform,accountId){return 'zl.local-chat-pins.v1:'+encodeURIComponent(platform)+':'+encodeURIComponent(accountId)}
export function createLocalChatPins({storage,platform,accountId}){
 const key=pinStorageKey(platform,accountId);let pinned=[];
 try{const saved=JSON.parse(storage.getItem(key));if(Array.isArray(saved))pinned=[...new Set(saved.filter(id=>typeof id==='string'&&id.length))]}catch{}
 return {has:id=>pinned.includes(id),get ids(){return [...pinned]},set(id,enabled){
  if(typeof id!=='string'||!id)throw new Error('无效会话');
  const next=pinned.filter(value=>value!==id);if(enabled)next.push(id);
  storage.setItem(key,JSON.stringify(next));pinned=next;
 },sort(chats){const rank=new Map(pinned.map((id,index)=>[id,index]));return chats.map((chat,index)=>({chat,index})).sort((a,b)=>{const ap=rank.has(a.chat.id),bp=rank.has(b.chat.id);return ap&&bp?rank.get(a.chat.id)-rank.get(b.chat.id):ap?-1:bp?1:a.index-b.index}).map(item=>item.chat)}};
}
