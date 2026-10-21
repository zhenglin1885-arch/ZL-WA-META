import {initialState,restoreState,serializableState} from './core.js';
export const PLATFORMS=Object.freeze({
 whatsapp:Object.freeze({name:'WhatsApp',icon:'whatsapp',storage:'zl.environment.demo.v1',sidebarStorage:'zl.ui.sidebarCollapsed.v1',forward:true}),
 facebook:Object.freeze({name:'Facebook Business',icon:'meta',storage:'zl.facebook.environment.demo.v1',sidebarStorage:'zl.facebook.ui.sidebarCollapsed.v1',forward:false})
});
export function platformConfig(id){if(!Object.hasOwn(PLATFORMS,id))throw new Error('未知平台');return PLATFORMS[id]}
export function loadPlatform(storage,id){const key=platformConfig(id).storage;try{return restoreState(storage.getItem(key))}catch{return initialState()}}
export function savePlatform(storage,id,state){storage.setItem(platformConfig(id).storage,JSON.stringify(serializableState(state)))}
export function createPlatformRuntime(){return {sampleCardIds:new Set(),sampleUnreadCounts:new Map(),proxyCredentialsByProfile:new Map(),conversationSessions:new Map(),conversationDemoIds:new Set()}}
