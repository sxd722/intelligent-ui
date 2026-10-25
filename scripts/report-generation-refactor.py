import json, html, statistics
from pathlib import Path

root=Path('artifacts/generation-refactor-qa')
read=lambda name:json.loads((root/name).read_text(encoding='utf-8-sig'))
escape=lambda s:html.escape(str(s))
original=read('original20/summary.json')
mobile=read('mobile-matrix.json')
new=read('new-scenarios/summary.json')
notes={
 '05-expenses':'未通过：初稿修改不可变 data；修复稿把空数组写成 {{[]}}。',
 '17-card-battle':'未通过：修复稿引用未声明的 state.winCount。',
 '19-media':'核心收藏交互通过；需求未完全满足：缺少指定主图，只生成两张候选图。',
 '20-cart':'结算/清空/快照保留通过；未选择商品的数量文案有空值。',
}
newnotes={
 'large-results':('未完整通过','实际读取 20 项，宿主每页渐进展示；模型用 number("12:30") 计算时段，14–16 筛选错误地得到 0 项。'),
 'partial-results':('模型校验失败','读取成功；把 collection 的选择动作复用于普通按钮，event.item 缺失。还把模型收到的 4 条样本误作全部返回数据。'),
 'empty-results':('未覆盖目标','卡片编译通过，但模型没有执行要求的生成前查询。不能记为空结果测试通过。'),
 'source-failure':('未完整通过','受控工具抛错；卡片有恢复入口，但文案称成功查询后 items=[]，事实语义错误。'),
 'three-cards':('生成通过','实际生成三张 ready 卡片，两个后续意图；六尺寸回放无溢出。独立状态、swipe 和返回另用可控替身验证。'),
 'planned-followup':('部分通过','规划两个后续意图，但额外生成 3 张卡，最后一张失败；前两张保留可用。未完全遵从只规划后续页面的要求。'),
}
rows=''.join(f'<tr><td>{escape(r["id"])}<br><small>{escape(r.get("area",""))}</small></td><td>{"✓" if r.get("firstPass") else "—"}</td><td>{"✓" if r["status"]=="succeeded" else "失败"}</td><td>{r["elapsed"]/1000:.1f}s</td><td>{escape(notes.get(r["id"],"已回放主要交互路径；未声称穷举所有分支。"))}</td><td><a href="original20/{r["id"]}-cardspec.json">trace</a></td></tr>' for r in original)
newrows=''.join(f'<tr><td>{escape(r["id"])}</td><td>{escape(newnotes[r["id"]][0])}</td><td>{escape(newnotes[r["id"]][1])}</td><td>{r["elapsedMs"]/1000:.1f}s / {r["calls"]} 次 CLI</td><td><a href="new-scenarios/{r["id"]}.json">trace</a></td></tr>' for r in new)
page=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>生成服务重构 · 实施与 QA</title><style>
body{{margin:0;background:#f2f5f8;color:#1c2b3a;font:16px/1.65 system-ui,sans-serif}}main{{max-width:1120px;margin:auto;padding:36px 24px}}h1{{font-size:34px}}h2{{margin-top:40px}}section,.metrics>div{{background:white;padding:22px;border-radius:18px;margin:16px 0}}.metrics{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}}.metrics b{{display:block;font-size:30px}}table{{width:100%;border-collapse:collapse;font-size:14px}}td,th{{text-align:left;padding:12px;vertical-align:top;border-bottom:1px solid #dde5ed}}small{{color:#586a7b}}a{{color:#1767a6}}.warn{{background:#fff0cd}}img{{max-width:100%;border-radius:16px}}code{{background:#edf1f5;padding:2px 5px}}@media(max-width:700px){{.metrics{{grid-template-columns:1fr 1fr}}.table{{overflow:auto}}}}
</style><main><p>LOCAL 8787 · 2026-10-16 · GLM-5.3-FLASH</p><h1>统一生成、先取数、再组织体验</h1><p>已落地通用服务与卡组能力。自动测试通过；真实模型生成仍存在业务语义错误，不能宣布全部场景通过。</p>
<div class="metrics"><div><b>258 / 258</b>自动测试</div><div><b>12 / 20</b>原有样本首次通过</div><div><b>18 / 20</b>一次修复后通过</div><div><b>{len(mobile)}</b>尺寸回放检查</div></div>
<section><h2>实际改动</h2><ul><li>初始卡、相关卡、下一页、slot 和 JSON 共用生成服务；共享校验、一次修复、资源解析。</li><li>生成阶段新增目录发现、契约读取、只读 CLI 查询和数据集抽样。完整结果保存在宿主，模型引用 context.datasets；同参数 binding 复用预取。</li><li>collection 提供筛选、分组、4 项分页、关键值、可信图片和按需详情；长 list 与纯 each 滚动区域有通用分页兜底。</li><li>plan_cards 只规划 1–3 张互补卡和最多两个后续意图，宿主逐张生成；首卡完成即可操作，失败卡独立重试。仍然每次只编译一个 card。</li><li>卡组 swipe 与每卡历史分开；后续生成读取当前状态、集合选择和有限证据，去重并拒绝陈旧结果，返回/刷新恢复。</li><li>本地来源约束沿用 /api/tools 的 loopback、Host、Origin 校验；非本地 chat 请求不能借生成阶段调用本机 CLI。</li></ul><p>总期限 300 秒；研究窗口 240 秒；最多 3 轮、10 次总工具调用，其中 CLI 最多 6 次；工具上下文 18,000 字符，宿主数据 256,000 字符。预算在修复与相关卡之间共享，不按卡重新发放。</p></section>
<section><h2>原有完整 20 例</h2><p>原清单、direct、同一 glm-5.3-flash、temperature 0.4、low reasoning、一次修复。全部实际调用，未用少量默认样本替代，未用重跑覆盖首次失败。一次运行不能证明统计上的改善；本轮没有做更改前同配置随机对照。</p><p>总生成耗时中位数 {statistics.median(r['elapsed'] for r in original)/1000:.1f} 秒。成功样本逐例检查主要交互：计数/边界、勾选与翻页恢复、筛选、表单、月历、独立笔记、图表/结构图选择、测验重置、资源分配、七日流程、收藏、购物车快照。语法通过与需求完整性分列。</p><div class="table"><table><thead><tr><th>样本</th><th>首次</th><th>修复后</th><th>耗时</th><th>交互/缺陷</th><th>原文</th></tr></thead><tbody>{rows}</tbody></table></div><p><a href="original20/manifest.json">运行配置及原 prompt 清单</a> · <a href="browser-interactions.json">主要交互记录</a> · <a href="tests.log">自动测试日志</a></p></section>
<section><h2>新增六类真实模型场景</h2><p>模型为真实 GLM；工具返回使用可控替身，便于区分模型行为和外部服务故障。下表不以编译成功替代业务成功。</p><div class="table"><table><tr><th>场景</th><th>结论</th><th>证据</th><th>成本</th><th>原文</th></tr>{newrows}</table></div><p class="warn">针对错误语义，已增强样本数量/完整数量的区分，并将执行失败记录保留到修复上下文。定向复跑 source-failure 时模型未调用工具，因此该复跑仍未覆盖失败路径；不能宣称模型问题已解决。<a href="targeted-rerun/source-failure.json">保留复跑记录</a>。自动测试证实失败不会被宿主转换成空数据集。</p></section>
<section><h2>真实 OpenCLI 与浏览器交互</h2><ul><li><a href="live/trains.json">12306：44.8 秒</a>。生成前获取杭州东→上海南 12–18 点的 19 班；浏览器筛选 14–16 点为 8 班，选择后显示对应余票详情。数据为测试时快照。</li><li><a href="live/movies.json">豆瓣：52.2 秒</a>。生成前获取前 6 部，4 项分页、选择联动。来源未给海报字段，显示文字占位，没有伪造海报。海报能力不是本轮真实场景的通过项。</li><li><a href="deck-browser.json">可控三卡测试</a>：实际 swipe 1→2；独立卡页历史；备注、筛选和选择在切换/刷新后恢复；第三卡失败不影响前两张，重试恢复。</li><li>已完成页面共 {len(mobile)} 次 320/360/432px × square/auto 回放，无卡片级横向溢出或组件错误。失败生成没有可测页面，明确排除；容器宽度回放不等同于真机全手势验证。</li></ul><p><a href="mobile-matrix.json">完整尺寸矩阵</a> · <a href="live-ui.json">真实数据交互文本</a> · <a href="new-ui.json">新增交互缺陷</a></p><img src="deck.png" alt="多卡与渐进披露本地验证截图"><details><summary>真实车次回放截图（实验室示意背景）</summary><img src="trains-360.png" alt="360px 车次筛选回放"></details></section>
<section><h2>结论和后续优先级</h2><p>适合渐进重构，不需要推翻 DSL。review 检查的是旧 DIL；现行 CardSpec 已有图表、可信时间、工具及错误隔离，不能按旧缺口重复建设。本次把高重复的生命周期、集合披露与导航交给宿主。</p><ol><li>继续处理语义正确性：时间字段的比较、空结果与失败区分、事件来源不同导致的参数缺失；以数据类型和静态诊断改进，避免按案例关键词改写。</li><li>减少模型遗漏：只声明后续意图时避免自动过量生成；明确要求查询却未查询应作为诊断，不能依赖无限加 prompt。</li><li>视觉质量仍需单独评审：已有 collection 和图片通道不等于每次都会产出好设计；当前仍有英文原始字段名、重复详情和缺图样本。</li></ol><p>已保持 DIL；未发布 GPT Site。服务在 8787，OpenCLI/Owl 原 daemon 和绑定会话保持一致。<a href="connection-after.json">最终连接状态</a>。构建通过，保留既有大资源包警告。当前并未完成全套视觉盲评或所有内部横向组件的真机手势回归。</p></section></main></html>'''
(root/'report.html').write_text(page,encoding='utf-8')
print(root/'report.html')
