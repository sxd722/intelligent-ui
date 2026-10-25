import {readFile,writeFile} from 'node:fs/promises'
const dir='artifacts/react-capability-20261020'
const read=n=>readFile(dir+'/'+n,'utf8').then(JSON.parse)
const [rows,compat,browser,protocol,probes]=await Promise.all(['rechecked.json','compatibility.json','browser.json','protocol.json','host-probes.json'].map(read))
const check=a=>a.recheck||a.check
const median=xs=>{const a=xs.filter(Number.isFinite).sort((a,b)=>a-b),n=a.length;return n%2?a[n>>1]:(a[n/2-1]+a[n/2])/2}
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length
const stats=arm=>{
 const r=rows.filter(r=>r.arm===arm),cp=compat.filter(r=>r.arm===arm)
 return {arm,n:r.length,compile:r.filter(r=>check(r.attempts[0]).compile).length,render:r.filter(r=>check(r.attempts[0]).render).length,first:r.filter(r=>check(r.attempts[0]).restore).length,
 recovered:r.filter(r=>r.attempts.some(a=>check(a).restore)).length,compatible:cp.filter(r=>check(r.attempts[0]).restore).length,
 medianSeconds:median(r.map(r=>r.attempts[0].ms))/1000,promptTokens:mean(r.map(r=>r.attempts[0].usage.prompt_tokens)),outputTokens:median(r.map(r=>r.attempts[0].usage.completion_tokens)),
 calls:r.reduce((n,r)=>n+r.attempts.length,0),promptChars:protocol[arm].length}
}
const summary={model:protocol.model,arms:['baseline','compact'].map(stats),browser:{samples:browser.length,horizontal:browser.filter(b=>b.metrics?.some(m=>m.horizontal)).length,vertical:browser.filter(b=>b.metrics?.some(m=>m.vertical)).length},calls:rows.reduce((n,r)=>n+r.attempts.length,0)}
await writeFile(dir+'/summary.json',JSON.stringify(summary,null,2))
const pct=(n,d=16)=>`${n}/${d}（${(100*n/d).toFixed(1)}%）`
const table=summary.arms.map(s=>`| ${s.arm==='baseline'?'现有提示':'短契约＋单例'} | ${pct(s.first)} | ${pct(s.recovered)} | ${pct(s.compatible)} | ${s.medianSeconds.toFixed(1)} s | ${s.promptTokens.toFixed(0)} / ${s.outputTokens.toFixed(0)} |`).join('\n')
const md=`# React / SVG 模型能力实验 — 2026-10-20

结论：先解决宿主能力错配，再缩短提示。短契约的收益有方向性，但 16 份/组不足以证明统计显著；不能声称开放任务已稳定达到 94%。

| 配置 | 首次完整通过 | 至多一次诊断修复后* | 只补 SVG marker，原稿重放 | 首次耗时中位数 | 平均输入 / 中位输出 tokens |
|---|---:|---:|---:|---:|---:|
${table}

“完整通过”覆盖 QuickJS 初始渲染、指定多步动作、计算结果、状态保留/恢复；不等于美观评分。两组温度0.4、5000输出token上限、同一 glm-5.3-flash、同一结构化brief、360×320沙箱、每组8类×2轮、并发2。每组交错请求，未设置随机种子；缓存和网络会影响耗时。

* 修复率来自此次实验的完整诊断（含运行时/交互）；云端现状只修复编译错误，不能把此数字当成线上现有通过率。测试初版对动态标签过于严格，造成不必要修复，之后用可见控件语义重新定位并重放全部原文；原记录未覆盖。报告的“修复后”保留已通过首稿，只对失败首稿看后续产物，不能替代一次干净的确认试验。共实际调用模型 ${summary.calls} 次，其中32次首稿，其余是已保存的修复；宿主兼容和浏览器复验不调用模型。

## 共性原因与优先级

1. **P0：把能力边界交给宿主维护。** marker/markerEnd 是真实首稿最集中失败源。隔离实验仅允许同文档引用的 SVG marker，远程 URL 仍拒绝，原稿通过率从20/32提高至28/32。生产还需同步 SVG 属性映射和浏览器安全回归，不能只加标签白名单。pattern 同样常见，但本轮未放开；foreignObject 保持禁止。
2. **P0：统一预检与一次修复预算。** 云端 JSX 能编译不代表能运行；线上原稿直接引用 window.matchMedia，另一份坐标交互调用 currentTarget.getBoundingClientRect。前者首次渲染即可发现，后者要执行事件才出现。共享契约 → AST禁止真实外部导入/DOM调用 → QuickJS渲染与有限事件预演 → 有诊断的一次修复，失败保留原生。不要开放 window/DOM、伪造空API或对每个失败无限续写。云端可先做静态检查，浏览器隔离预检的结果回传至同一次修复预算。
3. **P0：资料更新必须参与验收。** 三份可首次交互的候选筛选原稿，在新增一个同schema条目后崩溃：位置数组或ID→坐标映射写死。从工具结果推导布局，另给一个新增/空数据用例；测试输入变化而非只重放原数据。计数未混入上表固定输入通过率。
4. **P1：短正向契约＋按需示例。** 提示从1959字符降到1333字符，输入token约减少19%；首次生成中位耗时下降见表。明确“宿主负责减少动态效果和持久化”，保留状态替换示例。坐标任务额外一个 event.x/y 示例即可，不把全部API清单塞进每次提示。保证控件有可访问名称和键盘等价操作。
5. **P1：改用语法结构检查模块边界。** 当前正则会把合法正文或注释里的 import 误判为导入，已用合成样例证实。检查 AST 的 Import/Export 节点；不要用任意删除 import 语句的方式补救。真实 default export 词序错误仍应作为语法错误修复。
6. **P1：空间/视觉验收单列。** ${browser.length}份可首屏渲染原稿检查320/360/432px，${summary.browser.horizontal}份横向溢出，${summary.browser.vertical}份超过320px内容高度。截图抽查：1-quiz-compact在浅色宿主背景上用了浅色标题/重来按钮，且SVG点击节点没有键盘等价操作；1-budget-baseline的底部说明需要滚动；1-energy-compact有清晰的状态反馈。它们不应白屏，但并非一屏体验合格。下一版提供少量一致的前景/背景token与控件基样式，不要让模型重复猜宿主底色。本轮没有人工盲评，不以SVG数量代表质量。

## 下一轮建议

先在本地以“短契约 + 同源SVG基础能力 + 静态/运行时预检 + 单次诊断修复”建立候选版本；固定预算和原生回退。再跑未见过的12类开放brief、数据增删、多个尺寸和用户操作，由浏览器实测交互与盲评视觉。先不用更大模型或追加规划调用：本批没有证据表明算力不足是主要原因。通过率和生成耗时分别计首稿/修复后，并单列运行时错、交互错、契约不支持、布局错。

## 范围与保存

本次只测试独立React表面；未跑完整CardSpec规划、CLI实时取数、用户自由prompt端到端，不是全站正确率。未修改生产生成链路、未构建/发布GPT Site、未重启8787或触碰OpenCLI/Owl。候选SVG支持仅在artifacts目录的实验VM。

- protocol.json：原始prompt、8类任务和配置。
- results.json：原始诊断（含选择器误报）；rechecked.json：语义定位后重放；compatibility.json：原文在候选SVG宿主重放。
- 每条JSON：完整模型正文、推理、usage、耗时、代码、前后状态与错误。
- browser.json / screens/：真实浏览器布局数据和首稿截图。
- host-probes.json：误判/边界微型复现。
`
await writeFile(dir+'/REPORT.md',md)
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const names={energy:'能源模拟',budget:'预算联动',filter:'候选筛选',process:'流程推进',quiz:'预测揭晓',residual:'FFN/残差',position:'空间坐标',queue:'队列状态机'}
const statsHTML=summary.arms.map(s=>`<tr><td>${s.arm==='baseline'?'现有提示':'短契约＋示例'}</td><td>${pct(s.first)}</td><td>${pct(s.recovered)}</td><td>${pct(s.compatible)}</td><td>${s.medianSeconds.toFixed(1)}s</td><td>${s.promptTokens.toFixed(0)} / ${s.outputTokens.toFixed(0)}</td></tr>`).join('')
const samples=rows.map(r=>{
 const a=r.attempts[0],c=check(a),b=browser.find(b=>b.id===r.id),cp=check(compat.find(x=>x.id===r.id).attempts[0])
 return `<article data-arm="${r.arm}"><div class="meta">${esc(r.id)}</div><h3>${names[r.case]} <span class="${c.restore?'pass':'fail'}">${c.restore?'首稿通过':'首稿失败'}</span></h3>${b&&!b.error?`<img loading="lazy" src="screens/${r.id}.png" alt="${esc(names[r.case])}首稿"/>`:''}<p>${esc(c.error?.message||'多步交互与状态恢复通过')}</p><p class="meta">首稿 ${(a.ms/1000).toFixed(1)}s · SVG兼容重放 ${cp.restore?'通过':'失败'}${c.dataRefresh===false?' · 新增数据失败':''}${b?.metrics?.some(m=>m.vertical)?' · 需要纵向滚动':''}</p><details><summary>查看首稿源码</summary><pre>${esc(a.raw)}</pre></details><a href="${r.id}.json">完整 trace JSON</a></article>`
}).join('')
const findings=md.split('## 共性原因与优先级')[1].split('## 范围与保存')[0]
await writeFile(dir+'/report.html',`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>React/SVG 生成能力实验</title><style>
*{box-sizing:border-box}body{margin:0;background:#f0f3f7;color:#192b3e;font:15px/1.65 system-ui}main{max-width:1240px;margin:auto;padding:40px 24px}h1{font-size:36px;line-height:1.2}h2{margin-top:36px}.eyebrow,.meta{color:#62738a;font-size:13px}.lead{max-width:800px;font-size:19px}.notice{padding:18px 24px;background:#fff2d4;border-radius:16px}table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden}td,th{padding:14px;text-align:left;border-bottom:1px solid #edf0f4}th{color:#53637a;font-size:13px}.scroll{overflow:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}article{background:white;border-radius:18px;padding:20px;min-width:0}article img{display:block;max-width:100%;height:320px;object-fit:contain;background:#edf1f6;border-radius:12px}h3{font-size:17px}.pass,.fail{font-size:12px;float:right;padding:3px 8px;border-radius:8px;background:#e6f6ed;color:#18733f}.fail{background:#ffeae4;color:#9c3d24}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 monospace;max-height:400px;overflow:auto}a{color:#2463a5}button{border:0;background:white;padding:10px 18px;border-radius:20px;margin:0 8px 16px 0;cursor:pointer}.findings{white-space:pre-wrap;background:white;padding:24px;border-radius:18px}.foot{font-size:13px;color:#62738a}
</style><main><div class="eyebrow">LOCAL RESEARCH · GLM-5.3-FLASH · 2026-10-20</div><h1>更可靠的 Web 创作，<br>先让模型与宿主说同一种话。</h1><p class="lead">8类任务 × 2轮 × 2种提示，32份首稿。短提示有帮助，但最大的可测收益来自补齐安全的SVG能力，而不是再加模型调用。</p><p class="notice">宿主兼容结果为离线原稿重放，尚未发布。修复率来自实验诊断，不能当成当前云端通过率。固定简短任务也不能代表开放请求的成功率。</p><h2>正确率与成本</h2><div class="scroll"><table><tr><th>提示</th><th>首稿完整通过</th><th>≤1次诊断修复*</th><th>SVG marker兼容重放</th><th>首稿中位耗时</th><th>平均输入/中位输出token</th></tr>${statsHTML}</table></div><p class="foot">共${summary.calls}次真实模型调用。测试选择器误报已通过原文重放校正，保留全部旧诊断；修复后数据存在受误报触发修复的限制，下一轮需干净确认。首次成功率和SVG重放不依赖新增模型调用。</p><h2>下一轮怎么做</h2><div class="findings">${esc(findings)}</div><h2>首稿画廊与逐例证据</h2><button onclick="filter('all')">全部</button><button onclick="filter('baseline')">现有提示</button><button onclick="filter('compact')">短契约</button><div class="grid">${samples}</div><h2>可复查材料</h2><p><a href="REPORT.md">完整分析与限制</a> · <a href="protocol.json">实验协议与prompt</a> · <a href="summary.json">汇总JSON</a> · <a href="host-probes.json">宿主边界复现</a> · <a href="browser.json">浏览器验证</a></p><p class="foot">没有变更GPT Site、应用服务或OpenCLI/Owl连接。本报告代码区只显示文本，不运行模型源码。</p></main><script>function filter(arm){document.querySelectorAll('article[data-arm]').forEach(n=>n.hidden=arm!=='all'&&n.dataset.arm!==arm)}</script></html>`)
console.log(JSON.stringify(summary,null,2))
