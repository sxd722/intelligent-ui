import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {TOOLS,validateToolInput} from '../shared/cardspec/tools.mjs'
const root='artifacts/opencli-expanded';await mkdir(root,{recursive:true})
const cases=[
 ['wttr.current',{location:'Shanghai'}],['weread.search',{query:'三体',limit:3}],['weread.ranking',{limit:3}],
 ['steam.search',{query:'Stardew Valley',limit:3}],['steam.top-sellers',{limit:3}],['steam.app',{id:'413150'}],
 ['apple-podcasts.search',{query:'history',limit:3}],['apple-podcasts.top',{country:'cn',limit:3}],
 ['wikipedia.search',{query:'Moon',lang:'en',limit:3}],['wikipedia.summary',{title:'Moon',lang:'en'}],
 ['wikidata.search',{query:'Moon',limit:3}],['dictionary.search',{word:'serendipity'}],['dictionary.synonyms',{word:'happy'}],
 ['rest-countries.country',{name:'Japan',limit:3}],['tvmaze.search',{query:'Sherlock',limit:3}],['tvmaze.show',{id:82}],
 ['dongchedi.search',{keyword:'比亚迪',limit:3}],['autohome.brand',{brand:'比亚迪',limit:3}],['guazi.browse',{limit:3}],
 ['google.news',{keyword:'space',limit:3}],['google.suggest',{keyword:'旅行'}],['bbc.news',{limit:3}],['toutiao.hot',{limit:3}],
 ['hackernews.top',{limit:3}],['devto.top',{limit:3}],['lobsters.hot',{limit:3}],['v2ex.hot',{limit:3}],
 ['archive.search',{query:'astronomy',limit:3}],['eastmoney.quote',{symbols:'600519'}],['sinafinance.stock',{key:'贵州茅台'}],
 ['ctrip.hotel-suggest',{query:'杭州'}],['12306.stations',{keyword:'上海',limit:3}],
 ['douban.top250',{limit:5}],['douban.movie-hot',{limit:3}],['douban.book-hot',{limit:3}],['douban.subject',{id:'1292052',type:'movie'}],
 ['bilibili.hot',{limit:3}],['bilibili.ranking',{limit:3}],['zhihu.hot',{limit:3}],['weibo.hot',{limit:3}],['google.search',{keyword:'OpenHarmony',limit:3}]
].map(([id,input])=>({tool:'opencli.'+id,input}))
const only=process.argv.find(s=>s.startsWith('--only='))?.slice(7).split(',')
const results=only?JSON.parse(await readFile(root+'/real-results.json','utf8')).results:[]
async function check({tool,input}){
 const started=Date.now();let result,validated=false
 try{
  validateToolInput(tool,input)
  validated=true
  if(!TOOLS[tool].readOnly)throw Error('QA only executes reads')
  const response=await fetch('http://127.0.0.1:8787/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool,input,requestId:randomUUID(),pageId:'qa-expanded',sessionId:'qa-expanded',cause:'user',target:'binding'}),signal:AbortSignal.timeout(45000)})
  const body=await response.text()
  if(!response.ok)throw Error(body)
  const frames=body.split('\n').filter(x=>x.startsWith('data: ')).map(x=>JSON.parse(x.slice(6)))
  const error=frames.find(x=>x.type==='error');if(error)throw Error(error.error)
  const value=frames.find(x=>x.type==='result')?.result?.value
  if(!Array.isArray(value?.items))throw Error('No valid result envelope')
  if(!value.items.length)result={tool,input,status:'empty-result',value}
  else result={tool,input,status:'passed',value}
 }catch(e){result={tool,input,status:!validated?'qa-input-error':/登录|login|auth|captcha|验证|风控/i.test(e.message)?'authentication-or-site-restriction':/绑定/.test(e.message)?'binding-unavailable':'external-or-adapter-error',error:e.message}}
 result.elapsedMs=Date.now()-started;results.push(result)
 console.log(JSON.stringify({tool,status:result.status,count:result.value?.items.length,error:result.error,ms:result.elapsedMs}))
 await writeFile(root+'/real-results.json',JSON.stringify({at:new Date().toISOString(),scope:'production HTTP/SSE API, real pinned adapters; no writes',results},null,2))
}
const selected=cases.filter(c=>!only||only.includes(c.tool.replace('opencli.','')))
const publicCases=selected.filter(c=>!TOOLS[c.tool]?.browser),browserCases=selected.filter(c=>TOOLS[c.tool]?.browser)
for(let i=0;i<publicCases.length;i+=2)await Promise.all(publicCases.slice(i,i+2).map(check))
for(const c of browserCases)await check(c)
const catalog=await(await fetch('http://127.0.0.1:8787/api/tools')).json()
await writeFile(root+'/catalog.json',JSON.stringify(catalog,null,2))
console.log(JSON.stringify({total:results.length,passed:results.filter(r=>r.status==='passed').length,other:results.filter(r=>r.status!=='passed').map(r=>({tool:r.tool,status:r.status,error:r.error}))}))
