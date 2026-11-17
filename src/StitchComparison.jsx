import React,{useEffect,useState} from 'react'
const end=new Set(['ready','error','cancelled','interrupted'])
export function useStitchComparison(request){
 const [job,setJob]=useState(request)
 useEffect(()=>{
  setJob(request);if(!request?.id||request.status==='error')return
  let live=true,timer,missing=0;const controller=new AbortController()
  async function poll(){try{
   const response=await fetch('/api/stitch-comparisons/'+encodeURIComponent(request.id),{signal:controller.signal})
   if(response.status===404){if(++missing>=5)throw Error('未找到本次 Stitch 任务；不会自动重新生成');timer=setTimeout(poll,2000);return}
   const value=await response.json();if(!response.ok)throw Error(value.error||'Stitch 状态读取失败')
   if(live){setJob(value);if(!end.has(value.status))timer=setTimeout(poll,2000)}
  }catch(e){if(live&&!controller.signal.aborted){setJob(prev=>({...prev,status:'error',error:e.message}));}}}
  void poll();return()=>{live=false;clearTimeout(timer);controller.abort()}
 },[request?.id,request?.status,request?.error])
 return job
}
export const stitchStatus=job=>({starting:'Stitch 正在启动',queued:'Stitch 排队中',discovering:'Stitch 匹配工具',generating:'Stitch 设计中',downloading:'Stitch 下载 mock',ready:'Stitch 对照已就绪',cancelled:'Stitch 已取消',interrupted:'Stitch 已中断',error:'Stitch 暂不可用'}[job?.status]||'Stitch 等待中')
export function ToolLegend({bindings=[],label}){return <div className="comparison-tools"><strong>{label}</strong>{bindings.length?<ul>{bindings.map((b,i)=><li key={b.id||i}><code>{b.id}</code>{b.tool&&<span> → {b.tool}</span>}{b.purpose&&<small>{b.purpose}</small>}</li>)}</ul>:<p>没有声明工具。</p>}</div>}
export function StitchMock({job,annotate,onDesignReference}){
 const [imageError,setImageError]=useState(false)
 const [cancelError,setCancelError]=useState('')
 useEffect(()=>setImageError(false),[job?.imageUrl])
 if(!job)return null
 const ids=new Set(job.plannedTools||[]),tools=(job.candidates||[]).filter(t=>ids.has(t.id))
 return <section className="stitch-comparison" aria-label="Stitch 设计对照"><header><b>Stitch</b><span>视觉 mock · 不执行工具</span></header>
  {job.status==='ready'&&job.imageUrl&&!imageError?<div className="stitch-mock-frame"><img className="stitch-mock" src={job.imageUrl} alt="相同需求的 Stitch 设计 mock" onError={()=>setImageError(true)}/>{annotate&&job.preview?.regions?.map((r,i)=><div key={i} className="stitch-tool-region" style={{left:r.x*100+'%',top:r.y*100+'%',width:r.width*100+'%',height:r.height*100+'%'}}><span>{r.ids.join(' · ')}</span></div>)}</div>:<div className="stitch-placeholder" role="status"><strong>{stitchStatus(job)}</strong><p>{imageError?'对照图片加载失败':job.error||'CardSpec 独立生成，可以继续使用。'}</p></div>}
  {job.preview&&<small title="静态排版；脚本和远程资源未执行">静态预览 · <a href={job.imageUrl+'?original=1'} target="_blank" rel="noreferrer">原始 Stitch 图</a></small>}
  {job.status==='ready'&&onDesignReference&&<button type="button" onClick={onDesignReference}>用此设计作为下次参考</button>}
  {job.elapsedMs!=null&&<small>Stitch 用时 {Math.round(job.elapsedMs/1000)} 秒</small>}
  {!end.has(job.status)&&<button type="button" onClick={async()=>{try{const r=await fetch('/api/stitch-comparisons/'+encodeURIComponent(job.id),{method:'DELETE'});if(!r.ok)throw Error('无法取消对照，请稍后再试')}catch(e){setCancelError(e.message)}}}>取消 Stitch 对照</button>}{cancelError&&<small role="alert">{cancelError}</small>}
  {annotate&&<><ToolLegend label="Stitch 设计声明（非真实调用）" bindings={tools}/>{!tools.length&&<p className="comparison-note">{job.status==='ready'?'Stitch 未在 HTML 中标记工具，不能据此认定它使用了候选能力。':'等待设计结果的工具标记。'}</p>}<details><summary>发送给 Stitch 的候选工具（{job.candidates?.length||0}）</summary><ToolLegend label="候选 ≠ 已使用" bindings={job.candidates||[]}/></details></>}
  {job.prompt&&<details className="stitch-prompt"><summary>查看本次设计要求</summary><pre>{job.prompt}</pre></details>}
 </section>
}
