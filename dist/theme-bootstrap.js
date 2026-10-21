(()=>{
 const key='zl.theme.v1',media=matchMedia('(prefers-color-scheme: dark)');let choice='system';try{const v=localStorage.getItem(key);if(['light','dark'].includes(v))choice=v}catch{}
 function apply(){const theme=choice==='system'?(media.matches?'dark':'light'):choice;document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.getElementById('zlLightTheme').media=theme==='light'?'all':'not all';window.zlDesktop?.themeSet(choice).catch(()=>{})}
 window.ZLTheme={get:()=>choice,set:v=>{if(!['system','light','dark'].includes(v))throw Error('Invalid theme');localStorage.setItem(key,v);choice=v;apply()}};media.addEventListener('change',()=>{if(choice==='system')apply()});apply();
})();
