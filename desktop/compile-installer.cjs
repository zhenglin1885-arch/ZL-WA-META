const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.join(__dirname,'release/win-unpacked');let files=[],dirs=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(item.name.startsWith("."))continue;const p=path.join(dir,item.name);if(item.isDirectory()){walk(p);dirs.push(p)}else files.push(p)}}walk(root);
const rel=p=>path.relative(root,p).split(path.sep).join('\\');
fs.writeFileSync(path.join(__dirname,'uninstall-files.nsh'),files.map(p=>'Delete "$INSTDIR\\'+rel(p)+'"').concat(dirs.map(p=>'RMDir "$INSTDIR\\'+rel(p)+'"')).join('\n'));
execFileSync(process.env.MAKENSIS||'makensis',['installer.nsi'],{cwd:__dirname,stdio:'inherit'});
