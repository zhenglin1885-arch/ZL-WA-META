export function nativeAccountView(profile,status){
 const m=status?.metadata,authenticated=m?.authenticated===true;
 const failed=['error','blocked','incompatible'].includes(status?.state)||m?.offline===true;
 const unreadCount=authenticated&&Number.isSafeInteger(m.unreadCount)?m.unreadCount:0;
 return {nickname:m?.nickname||(authenticated?'WhatsApp 账号':profile.name),phoneNumber:m?.phoneNumber||(profile.sleeping?'已休眠':authenticated?'手机号暂未同步':m?.authenticated===false?'未登录':failed?'连接异常':status?.metadataSync==='unavailable'?'资料同步暂不可用':'正在同步账号资料…'),avatarUrl:m?.avatarUrl||'',remark:profile.remark,unreadCount,unreadLabel:unreadCount>99?'99+':unreadCount?String(unreadCount):'',status:profile.sleeping?'gray':failed?'yellow':authenticated?'green':m?.authenticated===false?'red':'gray',authenticated,isSample:false};
}
