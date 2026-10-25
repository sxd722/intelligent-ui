import json, csv, statistics, html, shutil
from pathlib import Path

root=Path('artifacts/cardspec-compact-balanced-2026-10-16')
old=Path('artifacts/html-reference-2026-10-16')
read=lambda p: json.loads(p.read_text(encoding='utf-8'))
esc=lambda x: html.escape(str(x))
records=read(root/'summary.json')
baseline=read(old/'summary.json')
old_metrics=read(old/'metrics.json')
qa={r['id']:r for r in read(root/'ui-qa.json')}
old_qa={r['id']:r for r in read(old/'ui-qa.json')}
layout=read(root/'layout-qa.json')
manifest=read(root/'manifest.json')
cs=[r for r in records if r['format']=='cardspec']
assert len(cs)==20 and len(qa)==20 and len(layout)==60
calls=[]; first=[]; case_input=[]; plan_cases=[]
for r in cs:
    trace=read(root/(r['id']+'-cardspec.json'))
    model=[f['frame'] for f in trace['frames'] if f['frame'].get('type')=='research_model']
    calls.extend(model)
    if model:
        first.append(model[0]['usage']['prompt_tokens'])
        case_input.append(sum(m['usage']['prompt_tokens'] for m in model))
    if any(f['frame'].get('tool')=='plan_cards' for f in trace['frames']):plan_cases.append(r['id'])
    (root/'sources').mkdir(exist_ok=True)
    (root/'sources'/(r['id']+'.txt')).write_text(trace['source'],encoding='utf-8')
metrics={'first':sum(r['firstPass'] for r in cs),'delivered':sum(r['status']=='succeeded' for r in cs),
 'medianSeconds':statistics.median(r['elapsed'] for r in cs)/1000,'meanSeconds':statistics.mean(r['elapsed'] for r in cs)/1000,
 'maxSeconds':max(r['elapsed'] for r in cs)/1000,'fullCases':sum(r['passed']==r['total'] for r in qa.values()),
 'passed':sum(r['passed'] for r in qa.values()),'total':sum(r['total'] for r in qa.values()),
 'firstInputTokens':statistics.mean(first),'meanTotalInputTokens':statistics.mean(case_input),
 'recordedCalls':len(calls),'planCases':len(plan_cases),'overflow':sum(r['overflow'] for r in layout),
 'geometryChecks':len(layout),'renderedGeometryChecks':sum(r['exists'] for r in layout)}
(root/'metrics.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2),encoding='utf-8')
def by(rs,id,fmt):return next(r for r in rs if r['id']==id and r['format']==fmt)
def state(r):return '首次成功' if r['firstPass'] else '修复成功' if r['status']=='succeeded' else '失败'
rows=[]
for c in manifest['cases']:
    id=c['id']; a=by(baseline,id,'cardspec'); b=by(records,id,'cardspec'); h=by(baseline,id,'html'); q=qa[id]; oq=old_qa[id]
    rows.append({'场景':id+' · '+c['area'],'原CardSpec':state(a),'精简CardSpec':state(b),
      '原耗时s':round(a['elapsed']/1000,1),'精简耗时s':round(b['elapsed']/1000,1),'HTML耗时s':round(h['elapsed']/1000,1),
      '原交互':f"{oq['cardspec']['passed']}/{oq['cardspec']['total']}", '精简交互':f"{q['passed']}/{q['total']}",
      'HTML交互':f"{oq['html']['passed']}/{oq['html']['total']}",'观察':q['note']})
with (root/'comparison.csv').open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fieldnames=rows[0]);w.writeheader();w.writerows(rows)
headers=list(rows[0]); table='<table><thead><tr>'+''.join('<th>'+esc(h)+'</th>' for h in headers)+'</tr></thead><tbody>'
for row,c in zip(rows,manifest['cases']):
    table+='<tr>'+''.join('<td>'+ (f'<a href="../html-reference.html?variant=compact&amp;case={c["id"]}">{esc(v)}</a>' if k=='场景' else esc(v))+'</td>' for k,v in row.items())+'</tr>'
table+='</tbody></table>'
o=old_metrics['cardspec']; h=old_metrics['html']
def comp(label,a,b,c):return f'<tr><th>{label}</th><td>{a}</td><td>{b}</td><td>{c}</td></tr>'
summary='<table><tr><th>指标（20例）</th><th>原CardSpec</th><th>精简CardSpec</th><th>HTML reference</th></tr>'
summary+=comp('首次生成成功','16/20','14/20','20/20')
summary+=comp('最多一次修复后成功','18/20','19/20','20/20')
summary+=comp('完整交互场景通过','15/20','16/20','16/20')
summary+=comp('交互检查项','39/47','42/47','41/47')
summary+=comp('耗时中位数',f'{o["medianSeconds"]:.1f}s',f'{metrics["medianSeconds"]:.1f}s',f'{h["medianSeconds"]:.1f}s')
summary+=comp('耗时均值',f'{o["meanSeconds"]:.1f}s',f'{metrics["meanSeconds"]:.1f}s',f'{h["meanSeconds"]:.1f}s')
summary+=comp('平均首轮输入tokens',f'{o["tokens"]["firstInput"]:,.0f} *',f'{metrics["firstInputTokens"]:,.0f}',f'{h["tokens"]["firstInput"]:,.0f}')
summary+=comp('平均累计输入tokens',f'{o["tokens"]["input"]:,.0f} *',f'{metrics["meanTotalInputTokens"]:,.0f}',f'{h["tokens"]["input"]:,.0f}')
summary+=comp('记录到的模型响应数','31 *','26','20')
summary+=comp('调用plan_cards的场景','10 *','0','不适用')
summary+=comp('320px根容器横向溢出','0/18成功样本','0/19成功样本','4/20')+'</table>'
source_links=''.join(f'<li>{esc(c["id"])}：<a href="{c["id"]}-cardspec.json">完整trace</a> · <a href="sources/{c["id"]}.txt">生成源码</a></li>' for c in manifest['cases'])
doc=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>精简契约：更快，但首次成功率仍需改进</title><style>
:root{{font:16px/1.65 system-ui,"Microsoft YaHei",sans-serif;color:#172b36;background:#f3f5f5}}body{{margin:0}}main{{max-width:1240px;margin:auto;padding:36px 30px}}h1{{font-size:34px;line-height:1.3;max-width:950px}}h2{{margin-top:42px;font-size:24px}}p{{max-width:1000px}}.eyebrow{{color:#53716c;letter-spacing:.1em;font-size:13px}}.lead{{font-size:20px}}.callout{{border-left:4px solid #26766c;padding:8px 20px;background:#e7f1ed}}a{{color:#176c73}}.scroll{{overflow:auto;background:white;border-radius:14px}}table{{border-collapse:collapse;width:100%;font-size:14px}}td,th{{padding:12px 14px;text-align:left;border-bottom:1px solid #e3e9e7;vertical-align:top}}th{{background:#e9efed;white-space:nowrap}}td:last-child{{min-width:260px}}.summary td:last-child{{min-width:0}}.gallery{{display:grid;grid-template-columns:1fr 1fr;gap:24px}}img{{width:100%;border-radius:12px}}figcaption{{font-size:14px;color:#4c6068}}figure{{margin:0}}details{{margin:20px 0}}small{{color:#607178}}@media(max-width:700px){{main{{padding:20px 14px}}h1{{font-size:27px}}.gallery{{grid-template-columns:1fr}}}}</style><main>
<div class="eyebrow">LOCAL EXPERIMENT · 2026-10-16 · GLM-5.3-FLASH</div>
<h1>精简契约让卡片更快生成，<br>但不能把语义示例一起删掉</h1>
<p class="lead">保留动作与表达式示例、移除冗余说明，并让独立单卡任务跳过规划后，20例生成耗时中位数从30.4秒降至12.0秒。修复后可用卡片由18例增至19例，交互检查由39/47增至42/47。</p>
<p class="callout"><strong>代价必须同时看：</strong>首次成功从16/20降至14/20，仍依赖一次修复；完整交互场景为16/20，不能声称全部问题已解决。部署的是保留关键示例的精简版，过度压缩版没有保留为生产策略。</p>
<p><a href="../html-reference.html?variant=compact">操作精简版与HTML对照</a> · <a href="../html-reference/report.html">原始报告</a> · <a href="comparison.csv" download>下载20例表格CSV</a></p>
<h2>同样的20例，生成成功与交互成功分别统计</h2><div class="scroll summary">{summary}</div>
<p><small>* 原CardSpec仅18个成功样本保留了完整用量/规划记录，失败样本不按0计算。新版本20例均有完整模型响应记录；因此累计调用和token只能作已记录样本的对照。输入token是契约负担代理指标，不等于直接测量模型认知。</small></p>
<h2>省掉的是重复说明和额外规划，保留的是可执行语义</h2>
<p>生成契约从26,276字符降至16,808字符（−36%）。组件属性、必填项、集合结构和事件字段仍从同一注册表生成；编译校验、安全限制、动作snapshot/state/next及一次修复流程保持。删除重复用途说明、重复排版规则和组件例子，保留关键动作语义与完整短例。首次输入实测约11,637→6,494 tokens（−44%）。</p>
<p>简单的独立单卡请求不再向模型暴露plan_cards，服务端也拒绝执行。明确要求多卡或探索规划时保留；CLI和检索权限独立于这个决策。初始页、后续页和slot通过同一生成服务应用规则；experience原有体验规划和staged仍保留，DIL不变。</p>
<details><summary>为什么不选择更短的版本？</summary><p>先进行了未完成的试跑，发现背景检索词的必填规则被误写为可选，已纠正并保留记录。之后完整的激进压缩轮约1.16万字符：首次仅5/20，修复后14/20，耗时中位数17.0秒。它频繁混淆state/derived、event/args和集合函数。恢复原关键语义示例与完整可运行短例后，得到本报告的最终轮。两轮均完整记录，没有逐题挑选更好的输出拼成结果。</p></details>
<h2>HTML值得借鉴的是信息组织，而不是把全部CSS交给模型</h2>
<div class="gallery"><figure><img src="screenshots/19-media.png" alt="自然观察卡HTML与精简CardSpec对照"><figcaption>HTML的图片、短标签、收藏操作排成一条视觉路径。CardSpec仍把署名挤进窄列，留下大块空白，而且把收藏误做成评分。图片通道已有，缺的是稳定图文布局与意图落实。</figcaption></figure><figure><img src="screenshots/11-mindmap.png" alt="学习图HTML与精简CardSpec对照"><figcaption>HTML更鲜明，CardSpec的节点选择更可靠，但仍重复标题和详情。应把选中高亮、单一详情区做成宿主默认行为，减少每次生成所需决策。</figcaption></figure></div>
<p>本次已把“短标题→当前状态/视觉主体→必要操作”、就地反馈、紧凑指标、题图与正文分层写成短指导。没有复制某一个例子的DSL，也没有添加自由HTML执行入口。后续更合适的方向是宿主提供稳定的图文行/紧凑表单配方，以及统一图片署名和图节点详情所有权；继续加长prompt不一定改善视觉。</p>
<h2>仍有四类未通过的场景</h2><ul>
<li><strong>流程图：</strong>模型将onSelect提供的event.id写成args.id，一次修复后仍失败。这是生成错误，编译器已准确拦截。</li>
<li><strong>资源模拟：</strong>食材耗尽后推进到两个选项均禁用的死状态，没有结算/重开。语法正确不代表状态机完整。</li>
<li><strong>战斗：</strong>法力恢复被实现为累加3并新增上限10。沿用前一轮“恢复为3”的判定口径失败；如果原意是“补充3”，三组各有一项可转为通过，故不据此比较架构优劣。</li>
<li><strong>图片收藏：</strong>每项0–2星评分替代了独立收藏与全局0–2计数。真实图片加载通过，交互意图没有落实。</li></ul>
<p>另外，月历换月后额外标题仍显示2月，思维导图有重复说明，购物快照含零数量行。这些没有被隐瞒为完美质量，但不重复扣除原先47项以外的检查分。</p>
<h2>逐例结果与交互证据</h2><div class="scroll">{table}</div>
<h2>比较范围与复现</h2>
<p>原20个prompt逐字复用。新一轮使用同一网关glm-5.3-flash、temperature 0.4、reasoning low、8192输出上限、square 432px、direct、toolsEnabled:false、并发2。HTML和原CardSpec沿用上一轮冻结产物；本次没有再次生成HTML。首次成功指无需修复通过生产校验；交互以原47项检查为分母，生成失败的任务记失败。未对某个输出手工修改。</p>
<p>浏览器实际操作覆盖20例，交互主要在432px；所有20例进行了320/360/432px几何检查（19个渲染样本×3=57项，失败样本不计作布局通过），根容器无横向溢出。轮播测试按钮切换与备注保留，未覆盖真实手机触摸手势。抽看关键截图，未做独立人工盲评或新的美观分数。故事验证七天完整流程、重开和第4天两种分支；购物验证清车后的历史快照。</p>
<p>耗时是请求至校验、资源解析完成的端到端时间，包含一次修复与素材缓存影响。旧组是HTML/CardSpec交错调用，新组仅CardSpec；网关时段和缓存不受控，单轮小样本不能证明所有收益都由prompt缩短造成。应继续观察首次成功率，而不是只看平均速度。</p>
<p>仅本地8787更新。通过维护交接保留了同一OpenCLI session及daemon，未解绑或关闭Owl页。未发布GPT Site。</p>
<details><summary>原始记录与定义</summary><p><a href="manifest.json">参数与20例清单</a> · <a href="metrics.json">汇总指标</a> · <a href="ui-qa.json">交互文本证据</a> · <a href="layout-qa.json">尺寸检查</a> · <a href="story-trace.json">故事多日trace</a> · <a href="cardspec-system-prompt.txt">精简契约</a></p><ul>{source_links}</ul></details>
</main></html>'''
(root/'report.html').write_text(doc,encoding='utf-8')
for dest in [Path('public/cardspec-compact'),Path('dist/cardspec-compact')]:
    dest.mkdir(parents=True,exist_ok=True)
    for f in root.iterdir():
        if f.is_file():shutil.copy2(f,dest/f.name)
    for directory in ['screenshots','sources']:shutil.copytree(root/directory,dest/directory,dirs_exist_ok=True)
print(json.dumps(metrics,ensure_ascii=False))
