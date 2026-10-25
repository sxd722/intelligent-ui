import {isIP} from 'node:net'

export function publicWebUrl(value){
  if(typeof value!=='string'||value.length>2000)throw Error('invalid public URL')
  const u=new URL(value),host=u.hostname.toLowerCase()
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||isIP(host.replace(/^\[|\]$/g,''))||!host.includes('.')||/(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host))throw Error('only public web URLs are allowed')
  u.hash='';return u.href
}
async function limitedText(response,maxBytes=1024*1024){
  if(!response.ok){await response.body?.cancel();throw Error(`source HTTP ${response.status}`)}
  const reader=response.body.getReader(),parts=[];let size=0
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw Error('source exceeds byte limit');parts.push(Buffer.from(value))}}finally{await reader.cancel().catch(()=>{})}
  return Buffer.concat(parts).toString('utf8')
}
export function focusExcerpt(text,focus='',max=3500){
  // Remove link-only navigation before splitting long lines: menus and linked
  // recommendation tiles otherwise consume the entire excerpt budget.
  text=String(text).replace(/!\[[^\]]*\]\([^)]*\)/g,'').split('\n').filter(line=>{
    const prose=line.replace(/\[[^\]]*\]\([^)]*\)/g,'').replace(/[\s#>*_\-–—|:·]/g,'')
    return !line.includes('](')||prose.length>20
  }).join('\n').replace(/\n{3,}/g,'\n\n').trim()
  if(text.length<=max)return {excerpt:text,truncated:false}
  const terms=String(focus).toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[]
  const blocks=text.match(/[^\n]{1,700}(?:\n|$)/g)||[]
  const scored=blocks.map((s,i)=>({s,i,score:terms.reduce((n,t)=>n+(s.toLowerCase().includes(t)?1:0),0)}))
  const relevant=scored.some(b=>b.score>0)
  const picked=scored.filter(b=>relevant?b.score>0:!/^\s*(?:[>*-]\s*)?\[[^\]]*\]\([^)]*\)\s*$/.test(b.s)&&b.s.trim().length>30).sort((a,b)=>b.score-a.score||a.i-b.i)
  const notice='[节选；省略部分正文]\n';let left=max-notice.length;const found=[]
  for(const b of picked){if(left<100)break;const s=b.s.slice(0,left-1);left-=s.length+1;found.push({...b,s})}
  return {excerpt:notice+found.sort((a,b)=>a.i-b.i).map(x=>x.s).join('\n'),truncated:true}
}
export function createResearchProviders({base,key,model,fetchImpl=fetch}){
  const readCache=new Map()
  return {
    async search({query,domain},signal){
      const q=domain?`${query} site:${domain}`:query
      const response=await fetchImpl(`${base}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model,stream:false,reasoning_effort:'low',max_tokens:1200,messages:[{role:'user',content:`请联网搜索：${q}。回答只输出“完成”，不要撰写答案。`}],tools:[{type:'web_search',web_search:{enable:true,search_result:true,search_engine:'search_pro',count:4,...(domain?{search_domain_filter:domain}:{})}}]}),signal})
      const j=JSON.parse(await limitedText(response));const items=[]
      // Only gateway search records are evidence; never use its generated answer.
      for(const s of Array.isArray(j.web_search)?j.web_search:[]){
        let url;try{url=publicWebUrl(s.link||s.url)}catch{continue}
        if(domain){const host=new URL(url).hostname;if(host!==domain&&!host.endsWith('.'+domain))continue}
        items.push({url,title:String(s.title||url).slice(0,200),excerpt:String(s.content||s.snippet||'').slice(0,700),publishedAt:s.publish_date||null,kind:'search',truncated:true})
        if(items.length===4)break
      }
      return {items,provider:'gateway.web_search',usage:j.usage||null,warning:items.length?'搜索摘要尚非全文核实':'检索未返回可用来源；不能据此声称已核实'}
    },
    async read({url,focus},signal){
      url=publicWebUrl(url)
      // A fixed remote reader avoids fetching arbitrary addresses on this host,
      // including private services behind DNS rebinding or the user's TUN proxy.
      let text=readCache.get(url)?.expires>Date.now()?readCache.get(url).text:null
      if(!text){
        const response=await fetchImpl('https://r.jina.ai/'+url,{headers:{Accept:'text/plain','X-Return-Format':'markdown'},redirect:'error',signal})
        text=await limitedText(response,512*1024)
      }
      if(/Warning:.*(?:403|404|429|captcha)|(?:Access Denied|Just a moment\.\.\.)/i.test(text)||!text.includes('Markdown Content:'))throw Error('reader did not return accessible page content')
      const resolved=text.match(/^URL Source:\s*(.+)$/m)?.[1]
      if(resolved)publicWebUrl(resolved.trim())
      const title=text.match(/^Title:\s*(.+)$/m)?.[1]||url
      const body=text.slice(text.indexOf('Markdown Content:')+'Markdown Content:'.length).trim()
      if(body.length<40)throw Error('page has no usable text')
      if(readCache.size>=8)readCache.delete(readCache.keys().next().value)
      readCache.set(url,{text,expires:Date.now()+300000})
      return {url,title:title.slice(0,200),...focusExcerpt(body,focus),publishedAt:text.match(/^Published Time:\s*(.+)$/m)?.[1]||null,kind:'page',provider:'jina.reader'}
    }
  }
}
