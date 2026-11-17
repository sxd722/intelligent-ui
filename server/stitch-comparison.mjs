import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {toolDiscovery} from './tools/semantic-discovery.mjs'
import {renderStitchMock} from './stitch-static-mock.mjs'
import {normalizeDesignBrief} from '../shared/cardspec/design-brief.mjs'

const terminal=new Set(['ready','error','cancelled','interrupted'])
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)
export function comparisonPrompt(input,tools){
 const width=Math.max(280,Math.min(432,Math.round(Number(input.width)||432)))
 const height=input.cardSize==='square'?width:Math.max(400,Math.min(780,Math.round(Number(input.height)||708)))
 return `设计一张可与交互卡片并排比较的高品质 UI mock。只设计这张卡，不要生成整个应用、浏览器边框、手机机身、侧栏或额外导航。
任务（用户最终确认的需求）：\n${input.prompt}
画布：${width} × ${input.cardSize==='full'?'自然长页（首屏 '+height+'px）':height+'px'}；模式 ${input.cardSize}。主体宽度必须为 ${width}px，外部留白最小。中文界面，紧凑且可读，主视觉与明确的操作反馈优先，避免长列表和重复说明。
视觉方向：本次是独立设计。根据题材、用户任务和阅读需求自行决定配色、明暗、字体层级、材质、图像与构图，不继承 CardSpec 的设计家族或其他对照卡的视觉语言。不要默认套用深色玻璃、金色仪表盘或同一组圆角面板；可用平面、编辑式、照片、插画等适合题材的表达，统一性只要求在本张卡内成立。用户需求中明确的风格和可访问性要求优先。
构图由任务关系决定，不固定页头→主图→列表的顺序。候选比较可用紧凑网格，步骤可用横向时间线，关键结果与控制项相邻；短事实共享一行，次要设置按需展开。保留必要留白、大字号和约44px触控区域，不靠缩小文字或裁切内容压缩。不要强制两个后续按钮或 A/B 保存。方形模式按需详情。无需遵循 CardSpec DSL，可自由设计交互表达；这里只交付视觉 mock。请给整张卡的根容器添加 data-stitch-card 属性，使用本地可静态渲染的 CSS/Tailwind 类，不依赖 JavaScript 排版。
可用工具候选（仅能力设计参考，不执行调用；不可把示意数值当真实取数）：\n${JSON.stringify(tools)}
只在有需要的区域使用这些工具能力；静态任务可不用工具。不发明工具 ID。请在生成的 HTML 中给使用某个候选工具的区域标注 data-tool-id="完整工具ID"（多个用空格分隔），以便宿主提取设计意图；不要把这些技术 ID 印在视觉画面上。不得加入实际联网脚本、账号登录或密钥。`
}
export function designToolIds(html,candidates){
 const allowed=new Set(candidates.map(t=>t.id)),found=new Set()
 for(const match of String(html).matchAll(/\bdata-tool-id\s*=\s*(["'])(.*?)\1/gi))for(const id of match[2].split(/[\s,]+/))if(allowed.has(id))found.add(id)
 return [...found]
}
export async function stitchCommand(args,{signal,timeout=480000}={}){
 const cli=process.env.STITCH_CLI_PATH||path.join(process.env.APPDATA||'', 'npm/node_modules/@google/stitch/dist/stitch.js')
 await fs.access(cli)
 return new Promise((resolve,reject)=>{
  let out='',err='',done=false;const child=spawn(process.execPath,[cli,...args],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']})
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value)}
  const abort=()=>{child.kill();finish(Error('Stitch comparison cancelled'))}
  const timer=setTimeout(()=>{child.kill();finish(Error('Stitch comparison timed out'))},timeout)
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
  child.stdout.on('data',b=>{out+=b;if(out.length>1048576){child.kill();finish(Error('Stitch output too large'))}})
  child.stderr.on('data',b=>{err=(err+b).slice(-4000)})
  child.once('error',e=>finish(e));child.once('close',code=>finish(code?Error(/login|auth|unauthenticated|credential/i.test(err+out)?'Stitch 登录已失效，请在本机重新登录':`Stitch CLI exit ${code}`):null,out.trim()))
 })
}
export function createStitchComparison({catalog,run=stitchCommand,discover=toolDiscovery.discover,render=renderStitchMock,directory=path.resolve('artifacts/stitch-comparison')}={}){
 const jobs=new Map(),references=new Map(),queue=[];let running=false
 const file=(id,name)=>path.join(directory,id,name)
 const save=async j=>{await fs.mkdir(path.dirname(file(j.id,'job.json')),{recursive:true});const target=file(j.id,'job.json');await fs.writeFile(target+'.tmp',JSON.stringify(j,null,2));await fs.rename(target+'.tmp',target)}
 const view=j=>{const {requestHash,...safe}=j;return safe}
 async function execute(job,input){
  const start=Date.now(),controller=new AbortController();job.controller=controller
  const update=async patch=>{const next={...job.data,...patch,elapsedMs:Date.now()-start};await save(next);job.data=next}
  try{
   await update({status:'discovering'})
   const entries=input.toolsEnabled===false?[]:await catalog()
   const found=entries.length?await discover(entries,input.prompt.slice(0,6000),{signal:controller.signal,limit:10}):{tools:[]}
   controller.signal.throwIfAborted()
   const candidates=found.tools.filter(t=>entries.some(e=>e.id===t.id&&e.available&&!e.unsupportedReason)).map(t=>({id:t.id,purpose:t.purpose,readOnly:t.readOnly}))
   const prompt=comparisonPrompt(input,candidates)
   await update({candidates,prompt,retrieval:found.retrieval,status:'generating'})
   // An independent reference must not inherit another subject's project
   // design system. Keep its project on the job, not in a shared project.json.
   const result=JSON.parse(await run(['create','project','--title',`Card reference ${job.data.id.slice(0,8)}`,'--json'],{signal:controller.signal}))
   const project=result.data?.id;if(!result.success||!project)throw Error('Stitch project creation failed')
   await update({project,designPolicy:'subject-led-v2'})
   const generated=JSON.parse(await run(['generate','screen','--project',project,'--prompt',prompt,'--device','AGNOSTIC','--model','GEMINI_3_8_FLASH','--json'],{signal:controller.signal}))
   const screen=generated.data?.id;if(!generated.success||!screen)throw Error('Stitch did not return a screen')
   await update({status:'downloading',project,screen})
   // Keep the generated screen even when an asset download fails; never
   // regenerate merely because the CDN is temporarily unavailable.
   for(const ext of ['png','html']){
    for(let attempt=0;attempt<2;attempt++)try{await run(['download','screen',screen,'--project',project,'--format',ext,'--output',file(job.data.id,'screen.'+ext)],{signal:controller.signal,timeout:90000});break}catch(e){if(attempt===1)throw e;controller.signal.throwIfAborted()}
   }
   const png=await fs.readFile(file(job.data.id,'screen.png'))
   if(png.length>20*1024*1024||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Stitch image is not a supported PNG')
   const html=await fs.readFile(file(job.data.id,'screen.html'),'utf8'),plannedTools=designToolIds(html,candidates)
   let preview
   try{preview=await render(html,{output:file(job.data.id,'mock.png'),width:input.width,tools:candidates.map(t=>t.id),signal:controller.signal})}catch(e){job.data.previewError='静态区域提取不可用，展示原始 Stitch PNG'}
   controller.signal.throwIfAborted()
   await update({status:'ready',imageUrl:`/api/stitch-comparisons/${job.data.id}/image`,preview,plannedTools,annotationSource:'html-data-tool-id',finishedAt:new Date().toISOString()})
  }catch(e){await update({status:controller.signal.aborted?'cancelled':'error',error:String(e.message).slice(0,200),finishedAt:new Date().toISOString()})}
  finally{job.controller=null}
 }
 async function drain(){if(running)return;running=true;try{while(queue.length){const next=queue.shift();if(next.job.data.status==='queued')try{await execute(next.job,next.input)}catch{next.job.data.status='error';next.job.data.error='Stitch 任务记录保存失败'}}}finally{running=false}}
 async function get(id){if(!validId(id))return null;let data=jobs.get(id)?.data;if(!data)try{data=JSON.parse(await fs.readFile(file(id,'job.json'),'utf8'));if(!terminal.has(data.status)){data.status='interrupted';data.error='服务重启中断了设计任务；不会自动重新生成';await save(data)}}catch{return null}return view(data)}
 return {
  async start(input){
   if(!validId(input.id)||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>12000||!['square','auto','full'].includes(input.cardSize))throw Object.assign(Error('Invalid comparison request'),{statusCode:400})
   const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex'),existing=await get(input.id)
   if(existing){const stored=jobs.get(input.id)?.data||JSON.parse(await fs.readFile(file(input.id,'job.json'),'utf8'));if(stored.requestHash!==hash)throw Object.assign(Error('Comparison ID belongs to another request'),{statusCode:409});return existing}
   if(jobs.has(input.id)){const prior=jobs.get(input.id).data;if(prior.requestHash!==hash)throw Object.assign(Error('Comparison ID belongs to another request'),{statusCode:409});return view(prior)}
   if(queue.length>=4)throw Object.assign(Error('Stitch queue is full'),{statusCode:429})
   const job={data:{id:input.id,status:'queued',createdAt:new Date().toISOString(),cardSize:input.cardSize,width:input.width,height:input.height,requestHash:hash,candidates:[],plannedTools:[]}}
   jobs.set(input.id,job);await save(job.data);queue.push({job,input:structuredClone(input)});void drain();return view(job.data)
  },get,
  async reference(id){
   const job=await get(id);if(job?.status!=='ready')throw Error('Stitch 参考尚未就绪，请先等待对照完成')
   const brief=normalizeDesignBrief(job.preview?.designBrief);if(brief&&job.preview?.extractionVersion===2)return {...brief,referenceId:id}
   if(!references.has(id))references.set(id,(async()=>{try{const preview=await render(await fs.readFile(file(id,'screen.html'),'utf8'),{output:file(id,'mock.png'),width:job.width,tools:job.candidates.map(t=>t.id)});const stored=jobs.get(id)?.data||JSON.parse(await fs.readFile(file(id,'job.json'),'utf8'));const data={...stored,preview:{...preview,extractionVersion:2}};await save(data);if(jobs.has(id))jobs.get(id).data=data;const result=normalizeDesignBrief(preview.designBrief);if(!result)throw Error('该参考暂无法提取可读配色');return {...result,referenceId:id}}finally{references.delete(id)}})())
   return references.get(id)
  },
  async cancel(id){const job=jobs.get(id);if(job&&!terminal.has(job.data.status)){job.controller?.abort();if(!job.controller){job.data.status='cancelled';await save(job.data)}}return get(id)},
  async image(id,original=false){const job=await get(id);return job?.status==='ready'?fs.readFile(file(id,job.preview&&!original?'mock.png':'screen.png')):null}
 }
}
