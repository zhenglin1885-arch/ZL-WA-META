export const TRANSLATION_PROVIDERS = [
 {id:'google',label:'谷歌翻译',builtin:true},
 {id:'deepl',label:'DeepL',builtin:true},
 {id:'openai',label:'OpenAI',builtin:false},
 {id:'gemini',label:'Gemini',builtin:false}
];
export const TRANSLATION_LANGUAGES = [
 ['zh-CN','简体中文','Chinese'],['zh-TW','繁體中文','Chinese'],['en','英语','English'],
 ['pt-BR','葡萄牙语（巴西）','Português Brasil'],['pt-PT','葡萄牙语（葡萄牙）','Português'],
 ['es','西班牙语','Español'],['fr','法语','Français'],['de','德语','Deutsch'],
 ['it','意大利语','Italiano'],['ja','日语','日本語'],['ko','韩语','한국어'],
 ['ru','俄语','Русский'],['ar','阿拉伯语','العربية'],['hi','印地语','हिन्दी'],
 ['id','印尼语','Bahasa Indonesia'],['ms','马来语','Bahasa Melayu'],['th','泰语','ไทย'],
 ['vi','越南语','Tiếng Việt'],['tr','土耳其语','Türkçe'],['nl','荷兰语','Nederlands'],
 ['pl','波兰语','Polski'],['uk','乌克兰语','Українська']
];
const providers=new Set(TRANSLATION_PROVIDERS.map(p=>p.id));
const languages=new Set(TRANSLATION_LANGUAGES.map(([id])=>id));
export function defaultTranslationSettings(){
 return {send:{enabled:false,provider:'google',sourceLanguage:'auto',targetLanguage:'en'},receive:{enabled:false,provider:'google',sourceLanguage:'auto',targetLanguage:'zh-CN'}};
}
export function safeTranslationSettings(value){
 const result=defaultTranslationSettings();
 for(const direction of ['send','receive']){
  const input=value?.[direction];if(!input||typeof input!=='object')continue;
  const output=result[direction];output.enabled=input.enabled===true;
  if(providers.has(input.provider))output.provider=input.provider;
  if(input.sourceLanguage==='auto'||languages.has(input.sourceLanguage))output.sourceLanguage=input.sourceLanguage;
  if(languages.has(input.targetLanguage))output.targetLanguage=input.targetLanguage;
 }
 return result;
}
export function applyTranslationSettings(state,profileId,settings){
 const profile=state.profiles.find(p=>p.id===profileId);if(!profile)throw new Error('账号不存在，请重新选择。');
 for(const direction of ['send','receive']){
  const value=settings?.[direction];
  if(!value||typeof value.enabled!=='boolean'||!providers.has(value.provider)||!(value.sourceLanguage==='auto'||languages.has(value.sourceLanguage))||!languages.has(value.targetLanguage))throw new Error('请选择有效的翻译服务和语言。');
 }
 profile.translation=safeTranslationSettings(settings);return profile;
}
