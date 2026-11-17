import {readFile,writeFile,mkdir,cp} from 'node:fs/promises'
const root='artifacts/core-task-routing-20261111',out='public/core-task-routing'
const read=async p=>JSON.parse(await readFile(p,'utf8'))
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const routing=await read(root+'/round2/routing-results.json')
const titles={social:'游戏舆情',movies:'今晚看什么',travel:'周末亲子',gpa:'GPA 试算'}
const judgments={
 social:'部分达成：真实 B站/小红书共40条，来源切换与选中原文有效；全部“未分类”，没有完成正负态度分布，不算完整成功。微博失败。',
 movies:'实测通过：真实榜单10条，纪录片筛选变为1条；详情增加故事/导演/演员；两片对比与返回正常，刷新保留2个对比项。',
 travel:'未通过：真实取数成功，但把checkbox的event.value当实体，而实体实际在args；已选状态不可用。上一轮还遗漏较早查询的绑定承诺。',
 gpa:'自动验收失败，人工关键交互通过：3.57→选择英语→4.0→3.86，刷新恢复。模型曾误写3.80预期；嵌套派生值断言也不匹配。不能按自动标记认定代码坏了。'
}
const generation=[]
for(const id of Object.keys(titles)){
 const first=await read(root+'/'+id+'-generation.json')
 const last=id==='movies'?first:await read(root+'/round2/'+id+'-generation.json')
 generation.push({id,title:titles[id],first:{status:first.status,seconds:first.elapsedMs/1000},last:{status:last.status,seconds:last.elapsedMs/1000},assessment:judgments[id],round:id==='movies'?'':'&round=round2'})
}
await mkdir(out+'/evidence',{recursive:true})
await cp(root+'/screenshots',out+'/screenshots',{recursive:true})
await cp(root+'/round2/routing-results.json',out+'/evidence/routing-results.json')
for(const id of Object.keys(titles))for(const round of ['', 'round2/']){
 if(id==='movies'&&round)continue
 await cp(root+'/'+round+id+'.sse',out+'/evidence/'+(round?'round2-':'round1-')+id+'.sse')
}
await writeFile(root+'/assessment.json',JSON.stringify({routing:routing.map(r=>({id:r.id,assessment:r.assessment,modelMs:r.modelMs,hostMs:r.routed.taskRouting.elapsedMs})),generation},null,2))
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>核心任务路由 · 调查与实测</title><style>
body{font:16px/1.65 system-ui,sans-serif;background:#f1f4f7;color:#172332;margin:0}main{max-width:1180px;margin:auto;padding:30px 20px}h1{font-size:36px;line-height:1.2}h2{margin-top:40px}a{color:#176c83}section,.callout{background:white;padding:22px;border-radius:20px;margin:18px 0}.callout{background:#e0edf0}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;border-bottom:1px solid #dce2e7;padding:12px;vertical-align:top}.scroll{overflow:auto}code{font-size:12px;overflow-wrap:anywhere}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}img{width:100%;border-radius:14px}small{color:#596773}summary{cursor:pointer}li{margin:9px 0}</style><main>
<small>LOCAL ONLY · 2026-11-11 · DeepSeek v4.1 Flash · 原生 CardSpec</small><h1>先识别任务，再找工具；<br>用实际数据决定表达。</h1>
<p>本轮交付：消费级 AI 案头调查、核心任务提取、宿主路由与证据约束。下面分开报告候选召回、实际调用、生成状态与完整功能，避免把其中一项当成全部成功。</p>
<div class="callout"><b>结论：路由机制可用，整卡质量仍有缺口。</b> 8项真实模型提取，7项预定义召回/本地任务检查通过，1项长尾人工检查。4类正常生成共7次调用：电影完成主要CUJ，舆情只完成采样，旅行失败，GPA自动验收误判但人工交互通过。没有达到“所有核心任务自动变成高质量卡片”。</div>
<h2>1. 消费级 AI 简要调查</h2><section><ul><li><a href="https://openai.com/index/how-people-are-using-chatgpt/">OpenAI/NBER（2025-09）</a>：150万消费版ChatGPT对话样本，实用指导、信息查找和写作约占四分之三，约70%为非工作使用。不是全部AI市场。</li><li><a href="https://publicpolicy.google/article/from-experimental-to-essential/">Google/Ipsos（2026-01）</a>：21国21,000访谈，AI用户自报学习/深入理解74%、省时65%、探索机会42%、决策40%；多选调查不等于消息份额。</li><li><a href="https://www.ipsos.com/en-us/half-americans-report-using-ai-services-information-and-productivity-leading-use-cases">Epoch AI/Ipsos（2026-04）</a>：美国用户信息/推荐80%、写作59%、建议学习55%、头脑风暴53%、图片44%、分析/编码37%；仅交叉印证，不外推全球。</li></ul><p>移动端偏短时查询、在途计划、识别与记录；PC偏长资料、写作、比较、模拟和创作——这是产品设计推断，现有调查不能给出可比的全球手机/PC用途排名。</p></section>
<h2>2. 已接入的机制</h2><section><p><b>prompt → 核心任务（最多3个） → 全目录召回＋来源先验 → 精确契约 → 真实取数 → 证据支持的视图候选 → 既有CardSpec/宿主交互</b></p><p>12类：查找、理解、表达、决策、计划、监控、记录、练习、计算、创作、整理、自定义。复杂任务合入现有plan_cards；简单且启用工具时增加短task_route，25秒/1000输出token，失败回原发现链，不额外修复提取。</p><p>宿主维护来源的领域和用途，不写“原神→B站”的案例规则。纯写作/计算不强迫联网。地图需要坐标，时间线需要实际事件日期，分类分布需要引用与标签；候选只是提示，不能代替完整CUJ验收。现有tool-view/task-board继续承担字段、分页、详情、比较与恢复。</p></section>
<h2>3. 真实模型任务提取与召回</h2><p>提取耗时1.6–2.6秒；宿主匹配0–5.0秒（受检索初始化/缓存影响）。不是完整卡片耗时，也不是稳定性能基准。测试不执行候选工具。</p><div class="scroll"><table><tr><th>用户表达</th><th>提取 / 宿主耗时</th><th>候选与任务</th><th>检查</th></tr>${routing.map(r=>`<tr><td>${escape(r.prompt)}</td><td>${(r.modelMs/1000).toFixed(2)}s / ${(r.routed.taskRouting.elapsedMs/1000).toFixed(2)}s</td><td>${r.routed.taskRouting.tasks.map(t=>`<b>${escape(t.kind)}</b> · ${escape(t.query)}<br><code>${escape(t.tools.map(x=>x.id).join(', ')||'不调用工具')}</code>`).join('<hr>')}</td><td>${r.assessment.passed===null?'人工检查：仅通用搜索出口':r.assessment.passed?'预定义检查通过':'未通过'}</td></tr>`).join('')}</table></div><p><a href="evidence/routing-results.json">完整两种召回结果、模型输入输出与usage</a></p>
<h2>4. 正常生成入口，两轮实测</h2><p>同模型、direct、原生CardSpec、调试开启、auto尺寸。第二轮只重跑失败项，非独立随机A/B实验。没有手改模型产物。</p><div class="scroll"><table><tr><th>任务</th><th>第一轮</th><th>第二轮</th><th>实际结论</th></tr>${generation.map(r=>`<tr><td><a href="viewer.html?id=${r.id}${r.round}">${r.title} · 交互预览</a><br><a href="evidence/round1-${r.id}.sse">首轮trace</a>${r.id==='movies'?'':` · <a href="evidence/round2-${r.id}.sse">二轮trace</a>`}</td><td>${r.first.status}<br>${r.first.seconds.toFixed(1)}s</td><td>${r.id==='movies'?'未重跑':r.last.status+'<br>'+r.last.seconds.toFixed(1)+'s'}</td><td>${escape(r.assessment)}</td></tr>`).join('')}</table></div>
<h2>5. 浏览器证据</h2><p>电影检查320/360/432宽度及square/auto：未检测到整页横向溢出或内部纵向滚动；不能据此保证所有弹层、所有工具数据都适配。截图是实际模型生成产物，未用手写fixture替换。</p><div class="grid">${[['movie-432-auto','电影：真实图片与宿主选择界面'],['movie-detail','详情新增信息'],['movie-compare','两片比较'],['gpa-interaction','GPA：人工改分有效'],['social-filter','舆情：来源切换有效，分类未做']].map(([f,t])=>`<figure><a href="screenshots/${f}.jpg"><img loading="lazy" src="screenshots/${f}.jpg" alt="${t}"></a><figcaption>${t}</figcaption></figure>`).join('')}</div>
<h2>6. 剩余问题与优先级</h2><section><ol><li><b>P0 需求→行为门控：</b>“工具调用成功”不能满足“态度分布”。未分类可以诚实交付部分内容，但必须保留未完成的CUJ。</li><li><b>P0 契约/事件：</b>旅行把checkbox布尔event.value当成实体；应推广宿主实体选择能力，精确事件契约按需披露。</li><li><b>P0 验收可信度：</b>GPA错误数值预期＋嵌套derived路径断言需与实现错误分开；不要为迎合错误断言破坏正确代码。</li><li><b>P1 来源选择与查询版本：</b>仍有宽泛旅游候选噪声；变更查询后的旧数据承诺需要明确替代/引用关系，不能简单删掉全部校验。</li><li><b>P1 体验落实：</b>presentation目前是数据能力提示，不是确定性的整卡编排器。下一步将CUJ所需的分类/对比/刷新变成宿主可验证的操作计划，继续优先原生组件。</li></ol></section>
<p>相关回归83项通过，新增路由负例8项套件通过（与前者重叠7项，合计84项不同检查）。前端构建通过。未宣称全仓库测试全绿：既有全量/紧凑prompt比例断言仍需单独处理。本轮未改GPT Site，保留DIL，OpenCLI/Owl原连接保持。</p></main></html>`
await writeFile(out+'/report.html',html)
await cp(out,'dist/core-task-routing',{recursive:true})
console.log('http://127.0.0.1:8787/core-task-routing/report.html')
