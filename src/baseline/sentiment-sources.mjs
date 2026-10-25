import {list,text} from './core.mjs'
import {isFeedback} from './insights.mjs'

export const SOCIAL_SOURCES=['微博反馈','小红书线索','B站评论']
const cancelled=e=>e.name==='AbortError'||/取消/.test(e.message)
const basic=(rows,source,kind)=>rows.map(r=>({...r,publisher:r.source,source,evidenceKind:kind,content:r.content||r.text||r.snippet||'',title:text(r.title||r.content||r.text)}))
export function normalizeVideoComments(video,rows){
 const bvid=video.url?.match(/\/video\/(BV[A-Za-z0-9]+)/)?.[1]
 return rows.filter(r=>text(r.text||r.content).trim()).map((r,i)=>{
  // OpenCLI 1.8.6 formats Bilibili ctime as a UTC string without a suffix.
  const utc=/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(r.time||'')?r.time.replace(' ','T')+':00Z':r.time
  return {...r,rowKey:`bilibili-comment:${bvid}:${r.rpid||r.rowKey||i}`,source:'B站评论',evidenceKind:'comment',content:text(r.text||r.content),title:text(r.text||r.content).slice(0,100),time:utc,url:video.url,parentTitle:video.title,parentId:bvid,dateEvidence:'来源评论时间 · UTC 转北京时间'}
 })
}
// A search returns a bounded evidence bundle. It never invokes GLM, silently
// broadens the query, or mistakes a video/note headline for a user opinion.
export async function collectSentiment({query,sources,fallback=true,call,previous=[],previousQuery='',onProgress=()=>{}}){
 const records=[],coverage=[],attempted=new Set();let series=[]
 async function attempt(source,reason='用户选择'){
  if(attempted.has(source))return false;attempted.add(source);onProgress(`正在读取${source}`)
  const start=records.length
  try{
   if(source==='新闻检索'){
    const data=await call('opencli.google.news',{keyword:query,lang:'zh',region:'CN',limit:20})
    records.push(...basic(list(data),source,'news'));coverage.push({source,status:`${list(data).length} 条新闻线索`,reason})
   }else if(source==='微博反馈'){
    const data=await call('opencli.weibo.search',{keyword:query,limit:20})
    records.push(...basic(list(data),source,'post'));coverage.push({source,status:list(data).length?`${list(data).length} 条微博正文样本`:'未找到微博结果',reason})
   }else if(source==='小红书线索'){
    const data=await call('opencli.xiaohongshu.search',{query,limit:8})
    records.push(...basic(list(data),source,'discovery').map(r=>({...r,dateEvidence:'适配器日期由笔记 ID 推算，非官方发布时间'})))
    coverage.push({source,status:`${list(data).length} 条笔记线索 · 仅有标题，不计入态度`,reason})
   }else if(source==='B站评论'){
    const data=await call('opencli.bilibili.search',{query,type:'video',limit:6}),videos=list(data)
    records.push(...basic(videos,'B站视频线索','discovery'))
    let successes=0,comments=0
    for(const video of videos.slice(0,3)){
     const bvid=video.url?.match(/\/video\/(BV[A-Za-z0-9]+)/)?.[1];if(!bvid)continue
     onProgress(`正在读取 B 站评论 · 视频 ${successes+1}/最多3`)
     try{const result=await call('opencli.bilibili.comments',{bvid,limit:10}),rows=normalizeVideoComments(video,list(result));records.push(...rows);comments+=rows.length;successes++
     }catch(e){if(cancelled(e))throw e;coverage.push({source:'B站评论',status:`${video.title}：${e.message}`,error:true,url:video.url});if(previousQuery===query)records.push(...previous.filter(r=>r.source==='B站评论'&&r.parentId===bvid).map(r=>({...r,stale:true})))}
    }
    coverage.push({source,status:`${videos.length} 条视频线索；${successes} 个视频返回 ${comments} 条评论。仅搜索前 3 个视频的首批评论，非完整或随机样本。`,reason})
   }else if(source==='懂车帝口碑'){
    const data=await call('opencli.dongchedi.search',{keyword:query.split(/\s+/)[0],limit:5});series=list(data)
    coverage.push({source,status:series.length?'选择车系后读取口碑':'未找到车系',reason})
   }
  }catch(e){
   if(cancelled(e))throw e
   coverage.push({source,status:e.message,error:true,reason})
   if(previousQuery===query)records.push(...previous.filter(r=>r.source===source||source==='B站评论'&&r.source==='B站视频线索').map(r=>({...r,stale:true})))
  }
  return records.slice(start).some(r=>isFeedback(r)&&!r.stale)
 }
 // Honor explicit sources before filling missing social evidence.
 for(const source of [...new Set(sources)])await attempt(source)
 if(fallback&&sources.some(s=>SOCIAL_SOURCES.includes(s))&&!records.some(r=>isFeedback(r)&&!r.stale)){
  for(const source of SOCIAL_SOURCES)if(!attempted.has(source)&&await attempt(source,'其他来源未取得可分析正文，自动换源'))break
 }
 const seen=new Set(),unique=records.filter(r=>{const key=`${r.source}:${r.rowKey||r.url||r.id||r.title}`;if(seen.has(key))return false;seen.add(key);return true})
 return {records:unique,coverage,series,query}
}
