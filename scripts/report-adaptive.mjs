import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises'
import {digest} from '../server/rsi-records.mjs'
const read=async(file,fallback=null)=>{try{return JSON.parse(await readFile(file,'utf8'))}catch{return fallback}}
const first='artifacts/adaptive-eval',latest=process.argv[2]||'artifacts/adaptive-eval-v2'
const manifest=await read(first+'/manifest.json'),records=[],cohorts=[]
for(const [name,folder]of [['control',first+'/legacy/r1'],['adaptive-v1',first+'/adaptive-v1/r1'],['adaptive-v1.1',latest+'/adaptive-v1/r1']]){
 let files=[];try{files=(await readdir(folder)).filter(f=>f.endsWith('-cardspec.json'))}catch{continue}
 const replay=await read(folder+'/replay.json',[])
 const rows=[]
 for(const file of files){
  const r=await read(folder+'/'+file);if(!r)continue
  const spec=r.message?.metadata?.card_spec,artifactHash=digest({source:r.source,spec})
  const entry={...r,artifactHash,caseId:digest(r.prompt),track:'cardspec-native',cohort:name,qa:replay.find(q=>q.id===r.result.id)}
  delete entry.frames
  rows.push(entry)
  if(name==='control'||name==='adaptive-v1.1')records.push(entry)
 }
 cohorts.push({name,rows})
}
if(!records.some(r=>r.cohort==='adaptive-v1.1'))records.push(...(cohorts.find(c=>c.name==='adaptive-v1')?.rows||[]))
const quantile=(a,p)=>{const sorted=a.filter(Number.isFinite).sort((x,y)=>x-y);return sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]:null}
const esc=x=>String(x??'—').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))
const pct=(n,d)=>d?`${n}/${d} (${Math.round(n/d*100)}%)`:'—'
const sec=v=>v==null?'—':(v/1000).toFixed(1)+'s'
const stats=cohorts.map(c=>{
 const original=c.rows.filter(r=>Number(r.result.id.slice(0,2))<=20),passed=original.filter(r=>r.result.status==='succeeded'),qa=original.filter(r=>r.qa)
 return {name:c.name,total:original.length,firstPass:original.filter(r=>r.result.firstPass).length,passed:passed.length,medianMs:quantile(original.map(r=>r.result.elapsed),.5),p95Ms:quantile(original.map(r=>r.result.elapsed),.95),promptChars:quantile(passed.map(r=>r.result.promptChars),.5),firstUsableMedian:quantile(passed.map(r=>r.result.firstUsableMs),.5),
  smokePassed:qa.filter(r=>r.qa.smokePassed).length,smokeTotal:qa.length,allSizesWithoutOverflow:qa.filter(r=>r.qa.widths?.length===6&&r.qa.widths.every(w=>!w.horizontalOverflow)).length}
})
const ui=await read(first+'/ui/results.json',[]),generatedUi=await read(latest+'/generated-ui/results.json',[]),live=await read(latest+'/live-workflow.json'),hybrid=await read(latest+'/hybrid-v2.json')||await read(latest+'/hybrid.json'),liveGeneration=await read(latest+'/live-generation.json')
const htmlReference=await read('public/html-reference/data.json',{})
const cases=[...manifest.cases]
if(liveGeneration){
 const r=liveGeneration,spec=r.message?.metadata?.card_spec
 cases.push({id:'live-sources',prompt:r.prompt})
 records.push({prompt:r.prompt,source:r.source,message:r.message,metadata:r.metadata,result:{...r.result,id:'live-sources',profile:'adaptive-v1',elapsed:r.result.elapsedMs,repairCount:r.metadata?.repair_count},artifactHash:digest({source:r.source,spec}),caseId:digest(r.prompt),track:'cardspec-native',cohort:'adaptive-v1.1-live',qa:r.qa})
}
const data={createdAt:new Date().toISOString(),cases,records,html:(htmlReference.records||[]).filter(r=>r.format==='html').map(({id,source})=>({id,source})),stats,ui,generatedUi,live,hybrid,liveGeneration,gate:{promoted:false,humanReview:'pending',reason:'Experimental. Generation, interaction and blind UX gates are separate; one batch is not a stable success-rate estimate.'}}
await mkdir('public/adaptive-eval',{recursive:true});await mkdir('dist/adaptive-eval',{recursive:true})
const report=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Adaptive CardSpec 实验报告</title><style>body{margin:0;background:#f2f4f8;color:#17273c;font:16px/1.65 system-ui}main{max-width:1250px;margin:40px auto;padding:20px}section{background:white;border-radius:20px;padding:24px;margin:20px 0}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;border-bottom:1px solid #e9edf3;padding:10px;vertical-align:top}.scroll{overflow:auto}small{color:#59687d}a{color:#24658f}code{overflow-wrap:anywhere}img{width:min(100%,400px);border-radius:14px}.warning{background:#fff3dc}h1{font-size:36px;line-height:1.25}</style><main>
<small>RSI / ADAPTIVE HARNESS / LOCAL ONLY</small><h1>短契约、工具编排与通用组合的真实对照</h1><p>仅本地部署。保留 DIL 和原生成流程；新能力以“自适应体验（实验）”开关提供。</p><p><a href="/adaptive-review.html">打开交互对照与反馈工作台 →</a> · <a href="/h5-baseline/index.html">五个 H5 基线 →</a></p>
<section class="warning"><strong>尚未晋级默认。</strong>生成通过仅说明编译和契约校验通过，不等于业务正确或达到 H5 的视觉质量。以下为同模型单轮对照，尚无三轮稳定性与人工盲评结论。历史 HTML 只作体验参考，不混入本次耗时统计。</section>
<section><h2>原有 20 例：生成与交互分开计分</h2><div class="scroll"><table><thead><tr><th>组别</th><th>首次通过</th><th>修复后通过</th><th>耗时中位 / P95</th><th>可用首屏中位</th><th>主 prompt 字符</th><th>交互脚本通过</th><th>六尺寸无横向溢出</th></tr></thead><tbody>${stats.map(s=>`<tr><td>${s.name}</td><td>${pct(s.firstPass,s.total)}</td><td>${pct(s.passed,s.total)}</td><td>${sec(s.medianMs)} / ${sec(s.p95Ms)}</td><td>${sec(s.firstUsableMedian)}</td><td>${s.promptChars??'—'}</td><td>${pct(s.smokePassed,s.smokeTotal)}</td><td>${pct(s.allSizesWithoutOverflow,s.smokeTotal)}</td></tr>`).join('')}</tbody></table></div><small>请求耗时包含修复与失败；旧流程未记录可用首屏，不以首次 token 代替。交互脚本中的 locatorUncertain 单独保留，不能直接认定为模型业务错误。</small></section>
<section><h2>已实现的通用能力</h2><p>experience 组合提供筛选、多选、样本分布、原文访问与状态恢复；map 提供有真实坐标的位置示意；chart 支持多系列和堆叠；隔离 JS 提供矩阵与常用数值函数。workflow.run 执行只读 DAG，dataset.analyze 返回带精确引文的分类，统计由宿主计算。</p><p>原生核心完整后才发布；React 增强继承剩余预算，生成失败保留原生功能。原生和 React 的局部状态仍各自保存；沙箱没有网络和宿主工具权限。地图目前是位置示意，未接入街道/路径导航。</p><p>新组件六尺寸确定性交互：${pct(ui.filter(r=>r.passed).length,ui.length)}。真实工具结果：${live?esc(live.summary):'尚未记录'}。React 增强验证：${hybrid?esc(hybrid.summary):'尚未记录'}。</p><a href="/cardspec-lab.html?fixture=adaptivePlanner">多选与位置示意</a> · <a href="/cardspec-lab.html?fixture=adaptiveNumeric">隔离数值模拟</a> · <a href="/cardspec-lab.html?fixture=adaptiveSeries">多系列图</a></section>
<section><h2>生成产物复验与真实取数</h2><p>五个基线方向的生成产物，加日历边界修复，六尺寸交互复验 ${pct(generatedUi.filter(r=>r.passed).length,generatedUi.length)}。日历保留原批次失败记录；通用允许“未选中日期”后，原文无需额外模型调用即可编译并完成选日、翻月。该复验不回填原批次生成成功率。</p><p>真实“GLM 生成前取数 → 卡片”请求：${liveGeneration?esc(liveGeneration.result.status)+'，耗时 '+sec(liveGeneration.result.elapsedMs)+'，首屏 '+sec(liveGeneration.result.firstUsableMs)+'，模型 '+(liveGeneration.result.budget?.modelCalls??'—')+' 次，实际读取 '+(liveGeneration.result.budget?.reads??'—')+' 次。':'未记录。'}</p><p>额外题的文字密度、信息结构与 H5 体验相似度尚待人审。电影、舆情等样本仍可能采用普通控件，而非充分使用新组合；不能只凭功能通过认定达到基线。</p></section>
<section><h2>逐例结果</h2><div class="scroll"><table><tr><th>案例</th><th>组别</th><th>生成 / 耗时</th><th>交互检查</th><th>失败/诊断</th></tr>${records.sort((a,b)=>a.result.id.localeCompare(b.result.id)).map(r=>`<tr><td>${esc(r.result.id)}</td><td>${r.cohort}</td><td>${r.result.status} / ${sec(r.result.elapsed)}</td><td>${r.qa?pct(r.qa.checks.filter(c=>c.passed).length,r.qa.checks.length):'未测'}</td><td>${esc(r.result.error||r.qa?.errors.join(';')||r.qa?.checks.filter(c=>!c.passed).map(c=>(c.locatorUncertain?'定位不确定：':'')+c.reason).join(';')||'—')}</td></tr>`).join('')}</table></div></section>
<section><h2>双飞轮的边界</h2><p>每个自适应请求记录契约版本、模型/工具 trace、数据来源、预算及不可变产物 hash。工作台意见绑定该 hash，导出后进入待审池。训练资格仍要求六尺寸 QA、事实核验、任务完成和人工批准。尚未做自动训练、自动部署或自动替换默认。</p><p>失败请求支持显式重试时复用 15 分钟内的数据 checkpoint，不自动重放模型。workflow 的依赖与参数需显式声明，尚不自动推导跨平台语义等价来源。引文校验只证明分类有原文依据，不代替人工核验分类正确性。</p><p>还需完成：三轮稳定性门控、留出题语义验证、人工 H5 盲评，以及更细粒度局部修复。当前继续使用已有 slot/页面栈的用户触发生成，不宣称已经具备任意深层任务的自动拆分能力。</p></section></main></html>`
for(const root of ['public/adaptive-eval','dist/adaptive-eval']){await writeFile(root+'/data.json',JSON.stringify(data));await writeFile(root+'/report.html',report)}
await writeFile(latest+'/report-summary.json',JSON.stringify({stats,uiPassed:ui.filter(r=>r.passed).length,uiTotal:ui.length,gate:data.gate},null,2))
console.log(JSON.stringify(stats,null,2))
