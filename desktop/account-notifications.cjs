function bindAccountNotification(notification,win,account,onClosed=()=>{}){
 notification.on('click',()=>{notification.close();if(win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus();win.webContents.send('select-account',{platform:account.platform,id:account.id})});
 notification.on('close',()=>onClosed(notification));
}
module.exports={bindAccountNotification};
