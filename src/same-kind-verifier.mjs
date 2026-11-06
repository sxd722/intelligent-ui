// Uses a separate document/session key, never touches the user's live card.
export async function createReuseVerifier(signal){
 const frame=document.createElement('iframe');frame.title='同款隔离验证';frame.src='/reuse-check.html';frame.style.cssText='position:fixed;left:0;top:0;width:432px;height:1400px;border:0;pointer-events:none;opacity:0;z-index:-1';frame.setAttribute('aria-hidden','true')
 const dispose=()=>{try{frame.contentWindow?.reuseCheck?.cancel()}catch{}frame.remove()}
 signal.addEventListener('abort',dispose,{once:true});document.body.append(frame)
 try{await new Promise((resolve,reject)=>{let timer=setTimeout(()=>reject(Error('验证器加载超时')),15000);frame.onload=()=>{clearTimeout(timer);resolve()};frame.onerror=()=>{clearTimeout(timer);reject(Error('验证器加载失败'))};signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason)},{once:true})});signal.throwIfAborted();if(!frame.contentWindow.reuseCheck)throw Error('验证器不可用')}
 catch(e){dispose();throw e}
 return {async verify(spec,baseline){const runs=[];for(const width of [432,320]){signal.throwIfAborted();frame.style.width=width+'px';const run=await frame.contentWindow.reuseCheck.run(spec,width,baseline?.runs.find(r=>r.width===width));signal.throwIfAborted();runs.push(run)}return {status:'passed',runs}},dispose(){signal.removeEventListener('abort',dispose);dispose()}}
}
