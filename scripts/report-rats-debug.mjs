import {readFile,writeFile,mkdir,cp} from 'node:fs/promises'
const root='artifacts/rats-debug-qa'
const read=async name=>JSON.parse((await readFile(`${root}/${name}`,'utf8')).replace(/^\uFEFF/,''))
const [summary,rounds,replay,correction]=await Promise.all(['summary.json','rounds.json','replay.json','model-correction/result.json'].map(read))
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const names={altar:'四阶段 → 祭坛结局 → 刷新 → 重开',bankruptcy:'金钱 8→6→4→2→0 → 破产',sanity:'理智耗尽 → 疯狂',truth:'四次阅读 → 真相线索 → 恢复 → 理性结局','clue-direct':'直接点击线索 → 查看详情 → 返回','clue-navigation':'选择线索 → 翻到第 2 屏 → 恢复 → 返回'}
const causes=[
 ['测试预期','阅读被断言为扣钱；只读一次就预期第二阶段；多次调用误以为共享前次状态。','实现本身按当前规则执行；不应为了满足错误预期改业务代码。新定向测试还复现 reload changed:true 的误判。'],
 ['模型实现 / 布局','点击线索后 sel 正确，但详情与返回落在第 2 屏。拖拽、真正计时推进没有实现。','主玩法可用不等于全部需求完成。单屏体验、拖拽和计时仍未达成；原产物没有被本轮改写。'],
 ['宿主契约 / 验收','富文本按钮可访问名称与模型猜测不符；分页不在失败反馈中明确展示；源码说明文字变化使旧验证版本失效。','最后一轮重放旧名称，产生大量无效定位；真实选择状态不等于用户看见反馈。'],
 ['宿主调试编排','同版本补测也重发源码；独立路径覆盖不累计；无工具游戏仍跑工具空结果/失败探针；partial 与 failed 交替逃过相同错误停机。','模型累计接收约 131 万 input tokens；多数耗时不在浏览器。部分完成标记也混合了沙箱覆盖提示与真实缺项。']
]
const roundNotes={1:'动作超过 16 步：真实编译契约错误',2:'猜测按钮名称，定位失败',3:'主玩法路径已通过；约第 14m50s',4:'错误 money=6 断言，阅读实际保持 8',5:'修正预期后通过',6:'详情不可见，实际在第二屏',7:'改布局/实现仍未解决分页',8:'继续改写，详情测试仍失败',9:'终检重放旧错误金额预期',10:'修改名称/实现，详情仍受分页影响',11:'继续测试详情，未收敛',12:'主玩法与结局通过',13:'一次阅读误预期阶段 2',14:'新测试从初始状态运行，前提仍不足',15:'明确翻至第二屏后详情/返回通过',16:'理智耗尽结局通过',17:'仅 intro/outro 变化却重验；旧定位路径失效，86 个动作未完成'}
const md=`# “墙中之鼠”42 分钟调试复盘

日期：2026-11-10。原请求：${summary.requestId}。模型 glm-5.3-flash，direct / hybrid / quick，extendedGeneration=true。

## 结论

不是持续 42 分钟有效实现：约 14 分 50 秒主玩法已有通过证据，后续在错误测试预期、分页下的不可见详情、旧路径重放之间循环，未持续收敛。当前产物有可玩的逻辑，但不满足全部原始需求。

| 指标 | 原始运行 |
|---|---:|
| 总耗时 | 42 分 46.6 秒 |
| 模型调用 / 调试记录 / 源码版本 | 18 / 17 / 8 |
| 编译、浏览器与保留路径检查累计 | 303,982ms，约 5 分 04 秒 |
| 其他时间 | 约 37 分 43 秒，主要为模型生成、等待及往返；不是精确 GPU 计算时间 |
| 累计 input / output tokens | 1,314,397 / 147,223 |
| 累计 reasoning tokens | 46,313 |
| 最大单次 input tokens | 116,518 |
| 首次调用 | 约 581 秒，25,740 reasoning tokens |
| 外部事实数据调用 | 0；另有一次把沙箱 ID 当 dataset ID 的无效读取 |

## 原因分类

${causes.map(c=>`### ${c[0]}\n\n${c[1]}\n\n${c[2]}`).join('\n\n')}

## 多轮是否收敛

${rounds.map(r=>`- 第 ${r.n} 轮：${r.status}，${(r.ms/1000).toFixed(2)}s，源码 ${r.version}。${roundNotes[r.n]||''}`).join('\n')}

第 17 轮源码与此前版本的可执行卡片内容相同，主要是外围说明改变；没有使用 card_commit 复用已测试版本。重放的旧定位与新标签不匹配。UI 中“修复次数 2”只计外层修复，不代表只有两次调试。partial 也不是卡死：沙箱的覆盖提示可以长期保留；实际需求缺失必须另行记录。

## 原产物独立验证

使用原源码，不修改游戏。432/320px，两种宽度、自然高度；隔离 Chrome，无需工具。共 6 条路径，5 条通过，1 条直接详情路径失败。

| 路径 | 结果 | 用时 |
|---|---|---:|
${replay.map(r=>`| ${names[r.id]} | ${r.passed?'通过':'失败'} | ${(r.elapsedMs/1000).toFixed(2)}s |`).join('\n')}

直接详情失败：state.sel 已变，预期详情和返回不在当前屏。手动转到第 2 屏后可读、可返回、可刷新恢复。在用户现有 Owl 页面也实际检查了详情、返回、保留线索；全屏组合在一次选中后会自动切页，说明行为受布局/容器条件影响，不能以全屏通过覆盖 320/432 嵌入态问题。用户游戏进度保留，未重置。

未达成：拖卡入槽、真正计时/异步推进、一屏完整操作；原文引用及忠实度未经事实核验。动画主视觉能响应阶段变化，但布局空白多、氛围和信息层级弱。不能把功能路径通过等同于设计验收通过。

## 本轮通用修改（已加载本地 8787）

1. 保存候选后始终可使用 card_retest(version, steps)，增加路径或修测试无需重新输出源码。
2. 同源码 + 同上下文累计已通过的行为/CUJ 覆盖；保留当前失败，源码变化使旧证据失效。当前执行 evidence 与累计覆盖分开，避免污染深度构建验收。
3. 失败反馈增加关键前置状态、每次调用从初始状态启动的说明，以及可见分页入口。内容/设计 review 与可执行交互缺项分开。
4. 没有工具绑定的卡片跳过无关的空结果/失败工具探针；显式指定的异常场景继续测试。
5. 刷新恢复成功且没有等待或自主变化时，把 changed:true 冲突归类为测试问题。仅修这条预期，其余状态断言、原失败记录和同源码复跑要求全部保留。

79 项相关单元/集成回归通过，含深度构建、防能力缩水、联动、需求规划和测试预期分类。只重启本项目 Node 应用；OpenCLI daemon PID 17048、bound session 均与检查前一致。

## 真实 GLM 的小范围验证

第一次定向调用仍写出 reload changed:true，实际恢复成功而断言失败；保留原始错误 trace。新的分类反馈下，一次 GLM 调用在 **10.348 秒**内修正测试，输出 956 字符，而不是再输出 12,845 字符源码；3380 input / 461 output tokens。未改一行产物源码，432/320px 测试通过并提交相同候选。整个需求覆盖仍是 partial，不冒充全卡通过。

这验证了测试修正链路，不是完整重生成的前后对照。不能据此声称整卡已从 42 分钟降到 10 秒。

## 下一步缩时优先级

1. **按新增证据停止，而非追逐 passed 标签。** 同实现反复 partial、无新行为覆盖时交付可用候选和缺项，转审查；不是持续扩写测试。
2. **以可执行代码而非外围说明作为复用边界。** 首选 card_commit；后续可单独哈希逻辑、布局与介绍文字，避免只改 outro 就重播全部路径。
3. **隔离规划/实现/测试上下文。** 固定精简规则与状态表；测试轮只给版本、前置状态、失败步骤、差异和覆盖摘要。旧完整源码/思考不反复累加；补测低推理强度即可。本轮只落实了版本补测与紧凑反馈，完整历史压缩仍待实现。
4. **拆分真正缺失的能力。** 先保持已验证资源/结局逻辑，再独立补单屏详情、拖拽、计时。模块分别提交，不让一个 UI 可见性问题反复改写整个游戏。
5. **完整耗时对照后再承诺目标。** 首次设计已近 10 分钟，首条主路径近 15 分钟；还需用精简上下文和小模块方案重新生成，才能验证 2–5 分钟目标。未锚定的数值预期错误仍需规则表/独立审查，不能把代码实际值自动当正确答案。

## 证据

- HTML： http://127.0.0.1:8787/rats-debug-qa/report.html
- 原运行：artifacts/rsi-adaptive/runs/${summary.requestId}.json
- 原 17 轮：artifacts/generation-debug/33ac00ef-3141-4e37-9990-53ada6b66cb4
- 本轮原源码、各步骤截图、6 条浏览器 trace、两次模型原始返回：artifacts/rats-debug-qa/
- 复测脚本：scripts/qa-rats-debug.mjs、scripts/qa-rats-retest-model.mjs、scripts/qa-rats-retest-correction.mjs
- 本次仅更新本地，没有发布 GPT Site。
`
await mkdir('docs',{recursive:true});await writeFile('docs/RATS-DEBUG-REVIEW.md',md)
const rows=rounds.map(r=>`<tr><td>${r.n}</td><td class="${r.status==='failed'?'bad':'warn'}">${esc(r.status)}</td><td>${(r.ms/1000).toFixed(2)}s</td><td>${esc(roundNotes[r.n])}</td></tr>`).join('')
const results=replay.map(r=>`<tr><td>${esc(names[r.id])}</td><td class="${r.passed?'good':'bad'}">${r.passed?'通过':'失败'}</td><td>${(r.elapsedMs/1000).toFixed(2)}s</td><td><a href="replay/${r.id}/trace.json">trace</a> · <a href="replay/${r.id}/normal-320.png">320px</a> · <a href="replay/${r.id}/normal-432.png">432px</a></td></tr>`).join('')
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>墙中之鼠 · 调试收敛复盘</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#10131a;color:#e5e9f1}body{max-width:1140px;margin:0 auto;padding:40px 22px;line-height:1.65}h1{font-size:clamp(28px,5vw,46px);line-height:1.2}h2{margin-top:48px}h3{margin-top:28px}a{color:#9cc5ff}p,li{max-width:950px}small,.muted{color:#9ba9bf}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpis>div,article{padding:20px;background:#1b222e;border-radius:16px}.kpis b{display:block;font-size:30px}.good{color:#80dfb3}.bad{color:#ffa6a6}.warn{color:#f5cd86}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;padding:13px 12px;border-bottom:1px solid #313a49;vertical-align:top}th{color:#9ba9bf}.gallery{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}img{max-width:100%;border-radius:12px}figcaption{color:#adbad0;margin:8px 0 20px}.bar{display:flex;height:36px;border-radius:8px;overflow:hidden}.bar span{display:flex;align-items:center;justify-content:center;font-size:13px;background:#38568b}.bar span:last-child{background:#236b63}details{margin:20px 0}summary{cursor:pointer;color:#9cc5ff}@media(max-width:650px){.kpis{grid-template-columns:1fr 1fr}.gallery{grid-template-columns:1fr}body{padding:24px 16px}}
</style><header><p class="muted">LOCAL QA / 2026-11-10 / 原产物未修改</p><h1>42 分钟，<br>并不等于 42 分钟有效进展。</h1><p>约第 <b>14 分 50 秒</b>主玩法已有通过证据。后续主要围绕错误测试、分页可见性与旧路径重放循环。当前卡片可玩，但拖拽、计时和单屏体验仍未完成。</p></header>
<div class="kpis"><div><small>原始耗时</small><b>42m 47s</b></div><div><small>模型 / 调试轮次</small><b>18 / 17</b></div><div><small>源码版本</small><b>8</b></div><div><small>独立路径通过</small><b>5 / 6</b></div></div>
<h2>时间花在哪里</h2><div class="bar"><span style="width:88.16%">模型生成、等待与往返 ≈ 37m43s</span><span style="width:11.84%">检查 ≈ 5m04s</span></div><p>累计 input 1,314,397 / output 147,223 tokens；reasoning 46,313。最大单次输入 116,518 tokens，首次调用约 581 秒。检查时间包含编译、浏览器与保留路径；余量不能精确等同于 GPU 推理时间。</p>
<h2>三类问题，不能用同一种修复</h2><div class="scroll"><table><thead><tr><th>类别</th><th>观察</th><th>判断</th></tr></thead><tbody>${causes.map(c=>`<tr>${c.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<h2>当前产物与详情证据</h2><div class="gallery"><figure><a href="live-overview.png"><img src="live-overview.png" alt="当前卡片与 Stitch 对照的实际浏览器截图"></a><figcaption>当前 Owl 页面：留白较多，主视觉小，动作集中底部。功能证据不能替代设计验收。</figcaption></figure><figure><a href="live-detail-verified.png"><img src="live-detail-verified.png" alt="实际点击后查看线索详情"></a><figcaption>线索内容存在，选择状态正确；嵌入态 320/432 的直接详情路径需翻页。全屏表现存在差异。</figcaption></figure></div>
<h2>原源码关键交互复测</h2><p>432/320px，自然高度，隔离浏览器。没有改游戏代码，也没有替换成手写成功样板。失败行保留。</p><div class="scroll"><table><thead><tr><th>路径</th><th>结果</th><th>耗时</th><th>证据</th></tr></thead><tbody>${results}</tbody></table></div><p class="warn">尚缺：拖拽、真正计时推进、单屏布局。原文引用未核验。当前测试不证明全部原需求完成。</p>
<details><summary>展开原 17 轮调试记录</summary><div class="scroll"><table><thead><tr><th>轮次</th><th>状态</th><th>检查耗时</th><th>实际变化</th></tr></thead><tbody>${rows}</tbody></table></div></details>
<h2>已加载本地的通用优化</h2><ol><li>保存候选后始终可按版本补测，不再为了追加测试重发源码。</li><li>同版本累计已通过的 CUJ/行为覆盖，当前失败仍保留。当前执行证据与累计覆盖分开。</li><li>反馈补充前置状态、fresh-start 语义和分页入口；内容/设计审查与可执行缺项分开。</li><li>无工具绑定时跳过无关工具空结果/失败探针，显式异常场景保留。</li><li>刷新恢复成功与 changed:true 冲突时，只修测试；其余断言及重新实测要求保留。</li></ol><p class="good">79 项回归通过。8787 已加载修改；OpenCLI daemon 和 bound session 与重启前一致。</p>
<h2>真实 GLM：缩小修复单位有用</h2><article><b>10.348 秒 / 1 次调用 / 0 行源码变更</b><p>第一轮真实 GLM 再次把“刷新恢复”误写成“必须发生改变”。提供宿主恢复证据后，模型仅修正测试，956 字符输出替代重复输出 12,845 字符源码，432/320px 通过。3380 input / 461 output tokens。</p><p class="warn">这是测试修正实验，不是从头生成对照；整体需求覆盖仍为 partial，不能宣称整卡降到 10 秒。</p><a href="model-retest/model-trace.json">首次错误输出</a> · <a href="model-correction/model-trace.json">修正输出</a> · <a href="model-correction/trace.json">修正过程</a> · <a href="model-correction/result.json">结果摘要</a></article>
<h2>进一步缩时：按证据收敛</h2><ol><li>无新增行为覆盖就停止扩写测试，交付可用候选与明确缺项；不要为了消灭 partial 警告反复改整卡。</li><li>优先 card_commit；后续将外围说明与可执行代码的验证身份分离。</li><li>规划、实现、测试分别使用紧凑上下文。完整历史压缩仍待实现，不能承诺已消除 116k 输入。</li><li>详情、拖拽、计时分别补齐，保留已验证资源与结局逻辑。</li><li>再做完整重生成对照，验证 2–5 分钟目标；目前没有该目标的实测证据。</li></ol>
<footer><a href="review.md">详细 Markdown</a> · <a href="summary.json">耗时用量</a> · <a href="rounds.json">原轮次证据</a> · <a href="original.cardspec">原 CardSpec</a> · <a href="unit-tests.txt">79 项测试</a><p class="muted">仅本地更新；没有发布 GPT Site。原请求 ${summary.requestId}。</p></footer></html>`
await writeFile(`${root}/report.html`,html);await writeFile(`${root}/review.md`,md)
const files=['report.html','review.md','summary.json','rounds.json','replay.json','unit-tests.txt','original.cardspec','live-overview.png','live-detail-verified.png','model-retest','model-correction','replay']
for(const dest of ['public/rats-debug-qa','dist/rats-debug-qa']){await mkdir(dest,{recursive:true});for(const f of files)await cp(`${root}/${f}`,`${dest}/${f}`,{recursive:true})}
console.log(JSON.stringify({report:'/rats-debug-qa/report.html',paths:replay.length,passed:replay.filter(r=>r.passed).length,modelCorrection:correction.passed}))
