// Installed in isolated QA contexts only, including their sandbox frames.
// Observe attempted navigation without contacting a site or touching Owl.
export function installDebugNavigation(){
 const attempts=[];Object.defineProperty(window,'__cardNavigation',{value:attempts})
 const record=(url,kind)=>{let parsed;try{parsed=new URL(String(url),location.href)}catch{};const valid=!!url&&!!parsed&&['https:','http:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password;attempts.push({id:crypto.randomUUID(),url:parsed?.href||String(url||''),valid,kind});return valid}
 window.open=(url)=>{record(url,'window.open');return null}
 document.addEventListener('click',event=>{if(event.defaultPrevented)return;const a=event.composedPath().find(el=>el?.tagName==='A'&&el.hasAttribute('href'));if(!a)return;const href=a.getAttribute('href');if(href?.startsWith('#'))return;record(href?a.href:'','anchor');event.preventDefault()})
}
