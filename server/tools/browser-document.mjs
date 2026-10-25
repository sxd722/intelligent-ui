// DOM_STATE transport: reuse pinned upstream parsing and validation, but load
// the page with browser cookies. Only used in the isolated single-call worker.
const fields={search:['searchData'],series:['seriesHomeHead','scoreSimpleInfo','rankData','carModelsData'],models:['carModelsData'],specs:['overviewData'],score:['scoreSimpleInfo','reviewData'],koubei:['reviewListData']}
const failure=(code,message)=>Object.assign(new Error(message),{code})
export function allowedDocumentUrl(tool,value){
  const u=new URL(value)
  if(tool.site!=='dongchedi'||!fields[tool.command]||u.origin!=='https://www.dongchedi.com'||u.username||u.password||u.hash)throw failure('INVALID_INPUT','Unsupported browser document destination')
  const pattern=tool.command==='search'?/^\/search$/:tool.command==='koubei'?/^\/auto\/series\/score\/\d+-x-x-x-x-x$/:/^\/auto\/series\/\d+$/
  if(!pattern.test(u.pathname))throw failure('INVALID_INPUT','Unsupported browser document path')
  return u.href
}
export function documentGate(snapshot){
  const path=new URL(snapshot.url).pathname
  if(/(?:^|\/)(?:login-required|login|signin)(?:\/|$)/i.test(path)||snapshot.page==='/login-required')throw failure('AUTH_REQUIRED','请在同一浏览器的懂车帝页面完成登录，然后手动重试；登录态由浏览器保管。')
  if(snapshot.verification)throw failure('ACCESS_RESTRICTED','来源要求安全验证，请在浏览器中完成验证后手动重试。')
  if(new URL(snapshot.url).origin!=='https://www.dongchedi.com')throw failure('ACCESS_RESTRICTED','来源跳转到站外验证页面，请在浏览器中检查后重试。')
}
export function browserDocumentCommand(cmd,tool){
  if(!tool.browserDocument)return cmd
  if(cmd.browser!==false||tool.site!=='dongchedi'||!fields[tool.command])throw failure('SCHEMA_MISMATCH','Unsupported pinned browser document adapter')
  return {...cmd,browser:true,strategy:'cookie',domain:'www.dongchedi.com',navigateBefore:false,func:async(page,args,debug)=>{
    const originalFetch=globalThis.fetch;let gateError
    globalThis.fetch=async(input,init)=>{
      const value=typeof input==='string'||input instanceof URL?String(input):input.url
      // Bridge requests keep their original transport; only the fixed source
      // origin uses navigation, with its exact routes checked below.
      if(new URL(value).origin!=='https://www.dongchedi.com')return originalFetch(input,init)
      try{
        const url=allowedDocumentUrl(tool,value)
        if((init?.method||input?.method||'GET').toUpperCase()!=='GET')throw failure('INVALID_INPUT','Browser document transport is read-only')
        await page.goto(url)
        let snapshot
        for(let attempt=0;attempt<8;attempt++){
          snapshot=await page.evaluate(`(() => {
            const el=document.querySelector('script#__NEXT_DATA__');let data;try{data=JSON.parse(el?.textContent||'null')}catch{}
            const pp=data?.props?.pageProps,selected={};for(const key of ${JSON.stringify(fields[tool.command])})if(pp&&Object.hasOwn(pp,key))selected[key]=pp[key];
            const text=document.body?.innerText||'';
            return {url:location.href,page:data?.page,verification:/请完成安全验证|请依次点击|美团安全验证|访问过于频繁/.test(text),ready:!!pp,props:selected};
          })()`)
          documentGate(snapshot)
          if(snapshot.ready)break
          await page.wait(.25)
        }
        if(!snapshot?.ready)throw failure('SCHEMA_MISMATCH','页面没有可读取的数据结构，未将其视为空结果。')
        const serialized=JSON.stringify({props:{pageProps:snapshot.props}}).replace(/</g,'\\u003c')
        if(serialized.length>2000000)throw failure('SCHEMA_MISMATCH','来源页面数据超出读取上限')
        return new Response('<script id="__NEXT_DATA__">'+serialized+'</script>',{headers:{'Content-Type':'text/html'}})
      }catch(e){gateError=e;throw e}
    }
    try{return await cmd.func(args,debug)}catch(e){throw gateError||e}finally{globalThis.fetch=originalFetch}
  }}
}
