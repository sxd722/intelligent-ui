import {readFile,writeFile,mkdir,cp} from 'node:fs/promises'
const root='artifacts/debug-progress-qa',read=async f=>JSON.parse(await readFile(`${root}/${f}`,'utf8'))
const [historical,results,host,live,recovery]=await Promise.all(['historical.json','results.json','host-repair.json','live-model-v2/result.json','replay-v2/result.json'].map(read))
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const names={rats:'墙中之鼠',shopping:'购物预算与确认返回',motion:'运动参数与沙箱联动',kilimanjaro:'乞力马扎罗路线一致性'}
const md=`# 有效进展停止与宿主恢复：实现和验证

日期：2026-11-10。仅本地 8787，保留 DIL；未发布 GPT Site。

## 机制

普通调试连续 **3 轮**没有新增有效证据或确定的实现错误修复，就停止。partial、改源码哈希、换错误措辞、重复通过、错误请求与缓存命中都不能重置停滞。新增证据使用宿主固定的需求 ID、行为覆盖及核心路径/恢复里程碑，不按组件数或模型自评计分。编译错误修复必须重新编译成功；运行时错误须在同一路径重跑且错误减少。修改测试预期不直接算实现修复。

保留同上下文中已编译、浏览器执行无阻断错误且路径未失败的最佳候选；依据需求和行为证据排名，不采用最后一次源码。没有可用候选时停止并报告受阻，不把编译失败卡交付为成功。上下文变化会使旧候选失效。

停止结果为 partial，并附 remainingTasks：需求、类型、目标/节点、原因、baseVersion、保留已通过路径的约束。任务分为 implementation / interaction / test / behavior-review / layout / host / review；未覆盖不等于一定未实现。卡片上方可展开局部待办，不自动开启新一轮模型调用。

深度构建沿用模块提交与冻结测试机制，停滞阈值改为4轮。实现阶段有效提交小单元属于建设进展；验收阶段依赖需求/错误/布局证据。已有可用模块时以 partial 保留，并拆出剩余需求；没有可用版本时仍报 BUILD_STALLED。它不是把未通过单元标成完成。

## 调试上下文

保留原始任务、必要工具数据和最近完整 assistant/tool 组。旧调试源码、测试和推理替换为宿主检查点：候选版本、最佳版本、覆盖摘要和最近失败。纯补测不再携带源码；需修改实现时通过 card_source 按版本读取。实现错误仍提供当前源码上下文。原始 trace 不删除。对齐工具调用 ID，最近网关续写组的 reasoning_content 不改动。

真实 GLM 续调中，一次请求历史由 **29,311 → 20,235 字符（减少31%）**；这是字符量，不等同于 token 减少比例。后续对检查点历史进一步精简，在录制响应回放中为19,436字符。不是在所有场景强制压缩到同一长度。

## 宿主能不调用模型处理什么

已实现：

1. **恢复测试的确定性纠错。** reload 已证实 restored=true、没有自主状态变化或等待，仅 changed:true 与宿主契约冲突时，将其改为 false，同源码重跑。其余断言不改、原错误不删。本次真实浏览器结果：0模型调用、源码不变，${(host.elapsedMs/1000).toFixed(2)}秒（含两次浏览器运行）。
2. **提交协议兜底。** 模型仅输出结束说明，或输出截断，而宿主已保存可用候选时，直接保留候选及未完成任务。不会再让模型抄写全文。没有可用候选时不伪造结果；用户取消仍尊重取消。
3. **已知执行结果复用。** 同源码、上下文、测试路径命中缓存无需重跑浏览器，但重复请求仍消耗停滞次数；源码读取不执行任何工具/业务动作。

可进一步宿主化：精确且无歧义的控件句柄恢复、按依赖重验、确定性语法规范化、布局测量和局部错误边界。现有编译器也已有部分规范化能力。本轮没有自动修正业务数值、胜负规则、路线天数、缺失拖拽/计时，也不会自动翻页后声称单屏可达。

## 验证结果

### 历史反事实回放

原“墙中之鼠”17轮真实调试记录输入新账本，会在第 **${historical.stopRound}轮 / ${(historical.stopElapsedMs/60000).toFixed(2)}分钟**停止，而非42.78分钟；理论省去约${((historical.originalElapsedMs-historical.stopElapsedMs)/60000).toFixed(2)}分钟尾部。保留同版本已经通过的路径；晚期新增证据不能假定提前存在。该估算沿用原时序，不是实际重新生成测速。

### 当前浏览器重验与停止压力测试

采用已有模型源码，432/320px截图和关键交互。前三例在通过真实路径后注入已标注的无效定位请求，验证3轮停滞、最佳版本和未完成任务；第四例重复真实路线关系失败，确认不会自动放宽断言。

| 场景 | 耗时 | 停滞后保留 | 完整性结论 |
|---|---:|---|---|
${results.map(r=>`| ${names[r.id]} | ${(r.elapsedMs/1000).toFixed(2)}s | ${r.retainedUnchanged?'源码不变，partial':'异常'} | ${r.actualBusinessFailure?'真实路线天数不一致仍失败，拆为 behavior-review':'原关键路径通过；未测项不计通过'} |`).join('\n')}

墙中之鼠：四阶段、资源/祭坛结局、刷新、重开通过；拖拽、真正计时、单屏详情依旧未补齐。购物：多选、预算门控、确认/返回、恢复。运动：参数与结果联动、解释/返回。路线：初始一致，切换特定路线后的计划天数不一致仍保留。

### 真实 GLM 与协议恢复

第一轮续调144.03秒：前三次模型输出完成，第四次输出截断；失败记录保留。

第二轮真实 glm-5.3-flash 续调 **${(live.elapsedMs/1000).toFixed(2)}秒 / ${live.modelCalls}调用**。两条测试提前在“放入行动槽”时断言应在“推进时间”后发生的变化，属于测试预期错误；刷新路径通过。模型最后忽略强制工具提交，返回说明文字，因此该次原始流程未成功交付，不能记作全功能通过。

针对这个新发现加入宿主提交兜底后，复用第二轮**原样模型输出**并重新浏览器验证：${(recovery.elapsedMs/1000).toFixed(2)}秒，**0次新增模型调用**，源码保持不变并以partial交付，未通过需求和协议问题成为待办。未把错误测试改成正确，也未冒充新模型生成成功。

117项相关回归通过，包括外层生成不会因停止而重新修复、最佳版本不被坏稿覆盖、跨上下文拒绝复用、深度模块保留、错误请求计数、源码按需读取和宿主纠错。生产前端构建通过。

## 限制与下一步

- 机制作用于多轮尾部；单次模型返回前的长时间思考尚不能靠进展账本缩短。原首轮近10分钟的问题仍需独立优化规划/实现上下文。
- 需求ID来自现有宿主拆解，粒度可能偏粗；通过一条有界路径不代表拖拽、计时、审美和所有分支全覆盖。待办保留原始要求，后续应改进子需求粒度。
- 真正业务错误仍需模型或人工定向实现。不能让宿主把实际输出当作正确答案。
- 本轮不是从零重生成对照；不承诺整卡生成已降至1–5分钟。

## 证据与入口

- http://127.0.0.1:8787/debug-progress-qa/report.html
- artifacts/debug-progress-qa/ 下有历史账本、四例逐步截图/trace、两轮真实模型消息及失败、录制响应回放、单元测试日志。
- 核心实现：server/cardspec/debug-progress.mjs、debug-session.mjs、deep-build.mjs、server/research/debug-context.mjs、session.mjs。
`
await writeFile('docs/DEBUG-PROGRESS-HARNESS.md',md);await writeFile(root+'/design-and-results.md',md)
const table=results.map(r=>`<tr><td>${esc(names[r.id])}</td><td>${(r.elapsedMs/1000).toFixed(2)}s</td><td class="ok">${r.retainedUnchanged?'保留原源码':'异常'} / partial</td><td>${r.actualBusinessFailure?'实际业务关系失败未被抹掉':'关键路径通过；停止探针通过'}</td><td><a href="${r.id}/trace.json">trace</a> · <a href="${r.id}/browser-1/normal-320.png">320</a> · <a href="${r.id}/browser-1/normal-432.png">432</a></td></tr>`).join('')
const gallery=results.map(r=>`<figure><img loading="lazy" src="${r.id}/browser-1/normal-432.png" alt="${esc(names[r.id])}真实浏览器截图"><figcaption>${esc(names[r.id])} · ${r.actualBusinessFailure?'初始状态通过，切换路线存在已知错误':'独立关键路径验证后的原卡片'}</figcaption></figure>`).join('')
const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>有效进展停止 · 本地验证</title><style>body{font:16px/1.65 system-ui,sans-serif;background:#101722;color:#e2eaf4;max-width:1120px;margin:auto;padding:32px 24px}h1{font-size:clamp(30px,5vw,49px);line-height:1.2}h2{margin-top:42px}a{color:#a1c9ff}small,figcaption{color:#9aabc1}.stats,.gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.stats>div,article{padding:22px;background:#1b2838;border-radius:16px}.stats b{display:block;font-size:32px}.ok{color:#83deb8}.warn{color:#ffcb88}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:13px 10px;border-bottom:1px solid #344153;text-align:left;vertical-align:top}figure{margin:0}img{max-width:100%;border-radius:12px;max-height:590px;object-fit:contain;background:#202c3b;width:100%}summary{cursor:pointer;color:#a1c9ff}details{padding:14px 0}code{background:#233247;border-radius:4px;padding:1px 4px}li{margin:8px 0}@media(max-width:650px){body{padding:22px 14px}.gallery{grid-template-columns:1fr}}</style>
<p><small>LOCAL 8787 · 2026-11-10 · 截图 / 真实模型 trace / 未通过项保留</small></p><h1>不再为“部分完成”<br>无限改写整张卡。</h1><p>以新增需求证据和真实错误修复判断进展。停止后保留最佳可用版本，分出局部待办；未完成仍明确标记，不用降低断言换取通过。</p>
<div class="stats"><div><small>普通调试无进展停止</small><b>连续 3 轮</b></div><div><small>回归测试</small><b>117 / 117</b></div><div><small>旧墙中之鼠反事实回放</small><b>42.78 → 19.00分</b><small>历史估算，非从零生成测速</small></div><div><small>真实续调一次上下文压缩</small><b>−31%</b><small>29,311 → 20,235 字符，非token比例</small></div></div>
<h2>已实现</h2><ol><li>partial、改名、换版本、缓存命中、错误请求均不能绕开停滞计数。</li><li>按已验证需求/行为保留最佳版本；新上下文失效；没有可用候选就报告受阻。</li><li>源码按版本复用，纯补测只带检查点，需要改实现才通过 <code>card_source</code> 读取。</li><li>同原型的深度构建4轮停滞后保留可用模块；局部待办在卡片上方可展开，不自动续跑。</li></ol>
<h2>四例真实浏览器验证</h2><p>已有模型产物，432/320px。前三例的重复无效定位是明确标注的停止压力测试，不是模型新生成。乞力马扎罗复测的是已有真实业务错误。</p><div class="scroll"><table><thead><tr><th>场景</th><th>耗时</th><th>停止后</th><th>完整性</th><th>证据</th></tr></thead><tbody>${table}</tbody></table></div><p class="warn">墙中之鼠仍缺拖拽、真正计时和单屏详情；路线天数不一致仍待修。这里只证明停止/保留机制与所列路径，不代表整卡全功能通过。</p>
<h2>截图</h2><div class="gallery">${gallery}</div>
<h2>宿主可以不经模型恢复</h2><article><b>刷新预期自动修正：0模型调用 / ${(host.elapsedMs/1000).toFixed(2)}秒</b><p>真实 GLM 写出的 reload changed:true 与宿主恢复证据冲突。宿主只修正这条预期，同源码重跑；其他状态断言与原失败保留。</p><a href="host-repair.json">纠错前后步骤与结果</a></article>
<h2>真实 GLM 续调：保留失败证据</h2><p>第一轮144.03秒，最终输出截断。第二轮${(live.elapsedMs/1000).toFixed(2)}秒、4次调用，仍把“放入行动槽”误判成已经执行行动；刷新路径通过，最后却只输出结束说明。两个原始运行都没有完整通过交付。</p><p>新宿主对截断/未提交版本提供确定性兜底。用第二轮录制的模型输出重新跑浏览器，${(recovery.elapsedMs/1000).toFixed(2)}秒、0新增模型调用，保留同一源码为 partial，并留下未通过需求。不会再因一句结束说明发起整卡重写。</p><p><a href="live-model/result.json">第一轮失败</a> · <a href="live-model-v2/model-trace.json">第二轮真实请求/响应</a> · <a href="live-model-v2/result.json">第二轮耗时与压缩</a> · <a href="replay-v2/result.json">宿主恢复验证</a></p>
<details><summary>查看墙中之鼠剩余局部任务</summary><ol>${recovery.retained.remainingTasks.map(t=>`<li><b>${esc(t.requirement||t.target)} · ${esc(t.lane)}</b><br>${esc(t.reason)}</li>`).join('')}</ol></details>
<h2>边界与下一步</h2><ul><li>不自动更改业务数值、胜负、药量、日期关系等语义；宿主不是答案裁判。</li><li>单次模型返回前的长思考尚未缩短。本轮优化的是多轮尾部、上下文重复和交付协议。</li><li>需求拆解仍可能偏粗；要进一步细分拖拽、计时、详情等可独立验证的功能点。</li><li>可继续宿主化无歧义定位修复、依赖重验、语法规范化；不能自动翻页后冒称单屏可达。</li></ul>
<footer><a href="design-and-results.md">设计与完整结论 Markdown</a> · <a href="historical.json">历史回放账本</a> · <a href="unit-tests.txt">117项回归</a><p><small>只更新本地，没有发布 GPT Site。用户原卡片未改写；截图和所有失败保留。</small></p></footer></html>`
await writeFile(root+'/report.html',html)
const files=['report.html','design-and-results.md','historical.json','results.json','host-repair.json','unit-tests.txt','rats','shopping','motion','kilimanjaro','live-model','live-model-v2','replay-v2']
for(const dest of ['public/debug-progress-qa','dist/debug-progress-qa']){await mkdir(dest,{recursive:true});for(const f of files)await cp(`${root}/${f}`,`${dest}/${f}`,{recursive:true})}
console.log('Report: /debug-progress-qa/report.html')
