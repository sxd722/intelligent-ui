import {readFile,writeFile} from 'node:fs/promises'
import {AUDIT_CASES} from './glm-audit-cases.mjs'
const dir='artifacts/glm-audit-2026-10-15',rows=JSON.parse(await readFile(`${dir}/summary.json`,'utf8'))
const records=await Promise.all(rows.map(r=>readFile(`${dir}/${r.id}-cardspec.json`,'utf8').then(JSON.parse)))
const replay=JSON.parse(await readFile(`${dir}/browser-replay.json`,'utf8'))
const notes={
 '01-counter':['基础交互','计数与备注结构紧凑；有界状态探索未发现契约异常。未穷举所有输入。'],
 '08-calendar':['交互验证通过','浏览器实测闰日29日→新闻正文、下月→3月、返回2月，均正确。'],
 '10-chart':['修复后可用','首轮给 strong 添加了不支持的 align；一次修复成功。负数、零值可见；方形下半部留白明显。'],
 '12-flowchart':['结构清楚','有环流程正常呈现，节点可达；有界状态探索覆盖选择变化。'],
 '14-quiz':['交互验证通过','浏览器完成3题，得3分，作答后选项消失，重开归零。内容中“月球不绕太阳运行”的绝对化解释仍需知识质量审查。'],
 '17-card-battle':['业务语义有歧义','浏览器确认出牌后禁用；火球后剩1法力，结束回合变4。“恢复3”被理解成增加3，而非设为3。不能仅据含糊提示判为运行时错误。'],
 '19-media':['视觉部分满足','两张缩略图和收藏状态已生成；森林题图被整卡背景代替，未完全按请求提供独立题图。截图使用实验室占位图，不能据此判断真实图片质量。'],
 '20-cart':['确认业务缺陷','结算总额22、实付17正确，但明细数量清零，之后添加苹果又改写上次明细。保存了商品数组，未保存数量；UI仍读当前state.qty。'],
 '21-world-clock':['最终校验失败','首轮动态节点id、未知data引用；修复后仍将weatherDublin等当作裸变量。时钟组件已存在，失败发生在生成的引用语法，并非缺少时钟能力。'],
 '22-pomodoro':['能力不满足','首轮编译通过，却只有当前时钟和手动“完成一轮”，没有自动倒计时、剩余时间或到点提醒。outro说明限制，但intro仍宣称番茄钟功能。'],
 '23-movie-analysis':['内容依据不足','修复状态声明和rowKey后通过；赏析生成仅传片名、评分、链接，未等待或传入真实详情。点击详情与生成赏析是分离动作，内容正确性没有保证。'],
 '24-weekend-movies':['确认工具语义缺陷','修复集合表达式及query→keyword后通过；详情id却来自rowKey。用合成行（rowKey=row:test，业务id=35322132）执行动作，得到subject id=row:test，未发网络请求。候选也依赖当前搜索结果，换关键词会丢失比较对象。'],
 '25-rail-weather':['生成通过，外部待验','当天日期、下午时段过滤、独立天气工具均已声明。实验室初始回放仅看到加载态；票价/经停字段与实际返回一致性未完成端到端验证，不记外部调用通过。'],
 '26-hotel':['生成阶段超时','180秒超时，输出停在第25行，源2399字符。首内容约23.9秒出现，未完成卡片，未执行携程查询。不能归因为携程失败或确定为token耗尽。'],
 '27-news':['修复后生成通过','重复detail节点ID在一次修复中解决；声明榜单与GLM解释工具。只完成初始渲染回放，未确认真实榜单和摘要依据。'],
 '28-mermaid':['结构组件匹配','实际选择flowchart而非Mermaid，符合用户“结构图”需求；有节点说明和本地小题。回放出现布局overflow标记但无横向溢出，需持续布局观测，不能仅凭fit判定完美。'],
 '29-lebesgue':['数学与展示双缺陷','两个区间各向左右扩ε，代价应为0.5+4ε，生成式为0.5+2ε；表格长度静态不变。长小数0.700000…导致320/432宽度横向溢出。公式正常渲染不能证明数学正确。'],
 '30-branch-story':['创作较强','三轮、两选项、后果停留及首轮记忆影响第三轮已在源码体现，21个状态的有限探索无契约错误。指标有代价但结局主要由flag决定；未穷举所有业务结局。'],
 '31-budget':['结构与快照较好','修复table表达式后通过。费用、人数、图表和保存快照在源码中分开；0人数有明确保护。16个状态探索无异常，但未做完整浏览器数值验收。'],
 '32-reading-explore':['局部生成路径','首轮动作名不一致，经修复通过。三种图文观察项、勾选、显式上下文及slot已生成；真实点击蘑菇→勾选→GLM追问已成功：slot更新为蘑菇颜色/菌盖形状问题，勾选与33%进度保留，安全提示仍在。证据：slot-live-result.txt、screenshots/slot-live.png。']
}
const findings=[
 ['生成成功率应拆成多层','20个新鲜对话、各一次direct：首次11/20（55%），一次修复后18/20（90%）。8次进入修复，7次救回；另1例生成超时。这里只衡量最终完整输出和服务端校验，不是业务正确率。'],
 ['工具组合是当前主要薄弱环节','7个工具任务首次1/7，修复后5/7；13个本地任务首次10/13，修复后13/13。样本少、任务复杂度不同，不能断言工具导致失败，也不能推断总体能力百分比。'],
 ['模型能组合组件，但仍承担太多程序员职责','它同时处理XML式语法、受限表达式、状态事务、工具schema、业务ID与rowKey、异步输入、布局、内容事实。基础组件任务较稳，多实体和工具详情更容易出现“字符串类型对、含义错”。'],
 ['现有架构解决了执行安全，尚未解决任务正确性','纯动作事务、完整校验后执行工具、局部错误隔离、一次修复都有效。空列表的编译预演却覆盖不到真实数据形状；型别正确的快照读取、数学公式和内容臆测也能通过。'],
 ['呈现能力够用，质量评价仍太粗','18张成功卡均在320/432px回放，初始组件无报错；其中数学卡两种宽度横向溢出。实验室fit标记不能替代几何检查和视觉检查。截图使用占位图片，外部工具初始加载不等于调用成功。']
]
const actions=[
 ['P0','把工具身份与结果形状交给宿主','生成统一entityRef（provider、type、业务id、rowKey）；详情动作从受验证引用取业务id。输出字段按工具schema对齐，并对table/map结果做非空样例预演。先堵住当前movie案例，无需额外模型调用。'],
 ['P0','让有依据的内容生成成为显式依赖','详情→生成必须绑定一个成功的数据版本。宿主收集已验证详情、来源和缺失字段，再允许glm.generate；资料不足时展示可查证信息或观看问题，不从译名编造剧情。保留direct首屏，不增加固定规划轮。'],
 ['P0','补足能力与承诺的一致性','为时间类任务增加宿主管理的duration timer（deadline、暂停剩余量、恢复、结束事件），与world clock区分；未支持能力在生成前短说明，并禁止intro宣称未实现功能。'],
 ['P1','把验收从初始树推进到可达状态','复用本次effect-free探索器，加入schema驱动的空/正常/缺失/重复结果样例及小型业务不变量。购物车应验证checkout快照不可被后续修改；数学数值必须有独立算术断言。失败定位到节点/动作，不默认整卡重写。'],
 ['P1','缩短和分层披露契约','本次静态CardSpec prompt为24,206字符；电影任务工具索引另有11,449字符，并展开11项候选。字符数不是token数，也不是总上下文。建议按任务投影组件/工具契约，保留一个规范示例；只有发现未知能力时再扩展，减少规则竞争。需A/B验证，不能先假定裁剪一定提升。'],
 ['P1','改善宿主显示默认值','stat统一数字格式与小数上限、可收缩排版；内容结果提供宿主空态/错误/更新时间；静态schema错误去重并带位置。对纯装饰属性可容错，对业务字段和工具参数保持严格。'],
 ['P2','以任务进展衡量趣味性','保留多样图片、结构图和短互动，但不强制每卡新增两套复杂功能。评估有效选择、反馈与后续数据依据，避免用大量正文、按钮或装饰数量代替互动质量。'],
 ['验证','做固定样本的对照实验','本轮只把direct设默认，不改模型prompt/协议以免污染基线。下一轮对同一20例各跑3次，对比“现架构 / 精简契约+类型化工具引用”，分别统计首次、修复后、功能断言、内容依据、延迟与模型调用次数。保留失败记录，不挑最好的一次。']
]
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const stats={total:rows.length,first:rows.filter(r=>r.firstPass).length,final:rows.filter(r=>r.status==='succeeded').length,repair:rows.filter(r=>r.repairCount).length,medianMs:27355.5,p90Ms:43210}
const recent=`近期可见会话有4个请求：Top3赏析三阶段失败（unexpected token :）、一次用户停止、Top3直出失败（each.items expected array）、周末观影直出经一次修复成功（40.7秒）。最后一例的完整导出trace已保存；前面几例只有当前DOM可见诊断与模型文本，不冒充完整原始trace。当前第三页赏析明确基于片名/译名，却给出悬念、反转等剧情判断，属于依据不足。已从最后一例trace恢复源码，注入明确标注为合成的两条电影结果，复现比较表传字符串数组而非行对象；未执行外部工具。用户取消不计模型失败，近期样本不与20例混算。`
const methods=`模型 glm-5.3-flash；2026-10-15（Asia/Shanghai）；direct、温度0.4、reasoning low、maxTokens8192、一次修复、并发2。20例包含8个既有回归用例和12个扩展任务，交错方形/不限高，工具开启，均新鲜对话。每例保留prompt、最终与首轮源码、完整SSE frames（含模型输出的reasoning字段）、诊断、工具披露、耗时和资源记录；没有记录API key。20例均只跑一次，没有同条件staged对照，因此本报告不声称direct比staged质量更高。中位27.4秒、最近秩P90为43.2秒，包含修复和图片等待，并发条件下不等同单用户延迟。18例成功输出进行了浏览器初始回放与有限状态探索（深度5、最多100个状态，不执行effects）；工具空数据限制会低估后续错误。另有实际月历、答题、战斗、购物车及slot交互证据。图片回放为实验室占位图，日期上下文为实验室固定日期；实际生成context日期保留在trace中。未全面执行所有外部服务、所有GLM后续页面，也未对未完成内容给出通过结论。`
let md=`# GLM生成能力与架构匹配审查\n\n日期：2026-10-15。已将前端和未显式指定mode的API默认改为direct；保留三阶段切换和DIL，仅本地8787。\n\n`
for(const [title,body] of findings)md+=`## ${title}\n\n${body}\n\n`
md+=`## 近期调用\n\n${recent}\n\n## 逐例记录\n\n|场景|首次/最终|耗时|审查结果|\n|---|---|---|---|\n`
for(const c of AUDIT_CASES){const r=rows.find(r=>r.id===c.id);md+=`|${c.id} ${c.area}|${r.firstPass?'通过':'未通过'} / ${r.status==='succeeded'?'通过':'失败'}|${(r.elapsed/1000).toFixed(1)}秒|${notes[c.id].join('：')}|\n`}
md+='\n## 架构改进优先级\n\n';for(const [p,t,b] of actions)md+=`### ${p} ${t}\n\n${b}\n\n`
md+=`## 方法与边界\n\n${methods}\n\n证据见同目录 summary.json、各场景 *-cardspec.json、browser-replay.json、browser-interactions.json、state-probes.json、cart-business-proof.json、detail-identity-proof.json、recent-visible.txt、recent-weekend-trace.json 与 screenshots/。\n`
await writeFile(`${dir}/report.md`,md)
await writeFile(`${dir}/analysis.json`,JSON.stringify({stats,notes,findings,actions,methods,recent},null,2))
const caseHtml=AUDIT_CASES.map(c=>{const r=records.find(r=>r.result.id===c.id),x=r.result,shot=replay.some(p=>p.id===c.id);return `<article class="case" data-status="${x.firstPass?'first':x.status==='succeeded'?'repair':'failed'}" data-search="${esc(c.id+' '+c.area+' '+c.prompt)}"><header><small>${esc(c.id)} · ${esc(c.area)} · ${c.cardSize==='auto'?'不限高':'方形'}</small><h3>${esc(notes[c.id][0])}</h3><span class="badge ${x.status==='failed'?'bad':x.firstPass?'good':'warn'}">${x.status==='failed'?'生成失败':x.firstPass?'首次通过':'修复后通过'} · ${(x.elapsed/1000).toFixed(1)}s</span></header><p>${esc(notes[c.id][1])}</p><details><summary>需求与验收目标</summary><p>${esc(c.prompt)}</p><ul>${c.checks.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></details>${shot?`<details><summary>浏览器截图（实验室占位图片）</summary><a href="screenshots/${c.id}.png"><img loading="lazy" src="screenshots/${c.id}.png" alt="${esc(c.area)}回放截图"></a></details>`:''}<details><summary>诊断与生成源码</summary><pre>${esc(JSON.stringify({first:x.firstDiagnostics,final:x.diagnostics},null,2))}</pre><pre>${esc(r.source)}</pre></details><a href="${c.id}-cardspec.json">完整 trace / 源码 / 模型输出</a></article>`}).join('')
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GLM生成能力与架构匹配 · 2026-10-15</title><style>body{margin:0;background:#f4f6f9;color:#182738;font:16px/1.7 system-ui,sans-serif}main{max-width:1180px;margin:auto;padding:48px 24px}h1{font-size:38px;line-height:1.25;max-width:900px}h2{margin-top:48px}h3{line-height:1.4}p{max-width:100ch}small,.muted{color:#607285}a{color:#145a91}nav{display:flex;gap:20px;flex-wrap:wrap}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:28px 0}.metric,.finding,.case,.action{background:#fff;padding:22px;border-radius:16px}.metric strong{display:block;font-size:34px}.metric span{color:#596b7d}.findings,.cases{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.finding h3{margin-top:0}.case header{position:relative}.badge{display:inline-block;padding:4px 10px;border-radius:30px;font-size:13px}.good{background:#e0f3ec;color:#245e4b}.warn{background:#fff0cf;color:#765716}.bad{background:#f9e4e1;color:#943b32}.action{margin-bottom:12px}.action strong{color:#165c89}details{padding:10px 0}summary{cursor:pointer;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f5f8;padding:14px;font-size:12px;max-height:440px;overflow:auto}img{width:100%;max-height:400px;object-fit:contain;background:#eef1f5}input,select{padding:11px;border:1px solid #cbd4dd;border-radius:10px;font:inherit;background:white}.filters{display:flex;gap:12px;margin:18px 0}footer{margin-top:40px;color:#607285}blockquote{margin:25px 0;padding:20px;background:#e7eff8;border-radius:12px}@media(max-width:720px){h1{font-size:28px}.metrics,.findings,.cases{grid-template-columns:1fr}.filters{flex-direction:column}main{padding:24px 16px}}</style><main><small>本地技术审查 · 2026-10-15 · GLM-5.3-flash</small><h1>能生成可交互卡片，<br>但“编译通过”还不能代表任务完成</h1><p>direct 已设为默认，三阶段与 DIL 继续可选。本轮冻结生成契约，保留失败样本，观察模型能力与架构之间的真实缺口。</p><nav><a href="#findings">主要发现</a><a href="#cases">20个场景</a><a href="#actions">改进优先级</a><a href="report.md">Markdown报告</a><a href="summary.json">原始统计</a></nav><div class="metrics"><div class="metric"><strong>11 / 20</strong><span>首次完整校验通过 · 55%</span></div><div class="metric"><strong>18 / 20</strong><span>一次修复后通过 · 90%</span></div><div class="metric"><strong>7 / 8</strong><span>进入修复后救回</span></div><div class="metric"><strong>27.4s</strong><span>总生成耗时中位数</span></div></div><blockquote>90% 是生成与校验结果，不能解释为功能正确率。已实证：购物车快照错误、电影详情 ID 错误、倒计时能力缺失、数学计算与显示错误。</blockquote><h2 id="findings">主要发现</h2><div class="findings">${findings.map(([t,b])=>`<section class="finding"><h3>${esc(t)}</h3><p>${esc(b)}</p></section>`).join('')}</div><h2>近期真实会话</h2><p>${esc(recent)}</p><nav><a href="recent-visible.txt">近期可见证据</a><a href="recent-weekend-trace.json">观影原始trace</a><a href="state-probes.json">状态探索与对比表复现</a><a href="cart-business-proof.json">购物车交互证据</a><a href="detail-identity-proof.json">详情ID证据</a></nav><h2 id="cases">20个场景逐例查看</h2><p class="muted">点击展开需求、诊断、生成源码与截图。外部工具只到加载态的用例明确标记为待验。</p><div class="filters"><input id="search" placeholder="搜索场景、能力、需求" aria-label="搜索场景"><select id="status" aria-label="筛选结果"><option value="all">所有结果</option><option value="first">首次通过</option><option value="repair">修复后通过</option><option value="failed">生成失败</option></select><span id="count"></span></div><div class="cases">${caseHtml}</div><h2 id="actions">架构改进优先级</h2>${actions.map(([p,t,b])=>`<section class="action"><strong>${esc(p)} · ${esc(t)}</strong><p>${esc(b)}</p></section>`).join('')}<h2>方法与边界</h2><p>${esc(methods)}</p><p>默认模式修改：src/App.jsx、server/index.mjs、server/cardspec/handler.mjs。测试集168项通过，生产构建通过；只更新本地8787，未发布GPT Site。OpenCLI绑定经checkpoint交接，daemon与原绑定session保持。</p><footer>证据目录：artifacts/glm-audit-2026-10-15 · 模型trace是待审查输出，不是事实来源。后续架构改进为建议，本轮未实施。</footer></main><script>const q=document.querySelector('#search'),s=document.querySelector('#status');function filter(){let n=0;document.querySelectorAll('.case').forEach(el=>{let show=(s.value==='all'||el.dataset.status===s.value)&&el.dataset.search.toLowerCase().includes(q.value.toLowerCase());el.hidden=!show;if(show)n++});document.querySelector('#count').textContent=n+' / 20 个场景'}q.addEventListener('input',filter);s.addEventListener('change',filter);filter()</script></html>`
await writeFile(`${dir}/report.html`,html)
console.log(JSON.stringify(stats))
