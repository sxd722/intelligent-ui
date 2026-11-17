"""Publish saved QA evidence only; never invokes models, CLI tools or browsers."""
import json, shutil, html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'artifacts/cuj-continuity-qa'
OUT = ROOT / 'public/cuj-continuity-qa'
OUT.mkdir(parents=True, exist_ok=True)
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def esc(value): return html.escape(str(value))
def copy(path, name):
    target = OUT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)
    return name

cases = [
 dict(id='bamboo', title='竹书纪年', run='verified', old=96.739, stitch=70.509, job='a3dc2c30-2ec0-47a6-8e23-fe29e9a573b2', paths=['cuj-1','cuj-2','cross-card'], shot='cuj-2', image='02-action.png',
      result='独立关键路径通过，但第二卡生成状态仍为 error：展示的是可复验草稿，未晋级为完整交付。',
      gain='古本/今本跨卡同步并恢复；点选伊尹与太甲后出现对应的不同叙述，展开有实际信息增量。',
      gap='仍偏分类→条目→展开；Stitch 将同一事件的两种叙述直接并置，比较成本更低。两卡风格也不够统一。'),
 dict(id='cs343', title='CS343 学习与练习', run='verified-interface', old=116.221, stitch=64.119, job='da6aea18-7bef-46b2-aa43-b6a0c0361ab5', paths=['concept','exercise','cross-card'], shot='cross-card', image='02-action.png',
      result='两卡可交付但仍为 partial；本轮关键路径通过。包含一次 50.2s 的第二卡定向重生成，不是一次首发全通过。',
      gain='知识树折叠、主题解释、答案展开可操作；薄弱主题在题库与知识树之间往返同步，刷新保留。宿主约束共同实体键与 boolean 编码。',
      gap='树与题库仍分卡，较 Stitch 的主题、机制、练习紧邻组织多一次切换。尚未逐题核对课程内容或所有答案。'),
 dict(id='care', title='婴儿护理', run='verified', old=170.905, stitch=62.941, job='889dcb7e-a39b-4807-a9e5-c0f05874e285', paths=['steps','record','cross-card'], shot='record', image='06-action.png',
      result='两卡可交付但仍为 partial；本轮场景、记录增改删、自查提示及恢复路径通过。',
      gain='五个护理场景切换有对应内容；步骤展开有增量；场景同步到记录卡，记录按场景保留，编辑/删除与刷新有效。',
      gap='Stitch 的“现在做什么→观察什么→何时处理”层级更清楚。当前面板外观近似、图标辨识不足；未验收跨场景编辑中的未提交草稿。'),
]
sections, table, manifest = [], [], []
for c in cases:
    base = BASE/c['run']/c['id']; generated=read(base/'result.json')
    evidence=[]; links=[]; steps=0
    for path in c['paths']:
        for width in [320,432]:
            folder=base/f'{path}-{width}'; trace=read(folder/'trace.json')
            steps+=len(trace['actions'])
            url=copy(folder/'trace.json',f"evidence/{c['id']}/{path}-{width}/trace.json")
            # Keep every action image next to its trace, including intermediate states.
            for png in folder.glob('*.png'): copy(png,f"evidence/{c['id']}/{path}-{width}/{png.name}")
            evidence.append(dict(path=path,width=width,ok=trace['ok'],actions=len(trace['actions']),trace=url))
            links.append(f'<a href="{url}">{esc(path)} · {width}px · {len(trace["actions"])}步 · {"通过" if trace["ok"] else "失败"}</a>')
    source_links=[]
    for i,card in enumerate(generated.get('deck',[])):
        name=f"evidence/{c['id']}/card-{i+1}.cardspec"
        (OUT/name).parent.mkdir(parents=True,exist_ok=True)
        (OUT/name).write_text(card.get('source',''),encoding='utf-8')
        source_links.append(f'<a href="{name}">模型原始第{i+1}卡 · {esc(card.get("status"))}</a>')
    # SSE trace without transport credentials or server configuration.
    event_url=f"evidence/{c['id']}/generation-trace.json"
    (OUT/event_url).write_text(json.dumps({'elapsedMs':generated['elapsedMs'],'parentRun':generated.get('parentRun'),'targetedRepairMs':generated.get('targetedRepairMs'),'events':generated.get('events',[])},ensure_ascii=False,indent=2),encoding='utf-8')
    mock=ROOT/'artifacts/stitch-comparison'/c['job']/'mock.png'
    if not mock.exists(): mock=mock.with_name('screen.png')
    mock_url=copy(mock,f"images/{c['id']}-stitch.png")
    image_url=f"evidence/{c['id']}/{c['shot']}-432/{c['image']}"
    image_mobile=f"evidence/{c['id']}/{c['shot']}-320/{c['image']}"
    ms=generated['elapsedMs']/1000
    table.append(f'<tr><td><a href="#{c["id"]}">{c["title"]}</a></td><td>{c["old"]:.1f}s</td><td>{ms:.1f}s'+('（139.5 + 50.2）' if c['id']=='cs343' else '')+f'</td><td>{c["stitch"]:.1f}s</td><td>6/6 路径 · {steps} 步</td><td>{c["result"]}</td></tr>')
    sections.append(f'''<section id="{c['id']}"><h2>{c['title']}</h2><p class="notice">{c['result']}</p><div class="comparison"><figure><figcaption>原 Stitch mock · 仅设计意图</figcaption><a href="{mock_url}"><img loading="lazy" src="{mock_url}"></a></figure><figure><figcaption>模型产物 · 432px 实际交互截图</figcaption><a href="{image_url}"><img loading="lazy" src="{image_url}"></a></figure><figure><figcaption>同一路径 · 320px</figcaption><a href="{image_mobile}"><img loading="lazy" src="{image_mobile}"></a></figure></div><h3>实际改善</h3><p>{c['gain']}</p><h3>仍有的体验差距</h3><p>{c['gap']}</p><details><summary>6 条路径、全部动作截图、生成 trace 与原始 DSL</summary><div class="links">{''.join(links+source_links)}<a href="{event_url}">生成 SSE trace</a></div><p>动作 trace 中包含前后快照、断言与截图。截图与 trace 同目录；生成 trace 为模型调用记录，不作为正确性证明。</p></details></section>''')
    manifest.append(dict(case=c['id'],elapsedMs=generated['elapsedMs'],evidence=evidence,result=c['result']))

rounds=[]
for stage,label in [('', '实施第一轮'),('final','中间门控修正'),('release','启动竞态（未调用模型）'),('verified','整组三例复验'),('verified-entities','实体键修复'),('verified-interface','值编码修复 / 定向第二卡')]:
    for c in cases:
        file=BASE/stage/c['id']/'result.json'
        if file.exists():
            r=read(file); status=', '.join(x.get('status','?') for x in r.get('deck',[])) or r.get('error',str(r.get('status','无交付')))
            rounds.append(f'<tr><td>{label}</td><td>{c["title"]}</td><td>{r.get("elapsedMs",0)/1000:.3f}s</td><td>{esc(status)}</td></tr>')

doc='''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CUJ 连续性 P0 · 三例复验</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f3f5f8;color:#203044;font:16px/1.65 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1280px;margin:auto;padding:36px 24px}h1{font-size:36px;line-height:1.2}h2{margin-top:0}h3{margin-bottom:4px}p{max-width:1000px}a{color:#176b8a}section,.panel{background:white;border-radius:20px;padding:28px;margin:24px 0;box-shadow:0 5px 25px #17263a08}.eyebrow{color:#436779;font-weight:700}.notice{background:#fff4db;padding:16px;border-radius:12px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #dbe2e7}th{white-space:nowrap}.scroll{overflow:auto}.comparison{display:grid;grid-template-columns:1fr 1fr .8fr;gap:18px;align-items:start}figure{margin:0;min-width:0}figcaption{font-size:13px;color:#577080;margin-bottom:12px}img{max-width:100%;height:auto;border-radius:14px;display:block}.links{display:grid;gap:8px;padding:20px 0}summary{cursor:pointer;font-weight:600;margin-top:22px}small{color:#5d6d7b}@media(max-width:740px){main{padding:18px 12px}.comparison{grid-template-columns:1fr}section{padding:20px}h1{font-size:28px}figure img{max-height:650px;width:auto;margin:auto}}
</style><main><div class="eyebrow">LOCAL 8787 · 2026-11-10 · P0 IMPLEMENTATION</div><h1>从“可以点击”到可连续完成的任务</h1><p>三例使用原始请求和 DeepSeek Flash 重新生成。宿主贯通 CUJ 分配、共享字段、实体键和值编码；独立浏览器按实际任务路径操作，保留返回与刷新证据。Stitch 仅作为信息组织与视觉参照。</p><p class="notice"><b>18/18 独立路径、132 个操作/断言步骤通过，不等于所有需求完整通过。</b>竹书第二卡仍是生成失败后的可复验草稿；CS343 包含一次定向重生成；三例仍有 partial 项。此次未证明耗时下降，也未达到 Stitch 的全部设计品质。</p><div class="panel scroll"><table><thead><tr><th>案例</th><th>旧 CardSpec</th><th>本轮产物成本</th><th>旧 Stitch mock</th><th>独立 UI 复验</th><th>交付边界</th></tr></thead><tbody>'''+''.join(table)+'''</tbody></table><p><small>单次样本，非性能基准。旧、新 CardSpec 含生成/调试；Stitch 是静态 mock，不能等同完整功能实现。独立浏览器复验时间不计入模型生成。CS343 成本为 139.530s 整组生成 + 50.178s 第二卡再生成。</small></p></div>'''+''.join(sections)+'''
<section><h2>根因归类与下一步</h2><ul><li><b>宿主：</b>原先拆卡丢失兄弟目标、共享状态无统一接口；结果采样漏掉 caption 与 each 作用域；分页隐藏正确目标导致测试误报。本轮修复并补回归。</li><li><b>契约：</b>record 类型相同仍可能用不同实体键、不同值编码。本轮由宿主推导紧凑接口，不增加模型维护第二套 DSL 的负担。</li><li><b>模型：</b>仍可能给出错误的测试预期和顺序、内容组织偏概述、局部通过后保留 partial。没有把预期改成当前页面来伪造通过。</li><li><b>竹书内容：</b>原 refine 已包含史料比较，信息价值主要在下游分类化与实现阶段流失。新增通用“具名事件—双方说法—差异/依据”职责，已产生具体对照；历史转述尚未逐项事实核验。</li></ul><p>下一优先级：收敛测试前置条件与预期错误，降低无效修复；用原生并置对照、主题→练习、行动→观察组合减少跨页记忆。当前不扩大到个案专用模板。</p><p>本轮使用隔离 Chrome；UI 验证工具 transport 为替身，未执行真实 OpenCLI 调用。未修改 GPT Site；OpenCLI/Owl 连接进程保持原样。护理测试验证界面行为，不证明医疗建议有效；课程与历史事实也不在本轮软件断言范围内。</p></section><section><h2>完整迭代记录</h2><p>保留中间失败；没有只选最快/最好的一轮。ready 是服务端卡片状态，不代表全部 CUJ 通过。</p><div class="scroll"><table><thead><tr><th>阶段</th><th>案例</th><th>耗时</th><th>卡片状态</th></tr></thead><tbody>'''+''.join(rounds)+'''</tbody></table></div><p>原始全量数据位于 artifacts/cuj-continuity-qa/；当前页 evidence/ 包含所展示产物的 DSL、SSE trace、独立测试快照与所有动作截图。</p><a href="manifest.json">机器可读验证索引</a></section></main></html>'''
(OUT/'index.html').write_text(doc,encoding='utf-8')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(OUT/'index.html')
