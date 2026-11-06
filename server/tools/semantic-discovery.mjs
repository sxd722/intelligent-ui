import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {createHash} from 'node:crypto'
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {TOOLS,selectToolIds} from '../../shared/cardspec/tools.mjs'
import {presentationFor} from '../../shared/cardspec/tool-presentations.mjs'
import {DISCOVERY_INTENTS,DISCOVERY_ANCHORS} from './discovery-intents.mjs'

const areas={weather:'天气 气温 降水 出门穿衣 weather rain forecast',travel:'旅行 景点 住宿 出行 火车 机票 travel transport',movies:'电影 影视 推荐 观影 movie watch film',reading:'阅读 图书 书籍 reading books',shopping:'商品 购物 价格 比价 shopping products',music:'音乐 歌曲 播放 music songs',images:'图片 编辑 照片 image editing',dining:'餐馆 美食 吃饭 dining restaurants',learning:'视频 教程 学习 问答 video tutorials',notes:'笔记 文档 notes documents',social:'社交 讨论 用户反馈 social posts',podcasts:'播客 收听 音频 podcasts listen',knowledge:'百科 知识 knowledge encyclopedia',language:'单词 释义 语言 dictionary language',games:'游戏 棋类 games chess',cars:'汽车 车辆 口碑 配置 car vehicle reviews',finance:'金融 股票 行情 finance stocks',news:'新闻 资讯 news',search:'搜索 网页 web search'}
export const SEMANTIC_MODEL='sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
const eligible=t=>TOOLS[t.id]&&!t.unsupportedReason&&t.provider!=='host'&&t.id!=='glm.generate'
export const toolDocument=t=>DISCOVERY_INTENTS[t.id]||String(t.description||'').split(/\. /)[0].slice(0,220)
const documents=t=>[...new Set([String(t.description||'').split(/\. /)[0].slice(0,220),toolDocument(t),...(DISCOVERY_ANCHORS[t.id]||[])])]
export const toolAreas=catalog=>[...new Set(catalog.filter(eligible).map(t=>areas[t.group]?.split(' ').slice(0,3).join('/')||t.group))].filter(Boolean).join('、')

// One owned subprocess, not an HTTP service. A failed model never blocks CLI use.
export function createLocalEncoder({python=process.env.TOOL_EMBED_PYTHON||'python',model=process.env.TOOL_EMBED_MODEL||SEMANTIC_MODEL,timeoutMs=20000}={}){
 let child,ready,pending=new Map(),seq=0,retryAfter=0,lastError,closed=false
 const ref=value=>{for(const handle of [child,child?.stdin,child?.stdout,child?.stderr])handle?.[value?'ref':'unref']?.()}
 function stop(error){lastError=error?.message;retryAfter=Date.now()+60000;for(const p of pending.values())p.reject(error);pending.clear();const old=child;child=null;ready=null;if(old)old.kill()}
 function start(){
  if(closed)throw Error('semantic encoder closed')
  if(ready)return ready
  if(Date.now()<retryAfter)throw Error(lastError||'semantic encoder cooling down')
  ready=new Promise((resolve,reject)=>{
   const proc=spawn(python,['-u',fileURLToPath(new URL('./semantic-worker.py',import.meta.url))],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,TOOL_EMBED_MODEL:model}});child=proc
   const timer=setTimeout(()=>{reject(Error('embedding startup timeout'));stop(Error('embedding startup timeout'))},45000)
   proc.stderr.on('data',()=>{}) // never echo environment or provider internals into a prompt
   createInterface({input:proc.stdout}).on('line',line=>{try{const data=JSON.parse(line);if(data.ready){clearTimeout(timer);resolve()}else if(data.id){const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.vectors);if(!pending.size)ref(false)}}else if(data.error){clearTimeout(timer);reject(Error(data.error))}}catch{}})
   proc.once('error',e=>{clearTimeout(timer);reject(e);if(child===proc)stop(e)})
   proc.once('exit',()=>{clearTimeout(timer);const e=Error('local embedding process unavailable');reject(e);if(child===proc)stop(e)})
  })
  return ready
 }
 return {model,async encode(texts){await start();ref(true);return new Promise((resolve,reject)=>{const id=String(++seq),timer=setTimeout(()=>{stop(Error('embedding inference timeout'))},timeoutMs);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});child.stdin.write(JSON.stringify({id,texts})+'\n',e=>{if(e)stop(e)})})},close(){closed=true;stop(Error('semantic encoder closed'))}}
}

export function rankTools(catalog,query,{vectors=[],queries=[],limit=8}={}){
 const entries=catalog.filter(eligible),q=query.toLowerCase(),lex=selectToolIds(entries.map(t=>t.id),query),words=q.split(/[\s，,。;；]+/).filter(w=>w.length>1)
 const scored=entries.map((t,i)=>{
  const representations=vectors[i]?(Array.isArray(vectors[i][0])?vectors[i]:[vectors[i]]):[]
  const cosine=queries.length&&representations.length?Math.max(...queries.flatMap(v=>representations.map(doc=>v.reduce((sum,x,k)=>sum+x*doc[k],0)))):0
  const explicit=q.includes(t.id.toLowerCase()),site=t.site&&new RegExp(`(^|[^a-z])${t.site.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z]|$)`,'i').test(q)
  const literal=words.some(w=>(t.id+' '+t.description).toLowerCase().includes(w)),rank=lex.indexOf(t.id)
  const score=(explicit?3:0)+(site?.22:0)+Math.max(0,cosine)+(rank>=0?.20/(1+rank*.14):0)+(literal?.12:0)
  return {t,score,cosine,explicit,lexical:rank>=0||literal||!!site}
 }).filter(r=>r.explicit||r.lexical||r.cosine>=.24).sort((a,b)=>b.score-a.score||a.t.id.localeCompare(b.t.id))
 // Reserve room for other intents; never allow a single large adapter to fill the shortlist.
 const chosen=[],counts=new Map()
 for(const row of scored){const site=row.t.site||row.t.group,n=counts.get(site)||0;if(n>=3&&!row.explicit)continue;chosen.push(row);counts.set(site,n+1);if(chosen.length>=limit)break}
 return chosen.map(({t,score,cosine,lexical})=>({id:t.id,purpose:String(t.description||'').slice(0,210),available:!!t.available,readOnly:t.readOnly!==false,...(!t.available?{reason:t.reason||'需连接或启用',connection:t.connection}:{}),related:[...new Set([t.detail?.tool,...entries.filter(x=>x.site===t.site&&x.command==='search'&&x.id!==t.id).map(x=>x.id)])].filter(id=>id&&entries.some(t=>t.id===id)),presentation:presentationFor(t.id)?.kind||null,score:+score.toFixed(4),semanticScore:+cosine.toFixed(4),matchedBy:cosine>=.24?(lexical?'hybrid':'semantic'):'keyword',describe:'cli_describe'}))
}

export function createToolDiscovery({encoder=createLocalEncoder(),cacheDir=fileURLToPath(new URL('../../.cache/tool-discovery/',import.meta.url))}={}){
 let indexKey,indexPromise;const queryCache=new Map()
 async function index(catalog){
  const groups=catalog.filter(eligible).map(documents),docs=groups.flat(),key=createHash('sha256').update(JSON.stringify([encoder.model,docs])).digest('hex')
  if(indexKey===key&&indexPromise)return indexPromise
  indexKey=key;indexPromise=(async()=>{
   const path=cacheDir+`/${key}.json`
   const partition=vectors=>{let offset=0;return groups.map(g=>{const result=vectors.slice(offset,offset+g.length);offset+=g.length;return result})}
   try{const saved=JSON.parse(await readFile(path,'utf8'));if(saved.key===key&&saved.vectors.length===docs.length&&saved.vectors.every(v=>Array.isArray(v)&&v.length===saved.dimension&&v.every(Number.isFinite)))return partition(saved.vectors)}catch{}
   const vectors=await encoder.encode(docs)
   try{await mkdir(cacheDir,{recursive:true});const tmp=path+'.'+process.pid+'.tmp';await writeFile(tmp,JSON.stringify({key,dimension:vectors[0]?.length,vectors}));await rename(tmp,path)}catch{}
   return partition(vectors)
  })().catch(e=>{indexPromise=null;throw e});return indexPromise
 }
 async function discover(catalog,query,{signal,limit=8,timeoutMs=2500}={}){
  if(typeof query!=='string'||!query.trim()||query.length>6000)throw Error('query must contain 1–6000 characters')
  const started=performance.now();signal?.throwIfAborted();let vectors=[],queries=[],fallbackReason,cached=false
  if(process.env.TOOL_SEMANTIC_DISABLED==='1')fallbackReason='semantic retrieval disabled'
  else try{
   const segments=[query.slice(0,1200),...query.split(/[，,；;\n]+/).filter(s=>s.trim().length>3)].slice(0,4).map(s=>s.trim().slice(0,1200)),key=JSON.stringify(segments)
   cached=queryCache.has(key)
   let timer
   try{[vectors,queries]=await Promise.race([Promise.all([index(catalog),queryCache.get(key)||encoder.encode(segments).then(v=>{queryCache.set(key,v);if(queryCache.size>256)queryCache.delete(queryCache.keys().next().value);return v})]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('semantic warmup exceeded discovery deadline; keyword fallback for this request')),timeoutMs)})])}finally{clearTimeout(timer)}
  }catch(e){fallbackReason=String(e.message).slice(0,240)}
  signal?.throwIfAborted()
  return {tools:rankTools(catalog,query,{vectors,queries,limit:Math.max(1,Math.min(12,limit))}),retrieval:{method:fallbackReason?'keyword-fallback':'local-embedding+keyword',model:encoder.model,cached,elapsedMs:Math.round(performance.now()-started),catalogSize:catalog.filter(eligible).length,...(fallbackReason?{fallbackReason}:{})},instruction:'候选不是必选，也不是能力全集。先用cli_describe确认选中工具的参数/字段；可用cli_discover换用途检索。available仅是宿主状态，不保证外部成功。无需真实数据的任务可不使用CLI。'}
 }
 return {discover,warm:catalog=>Promise.all([index(catalog),encoder.encode(['工具用途'])]),close:()=>encoder.close()}
}
export const toolDiscovery=createToolDiscovery()
process.once('exit',()=>toolDiscovery.close())
