# CardSpec v1 实现契约

## 兼容性与入口

`POST /api/chat` 支持两个独立选项：`format: "dil" | "cardspec"`（缺省 cardspec）、`mode: "staged" | "direct" | "experience"`（缺省 direct）。experience 只用于 CardSpec；界面选择 DIL 时保留 direct/staged。页面默认协议为 CardSpec v1；DIL 的原始语法、服务端编译器及 `new Function` 运行时保留。CardSpec 不生成或执行 JavaScript。

experience 在初始卡和 GLM 下一页先调用一次体验规划，slot 为精简版本；普通交互、工具刷新、历史恢复不调用规划。规划不输出正文/组件树/表达式/工具参数，仅输出 goal、pattern、primary、interaction、followups、resources、disclosure。page/slot 输出预算分别 2048/1024 tokens，25秒超时后回退，整体180秒期限不变；staged 复用原交互阶段。宿主记录 experiencePlan、experienceDiagnostics、时间和用量，不要求 DSL 写入这些字段。warning 不使卡片失败。体验模式质量门槛通过前不替换 direct 默认。

```json
{"messages":[{"role":"user","content":"做一个带备注的计数器"}],"format":"cardspec","mode":"direct"}
```

## 模型输出与执行边界

模型输出 `<intro>…</intro><card schemaVersion="1" actionMode="snapshot" theme="soft" palette="a">…</card><outro>…</outro>`。card 内声明 `data/state/derive/action`，随后使用注册表中的组件。完整可运行源代码见 `shared/cardspec/fixtures.mjs`；公开属性表由 `shared/cardspec/registry.mjs` 同时供 prompt、编译器和运行时使用。

表达式支持 JSON 字面量、字段读取、算术、逻辑、三元运算和白名单函数。集合函数以 `item/index` 求值，不接受箭头函数。禁止原型成员与任意方法执行。`if.test` 必须返回 boolean；显式节点 id 必须是唯一静态字符串；each 用 itemKey 区分稳定条目。普通可见节点省略 id 时由宿主分配保留命名空间内的稳定模板 ID；声明及 navigation 目标必须显式命名。布尔属性接受 `{true}`、`"true"` 或裸属性三种明确写法。

属性边界和表达式字符串起点均兼容配对的 `“…”` / `‘…’`，包括数组值、对象键和字符串中的大括号/标签；不全局替换正文或已引用字符串内部的标点。模型仍应输出 ASCII 直引号。根标签属性解析失败时仅报告原始语法错误，不追加误导性的 missing card。mindmap 仍要求单根树；诊断列出根节点并提示补充 parentId，宿主不推测关系。

多份 card 不会被拼接或自动挑选旧稿，诊断明确数量及最后一份是否完整。生成提示要求单个最终文档，outro 后停止；遇 token 上限截断，可进入现有的一次完整文档修复预算。修复仍不完整则明确失败，取消、网络错误和其它上游异常不伪装成功。

流式追加保持节点身份。自动修复优先保留已有结构；确需改变已发布树或状态类型时，只有完整候选通过校验才以新 cardId 原子替换预览，同时重建运行时和导航状态。此时生成中预览的临时交互状态不迁移，并发送替换提示。普通增量修订不重置状态。

动态字符串属性使用 `label={"数量 " + state.count}`。引号内不插值；明显包含 `{state.x}` 等绑定的字符串属性会给出 interpolation 诊断。`role` 只接受 summary/content/actions；supporting 是 `priority` 值。日志等追加集合用 append 动作及唯一条目 id，不使用 JavaScript 的 `.concat()` 或可能重复的文案作 itemKey。

状态类型为 number/string/boolean/array/record，初始化只执行一次。动作 `set/toggle/increment/append/update/remove` 在副本上顺序执行，全部通过类型校验后才提交。事件只提供 value/checked/date/month 等受控数据，args 传递条目标识。

新生成卡片显式声明 `<card actionMode="snapshot">`：一次动作内 `state` 和 `derived` 始终读取动作开始时的快照，`next` 读取此前步骤已写入的草稿。所有写入仍按顺序执行，任一步失败整笔回滚。例如先 `set capacity={state.capacity+1}`，再 `set available={next.capacity}`；判定扣减后是否耗尽用 `next.stock<=0`。视图在提交后统一重算 derive。increment/toggle/append 等操作累积写入草稿，操作数按同一读取规则求值。

省略 actionMode 或显式 sequential 的旧卡片继续顺序读取更新后的 state，不静默改变既有业务含义。迁移旧卡必须检查每个动作，将需要中间结果的读取改为 next，再声明 snapshot。一次性操作仍需要将执行标记绑定到 disabled 条件；重置固定值用 set，恢复增量用 increment。宿主不按游戏或其它业务名称补写规则，也不能自动纠正模型编写的任意业务公式。

动作步骤支持可选 `when={布尔表达式}`，false 时跳过且不计算 key/value。条件与操作数使用相同快照/next 规则；条件类型错误会整笔回滚。条件追加用 `<append target="items" when={state.amount>0} value={{id:state.seq,amount:state.amount}}/>`，不要为了处理校验失败而把整个列表替换为单条数组。结束时只有声明、没有任何 UI 节点的卡片会给出 structure 诊断并进入正常修复。

宿主提供 `context.generatedAt/timeZone/localDate`。当前默认 Asia/Shanghai。会话数据不能冒充用户此前的真实历史。当前标签页通过 sessionStorage 保存对话卡片及页面栈，刷新后恢复；运行中的生成标记为中断，不自动重放 GLM。

## 可选工具扩展

开启「工具增强」后，声明 `binding`、在 action 中使用 `invoke`、以 `slot` 承载局部生成。表达式通过 `bindings.ID.value/status/error/updatedAt` 读取结果。目录与 Schema 由 `shared/cardspec/tools.mjs` 统一提供，模型只选择已启用的工具与结构化参数；不输出 shell。第一版为四个 AutoCLI 只读资讯工具及 `glm.generate`。

编译及动作预演仍为纯计算；全部本地写入/effects 校验成功后才执行工具。snapshot 下先改状态再调用工具时，默认 binding 输入仍读取动作入口；需要刚写入的值应显式使用 `invoke input={{query:next.query}}`。异步响应启动新的事务，回调读取 `event.result/input/error`。新页成功后才入栈，slot 校验完整 card 后只渲染内部内容、独立保存状态。具体 API、语法、取消/轮询/并发与恢复约束见 [工具绑定与页面历史](tool-bindings.md)。

## 背景与材质 design tokens

新生成的卡片由模型选择一个 `visualStyle` 和一个简短英文 `backgroundQuery`，渲染器负责背景、蒙版、光影、材质及组件过渡。模型不输出 CSS、透明度、滤镜、动画时间或任意图片 URL。注册表 `shared/cardspec/styles.mjs` 同时供 prompt、编译器、实验室和运行时引用。

| token | 对应参考 | 宿主表现 |
| --- | --- | --- |
| `photo-glass` | A 摄影渐变玻璃 | 照片主导、下方渐深蒙版、克制的局部面板 |
| `tinted-glass` | B 染色氛围玻璃 | 染色背景、柔光、半透明高光边缘 |
| `liquid-glass` | C 液态玻璃 | 清晰背景、局部模糊、玻璃厚度与折射感边光 |
| `frosted-glass` | D 柔和磨砂 | 更强的漫反射与磨砂阅读面 |
| `smoked-glass` | E 烟黑舞台玻璃 | 深色烟玻璃、阴影、暖色轮廓光 |

```xml
<intro>记录今天的阅读进度。</intro>
<card schemaVersion="1" actionMode="snapshot" theme="soft" palette="a"
  visualStyle="liquid-glass" backgroundQuery="quiet forest lake"
  backgroundPosition="center">
  <state id="count" type="number" initial={0}/>
  <action id="add"><increment target="count" value={1}/></action>
  <region id="summary" role="summary"><title id="title">阅读片刻</title></region>
  <region id="content" role="content" overflow="scroll">
    <text id="countText">已阅读 {state.count} 页</text>
  </region>
  <region id="actions" role="actions"><button id="addButton" label="再读一页" onPress="add"/></region>
</card>
<outro>背景为氛围示意图。</outro>
```

`backgroundPosition` 仅接受 center/top/bottom，缺省 center。三个新增属性必须是静态字面量；有视觉样式就必须提供有效的背景关键词（1–100 字符）。未声明新字段的旧 CardSpec 继续按原主题渲染，DIL 入口保留。`theme/palette` 与材质 token 分开：前者保留已有排版/配色语义，后者由宿主覆盖必要的可读性和表面参数。

背景作为 `photoKey(query, 'background')` 资源优先进入每卡最多 12 个图片请求的队列，复用 Pexels 服务与本地缓存。背景加载失败不影响卡片交互；宿主保留渐变底色和阅读蒙版。摄影署名放在正方形紧邻下方，不占用组件高度。图片是氛围素材，不能作为事实或新闻现场证据。

材质采用分层阅读保护：深色 token 的蒙版用 `darken` 限制照片亮部，同时保留阴影细节；浅色磨砂用半透明白色蒙版保证背景亮度下限，并保留暗照片的纹理差异。蒙版混合隔离在背景容器，不影响 UI。局部面板以 24%–32% 色层、方向性高光、内外阴影及 4–9px 模糊塑造玻璃；pressable、月历、图表与纯正文区域共用该机制。已有面板的集合不再套整块玻璃；嵌套阅读区域关闭重复模糊，日期格不逐个创建模糊层。选中条目内的 badge 沿用选中前景色，避免金色底上叠深色标签影响阅读。无需增加 DSL 字段或模型输出长度。

`tests/browser/material-depth.spec.mjs` 对纯白/纯黑背景上的实际合成像素测量正文、辅助文字、状态文字及选中项对比度（阈值 4.5:1），并交叉验证五种风格与月历、轮播、图表、清单、输入卡在 320/432px 下的布局和交互。配合 `styles.spec.mjs` 检查图片失败回退、焦点/状态保持、减少动态效果和旧卡兼容。对比度测试不取代对复杂照片纹理的目视检查。

组件动效由宿主统一提供，不改变状态模型或通过换 key 重建输入节点；遵循 reduced-motion，减少透明度时使用更实的阅读表面。液态玻璃是轻量 CSS 材质近似，并非逐像素物理折射。可在 `/cardspec-lab.html` 的“风格”选项下为已有样例切换五种材质、图片成功/加载/失败状态和 320–432px 尺寸。

## 流式协议与状态

沿用 SSE delta v1。`metadata.format` 区分协议；新路径发送 `metadata.card_spec`，包含 schemaVersion、cardId、revision、context、theme/palette、data/state/derived/actions 和节点树。属性与文本表达式已编译为 AST，客户端无需再次解析模型原文。

`phase_begin/phase_end`、`message_stream_complete` 带显式 succeeded/failed/cancelled 状态；只有收到明确终态与完成标记才完成。服务端检测上游异常 EOF、token 截断和超时，用户中止会取消上游请求。输入限制 1MiB，结构错误 400、过大 413、未知 API/资源 404、错误方法 405。

不完整语法暂缓发布；有错误时保留最后有效版本。最多一次完整 DSL 修复，每个规划阶段最多修复一次 JSON。DSL 修复要求保留已发布节点 id、父子路径与状态类型；修复失败会明确失败而非伪装成功。初始可见控件使用受控事件预检动作类型，包括暂时 disabled 的控件；这不是所有未来状态的形式化证明。渲染中的 assistant turn 始终留在同一 React 树位置，结束只更新状态；节点类型稳定、状态以 cardId/stateId 保存。

对于已找到完整括号边界的非法表达式、错配闭合标签，编译器继续扫描后续独立节点并汇总诊断；恢复仅用于诊断，不允许带错误的树发布。修复阶段缓冲整个候选文档，只在流结束且完整校验通过后发布，不用半张修复稿替换当前视图。首轮正常流式生成保持增量交互。

属性表达式在引号外遇到 `/>` 且缺少最外层 `}` 时，诊断定位到起始 `{`，保留标签边界并继续检查后面的属性/节点。普通未闭合表达式也报告起始行号；合法字符串中的 `/>` 不触发恢复。这只改善修复信息，不自动补写源文件，也不发布有错误的卡片。

规划阶段将历史 assistant 卡片转成数据、初始状态及组件文本摘要，用户原始需求保留；完整历史 DSL 只用于最后的卡片生成。阶段1/2使用单一 system 阶段契约并请求 `response_format: {type:"json_object"}`，增量检查 JSON 前缀；出现组件标记等错误格式时立即取消该次上游流，最多纠正重试一次，避免等待完整错误 DSL。修复请求不再回灌错误 DSL。每阶段 metadata 记录 `model_call_count` 和重试时的 `retry_reason`，最终统计 `plan_repair_count` 与 `repair_count`。

阶段1/2在规划区域显示 Thinking 动画，CardSpec 规划文档通过校验后展示；阶段3及 direct 在卡片内部显示，尚无节点时居中，已有内容时缩为角落状态标识。动画不卸载卡片、不阻挡交互，完成、失败或取消即移除，并遵循减少动态效果的系统偏好。DIL 路径保留并共用这套动画。

## 通用布局

组件优先用留白、底色和阴影分层，减少重复描边。确需 outlined 表面或输入边界时保留低对比度边框并增加内边距；焦点、选中和 forced-colors 的边界仍可辨认。

grow 使用自然内容作为 flex 基准并保留最小内容高度，避免嵌套列表行被零基准压扁、按钮重叠。spacer 仍可伸缩到零；超出的列表内容由滚动容器承接。

mindmap/flowchart 依据容器宽度比较双向树、分层和横纵排列，按全部节点求自然高度；direction 为排列偏好。节点文字最多缩至 85%，大图仍保留平移与辅助缩放。节点间距24px。内置说明按所有 description 中最高者预留空间，选择短长节点均不跳动。提供外部富文本详情时设置 `detailMode="external"` 隐藏内置说明，避免重复抄写正文。返回边不参与重复层级递增。

图文 carousel 默认图片在上、文字在下，图片高度随卡片宽度调整。全部页保持挂载，按最长页内容（含内边距、边框）确定高度，取消固定上限和强行占满剩余高度。正常短页无需纵向滚动；模型应将长说明放到 details。

上述三个组件在生成期间随内容测量，生成结束后锁定高度，翻页、选择与zoom不会改变组件尺寸。容器宽度变化时重新测量；生成完成后新增或变长的动态内容保留滚动兜底。若完整内容超出正方形预算，整卡保持可滚动与可达，不为伪装fit而裁掉内容。布局监听测量结果，更新真实overflow诊断。相邻块额外2px留白，轮播页间距12px。

长文 region 可声明 `presentation="magazine"`：子节点作为文章片段排版，首段首字下沉，宽卡使用交错栏位、窄卡回到单栏。纯 text 按句界自动分段，保留全部原文；也可由模型用 strong/text/box 组织语义片段。避免把全文塞进有描边的面板。

320–432px 正方形容器。正文14px、caption12px，布局不整体缩小字体；按自然/紧凑/密集/最小四档调节间距、媒体与日期网格尺寸。流式期间同宽度只向更紧凑档移动，结束后重新测量。ResizeObserver/MutationObserver 驱动，避免持续轮询。

progress 的 label 同时用于可见名称和无障碍名称，组件显示四舍五入的百分比（原始 value 仍为 0–1）。无需再手写一个重复标签；多项指标不会只剩无法区分的色条。此表现适用于所有任务，未增加游戏专用属性。

- `region overflow="scroll"`：占据剩余空间，至少48px，内容局部滚动。
- `paginate`：按可用空间计算每页条目数，跨页状态保留。
- `details`：原生 dialog 展示次要内容和编辑字段。
- 固定内容仍超预算时，启用整卡滚动以保证内容可达，同时标记 `data-cs-fit="overflow"`；QA 将它判为失败。

在局部滚动仍不足时，纯文字脚注（顶层 caption，或仅含 caption 的 summary 区）可移到正方形紧邻下方的附注区；内容保留可见，不移动标题、交互控件或内容区内部的联动 caption。此规则适用于任意高密度主体，并通过 accessoryIds 记录调整。框架不会按“新闻”等业务关键词选择布局。

priority 是语义提示，当前不会据此自动删除内容或重写模型结构。模型应正确分配 overflow；如果仍超预算，宿主依次把过高且未声明 overflow 的顶层 content 区改为局部滚动，并在 automaticScrollRegions 记录。包含月历、轮播等完整选择区域的不自动折叠。实际测量目前发生在浏览器，尚无“浏览器几何诊断反馈模型再规划”的闭环；语法成功不保证布局成功。

月历只是一个受控选择组件，包含正确4/5/6周、闰年、月份切换、键盘导航。新闻、课程、预约等业务内容由 data + state + find/filter 绑定到普通文本区域。更改 selection 的 resetKey 可以复位说明区滚动。

月历在编译预览与运行时检查 month=YYYY-MM、selectedDate 与 markedDates 为真实日期字符串。月份优先 monthOf(context.localDate)，formatDate 也支持 yyyy-MM。自动事件字段使用 event，只有显式传入的业务参数才使用 args；换日/换月要同步加载对应草稿。保存索引用 append + when 去重，字符串数组过滤直接比较 item。可运行天气记录修复稿在 `shared/cardspec/experience-fixtures.mjs`。

内容体验优先一个与任务相关的记忆点与可见后果，例如条件比较、预测揭晓、可撤销的取舍；工具不强行游戏化。不新增场景专用组件，复用 state/derive/when、segmented/chips/slider/if。用户明确的步骤或事件数量优先于提示中的建议。实验室可用 `?fixture=weatherJournal`、`conceptLab`、`packingLab` 打开完成状态的样例。

图片有加载/失败状态。hero 题图至少112px高；thumbnail 是条目内64×64px小图。每轮最多解析12个不同 query/role，3路并发；循环内的 item.query 独立解析并去重。交互后出现的新 query 可在流结束后请求 `/api/photo`；资源以 query/role 定位，不会让循环项共用最后一张图片。

`image` 的 `query` 与 `assetRef` 必须恰有一个：`<image assetRef={item.assetRef} mediaRole="thumbnail" alt={item.title}/>` 引用宿主签发的真实素材，支持绑定表达式；异步缺失/null 显示占位。工具结果中的受支持图片字段会附带 `assetRef` 和 `assetKind="source-image"`。签名服务复用现有媒体来源白名单（当前支持豆瓣 CDN）、内容校验和缓存；模型不能自行构造任意 URL 或签名。Pexels query 显示示意素材标识，assetRef 显示来源图片标识；图片失败保留文字和交互，旧 query 用法不变。

Pexels 密钥仅在服务端读取：`PEXELS_API_KEY` → `PEXELS_API_KEY_FILE`（默认 `C:/Users/USER/Desktop/pexels.txt`）→ 原有 env 文件。支持裸密钥或 `PEXELS_API_KEY=...`，不会传入 prompt、SSE 或浏览器。图片由服务端下载到 `.cache/pexels`，通过 `/api/media/<hash>.jpg` 同源提供；检索结果缓存24小时，同请求合并，失败不永久缓存。仅下载 `images.pexels.com` 的图片，每文件上限8MiB，总请求限时15秒。磁盘缓存目前不自动清理。`PEXELS_DISABLED=1` 用于测试关闭真实调用。

客户端为题图和小图显示摄影师与 Pexels 链接；具体尺寸与署名依据 [Pexels API 文档](https://www.pexels.com/api/documentation/)。照片是示意素材，不代表新闻现场或精确物种识别。原版 DIL 的 AsyncImage 同样使用下载缓存并展示署名。

## 移动端与高阶组件（2026-10-12 增补）

新高阶组件属于 CardSpec 路径。模型只提供数据与关系，宿主计算布局和绘制，不接受 SVG/Mermaid 源码。

| 组件 | 数据与交互 |
| --- | --- |
| carousel | `carousel-item` 或 each 条目；原生横滑/吸附、前后按钮、页码、方向键。可选 index 与 onIndexChange，事件 `event.index`。所有页保持挂载，输入状态不会随翻页丢失。推荐步骤/展示列表，不强制替代所有 listing。 |
| slider | label、number 类型的 value/min/max/step、可选 unit。onChange 提供 number 类型 `event.value`，原生触摸与键盘交互，至少44px操作区。 |
| mindmap | nodes: `[{id,label,parentId?,description?}]`，一个根、无环、最多40节点；节点选择、双向滑动、75–200%缩放，onSelect 提供 `event.id`。 |
| flowchart | nodes: `[{id,label,description?}]`；edges: `[{from,to,label?}]`，最多40节点80边，支持分支和循环、横/纵布局、选择和缩放。 |
| chart | kind=`bar/line`，data: `[{id,label,value}]`，最多40点，可正/负/零/空数据；unit 可选。选择提供 `event.id/value/label`，标签含原始数值，超宽横滑。 |

图形为轻量浏览与选择组件，不提供节点编辑、拖拽改连线、多序列或坐标轴配置；复杂分析图暂不属于当前能力。六类可运行示例在 `shared/cardspec/mobile-fixtures.mjs`；实验室 `/cardspec-lab.html` 选 carousel/slider/mindmap/flowchart/chart/media。图片模式选“Pexels 实图”可验证真实下载。

## 观测与验证

### 短回合游戏与互动叙事

当前 v1 的 data、record 状态、derive、args 快照、事务动作与条件视图已能表达条件事件、跨回合记忆、反馈阶段和多结局，不增加题材专用组件或语法。

规划与直出提示词按任务启用玩法约束：2–3 个有取舍的指标、短回合、至少一个延迟后果；事件/选项数据复用一套视图和结算动作。规划只概述规则，不复制完整事件表；事件正文和选项保持简短以控制上下文及手机布局。工具类任务不自动加入游戏或幽默语气。

生成时要注意：

- 跨回合记忆用 record 按键追加，避免中性选择覆写之前的承诺。
- args 传入当前选项/必要原状态快照；derive 会随动作中的状态更新重新计算。
- 选择结算后保留反馈，用户继续才推进；先判断已完成回合是否为最后一轮，再递增，防止跳过最后一轮。
- 事件查找提供兜底；终局停止选择，重开清空记忆、指标、反馈和回合。

真实模型评估可用 `node scripts/evaluate-cardspec.mjs --cases=nurgle,station --modes=direct,staged --rounds=1 --base=http://127.0.0.1:8787`。`node scripts/explore-card-actions.mjs <生成结果.json> --reset-action=restart` 在深度/状态数上限内枚举按钮状态转换，检查每次动作和可见绑定，包括终局和重开。reset-action 应填写该卡片实际的重开 action id；检测重开状态与初始值是否完全一致，并停止重复遍历下一局。它不覆盖输入、随机性、弹窗可达性、视觉布局或任意规则正确性；规则取舍、结局可达性和实际浏览器交互仍需另外检查。

### 导航归属与联动辅助区

分页 region、carousel、calendar 使用统一导航契约，默认 `navigation="auto"`。需要自定义位置时设置 `navigation="external"` 并提供唯一的 `<navigation id="pager" target="ownerId"/>`。外部控件直接调用所属组件的动作、读取真实页数/月，不增加一份业务页码。外部控件尚未流入或条件隐藏时，内置导航自动恢复；零/单页不展示分页栏。月历仍可换月，不按当前月份数隐藏导航。外部导航暂不支持 each 内的重复所有者，循环内保留内置控件。

规划文档可以声明 `navigation: [{ownerId,kind:"page|month",controls:"builtin|external",controllerId?}]`，同一所有者只能声明一次。编译器诊断无效目标、重复控制器、缺失外部控制器、分页外壳仅包裹一个自带导航组件，以及按钮动作对受控 index/month 状态做重复步进。不依赖中文“上一页”等标签。独立列表各自分页、业务重置/筛选/收藏继续允许。检查并非任意复杂表达式的形式化证明；别名或间接动作仍需遵守显式导航契约。

空间规划先保障主体，剩余约60–100px且有任务价值时可放一个联动辅助区；密集主体改用 details 或留白，不自动塞小游戏。当前提供六个实验室样例：`shortlist`（浏览+候选收藏）、`quiz`（选择+反馈+解释）、`whatIf`（slider/轮数+结果）、`externalList`、`externalCalendar`、`externalCarousel`。这些组合复用现有组件与受控状态，不新增业务专用标签。

| 任务 | 可组合的辅助交互 | 与主体的关系 |
| --- | --- | --- |
| 浏览/选型 | toggle候选收藏、chips筛选、候选摘要 | 使用当前选择id，保留跨项选择 |
| 知识/学习 | segmented答题、反馈文本、if解释 | 答案决定反馈，解释可收起 |
| 参数探索 | slider、segmented、stat/文本结果 | 参数变化立即重算已有数据 |
| 步骤/清单 | checkbox、progress、下一步提示 | 使用真实完成状态，不重复分页 |
| 图表/图节点 | 选择说明、标记、details笔记 | 绑定selectedId，不追加无关统计 |

后续可评估可翻面问答卡、受控排序练习和双项对比视图；当前已验证的组合优先复用现有基础组件，拖拽交互还需键盘/触摸替代操作后再引入。

服务端分别记录 first_reasoning_ms、first_content_ms、first_card_ms、阶段耗时、图片耗时和 total_ms。客户端补充双 RAF 的 client_first_paint、布局档位/溢出，均从该轮请求开始计时。浏览器绘制指标是近似值，不是浏览器内部精确合成时间。

Inspector 屏幕只展示最近400帧，导出保存该轮完整事件轨迹。`npm test` 与 `npm run test:e2e` 覆盖解释执行、流式状态/输入焦点、可访问名称、对比度、月份边界、分页、图片、异常流及 HTTP 边界。真实模型评估与浏览器回放分开统计，避免把编译成功误认为任务通过。
