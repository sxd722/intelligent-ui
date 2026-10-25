"""Build the local, evidence-linked HTML/CardSpec reference report. No model calls."""
import csv
import html
import json
import pathlib
import shutil
import statistics

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'artifacts/html-reference-2026-10-16'
read = lambda name: json.loads((OUT / name).read_text(encoding='utf-8'))
manifest, runs, qa, layouts = (read(n) for n in ['manifest.json', 'summary.json', 'ui-qa.json', 'layout-qa.json'])
esc = lambda s: html.escape(str(s))
formats = ['html', 'cardspec']
names = ['计数与备注', '喝水进度', '20项清单', '组合筛选', '支出增删', '费用分摊', '报名表单', '闰年月历', '三步独立备注', '负数柱图', '学习导图', '回退流程图', '长文阅读', '答题计分', '资源回合游戏', '七天分支剧情', '卡牌战斗', '分类编年史', '图片与收藏', '购物车快照']
lookup = {(r['id'], r['format']): r for r in runs}
stats = {}
for fmt in formats:
    group = [r for r in runs if r['format'] == fmt]
    times = [r['elapsed'] / 1000 for r in group]
    tokens, calls, planned = [], 0, 0
    for r in group:
        raw = read(f"{r['id']}-{fmt}.json")
        if fmt == 'html':
            usage = [a.get('usage') for a in raw['attempts'] if a.get('usage')]
        else:
            trace = raw['metadata'].get('research', {}).get('trace', [])
            usage = [t['usage'] for t in trace if t['type'] == 'research_model' and t.get('usage')]
            planned += any(t.get('tool') == 'plan_cards' for t in trace)
        calls += len(usage)
        if usage:
            tokens.append({'firstInput': usage[0]['prompt_tokens'], 'input': sum(u['prompt_tokens'] for u in usage), 'output': sum(u['completion_tokens'] for u in usage)})
    stats[fmt] = {
        'first': sum(r['firstPass'] for r in group),
        'delivered': sum(r['status'] == 'succeeded' for r in group),
        'repairCases': sum(r['repairCount'] > 0 for r in group),
        'fullCases': sum(q[fmt]['passed'] == q[fmt]['total'] for q in qa),
        'passed': sum(q[fmt]['passed'] for q in qa), 'total': sum(q[fmt]['total'] for q in qa),
        'beauty': statistics.mean(q[fmt]['beauty'] for q in qa),
        'interaction': statistics.mean(q[fmt]['interaction'] for q in qa),
        'pairedBeauty': statistics.mean(q[fmt]['beauty'] for q in qa if all(lookup[(q['id'], f)]['status'] == 'succeeded' for f in formats)),
        'medianSeconds': statistics.median(times), 'meanSeconds': statistics.mean(times), 'maxSeconds': max(times),
        'tokenCases': len(tokens), 'recordedCalls': calls, 'recordedPlanCases': planned,
        'tokens': {k: statistics.mean(t[k] for t in tokens) for k in tokens[0]},
        'overflow320': sum(l[fmt]['horizontalOverflow'] for l in layouts if l['width'] == 320),
        'overflow432': sum(l[fmt]['horizontalOverflow'] for l in layouts if l['width'] == 432),
    }
(OUT / 'metrics.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding='utf-8')

rows, details, markdown = [], [], []
source_dir = OUT / 'sources'
source_dir.mkdir(exist_ok=True)
csv_rows = []
for i, q in enumerate(qa):
    ident = q['id']; case = manifest['cases'][i]
    h, c = q['html'], q['cardspec']; hr, cr = (lookup[(ident, f)] for f in formats)
    hs, cs = hr['elapsed']/1000, cr['elapsed']/1000
    grade = lambda z: f"{z['passed']}/{z['total']}"
    badge = lambda z: f'<span class="badge {"ok" if z["passed"]==z["total"] else "partial"}">{grade(z)}</span>'
    rows.append(f'<tr data-search="{esc(names[i]+" "+ident+" "+h["note"]+" "+c["note"])}" data-failed="{str(h["passed"]<h["total"] or c["passed"]<c["total"]).lower()}"><td><a href="#{ident}">{i+1:02d} {names[i]}</a></td><td>{h["beauty"]} / {c["beauty"]}</td><td>{h["interaction"]} / {c["interaction"]}</td><td>{badge(h)} / {badge(c)}</td><td>{hs:.1f} / {cs:.1f}</td><td>{esc(h["note"])}<br><span class="muted">CS：{esc(c["note"])}</span></td></tr>')
    markdown.append(f'| {i+1:02d} {names[i]} | {h["beauty"]}/{c["beauty"]} | {h["interaction"]}/{c["interaction"]} | {grade(h)} · {grade(c)} | {hs:.1f}/{cs:.1f} |')
    csv_rows.append({'id': ident, '场景': names[i], 'HTML美观': h['beauty'], 'CardSpec美观': c['beauty'], 'HTML互动': h['interaction'], 'CardSpec互动': c['interaction'], 'HTML功能通过': grade(h), 'CardSpec功能通过': grade(c), 'HTML秒': round(hs,3), 'CardSpec秒': round(cs,3), 'HTML首轮生成': hr['firstPass'], 'CardSpec首轮生成': cr['firstPass'], 'HTML备注': h['note'], 'CardSpec备注': c['note']})
    for f in formats:
        raw = read(f'{ident}-{f}.json')
        (source_dir / f'{ident}-{f}.txt').write_text(raw['source'], encoding='utf-8')
    checklist = ''.join(f'<li>{esc(t)}</li>' for t in case['checks'])
    mobile = [l for l in layouts if l['id'] == ident]
    layout_text = '；'.join(f'{l["width"]}px：H {"横溢出" if l["html"]["horizontalOverflow"] else "无根级横溢出"} / CS {"未交付" if cr["status"]!="succeeded" else "横溢出" if l["cardspec"]["horizontalOverflow"] else "无根级横溢出"}' for l in mobile)
    details.append(f'''<article id="{ident}" class="case"><div class="case-head"><div><small>CASE {i+1:02d} · {esc(case['area'])}</small><h3>{names[i]}</h3></div><a class="button" href="http://127.0.0.1:8787/html-reference.html?case={ident}" target="_blank" rel="noopener">打开交互对照 ↗</a></div><p>{esc(case['prompt'])}</p><div class="shot-controls"><button data-width="432" aria-pressed="true">432px</button><button data-width="320" aria-pressed="false">320px</button><span>截图左：HTML · 右：CardSpec</span></div><a class="shot-link" href="screenshots/{ident}.png" target="_blank"><img class="shot" loading="lazy" src="screenshots/{ident}.png" data-base="screenshots/{ident}" alt="{names[i]} HTML 与 CardSpec 实际浏览器对照截图"></a><div class="notes"><section><b class="h-label">自由 HTML</b> {badge(h)}<p>{esc(h['note'])}</p><a href="sources/{ident}-html.txt" target="_blank">原始 HTML 源码</a></section><section><b class="c-label">CardSpec</b> {badge(c)}<p>{esc(c['note'])}</p><a href="sources/{ident}-cardspec.txt" target="_blank">原始 CardSpec 源码</a></section></div><details><summary>验收依据与尺寸记录</summary><ul>{checklist}</ul><p>{layout_text}</p><p>功能判定来自实际点击、输入、切换及结果读取；不是仅凭源码推测。触摸 swipe 未在真实移动设备验证。</p></details></article>''')

with (OUT/'comparison.csv').open('w', encoding='utf-8-sig', newline='') as file:
    writer = csv.DictWriter(file, fieldnames=csv_rows[0]); writer.writeheader(); writer.writerows(csv_rows)
(OUT/'comparison.md').write_text('| 场景 | 美观 H/C | 互动 H/C | 功能 H · C | 耗时秒 H/C |\n|---|---:|---:|---|---:|\n'+'\n'.join(markdown), encoding='utf-8')

H,C=stats['html'],stats['cardspec']
overview = [
    ('美观 · 432px，全部20例', f'{H["beauty"]:.2f}/5', f'{C["beauty"]:.2f}/5', '单一评审者的主观截图评分；未交付为1分。'),
    ('美观 · 双方均交付的18对', f'{H["pairedBeauty"]:.2f}/5', f'{C["pairedBeauty"]:.2f}/5', '排除两张未生成的CS，差距明显缩小；不能据此宣称普遍更美。'),
    ('互动体验 · 全部20例', f'{H["interaction"]:.2f}/5', f'{C["interaction"]:.2f}/5', '反馈、操作负担、语义可访问性与状态正确性综合，非按钮数量。'),
    ('功能验收 · 完整场景', f'{H["fullCases"]}/20', f'{C["fullCases"]}/20', '完整场景=该例所有既有检查项通过；不代表满足所有隐含要求。'),
    ('功能验收 · 检查点', f'{H["passed"]}/47', f'{C["passed"]}/47', '失败交付的检查项全部计失败。'),
    ('生成交付 · 首轮 → 修复后', f'{H["first"]} → {H["delivered"]}/20', f'{C["first"]} → {C["delivered"]}/20', 'HTML完整文档+JS语法，CS编译+富内容验证；严格程度不等，不能直接当可靠性。'),
    ('生成耗时 · 中位数', f'{H["medianSeconds"]:.1f}s', f'{C["medianSeconds"]:.1f}s', '当前端到端技术栈，包含修复和可选规划，非纯格式消融。'),
    ('生成耗时 · 均值 / 最慢', f'{H["meanSeconds"]:.1f}s / {H["maxSeconds"]:.1f}s', f'{C["meanSeconds"]:.1f}s / {C["maxSeconds"]:.1f}s', 'CS长剧情失败拉高均值。'),
    ('320px 根级横向溢出', '4/20', '0/18 已交付', 'HTML：支出、图表、答题、战斗；不把内部可滚动列表当作根级溢出。'),
    ('432px 根级横向溢出', '1/20', '0/18 已交付', 'HTML战斗；另有计数和喝水标题在视口上方被裁切。'),
]
overview_html=''.join('<tr>'+''.join(f'<{tag}>{esc(cell)}</{tag}>' for tag,cell in zip(['th','td','td','td'],row))+'</tr>' for row in overview)
latency_bars=''.join(f'<div class="bar-row"><span>{names[i]}</span><div><i class="bar html" style="width:{lookup[(q["id"],"html")]["elapsed"]/230000*100:.2f}%"></i><i class="bar cs" style="width:{lookup[(q["id"],"cardspec")]["elapsed"]/230000*100:.2f}%"></i></div><small>{lookup[(q["id"],"html")]["elapsed"]/1000:.1f} / {lookup[(q["id"],"cardspec")]["elapsed"]/1000:.1f}s</small></div>' for i,q in enumerate(qa))

document = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>自由 HTML vs CardSpec · 20例对照实验</title><style>
:root{--ink:#132b37;--muted:#596e77;--bg:#f3f5f2;--line:#dbe3df;--h:#167d73;--c:#7856ac}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1220px;margin:auto;padding:42px 28px 90px}a{color:#196a75;text-underline-offset:3px}h1{font-size:clamp(32px,5vw,58px);line-height:1.12;letter-spacing:-2px;margin:14px 0 22px}h2{font-size:28px;margin:48px 0 16px}h3{font-size:23px;margin:5px 0 12px}p{max-width:95ch}.eyebrow{font-size:12px;font-weight:800;letter-spacing:3px;color:var(--h)}.lede{font-size:19px;max-width:850px}.muted,small{color:var(--muted)}.hero{padding:26px 0 34px;border-bottom:1px solid var(--line)}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}.chips span{background:#e4ece7;padding:4px 11px;border-radius:30px;font-size:12px}.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:16px 0}.button,button{border:0;border-radius:9px;background:#deebe7;color:#17493e;padding:9px 14px;font:inherit;text-decoration:none;cursor:pointer}button:hover,.button:hover{background:#c9dfd8}button[aria-pressed=true]{background:#174f47;color:white}input,select{padding:10px;border:1px solid #c9d5cf;border-radius:8px;font:inherit;background:white;color:var(--ink)}.callout{background:#e5eee8;padding:20px 24px;border-radius:16px;margin:24px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.tile{background:#fff;padding:22px;border-radius:16px}.tile .number{font-size:36px;font-weight:750;letter-spacing:-1px}.tile p{margin:6px 0;color:var(--muted)}.table-wrap{overflow:auto;border-radius:14px;background:white}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:14px}th,td{padding:13px 15px;border-bottom:1px solid #e5eae6;text-align:left;vertical-align:top}thead th{background:#e8eee9;white-space:nowrap}tbody th{font-weight:550;min-width:220px}.comparison td:nth-child(1){min-width:160px}.comparison td:nth-child(2),.comparison td:nth-child(3),.comparison td:nth-child(4),.comparison td:nth-child(5){white-space:nowrap}.comparison td:last-child{min-width:380px;font-size:13px}.badge{display:inline-block;padding:2px 8px;border-radius:8px;font-size:12px;font-weight:700}.ok{background:#e2f2e8;color:#206641}.partial{background:#fff0d7;color:#875312}.h-label{color:var(--h)}.c-label{color:var(--c)}.two{display:grid;grid-template-columns:1fr 1fr;gap:22px}.panel{padding:22px;background:white;border-radius:16px}.panel h3{font-size:20px}.case{scroll-margin-top:20px;background:white;border-radius:20px;padding:24px;margin:24px 0}.case-head{display:flex;align-items:center;justify-content:space-between;gap:20px}.case-head small{letter-spacing:1px}.shot{width:100%;height:auto;display:block;border-radius:12px;background:#f6f6f6}.shot-controls{display:flex;align-items:center;gap:8px;margin:16px 0;font-size:13px;color:var(--muted)}.shot-controls button{padding:5px 13px}.notes{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}.notes section{background:#f3f6f2;padding:18px;border-radius:12px}.notes p{margin:10px 0}.notes a{font-size:13px}details{background:#f6f7f3;padding:12px 16px;border-radius:10px;margin:10px 0}summary{cursor:pointer;font-weight:600}li{margin:7px 0}code{background:#e7ece7;padding:2px 5px;border-radius:4px}.bars{background:white;padding:22px;border-radius:16px}.bar-row{display:grid;grid-template-columns:120px 1fr 130px;gap:12px;align-items:center;margin:11px 0;font-size:12px}.bar-row>div{background:#f2f4f1}.bar{display:block;height:6px;min-width:2px;margin:3px 0;border-radius:4px}.bar.html{background:var(--h)}.bar.cs{background:var(--c)}.foot{font-size:12px;color:var(--muted);margin-top:50px}@media(max-width:700px){main{padding:22px 14px}.grid,.two,.notes{grid-template-columns:1fr}.case{padding:15px}.case-head{display:block}.case-head .button{display:inline-block}.bar-row{grid-template-columns:85px 1fr 100px;gap:6px}.shot-controls{flex-wrap:wrap}}@media print{button,input,select,.toolbar{display:none}body{background:white}.case{break-inside:avoid}details{display:block}}
</style></head><body><main>
<header class="hero"><div class="eyebrow">LOCAL REFERENCE / 2026.10.16</div><h1>让 GLM 自由写 HTML，<br>会比 CardSpec 更好吗？</h1><p class="lede">在同一模型、同一组 20 个任务上，从生成结果走到真实交互。HTML 的表达更自由、当前链路更快；CardSpec 的小屏布局与控件语义更统一。两边都没有消除业务逻辑错误。</p><div class="chips"><span>GLM-5.3-flash</span><span>20题 × 2技术栈 · 各1轮</span><span>40次生成任务</span><span>47项功能检查 / 栈</span><span>320 / 360 / 432px</span><span>仅本地8787</span></div></header>
<div class="toolbar"><a class="button" href="http://127.0.0.1:8787/html-reference.html" target="_blank" rel="noopener">打开可交互 Reference ↗</a><a class="button" href="comparison.csv" download>下载 CSV 表格</a><a href="comparison.md">Markdown 表格</a><a href="#cases">逐例截图</a><a href="#method">实验边界</a></div>
<div class="grid"><div class="tile"><small>功能全项通过 · HTML / CS</small><div class="number">16 / 15 <small>例</small></div><p>共20例；生成成功不等于功能通过。</p></div><div class="tile"><small>端到端耗时中位数 · HTML / CS</small><div class="number">19.0 / 30.4 <small>s</small></div><p>包含各自当前生成链路的开销。</p></div><div class="tile"><small>320px 根级横溢出 · HTML / CS</small><div class="number">4 / 0 <small>例</small></div><p>CS分母18张已交付；其余2张未生成。</p></div></div>
<div class="callout"><b>结论：值得保留 HTML reference，但本轮不足以支持整体替换 CardSpec。</b><br>在双方均交付的18对中，美观均分仅为3.56 vs 3.39；完整功能通过差1例。更明确的差异是当前提示与调用链负担、内容表达自由度，以及小屏布局约束。下一步应先做精简 CardSpec 契约与规划开销的消融，再评估受限 HTML 作为局部复杂体验扩展。</div>
<h2>四个维度，分别看</h2><div class="table-wrap"><table><thead><tr><th>指标</th><th class="h-label">自由 HTML</th><th class="c-label">CardSpec direct</th><th>解释</th></tr></thead><tbody>__OVERVIEW__</tbody></table></div>
<h2>二十例结果表</h2><p class="muted">每个单元格均按 <b>HTML / CardSpec</b> 排列。美观、互动为1–5分；功能为通过项/检查项；耗时单位秒。美观分基于432px，移动宽度风险另列，不混成一个总分。</p><div class="toolbar"><input id="search" placeholder="筛选场景或问题" aria-label="筛选场景或问题"><select id="filter" aria-label="结果筛选"><option value="all">全部20例</option><option value="failed">任一栈功能未全通过</option></select><span id="count">20例</span></div><div class="table-wrap"><table class="comparison"><thead><tr><th>场景</th><th>美观 H/C</th><th>互动 H/C</th><th>功能 H/C</th><th>耗时 H/C</th><th>观察（首行H，次行CS）</th></tr></thead><tbody id="rows">__ROWS__</tbody></table></div>
<h2>时间差从哪里来</h2><div class="two"><section class="panel"><h3>比较的是当前技术栈</h3><p>HTML每例一次模型调用，20例没有触发语法修复。CardSpec沿用生产direct路径：18张成功产物的trace里，10例调用过<code>plan_cards</code>，另有修复或追加模型回合。不是两边各一次调用的纯DSL对照。</p><p>有usage记录的样本中，首个请求输入token均值：HTML <b>630</b>，CardSpec <b>11,637</b>。CardSpec契约与工具说明的上下文成本显著更高。不能从这轮实验判断究竟多少收益来自“熟悉HTML”，多少来自“更短提示、较少调用”。</p></section><section class="panel"><h3>输出更长，也可以更快</h3><p>有完整usage的样本，HTML每任务输出均值<b>1,819 tokens</b>；CS已记录回合合计输出均值<b>918 tokens</b>，输入合计均值<b>20,320 tokens</b>。CS是18个成功样本，HTML是20个，分母不同。</p><p>CS两例失败没有完整usage trace，不能计为零消耗。本轮包含图片准备/缓存差异、网关排队及修复；图片预取不计入HTML计时。CS元数据的image_resolution_ms全部为0，也不表示视觉资源无成本。</p></section></div><p class="muted"><span class="h-label">绿色：HTML</span> · <span class="c-label">紫色：CardSpec</span>。统一0–230秒比例，保留长尾失败。</p><div class="bars">__BARS__</div>
<h2>可复现的问题与根因判断</h2><div class="two"><section class="panel"><h3>CardSpec 的主要问题</h3><ul><li><b>契约边界：</b>组合筛选把<code>each</code>写进动作步骤；剧情action读取未传入的<code>args.reply</code>。校验发现问题，但一次修复仍未得到可交付卡片。</li><li><b>业务规则缺少守卫：</b>食堂选择没有锁定本回合已选择状态。第五回合重复点击节省餐，食材1→0、满意度−2→−3，违反一次结算。</li><li><b>有限空间被分散：</b>自动背景、过多统计块和额外后续入口压缩内容。自然观察把森林题图变成背景，小图署名列比内容还显眼。</li><li><b>显示语义：</b>购物车0数量商品留在明细；图表单位重复；知识练习额外解释“月球不绕太阳转”不准确。功能通过不能替代内容质量检查。</li></ul></section><section class="panel"><h3>自由 HTML 的主要问题</h3><ul><li><b>手势竞争：</b>导图父SVG在pointerdown捕获指针，节点click未产生详情；图画得完整不代表能交互。源码支持此根因推测，未修改产物后复验。</li><li><b>状态与显示脱节：</b>剧情分支函数计算了临时结果，但commit仍取原始空数据；第4/7天结果空白，重开仅重建事件未刷新指标。</li><li><b>漏需求：</b>自然观察仅切换每项收藏，未实现0–2的总数。编年史擅自扩写了给定数据之外的正文。</li><li><b>响应式失守：</b>图表、答题、战斗写死432宽；支出小屏也有溢出。计数与喝水纵向居中导致标题跑到视口上方；部分可点div/SVG无键盘语义。</li></ul></section></div><div class="callout"><b>共同偏差：</b>战斗把“法力恢复3”解释为每回合加3。空过五回合后，HTML显示10（另设上限），CS显示18。本报告按恢复到3的验收意图记失败；原prompt用词存在歧义，若业务本意是增加3，则该检查项不应判失败，两栈完整通过数均加1，技术栈间差距不变。</div>
<h2>对架构的建议</h2><ol><li><b>保留 CardSpec 作为宿主协议，先减少不必要的生成负担。</b>简单确定性任务不需要额外规划两次；按任务披露小契约，避免每题携带完整组件与工具手册。后续按钮应服务当前任务，避免机械占用空间。</li><li><b>复杂状态逻辑优先交给现有隔离 JS 模块。</b>把“每回合一次”“提交后快照”“重开刷新”作为可执行的不变量，配合短路径测试；换成HTML并不会自动解决这些逻辑问题。</li><li><b>将 HTML 保持为可选扩展实验。</b>它适合自定义图形、表现力强的局部交互。生产化仍需要宿主状态序列化、生命周期、尺寸、焦点、错误隔离及工具边界契约；本实验没有证明这些能力或HMOS加桌适配。</li><li><b>下一轮做消融而非继续泛化结论。</b>同一批任务比较“当前CS”“精简CS且无额外规划”“自由HTML”，统一图片与修复预算，多随机轮次、盲评，并保留逐步交互断言。</li></ol>
<h2 id="method">实验方法与可比性</h2><ul><li>2026-10-16，沿用<code>scripts/direct-benchmark-cases.mjs</code>全部20个原始prompt和47个既有检查项；不是抽样替代。各1轮，每题新会话；交错发送，跨两栈共享并发2。</li><li>模型<code>glm-5.3-flash</code>，temperature0.4、reasoningEffort low、输出上限8192；正方形默认432px。CS使用当前生产direct接口，不是experience模式。HTML系统提示没有CardSpec组件契约，允许自由HTML/CSS/JS、SVG/canvas。</li><li>关闭CLI取数与实际工具执行；CS的规划工具仍可用，其生成的后续按钮在reference中禁用。未要求的禁用后续按钮不作为核心功能失败，但其布局占用会影响观感。没有调用OpenCLI、解绑、关闭或重启Owl。</li><li>HTML使用无同源权限的sandbox iframe，允许脚本和本地表单事件；CSP禁止connect与表单网络提交，只允许给定本地媒体图片。早期容器禁止form事件的问题已修正后复测，未修改模型源码。本轮不是安全审计，也不代表可直接上线任意HTML。</li><li>图片能力不完全对称：HTML预先获得森林/鸟/叶三张示意照片URL及来源；CS使用现有query与图片宿主，二者共享缓存。外部库/CDN、真实提交、存储与网络查询不在HTML范围。</li><li>HTML仅检查完整文档和JS语法，失败最多修一次；CS沿用编译、富内容检查及一次修复。交互测试发现的问题没有人工修补，以保留模型原始表现。</li><li>20对均在浏览器检查，38张已交付产物进行实际交互；三种卡片宽度共120个展示位置（114个卡片面、6个失败位置）做DOM布局测量，保存432px与320px对照截图。根级宽度检查不等于所有内容无裁切；真实手机触摸swipe、离页/刷新恢复、工具网络、长时间运行均未验收。</li><li>美观和互动评分由同一助手结合截图及操作判断，非人类盲评。1=不可用/严重缺陷；3=可用但有明显限制；5=完成度高。无统计显著性检验，20题单轮不足以推断模型普遍能力。</li><li>计时从请求开始至完整响应结束，包含CardSpec修复等链路，未计人工QA与构建。CS失败case16为228.3秒；耗时不等同模型推理时间。</li></ul><details><summary>原始数据与复跑入口</summary><p><a href="metrics.json">汇总指标</a> · <a href="ui-qa.json">交互证据</a> · <a href="layout-qa.json">尺寸测量</a> · <a href="manifest.json">实验清单与HTML提示</a> · <a href="summary.json">40次任务记录</a></p><p>本地原始完整响应与SSE trace：<code>artifacts/html-reference-2026-10-16/*-cardspec.json</code>、<code>*-html.json</code>。生成脚本：<code>node scripts/benchmark-html-reference.mjs</code>（会消耗模型调用并覆盖本轮同名目录；再次对照应先改输出目录）。报告构建不调用模型：<code>python -X utf8 scripts/report-html-reference.py</code>。</p></details>
<h2 id="cases">逐例证据与可运行产物</h2>__DETAILS__<p class="foot">仅新增本地实验入口和报告，未切换生产默认协议，未发布GPT Site。DIL保持不变。截图保留原始缺陷，未修饰生成结果。</p></main><script>
const search=document.getElementById('search'),filter=document.getElementById('filter');function apply(){let n=0;for(const r of document.querySelectorAll('#rows tr')){const show=r.dataset.search.toLowerCase().includes(search.value.toLowerCase())&&(filter.value==='all'||r.dataset.failed==='true');r.hidden=!show;if(show)n++}document.getElementById('count').textContent=n+'例'}search.addEventListener('input',apply);filter.addEventListener('change',apply);document.querySelectorAll('.shot-controls button').forEach(b=>b.addEventListener('click',()=>{const card=b.closest('.case'),img=card.querySelector('.shot'),url=img.dataset.base+(b.dataset.width==='320'?'-320':'')+'.png';img.src=url;card.querySelector('.shot-link').href=url;card.querySelectorAll('.shot-controls button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}));
</script></body></html>'''
for key,value in {'__OVERVIEW__':overview_html,'__ROWS__':''.join(rows),'__BARS__':latency_bars,'__DETAILS__':''.join(details)}.items(): document=document.replace(key,value)
(OUT/'report.html').write_text(document, encoding='utf-8')
for base in [ROOT/'public/html-reference', ROOT/'dist/html-reference']:
    base.mkdir(exist_ok=True, parents=True)
    for name in ['report.html','comparison.csv','comparison.md','metrics.json','ui-qa.json','layout-qa.json','manifest.json','summary.json']:
        shutil.copy2(OUT/name, base/name)
    shutil.copytree(OUT/'screenshots',base/'screenshots',dirs_exist_ok=True)
    shutil.copytree(source_dir,base/'sources',dirs_exist_ok=True)
print(json.dumps(stats,ensure_ascii=False,indent=2))
print('Report:',OUT/'report.html')
