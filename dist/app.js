import {openNativeTranslation} from './native-translation.js';
import {openNativeTool} from './native-tools.js';
import {startNetworkStatus} from './native-network.js';
import {nativeAccountView} from './native-account-view.js';
import {createNativeWorkspace} from './native-workspace.js';
import {openGroupManager} from './group-manager.js';
import {readPreferences} from './system-settings-model.js';
import {DEFAULT_GROUP,newId,defaultConfig,initialState,restoreState,serializableState,validateDraft,parseProxy,createProfile,safeConfig,accountCardView,archiveProfile,applyProxySettings} from './core.js';
import {createProxyPanel} from './proxy-panel.js';
import {applyTranslationSettings} from './translation-config.js';
import {createTranslationPanel,createTranslationKeyForm} from './translation-panel.js';
import {createConversationSession,createConversationDemo} from './conversation-demo.js';

import {PLATFORMS,platformConfig,loadPlatform,savePlatform,createPlatformRuntime} from './platforms.js';
import {createFacebookStage} from './facebook-stage.js';
import {openBulkDialog} from './bulk-dialog.js';
import {createSystemSettings} from './system-settings.js';
import {createPinnedConversationWorkspace,createPinnedConversationDemo} from './pinned-conversations.js';

const $=id=>document.getElementById(id);
let activePlatform='whatsapp';try{const saved=localStorage.getItem('zl.ui.platform.v1');if(Object.hasOwn(PLATFORMS,saved))activePlatform=saved}catch{}
const platform=()=>platformConfig(activePlatform);
let STORAGE=platform().storage;
let SIDEBAR_STORAGE=platform().sidebarStorage;
let sidebarCollapsed=false;try{sidebarCollapsed=localStorage.getItem(SIDEBAR_STORAGE)==='true'}catch{}
let state;try{state=loadPlatform(localStorage,activePlatform)}catch{state=initialState()}
let draft=null,editingId=null,activeTab='basic',activeTool=null,toastTimer,dialogOpener;
const platformRuntimes={whatsapp:createPlatformRuntime(),facebook:createPlatformRuntime()};
let {sampleCardIds,sampleUnreadCounts,proxyCredentialsByProfile,conversationSessions,conversationDemoIds}=platformRuntimes[activePlatform];
let proxyPanel=null;
let translationPanel=null,translationKeyOpener=null;
let translationCredentials={openai:'',gemini:''};
let conversationView=null;
let remarkEditingId=null;
const paths={
 meta:'<path d="M3 16c-2-3 0-10 3-10 4 0 7 12 11 12 3 0 5-3 4-6-1-4-3-7-5-6-3 1-6 12-9 12-2 0-3-1-4-2Z"/>',
 home:'<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
 whatsapp:'<path d="m3 21 1.5-5A9 9 0 1 1 8 20L3 21Z"/><path d="M9 7c-1 0-1.5 1-1 3 1 3 3 5 6 6 2 .5 3 0 3-1l-3-2-1 1c-2-1-3-2-4-4l1-1-1-2Z"/>',
 settings:'<path d="M9.2 3.2 9.8 1.8h4.4l.6 1.4.5 1.7 1.5.9 1.7-.4 1.5.2 2.2 3.8-.6 1.4-1.2 1.3v1.8l1.2 1.3.6 1.4-2.2 3.8-1.5.2-1.7-.4-1.5.9-.5 1.7-.6 1.4H9.8l-.6-1.4-.5-1.7-1.5-.9-1.7.4-1.5-.2-2.2-3.8.6-1.4 1.2-1.3v-1.8L2.4 10l-.6-1.4L4 4.8l1.5-.2 1.7.4 1.5-.9z" stroke-linejoin="round" stroke-linecap="round"/><circle cx="12" cy="12.5" r="3.1"/>',
 menu:'<path d="M5 7h14M5 12h14M5 17h14"/>',plus:'<path d="M12 5v14M5 12h14"/>',
 minimize:'<path d="M4 16h16"/>',maximize:'<rect x="5" y="5" width="14" height="14" rx=".5"/>',
 sidebarExpand:'<path d="M4 5h16M11 12h9M4 19h16m0-10 4 3-4 3"/>',
 chevron:'<path d="m8 10 4 4 4-4"/>',more:'<circle cx="12" cy="5" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="12" cy="19" r=".8"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',refresh:'<path d="M20 10a8 8 0 0 0-14-4L3 9m0-5v5h5M4 14a8 8 0 0 0 14 4l3-3m0 5v-5h-5"/>',
 layers:'<path d="m12 3 10 5-10 5L2 8l10-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
 sliders:'<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
 moon:'<path d="M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11Z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
 power:'<path d="M12 3v9M7 5a8 8 0 1 0 10 0"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',eyeOff:'<path d="m3 3 18 18M9 5a12 12 0 0 1 3 0c6 0 10 7 10 7s-1 2-3 4M6 6c-3 2-4 6-4 6s4 7 10 7c2 0 4-1 6-2"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',network:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
 translate:'<path d="M3 5h12M9 3v2M5 5c0 5 4 8 8 10M13 5c0 4-4 8-9 11m10 5 4-10 4 10m-7-3h6"/>',send:'<path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15"/>',
 person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 pen:'<path d="m4 16 11-11 4 4L8 20H4v-4ZM13 7l4 4M3 23h16"/>',
 readAll:'<path d="m3 10 9-6 9 6v10H3V10Zm0 0 9 6 9-6"/>',
 move:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
 trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
 scan:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M4 12h16"/>',
 fingerprint:'<path d="M4 11a8 8 0 0 1 16 0m-12 9c2-3 2-5 2-8a2 2 0 0 1 4 0c0 4-.5 7-2 10M6 17c1-2 1-3 1-5a5 5 0 0 1 10 0c0 4-1 7-2 9M4 14v-2m15 8c1-3 1-5 1-7M12 12c0 3-.5 5-1 6"/>',
 lock:'<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v2"/>'
};
function icon(name,size=18){return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.layers)+'</svg>'}
function fillIcons(root=document){root.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon,e.classList.contains('rail-icon')?24:18))}
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function action(label,fn,cls='button quiet',symbol){const b=node('button',cls);b.type='button';if(symbol){const s=node('span');s.innerHTML=icon(symbol,15);b.append(s)}b.append(document.createTextNode(label));b.onclick=fn;return b}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000)}
const nativeWorkspace=createNativeWorkspace({getAccounts:()=>Object.keys(PLATFORMS).flatMap(platform=>{const data=platform===activePlatform?state:loadPlatform(localStorage,platform);return data.profiles.map(p=>({platform,id:p.id,sleeping:p.sleeping,proxyEnabled:p.config?.proxyEnabled&&p.config?.proxyType!=='direct'}))}),getActive:()=>{const p=current();return p?{key:activePlatform+':'+p.id}:null},onStatus:()=>renderGroups(),onError:message=>toast(String(message))});
function persist(next){try{savePlatform(localStorage,activePlatform,next);state=next;return true}catch{toast('当前浏览器无法保存配置，请检查存储空间或浏览器限制。');return false}}
function updateState(fn){const next=structuredClone(state);fn(next);if(!persist(next))return false;render();return true}
function current(){return state.profiles.find(p=>p.id===state.activeId)}
function cardView(profile){if(nativeWorkspace)return nativeAccountView(profile,nativeWorkspace.status(activePlatform,profile.id));return accountCardView(profile,{sample:sampleCardIds.has(profile.id),sampleUnreadCount:sampleUnreadCounts.get(profile.id),platform:activePlatform})}
function serial(number){return 'ENV-'+String(number).padStart(4,'0')}
function selectProfile(id,wake=false){requestDrawerClose(()=>{closeGroup();closeContext();updateState(s=>{s.activeId=id;if(wake){const p=s.profiles.find(p=>p.id===id);if(p)p.sleeping=false}})})}
function toggleProfileSleep(id){
 if(id===state.activeId&&(proxyPanel?.isDirty()||translationPanel?.isDirty()))return requestDrawerClose(()=>toggleProfileSleep(id));
 const next=structuredClone(state),profile=next.profiles.find(p=>p.id===id);if(!profile)return false;
 profile.sleeping=!profile.sleeping;if(!persist(next))return false;
 closeGroup();closeContext();closeRemark();
 if(id===state.activeId){closeDrawer();render()}else renderGroups();return true
}
function applySidebarMode(){
 document.querySelector('.app-shell').classList.toggle('sidebar-collapsed',sidebarCollapsed);
 const button=$('toggleSidebar'),label=sidebarCollapsed?'展开账号栏':'收起账号栏';
 button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-expanded',String(!sidebarCollapsed));button.innerHTML=icon(sidebarCollapsed?'sidebarExpand':'menu');
}
function toggleSidebar(){
 closeGroup();closeContext();closeRemark();sidebarCollapsed=!sidebarCollapsed;
 try{localStorage.setItem(SIDEBAR_STORAGE,String(sidebarCollapsed))}catch{}
 applySidebarMode();renderGroups();
 const selected=[...$('groupList').querySelectorAll('.account-card')].find(card=>card.dataset.profileId===state.activeId);selected?.scrollIntoView({block:'nearest'});
}

function renderPlatformChrome(){
 const config=platform();
 $('platformHeading').textContent=config.name;$('platformHeading').title=config.name;
 $('platformToolbarTitle').textContent=config.name;$('platformToolbarIcon').innerHTML=icon(config.icon);
 $('platformStatus').textContent=nativeWorkspace?'WhatsApp 独立会话': '界面演示：仅保存配置，未运行真实 '+config.name+' 或应用指纹设置。';
 document.querySelector('[data-tool="forward"]').hidden=!config.forward;
 document.querySelector('[data-tool="groups"]').hidden=activePlatform!=='whatsapp';
 document.body.dataset.platform=activePlatform;
 document.querySelectorAll('.platform-button[data-platform]').forEach(button=>{const selected=button.dataset.platform===activePlatform;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected))});
}
function switchPlatform(id){
 if(!Object.hasOwn(PLATFORMS,id)||id===activePlatform)return;
 if(document.querySelector('dialog[open]'))return;
 requestDrawerClose(()=>{
  closeGroup();closeContext();closeRemark();conversationView?.destroy();conversationView=null;
  activePlatform=id;STORAGE=platform().storage;SIDEBAR_STORAGE=platform().sidebarStorage;
  ({sampleCardIds,sampleUnreadCounts,proxyCredentialsByProfile,conversationSessions,conversationDemoIds}=platformRuntimes[id]);
  try{state=loadPlatform(localStorage,id)}catch{state=initialState()}
  sidebarCollapsed=false;try{sidebarCollapsed=localStorage.getItem(SIDEBAR_STORAGE)==='true';localStorage.setItem('zl.ui.platform.v1',id)}catch{}
  applySidebarMode();render();
 });
}

function render(){renderPlatformChrome();renderGroups();renderStage();const p=current();$('bottomCount').textContent=state.profiles.length+' 个环境';$('selectedLabel').textContent=p?p.name+' · '+serial(p.number):'官方界面区域';$('editEnvironment').hidden=!p;$('openChatDemo').hidden=!!nativeWorkspace||!p||activePlatform!=='whatsapp';$('openChatDemo').disabled=!!p?.sleeping;$('sleepButton').hidden=!p;$('sleepButton').innerHTML=icon(p?.sleeping?'power':'moon');$('sleepButton').title=p?.sleeping?'开启':'休眠';$('sleepButton').setAttribute('aria-label',(p?.sleeping?'开启':'休眠')+'当前账号');}
function renderGroups(){
 nativeWorkspace?.sync();
 const list=$('groupList');list.replaceChildren();
 state.groups.forEach(group=>{
  const section=node('section','group-section'),row=node('div','group-row'),toggle=node('button','group-toggle'+(group.collapsed?' closed':''));
  toggle.type='button';toggle.innerHTML=icon('chevron',12);toggle.append(node('span','',group.name));toggle.setAttribute('aria-expanded',String(!group.collapsed));toggle.title=group.name;toggle.onclick=()=>updateState(s=>{s.groups.find(g=>g.id===group.id).collapsed=!group.collapsed});
  const add=action('＋新增会话',()=>openEnvironment(group.id),'group-add');const menu=action('',e=>groupMenu(group,menu.getBoundingClientRect().right,menu.getBoundingClientRect().bottom),'icon-button group-menu','more');menu.title='分组菜单';menu.setAttribute('aria-label',group.name+' 的菜单');
  const groupUnread=state.profiles.filter(p=>p.groupId===group.id).reduce((n,p)=>n+cardView(p).unreadCount,0);if(groupUnread){const badge=node('span','group-unread',groupUnread>99?'99+':String(groupUnread));badge.setAttribute('aria-label',groupUnread+' 条未读消息');toggle.append(badge)}
  row.append(toggle,add,menu);row.oncontextmenu=e=>{e.preventDefault();groupMenu(group,e.clientX,e.clientY)};section.append(row);
  if(sidebarCollapsed||!group.collapsed){
   const profiles=state.profiles.filter(p=>p.groupId===group.id);
   profiles.forEach(profile=>{
    const view=cardView(profile);
    const card=node('article','account-card'+(profile.id===state.activeId?' selected':'')+(profile.sleeping?' sleeping':'')+(view.unreadCount?' has-unread':''));
    card.dataset.profileId=profile.id;
    const main=node('button','account-main');main.type='button';main.setAttribute('aria-pressed',String(profile.id===state.activeId));main.title=view.nickname+'\n'+view.phoneNumber+'\n备注：'+(view.remark||'未填写')+'\n'+profile.name+' · '+serial(profile.number)+(view.isSample?'\n示例资料，未登录真实账号':'');
    if(view.unreadCount)main.title+='\n'+view.unreadCount+' 条未读消息'+(view.isUnreadSample?'（示例）':'');card.title=main.title;
    const avatar=node('span','account-avatar'),avatarContent=node('span','account-avatar-content');
    if(view.avatarUrl){const photo=node('img','account-avatar-photo');photo.src=view.avatarUrl;photo.alt=view.isSample?'示例账号头像':view.nickname+' 的 '+platform().name+' 头像';photo.decoding='async';photo.onerror=()=>{avatarContent.innerHTML=icon('person',22)};avatarContent.append(photo)}else avatarContent.innerHTML=icon('person',22);
    avatar.append(avatarContent,node('i','account-dot '+view.status));
    const lines=node('span','account-lines');lines.append(node('strong','account-nickname',view.nickname),node('span','account-phone',view.phoneNumber));main.append(avatar,lines);
    const compactLabel=view.remark||(view.authenticated||view.isSample?view.nickname:profile.name);
    const remark=action('',()=>sidebarCollapsed?selectProfile(profile.id):editRemark(profile,remark),'account-remark-button','pen');remark.append(node('span','remark-text'+(view.remark?'':' empty'),sidebarCollapsed?compactLabel:view.remark||'备注'));remark.title=sidebarCollapsed?main.title:view.remark?'编辑备注：'+view.remark:'填写本地备注';remark.setAttribute('aria-label',sidebarCollapsed?'选择账号：'+compactLabel:'编辑 '+view.nickname+' 的本地备注');remark.ondblclick=()=>{if(sidebarCollapsed)selectProfile(profile.id,true)};
    main.onclick=()=>selectProfile(profile.id);main.ondblclick=()=>selectProfile(profile.id,true);
    const sleep=action('',e=>{e.stopPropagation();if(toggleProfileSleep(profile.id)){const updated=[...$('groupList').querySelectorAll('.account-card')].find(a=>a.dataset.profileId===profile.id);updated?.querySelector('.account-sleep')?.focus({preventScroll:true})}},'icon-button account-sleep'+(profile.sleeping?' is-sleeping':''),profile.sleeping?'power':'moon');
    const sleepLabel=profile.sleeping?'开启':'休眠';sleep.title=sleepLabel+(nativeWorkspace?'':'（演示）');sleep.setAttribute('aria-label',sleepLabel+' '+(view.remark||profile.name)+(nativeWorkspace?'':'（演示）'));sleep.ondblclick=e=>e.stopPropagation();
    const more=action('',()=>accountMenu(profile,more.getBoundingClientRect().right,more.getBoundingClientRect().bottom),'icon-button account-more','more');more.title='账号菜单';more.setAttribute('aria-label',profile.name+' 的菜单');
    card.oncontextmenu=e=>{e.preventDefault();accountMenu(profile,e.clientX,e.clientY)};card.append(main,remark,sleep,more);
    if(view.unreadLabel){const unread=node('span','account-unread',view.unreadLabel);unread.setAttribute('aria-label',view.unreadCount+' 条未读消息'+(view.isUnreadSample?'（示例）':''));card.append(unread)}section.append(card)
   });
   if(!profiles.length&&!sidebarCollapsed)section.append(node('div','group-empty','在此分组新增会话，建立第一个环境。'));
  }
  list.append(section)
 });
 if(sidebarCollapsed&&!state.profiles.length){const empty=node('div','compact-empty','暂无账号');empty.title='展开账号栏后，点击分组中的“＋新增会话”';list.append(empty)}
}
function renderStage(){
 conversationView?.destroy();conversationView=null;
 const stage=$('stage'),p=current();stage.replaceChildren();stage.classList.remove('showing-conversation','showing-facebook');
 if(!p){
  const wrap=node('div','empty-stage'),symbol=node('div','stage-icon');symbol.innerHTML=icon('layers',38);
  wrap.append(symbol,node('h1','','先建立一个独立环境'),node('p','','为账号设置环境、代理和备注，'),node('p','','创建后进入 '+platform().name+' 官方登录区域。'),action('新增会话',()=>openEnvironment(),'button blue','plus'),node('p','capacity-note','不预设账号数量上限，实际多开取决于电脑性能。'));stage.append(wrap);return
 }
 if(nativeWorkspace){nativeWorkspace.render(stage,p,activePlatform);return}
 if(p.sleeping){const wrap=node('div','empty-stage'),symbol=node('div','stage-icon');symbol.innerHTML=icon('moon',34);wrap.append(symbol,node('h1','','当前环境已休眠（演示）'),node('p','','双击左侧账号卡片，或点击该账号的开启按钮。'),node('span','sleep-label',serial(p.number)+' · '+p.name));stage.append(wrap);return}
 stage.classList.toggle('showing-conversation',conversationDemoIds.has(p.id));
 if(conversationDemoIds.has(p.id)){
  let session=conversationSessions.get(p.id);if(!session){session=activePlatform==='whatsapp'?createPinnedConversationWorkspace(p.translation,{storage:localStorage,accountId:p.id}):createConversationSession(p.translation);conversationSessions.set(p.id,session)}else session.applyConfig(p.translation);
  conversationView=(activePlatform==='whatsapp'?createPinnedConversationDemo:createConversationDemo)(session,{platformName:platform().name,accountName:p.remark||p.name,icon,onClose:()=>{conversationDemoIds.delete(p.id);renderStage()}});stage.append(conversationView.element);return
 }
 if(activePlatform==='facebook'){stage.classList.add('showing-facebook');stage.append(createFacebookStage({icon,onDemo:()=>{conversationDemoIds.add(p.id);renderStage()}}));return}
 const wrap=node('div','login-stage');
 const card=node('div','login-card'),instructions=node('div');instructions.append(node('h1','','在手机上关联 WhatsApp'));
 const steps=node('ol','login-steps');['打开手机上的 WhatsApp','进入“设置”或菜单中的“关联设备”','点击“关联设备”，扫描官方二维码'].forEach(t=>steps.append(node('li','',t)));instructions.append(steps);
 const placeholder=node('div','login-placeholder');placeholder.append(node('div','scan-corners'));const scan=node('div');scan.innerHTML=icon('scan',43);placeholder.append(scan,node('strong','','官方二维码区域'),node('span','','演示占位 · 桌面版加载'));
 card.append(instructions,placeholder);
 const note=node('div','login-note');note.innerHTML=icon('info',14);note.append(document.createTextNode(sampleUnreadCounts.has(p.id)?'左侧未读数量为交互示例，尚未接入真实消息；可通过账号菜单“全部已读”测试隐藏效果。':sampleCardIds.has(p.id)?'左侧正在预览示例头像、昵称和号码；该环境尚未登录真实 WhatsApp。':'本演示尚未连接 WhatsApp；真实二维码与扫码后的聊天页面由官方页面提供。'));
 wrap.append(card,note);stage.append(wrap)
}
function addGroup(){
 if(!$('groupPopover').hidden){closeGroup(true);return}
 closeContext();closeRemark();$('newGroupForm').reset();$('newGroupError').textContent='';$('newGroupInput').removeAttribute('aria-invalid');
 $('groupPopover').hidden=false;$('newGroup').setAttribute('aria-expanded','true');positionGroupPopover();$('newGroupInput').focus()
}
function positionGroupPopover(){
 const popup=$('groupPopover');if(popup.hidden)return;const anchor=$('newGroup').getBoundingClientRect();
 popup.style.left=Math.max(6,Math.min(anchor.left,innerWidth-popup.offsetWidth-6))+'px';popup.style.top=anchor.bottom+6+'px';popup.style.maxHeight=Math.max(0,innerHeight-anchor.bottom-14)+'px'
}
function closeGroup(restoreFocus=false){
 const popup=$('groupPopover');if(popup.hidden)return;popup.hidden=true;$('newGroup').setAttribute('aria-expanded','false');if(restoreFocus)$('newGroup').focus()
}
function saveGroup(e){
 e.preventDefault();const input=$('newGroupInput'),error=$('newGroupError'),name=input.value.trim();
 const message=!name?'请填写分组名称':state.groups.some(g=>g.name===name)?'分组名称已存在':'';
 if(message){error.textContent=message;input.setAttribute('aria-invalid','true');input.focus();return}
 if(!updateState(s=>s.groups.push({id:newId(),name,collapsed:false}))){error.textContent='保存失败，请重试';return}
 closeGroup(true);toast('分组已创建')
}
function context(items,x,y){
 closeGroup();closeContext();const menu=$('contextMenu');menu.replaceChildren();items.forEach(item=>{const button=action(item.label,()=>{closeContext();item.fn()},item.danger?'danger':'',item.icon);button.setAttribute('role','menuitem');menu.append(button)});menu.hidden=false;
 const bounds=menu.getBoundingClientRect();menu.style.left=Math.max(5,Math.min(x,(nativeWorkspace?$('stage').getBoundingClientRect().left:innerWidth)-bounds.width-7))+'px';menu.style.top=Math.max(5,Math.min(y,innerHeight-bounds.height-7))+'px';menu.querySelector('button')?.focus()
}
function closeContext(){$('contextMenu').hidden=true}
function groupMenu(group,x,y){const items=[{label:'新增会话',fn:()=>openEnvironment(group.id)}];if(group.id!==DEFAULT_GROUP)items.push({label:'重命名分组',fn:()=>renameGroup(group)},{label:'删除分组',danger:true,fn:()=>deleteGroup(group)});context(items,x,y)}
function renameGroup(group){
 const sections=[...$('groupList').children],section=sections[state.groups.findIndex(g=>g.id===group.id)],toggle=section.querySelector('.group-toggle'),input=node('input','group-edit-input');input.value=group.name;input.maxLength=30;input.setAttribute('aria-label','分组名称');toggle.replaceWith(input);input.focus();input.select();
 const err=node('p','inline-error');section.insertBefore(err,section.children[1]||null);
 input.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();renderGroups()}if(e.key==='Enter'){e.preventDefault();const name=input.value.trim();if(!name){err.textContent='请填写分组名称';return}if(state.groups.some(g=>g.id!==group.id&&g.name===name)){err.textContent='分组名称已存在';return}updateState(s=>s.groups.find(g=>g.id===group.id).name=name)}}
}
function deleteGroup(group){showConfirm('删除分组',[group.name,'包含 '+state.profiles.filter(p=>p.groupId===group.id).length+' 个账号。账号将移至默认分组，会话配置会保留。'],()=>updateState(s=>{s.groups=s.groups.filter(g=>g.id!==group.id);s.profiles.forEach(p=>{if(p.groupId===group.id)p.groupId=DEFAULT_GROUP});s.groups[0].collapsed=false}))}
function accountMenu(p,x,y){context([
 {label:'刷新会话',icon:'refresh',fn:()=>refreshSession(p.id)},
 {label:'全部已读',icon:'readAll',fn:()=>markAllRead(p.id)},
 {label:'移动分组',icon:'move',fn:()=>moveProfile(p)},
 {label:'修改昵称',icon:'person',fn:()=>editRemark(p)},
 {label:'删除会话',icon:'trash',danger:true,fn:()=>deleteSession(p.id)}
],x,y)}
function refreshSession(id){
 const p=state.profiles.find(p=>p.id===id);if(!p)return;
 if(p.sleeping){toast('此会话已休眠，请先开启。');return}
 if(nativeWorkspace){nativeWorkspace.refresh(activePlatform,id);return}
 if(id===state.activeId){renderStage();toast('已刷新演示占位界面；真实会话刷新待桌面版接入。')}else toast('该账号尚未运行真实 '+platform().name+'；会话刷新待桌面版接入。')
}
function markAllRead(id){
 if(nativeWorkspace){toast('未读状态同步尚未接入，请在官方页面中操作。');return}
 const p=state.profiles.find(p=>p.id===id);if(!p)return;const view=cardView(p);
 if(!view.unreadCount){toast('当前没有未读消息。');return}
 if(!view.isUnreadSample){toast('真实 '+platform().name+' 的“全部已读”操作待桌面版接入。');return}
 showConfirm('全部已读',[view.nickname,'确认将此账号的示例未读消息全部标记为已读？'],()=>{
  if(!state.profiles.some(p=>p.id===id))return;sampleUnreadCounts.set(id,0);renderGroups();if(id===state.activeId)renderStage();toast('示例未读数已清零。')
 });$('infoDialog').classList.add('session-confirm')
}
function deleteSession(id){
 const p=state.profiles.find(p=>p.id===id);if(!p)return;
 showConfirm('删除会话',[cardView(p).nickname],()=>{
  const wasActive=state.activeId===id,next=structuredClone(state);if(!archiveProfile(next,id)||!persist(next))return;
  sampleCardIds.delete(id);sampleUnreadCounts.delete(id);proxyCredentialsByProfile.delete(id);conversationSessions.delete(id);conversationDemoIds.delete(id);closeRemark();
  if(wasActive){closeDrawer();render()}else{renderGroups();$('bottomCount').textContent=state.profiles.length+' 个环境'}toast('会话已移出列表，本地配置已保留。')
 });$('infoDialog').classList.add('session-confirm')
}
function info(title,paragraphs){closeGroup();$('infoDialog').classList.remove('session-confirm');$('infoTitle').textContent=title;$('infoContent').replaceChildren();paragraphs.forEach(text=>$('infoContent').append(node('p','',text)));$('infoDialog').showModal()}
function showConfirm(title,paragraphs,fn){info(title,paragraphs);const buttons=node('div','dialog-buttons');buttons.append(action('取消',()=>$('infoDialog').close(),'button quiet'),action('确认',()=>{$('infoDialog').close();fn()},'button blue'));$('infoContent').append(buttons)}
function remarkAnchor(id){return [...document.querySelectorAll('.account-card')].find(card=>card.dataset.profileId===id)?.querySelector('.account-remark-button')}
function closeRemark(restoreFocus=false){const id=remarkEditingId;$('remarkPopover').hidden=true;remarkEditingId=null;if(restoreFocus)remarkAnchor(id)?.focus()}
function editRemark(p,anchor=remarkAnchor(p.id)){
 closeGroup();closeContext();closeRemark();remarkEditingId=p.id;const popup=$('remarkPopover');popup.replaceChildren();
 const form=node('form'),label=node('label','remark-label','本地备注'),input=node('input');input.id='remarkInput';label.htmlFor=input.id;input.value=state.profiles.find(a=>a.id===p.id)?.remark||'';input.maxLength=100;input.placeholder='填写备注';input.autocomplete='off';
 const buttons=node('div','remark-actions');buttons.append(action('取消',()=>closeRemark(true),'button quiet'));const save=node('button','button blue','保存');save.type='submit';buttons.append(save);form.append(label,input,buttons);popup.append(form);popup.hidden=false;
 form.onsubmit=e=>{e.preventDefault();if(!state.profiles.some(a=>a.id===p.id)){closeRemark();return}if(updateState(s=>s.profiles.find(a=>a.id===p.id).remark=input.value.trim())){closeRemark(true);toast('本地备注已保存')}};
 const rect=anchor?.getBoundingClientRect()||{left:65,top:100,bottom:118},size=popup.getBoundingClientRect();popup.style.left=Math.max(6,Math.min(rect.left,innerWidth-size.width-6))+'px';popup.style.top=Math.max(6,rect.bottom+size.height+8<innerHeight?rect.bottom+7:rect.top-size.height-7)+'px';input.focus();input.select()
}
function moveProfile(p){info('移动分组',[]);const select=node('select');select.setAttribute('aria-label','目标分组');state.groups.forEach(g=>{const o=node('option','',g.name);o.value=g.id;select.append(o)});select.value=p.groupId;const buttons=node('div','dialog-buttons');buttons.append(action('取消',()=>$('infoDialog').close()),action('确认',()=>{if(updateState(s=>{s.profiles.find(a=>a.id===p.id).groupId=select.value;s.groups.find(g=>g.id===select.value).collapsed=false}))$('infoDialog').close()},'button blue'));$('infoContent').append(select,buttons)}

function openEnvironment(groupId=DEFAULT_GROUP,profile=null,tab='basic'){
 if(proxyPanel?.isDirty()||translationPanel?.isDirty()){requestDrawerClose(()=>openEnvironment(groupId,profile,tab));return}
 closeGroup();closeContext();closeDrawer();dialogOpener=document.activeElement;editingId=profile?.id||null;
 draft=profile?{name:profile.name,remark:profile.remark,groupId:profile.groupId,config:safeConfig(profile.config)}:{name:'环境 '+String(state.nextNumber).padStart(2,'0'),remark:'',groupId,config:defaultConfig()};
 if(!state.groups.some(g=>g.id===draft.groupId))draft.groupId=DEFAULT_GROUP;
 $('environmentTitle').firstChild.textContent=profile?'编辑环境配置 ':'建立独立环境 ';
 $('saveEnvironment').replaceChildren(document.createTextNode(profile?'保存环境配置':'创建环境并打开登录页'));const arrow=node('span');arrow.innerHTML=icon('arrow',15);$('saveEnvironment').append(arrow);
 $('environmentGroup').replaceChildren();state.groups.forEach(g=>{const o=node('option','',g.name);o.value=g.id;$('environmentGroup').append(o)});
 $('accountRemark').value=draft.remark;$('environmentGroup').value=draft.groupId;$('fingerprintEnabled').checked=draft.config.fingerprintEnabled;
 for(const key of Object.keys(defaultConfig())){const control=$('environmentForm').elements.namedItem(key);if(control){if(control.type==='checkbox')control.checked=draft.config[key];else control.value=draft.config[key]}}
 $('proxyImport').value='';$('proxyPassword').value=profile?proxyCredentialsByProfile.get(profile.id)?.password||'':'';$('proxyImportError').textContent='';$('formError').textContent='';
 activeTab=tab;syncControls();setTab(tab);$('environmentDialog').showModal();if(tab==='basic')$('accountRemark').focus();else $('tab-'+tab).focus()
}
function closeEnvironment(){if(!$('environmentDialog').open)return;$('environmentDialog').close();draft=null;editingId=null;$('proxyPassword').value='';$('proxyImport').value='';if(dialogOpener?.isConnected)dialogOpener.focus()}
function setTab(tab){activeTab=tab;document.querySelectorAll('[data-tab]').forEach(b=>{const selected=b.dataset.tab===tab;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1});['basic','fingerprint','proxy'].forEach(t=>$('panel-'+t).hidden=t!==tab);$('environmentDialog').querySelector('.tab-scroll').scrollTop=0}
function collectDraft(){if(!draft)return;draft.remark=$('accountRemark').value;draft.groupId=$('environmentGroup').value;for(const key of Object.keys(defaultConfig())){const control=$('environmentForm').elements.namedItem(key);if(control)draft.config[key]=control.type==='checkbox'?control.checked:control.value}}
function syncControls(){
 if(!draft)return;const c=draft.config;
 document.querySelectorAll('[data-segment]').forEach(group=>group.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.value===c[group.dataset.segment]);b.setAttribute('aria-pressed',String(b.dataset.value===c[group.dataset.segment]))}));
 $('fingerprintFields').classList.toggle('disabled',!c.fingerprintEnabled);$('fingerprintFields').querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=!c.fingerprintEnabled);$('browserEngine').disabled=true;$('userAgent').disabled=!c.fingerprintEnabled||c.uaMode==='auto';
 $('timezone').hidden=c.timezoneMode!=='custom';$('timezoneHint').textContent=c.timezoneMode==='custom'?'使用 IANA 时区名称。':c.timezoneMode==='ip'?'桌面版检测环境出口 IP 后匹配时区；当前未检测。':'沿用设备真实时区。';
 $('gpuBox').hidden=c.webgl!=='custom';$('coordinateFields').hidden=c.geolocation!=='custom';$('proxyType').disabled=!c.proxyEnabled;$('proxyFields').hidden=!c.proxyEnabled||c.proxyType==='direct';updatePreview()
}
function addDetail(container,label,value){const row=node('div','detail-row');row.append(node('dt','',label),node('dd','',value));container.append(row)}
function updatePreview(){
 if(!draft)return;const c=draft.config,p=state.profiles.find(p=>p.id===editingId);$('previewName').textContent=draft.name.trim()||'未命名环境';$('previewId').textContent=serial(p?.number||state.nextNumber);const dl=$('previewDetails');dl.replaceChildren();
 const group=state.groups.find(g=>g.id===draft.groupId);addDetail(dl,'分组',group?.name||'默认分组');addDetail(dl,'账号备注',draft.remark.trim()||'未填写');addDetail(dl,'会话空间','独立持久会话（待接入）');
 addDetail(dl,'指纹配置',c.fingerprintEnabled?'已开启 · 仅配置':'关闭 · 真实参数');addDetail(dl,'系统标识',c.fingerprintEnabled?(c.os==='windows'?'Windows':'macOS'):'跟随真实设备');addDetail(dl,'内核','跟随桌面 Chromium');addDetail(dl,'语言',c.language==='system'?'跟随系统':c.language);addDetail(dl,'时区',c.timezoneMode==='custom'?c.timezone||'待填写':c.timezoneMode==='ip'?'基于 IP（未检测）':'真实');addDetail(dl,'WebGL',!c.fingerprintEnabled?'真实':({real:'真实',off:'关闭硬件加速',custom:'自定义'})[c.webgl]);addDetail(dl,'Canvas',c.fingerprintEnabled&&c.canvas==='noise'?'噪声 · 未应用':'真实');addDetail(dl,'代理',!c.proxyEnabled||c.proxyType==='direct'?'不使用代理':c.proxyType.toUpperCase());addDetail(dl,'连接状态','尚未运行')
}
$('environmentForm').addEventListener('input',()=>{collectDraft();syncControls()});$('environmentForm').addEventListener('change',()=>{collectDraft();syncControls()});
document.querySelectorAll('[data-segment]').forEach(group=>group.querySelectorAll('button').forEach(button=>button.onclick=()=>{if(!draft)return;collectDraft();draft.config[group.dataset.segment]=button.dataset.value;syncControls()}));
document.querySelectorAll('[data-tab]').forEach(button=>{button.onclick=()=>setTab(button.dataset.tab);button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=['basic','fingerprint','proxy'],index=tabs.indexOf(activeTab),next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3;setTab(tabs[next]);$('tab-'+tabs[next]).focus()}});
document.querySelectorAll('[data-go-tab]').forEach(b=>b.onclick=()=>{setTab(b.dataset.goTab);$('tab-'+b.dataset.goTab).focus()});
$('environmentProxyEnabled').onchange=()=>{if($('environmentProxyEnabled').checked&&$('proxyType').value==='direct')$('proxyType').value='http';collectDraft();syncControls()};$('proxyType').onchange=()=>{if($('proxyType').value==='direct')$('environmentProxyEnabled').checked=false;collectDraft();syncControls()};
$('importProxy').onclick=()=>{try{const parsed=parseProxy($('proxyImport').value);for(const key of ['proxyType','proxyHost','proxyPort','proxyUsername'])$(key).value=parsed[key];$('environmentProxyEnabled').checked=true;$('proxyPassword').value=parsed.password;$('proxyImportError').textContent='';$('proxyImport').value='';collectDraft();syncControls();toast('代理格式已解析，尚未检测连接。')}catch(error){$('proxyImportError').textContent=error.message}};
$('environmentForm').onsubmit=e=>{
 e.preventDefault();collectDraft();const error=validateDraft(draft,state.groups);
 if(error){$('formError').textContent=error.message;setTab(error.tab);$(error.field)?.focus();return}
 const next=structuredClone(state);let profile;
 if(editingId){profile=next.profiles.find(p=>p.id===editingId);if(!profile){$('formError').textContent='环境不存在，请重新打开。';return}Object.assign(profile,{name:draft.name.trim(),remark:draft.remark.trim(),groupId:draft.groupId,config:safeConfig(draft.config)});next.groups.find(g=>g.id===profile.groupId).collapsed=false}
 else profile=createProfile(next,draft,{platform:activePlatform});
 if(!persist(next)){$('formError').textContent='配置未能保存，请检查浏览器存储后重试。';return}
 proxyCredentialsByProfile.set(profile.id,{password:$('proxyPassword').value,refreshUrl:proxyCredentialsByProfile.get(profile.id)?.refreshUrl||''});
 const editing=!!editingId;closeEnvironment();render();toast(editing?'环境配置已保存；未应用到真实浏览器。':'环境配置已建立，已打开'+(activePlatform==='facebook'?'Meta 官方登录':'扫码登录')+'占位区域。')
};
function closeDrawer(){activeTool=null;proxyPanel=null;translationPanel?.destroy();translationPanel=null;$('toolDrawer').hidden=true;$('drawerBody').replaceChildren();document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');b.setAttribute('aria-expanded','false')})}
function requestDrawerClose(afterClose){
 const opener=document.querySelector('.tool.active');
 const finish=()=>{closeDrawer();if(afterClose)return afterClose();opener?.focus();return true};
 const dirtyPanel=proxyPanel?.isDirty()?proxyPanel:translationPanel?.isDirty()?translationPanel:null;
 if(dirtyPanel){
  const p=state.profiles.find(p=>p.id===dirtyPanel.profileId);showConfirm('放弃未保存的修改？',[p?.remark||p?.name||'当前账号',(dirtyPanel===proxyPanel?'代理':'翻译')+'配置尚未保存。确认离开将放弃本次修改。'],finish);return false
 }
 return finish()
}
function openTool(tool){
 closeGroup();
 if(activeTool===tool){requestDrawerClose();return}requestDrawerClose(()=>showTool(tool))
}
function showTool(tool){
 if(nativeWorkspace&&['groups','forward'].includes(tool)){openNativeTool(tool,state,id=>nativeWorkspace.status(activePlatform,id));return}
 if(nativeWorkspace&&tool==='translate'){openNativeTranslation(current());return}
 if(tool==='groups'){if(activePlatform==='whatsapp')openGroupManager(state);return}
 if(tool==='forward'&&!platform().forward)return;
 if(tool==='forward'){
  openBulkDialog();
  return;
 }
 activeTool=tool;$('toolDrawer').hidden=false;document.querySelectorAll('[data-tool]').forEach(b=>{const selected=b.dataset.tool===tool;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));b.setAttribute('aria-expanded',String(selected))});$('drawerTitle').textContent=({proxy:'代理设置',translate:'翻译配置',forward:'转发 / 群发'})[tool];const body=$('drawerBody'),p=current();body.replaceChildren();body.classList.toggle('proxy-drawer-body',tool==='proxy'&&Boolean(p));$('toolDrawer').classList.toggle('proxy-drawer',tool==='proxy'&&Boolean(p));body.classList.toggle('translation-drawer-body',tool==='translate'&&Boolean(p));$('toolDrawer').classList.toggle('translation-drawer',tool==='translate'&&Boolean(p));
 if(!p){body.append(node('p','','先建立一个环境，再为该环境配置工具。'),action('新增会话',()=>openEnvironment(),'button blue','plus'));return}
 if(tool==='proxy'){
  proxyPanel=createProxyPanel(p,{platform:activePlatform,credentials:proxyCredentialsByProfile.get(p.id),icon,onCancel:()=>{closeDrawer();document.querySelector('[data-tool="proxy"]').focus()},onSave:async(profileId,settings,credentials)=>{
   if(window.zlDesktop?.proxySave)await window.zlDesktop.proxySave({platform:activePlatform,id:profileId,config:{...settings,proxyPassword:credentials.password}});
   const next=structuredClone(state);applyProxySettings(next,profileId,settings);if(!persist(next))return false;
   proxyCredentialsByProfile.set(profileId,credentials);closeDrawer();toast(nativeWorkspace?'代理已保存，正在重新加载此账号。':'代理配置已保存，请在桌面应用中使用。');return true
  }});body.append(proxyPanel.element);return
 }
 if(tool==='translate'){
  translationPanel=createTranslationPanel(p,{icon,getCredentials:()=>translationCredentials,onConfigureKeys:openTranslationKeys,onDemo:()=>requestDrawerClose(()=>{conversationDemoIds.add(p.id);renderStage()}),onSave:(profileId,settings)=>{
   const next=structuredClone(state);applyTranslationSettings(next,profileId,settings);if(!persist(next))return false;conversationSessions.get(profileId)?.applyConfig(settings);return true
  }});body.append(translationPanel.element);return
 }
 body.append(node('h3','',p.remark||p.name));
 body.append(node('p','','群发工作窗口尚未接入。此入口保留，主界面继续运行。'))
}
function closeTranslationKeys(){$('translationKeysDialog').close()}
function openTranslationKeys(){
 if(nativeWorkspace){openNativeTranslation(current());return}
 closeGroup();closeContext();translationKeyOpener=document.activeElement;
 const form=createTranslationKeyForm({credentials:translationCredentials,icon,onCancel:closeTranslationKeys,onSave:credentials=>{
  translationCredentials=credentials;translationPanel?.refreshCredentials();closeTranslationKeys();toast('API Key 已在当前页面保留，尚未连接或验证。')
 }});$('translationKeysContent').replaceChildren(form);$('translationKeysDialog').showModal()
}
function help(){if(nativeWorkspace){info('使用说明',['每个账号独立保存网页登录数据。','登录和消息操作请在官方页面完成。','转发和群管理使用当前账号的真实会话。翻译需先配置有效 API Key。','代理及高级指纹设置仍未接入。']);return}
 info('ZL Multi Manager · 当前演示',['可以实际操作：建立环境、配置参数、填写本地备注、创建分组、切换与编辑环境。配置保存在当前浏览器。','当前平台：'+platform().name+'。尚未接入真实平台登录、独立浏览器会话、代理连接与指纹参数应用。高级指纹设置目前仅保存选择。','账号数量不设置固定上限；真实多开能力需在 Windows 电脑上按实际性能测试。']);
 $('infoContent').append(action('翻译 API Key 设置',()=>{$('infoDialog').close();openTranslationKeys()},'button quiet','translate'));
 const p=current();if(!p)return;
 const demo=node('section','card-demo-controls');demo.append(node('h3','','卡片效果演示'),node('p','','当前账号：'+(p.remark||p.name)),node('p','','以下均为示例，不产生真实消息或登录状态。未读示例可在账号菜单点击“全部已读”清零。'));
 const preview=fn=>{if(!state.profiles.some(a=>a.id===p.id)){ $('infoDialog').close();return}fn();$('infoDialog').close();render()};
 const buttons=node('div','card-demo-actions');buttons.append(
  action('示例头像与昵称',()=>preview(()=>sampleCardIds.add(p.id)),'button quiet'),
  action('12 条未读',()=>preview(()=>sampleUnreadCounts.set(p.id,12)),'button quiet'),
  action('120 条未读',()=>preview(()=>sampleUnreadCounts.set(p.id,120)),'button quiet'),
  action('退出卡片演示',()=>preview(()=>{sampleCardIds.delete(p.id);sampleUnreadCounts.delete(p.id)}),'button quiet')
 );demo.append(buttons);$('infoContent').append(demo)
}
const systemSettings=createSystemSettings({icon,onPreferencesChange:updateWindowCloseLabel,onKeys:openTranslationKeys,onHelp:help,
 getHistoryAccounts(){let data;try{data=activePlatform==='whatsapp'?state:loadPlatform(localStorage,'whatsapp')}catch{data=initialState()}return data.profiles.map(p=>{const v=accountCardView(p);return {id:p.id,name:[v.authenticated?v.nickname:p.name,p.remark].filter(Boolean).join(' · ')}})},
 getStats(){const result={total:0,awake:0,sleeping:0,whatsapp:0,facebook:0};for(const id of Object.keys(PLATFORMS)){let data;try{data=id===activePlatform?state:loadPlatform(localStorage,id)}catch{data=initialState()}result[id]=data.profiles.length;result.total+=data.profiles.length;result.sleeping+=data.profiles.filter(p=>p.sleeping).length}result.awake=result.total-result.sleeping;return result},
 getCache(){const result={count:0,bytes:0};for(const runtime of Object.values(platformRuntimes))for(const session of runtime.conversationSessions.values()){const stats=session.cacheStats();result.count+=stats.count;result.bytes+=stats.bytes}return result},
 clearCache(){for(const runtime of Object.values(platformRuntimes))for(const session of runtime.conversationSessions.values())session.clearCache()}
});
function openSystemSettings(){requestDrawerClose(()=>{closeGroup();closeContext();closeRemark();systemSettings.open();if(window.zlDesktop&&!document.getElementById('nativeNotificationTest')){const host=document.querySelector('dialog[open]');if(host){const b=action('发送 Windows 通知',()=>window.zlDesktop.notificationTest().then(()=>toast('已请求发送通知，请检查 Windows 通知设置')).catch(e=>toast(e.message)),'button quiet');b.id='nativeNotificationTest';b.className='settings-footer-link';(host.querySelector('.system-settings-footer > div')||host).prepend(b)}}})}

$('openChatDemo').onclick=()=>requestDrawerClose(()=>{const p=current();if(!p||p.sleeping)return;conversationDemoIds.add(p.id);renderStage()});
$('toggleSidebar').onclick=toggleSidebar;$('newGroup').onclick=addGroup;$('editEnvironment').onclick=()=>{const p=current();if(p)openEnvironment(p.groupId,p)};$('sleepButton').onclick=()=>{const p=current();if(p)toggleProfileSleep(p.id)};
$('cancelGroup').onclick=()=>closeGroup(true);$('newGroupForm').onsubmit=saveGroup;$('newGroupInput').oninput=()=>{$('newGroupError').textContent='';$('newGroupInput').removeAttribute('aria-invalid')};$('newGroupForm').onkeydown=e=>{if(e.key==='Enter'&&e.isComposing)e.preventDefault()};
function currentSystemPreferences(){return readPreferences({getItem:key=>localStorage.getItem(key)})}
function updateWindowCloseLabel(prefs=currentSystemPreferences()){if(window.zlDesktop)window.zlDesktop.preferences(prefs).catch(()=>toast('桌面设置保存失败，请重试。')); const button=document.querySelector('.window-close');const label=prefs.closeBehavior==='exit'?'直接退出软件':'最小化到系统托盘';button.dataset.windowControl=label;button.title=label+'（桌面版）';button.setAttribute('aria-label',button.title)}
updateWindowCloseLabel();
document.querySelectorAll('[data-window-control]').forEach(button=>button.onclick=()=>{if(button.classList.contains('window-close'))updateWindowCloseLabel();if(window.zlDesktop){window.zlDesktop.windowControl(button.classList.contains('window-close')?'close':button.dataset.windowControl==='最小化'?'minimize':'maximize');return}toast('“'+button.dataset.windowControl+'”将在 Windows 桌面版中生效。')});
$('closeEnvironment').onclick=closeEnvironment;$('cancelEnvironment').onclick=closeEnvironment;$('environmentDialog').addEventListener('cancel',e=>{e.preventDefault();closeEnvironment()});
$('closeDrawer').onclick=()=>requestDrawerClose();document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>openTool(b.dataset.tool));$('railHelp').onclick=openSystemSettings;$('closeInfo').onclick=()=>$('infoDialog').close();$('networkRefresh').onclick=()=>toast('公网 IP 与延迟检测尚未接入。');
$('closeTranslationKeys').onclick=closeTranslationKeys;$('translationKeysDialog').addEventListener('close',()=>{$('translationKeysContent').replaceChildren();if(translationKeyOpener?.isConnected)translationKeyOpener.focus();translationKeyOpener=null});
document.addEventListener('pointerdown',e=>{if(!$('groupPopover').contains(e.target)&&!$('newGroup').contains(e.target))closeGroup();if(!$('contextMenu').contains(e.target))closeContext();if(!$('remarkPopover').contains(e.target))closeRemark()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.isComposing){closeGroup(true);closeContext();closeRemark(true);if(!document.querySelector('dialog[open]')){e.preventDefault();requestDrawerClose()}}});window.addEventListener('resize',()=>{closeContext();closeRemark();positionGroupPopover()});window.addEventListener('storage',e=>{if(e.key===STORAGE&&!$('environmentDialog').open){const editingProxyId=proxyPanel?.profileId||translationPanel?.profileId;state=restoreState(e.newValue);if(editingProxyId&&state.profiles.some(p=>p.id===editingProxyId))state.activeId=editingProxyId;else closeDrawer();closeRemark();render()}if(e.key===SIDEBAR_STORAGE){sidebarCollapsed=e.newValue==='true';closeGroup();closeContext();closeRemark();applySidebarMode();renderGroups()}});
document.querySelectorAll('.platform-button[data-platform]').forEach(button=>button.onclick=()=>switchPlatform(button.dataset.platform));
fillIcons();applySidebarMode();render();

startNetworkStatus();
window.zlDesktop?.onSelectAccount?.(({platform,id})=>{if(platform!==activePlatform)switchPlatform(platform);selectProfile(id,true)});
