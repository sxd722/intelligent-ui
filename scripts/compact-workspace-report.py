import json,hashlib,html,shutil
from pathlib import Path
p=Path('artifacts/compact-workspace-qa'); before=json.loads((p/'before.json').read_text(encoding='utf-8')); rows=json.loads((p/'layouts.json').read_text(encoding='utf-8')); trace=json.loads((p/'play-trace.json').read_text(encoding='utf-8')); full=next(x for x in rows if x['cardWidth']==432 and x['mode']=='full'); ending=next(x for x in trace if x['label']=='ritual-resolved-ending')['componentState']['/game']['webSandbox']['state']; source=(p/'original.source.txt').read_bytes()
checks=[{'id':'layout','status':'pass','evidence':['layouts.json','layout-432-full.png'],'note':'九尺寸无横向溢出；每次20个高度采样末10个稳定。方形/自然模式仍有纵向滚动，不算一屏完成。'}, {'id':'work-explore-research-recruit-relic','status':'pass','evidence':['play-trace.json'],'note':'浏览器真实点击投入、启动、逐拍推进，消费与新增卡牌有状态证据。'}, {'id':'restore-running-job','status':'pass','evidence':['play-trace.json'],'note':'t=47时剩余10拍的仪式保存恢复后状态一致。'}, {'id':'timer','status':'pass','evidence':['play-trace.json'],'note':'实际定时器推进到t=49，工作完成且发生生活费扣除。'}, {'id':'invalid-combination','status':'pass','evidence':['play-trace.json'],'note':'银币投入研究提示不适用，无扣费或卡牌消耗。'}, {'id':'winning-ending','status':'fail','evidence':['play-trace.json','ending-failure.png','original.source.txt'],'note':'仪式完成的成功消息存在，但ending=mind；胜利被后置死亡判定覆盖。'}, {'id':'drag','status':'not_tested','note':'本轮通过触屏投入按钮验证完整操作路径，未做指针拖放验收。'}, {'id':'generic-strict-workspace','status':'pass','evidence':['generic-checks.json','generic-workspace.png'],'note':'设备选择联动处理队列，执行次数增长；3段长文和表单不分栏。'}]
acceptance={'caseId':'ashen-compact-workspace','status':'candidate','artifactHash':hashlib.sha256(source).hexdigest(),'hostHash':hashlib.sha256(Path('src/cardspec/compact-workspace.mjs').read_bytes()).hexdigest(),'testVersion':'functional-v3','mode':'original-generated-artifact','checks':checks,'layouts':rows,'limitations':['Stitch为静态mock，不证明其游戏逻辑。','本轮修改宿主布局，原始生成的游戏业务源码未修改；不能称为可通关版本。','手机方形/自然模式仍需纵向滚动；完整长页减少约26%高度而非一屏容纳全部玩法。','早期多步通关试验为同一源代码的三列布局，最终双列布局复测无效投入、自动工作和九尺寸；未在每个尺寸重复全部通关路径。']};(p/'acceptance.json').write_text(json.dumps(acceptance,ensure_ascii=False,indent=2),encoding='utf-8')
md=f'''# 灰烬之门：紧凑布局与核心玩法验收

## 结论

本地宿主布局改进通过；原始游戏的核心胜利结局未通过。源码SHA256：{acceptance['artifactHash']}。

## 与 Stitch 的差异

Stitch 把行动槽并排组织，卡牌更小，重点是选择—投入—进度—结果的局部闭环。原产物则将五个槽都当作全宽面板，还把详情与操作反复向下堆积。新宿主只调整结构明确的重复组，不匹配任何中文标题，不重排React节点，不修改状态或规则。

|432px完整长页|原版|新宿主|
|---|---:|---:|
|整页内容高|{before['height']:.0f}px|{full['height']}px|
|卡牌区（含详情）|{before['sections'][1]['height']:.0f}px|{full['sections'][1]['height']}px|
|行动区（含说明及反馈）|{before['sections'][2]['height']:.0f}px|{full['sections'][2]['height']}px|
|行动槽列数|1|2|
|初始卡牌列数|3|4|

卡牌约由116px高收紧到82px。320/360长页卡牌3列、行动2列；特别窄且有内部滚动条的方形/自然模式会退回一列以保证可读性。仍不是Stitch级的一屏桌面，文本与控件内容没有删减。内容识别不会代替更好的任务规划。

## 玩法

真实浏览器链条：工作筹资 → 工作与探索并行 → 获得灰烬残页 → 理性+残页+激情研究 → 获得灰烬密语 → 交谈结识抄写员 → 再次交谈招募信徒 → 信徒探索得铜铃 → 仪式。t=47保存恢复，任务剩余10拍及资源一致；t=57仪式完成。

最后状态：mind={ending['mind']}，heat={ending['heat']}，ending={ending['ending']}。成功消息为“{ending['message']}”，但UI呈现失败结局。

### 模型业务问题（不是渲染器或测试预期错误）

1. 源码166行把ending设为win，182–184行无条件再次按健康/理性/调查判失败。仪式消耗两点理性并加三点调查，使成功和失败同一事务冲突。
2. 首条通关链至少带来1+1+2+2+3=9调查，阈值为8；没有降低调查的可达操作。
3. 恐惧恢复需要fear类型卡，但没有任何初始卡或行动会生成它。状态数值fear与同名卡牌并不等价。这使恢复路径不可达。
4. 工作、探索、研究等局部通过不能替代终局验收。完成文案不能替代实际ending值。

## 后续通用改进建议

- 生成期游戏验收至少覆盖一个实际成功终局及一个失败终局，判断持久状态与UI结果是否一致；不能只验证计时或产卡。
- 检查必要物品的生产者→消费者可达性、必经链最低成本和恢复入口。
- 由作者明确终局优先级；宿主不要猜测并改写游戏规则。需要修复原产物时保存新的候选版本与父版本hash，再重走路径。

## 验证范围

19项相关单测通过；320/360/432 × full/auto/square共9组截图和20点稳定性采样，无横向溢出。新增严格沙箱设备工作区验证选择联动与行动反馈，长文表单排除。
本次不调用模型、不调用CLI，不修改用户主页面游戏进度，不重启服务或OpenCLI/Owl；仅本地8787前端构建。原始游戏业务源码保持不变；拖拽未单独测试，触屏投入路径已测。
''';(p/'REVIEW.md').write_text(md,encoding='utf-8')
checkrows=''.join(f'<tr><td>{html.escape(c["id"])}</td><td class="{c["status"]}">{c["status"]}</td><td>{html.escape(c["note"])}</td></tr>'for c in checks)
layoutrows=''.join(f'<tr><td>{r["cardWidth"]}</td><td>{r["mode"]}</td><td>{r["height"]} / {r["scrollHeight"]}</td><td>{" / ".join(g["columns"]for g in r["groups"])}</td><td><a href="layout-{r["cardWidth"]}-{r["mode"]}.png">截图</a></td></tr>'for r in rows)
report=f'''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>灰烬之门 · 紧凑布局验收</title><style>body{{margin:0;background:#101719;color:#dfe9e5;font:16px/1.65 system-ui}}main{{max-width:1120px;margin:auto;padding:32px 20px}}h1{{font-size:30px}}h2{{margin-top:40px}}a{{color:#8ee3bf}}.summary{{display:flex;gap:14px;flex-wrap:wrap}}.metric{{background:#1b2929;padding:18px 24px;border-radius:14px}}.metric b{{font-size:28px;display:block}}.warn{{background:#3a2620;padding:18px;border-radius:12px;color:#ffd6b9}}table{{border-collapse:collapse;width:100%;font-size:14px}}th,td{{padding:12px;text-align:left;border-bottom:1px solid #344343}}.pass{{color:#90e1bd}}.fail{{color:#ffac9a}}.images{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}}img{{width:100%;border-radius:10px}}details{{margin:18px 0}}@media(max-width:700px){{.images{{grid-template-columns:1fr}}table{{display:block;overflow:auto}}}}</style><main><small>LOCAL 8787 · 原始模型产物 · 宿主通用排版</small><h1>灰烬之门：更紧凑，但通关仍有真实错误</h1><div class="summary"><div class="metric"><b>{before['height']:.0f} → {full['height']}px</b>完整长页 · 缩短{(1-full['height']/before['height'])*100:.0f}%</div><div class="metric"><b>{before['sections'][2]['height']:.0f} → {full['sections'][2]['height']}px</b>行动区域 · 改为双列</div><div class="metric"><b>9 / 9</b>尺寸无横向溢出且稳定</div></div><p class="warn">玩法验收未通过：仪式已产出成功结果，但结局随后被失败判断覆盖。不能称为完整可通关。Stitch仅是视觉mock。</p><p><a href="index.html">交互副本与Stitch对照</a> · <a href="REVIEW.md">完整分析</a> · <a href="play-trace.json">逐步状态trace</a> · <a href="acceptance.json">验收数据</a></p><h2>视觉对照</h2><div class="images"><div>改前 · 全宽槽位<a href="before.png"><img src="before.png"></a></div><div>改后 · 小卡牌 / 双列槽位<a href="layout-432-full.png"><img src="layout-432-full.png"></a></div><div>Stitch · 静态设计<a href="stitch.png"><img src="stitch.png"></a></div></div><h2>实际功能结果</h2><table><tr><th>检查</th><th>结果</th><th>证据结论</th></tr>{checkrows}</table><h2>终局根因</h2><p>第57拍，仪式消息已经表示开门成功，持久状态却为 ending=mind、理性0、调查10。源码先设win，再用死亡规则覆盖；必经链最低调查9已超失败阈值8，恢复恐惧所需卡牌又没有生产路径。</p><details><summary>查看失败终局截图</summary><img src="ending-failure.png"></details><h2>尺寸回归</h2><p>仅布局回归，不代表9次完整玩法。方形/自然模式仍需纵向滚动；没有裁切内容来获取通过。</p><table><tr><th>卡宽</th><th>模式</th><th>视口 / 内容高</th><th>卡牌 / 行动列数</th><th>证据</th></tr>{layoutrows}</table><h2>可复用范围</h2><p>Web与严格沙箱共用结构识别。短卡牌、重复行动、短指标被紧凑排列；保留配色、选中态、React节点和事件。长文、表单、图表不强行分栏。未新增模型调用或题材规则。</p><p>19项相关单测通过；跨题材设备工作区也验证了选择→队列→执行反馈。<a href="generic.html">交叉验证页</a> · <a href="generic-workspace.png">截图</a></p><p>只更新本地；GPT Site及OpenCLI/Owl均未操作。原业务源码冻结保留，当前聊天页刷新后使用新布局。</p></main></html>''';(p/'report.html').write_text(report,encoding='utf-8')
for file in p.iterdir():
 if file.is_file():shutil.copyfile(file,Path('dist/compact-workspace-qa')/file.name)
print({'before':before['height'],'after':full['height'],'actionsBefore':before['sections'][2]['height'],'actionsAfter':full['sections'][2]['height'],'tests':19})
