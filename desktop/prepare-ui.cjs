const fs=require('node:fs'),path=require('node:path');
fs.rmSync(path.join(__dirname,'ui'),{recursive:true,force:true});
fs.cpSync(path.join(__dirname,'../dist'),path.join(__dirname,'ui'),{recursive:true,filter:p=>! /\.(zip|exe)$/i.test(p)});
