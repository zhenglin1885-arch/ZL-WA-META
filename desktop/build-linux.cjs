const {build,Platform,Arch}=require('electron-builder');
build({targets:Platform.WINDOWS.createTarget('nsis',Arch.x64),config:{toolsets:{wine:'1.0.1'}}}).catch(e=>{console.error(e);process.exitCode=1});
