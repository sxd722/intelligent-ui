# 生成式交互卡片引擎（generative card engine）

模型驱动的生成式交互卡片全链路实现:三阶段生成管线 + 流式增量编译 + 方形画布自动布局引擎 + 六语言主题系统。

## 渲染协议选项（2026-10-12）

顶栏 **协议** 下拉框默认选择 **CardSpec v1**，使用声明式编译与解释执行路径；仍可选择 **DIL（原版）**，原有编译器、组件和 JavaScript 运行时保留。CardSpec 可选 `direct / experience / staged`，DIL 保留 `direct / staged`。下文未注明的原有管线说明描述 DIL；新协议详见 [CardSpec 契约](docs/CARDSPEC.md)。

体验规划（2026-10-15）：点击顶栏 Pipeline 切换到“体验规划 → 卡片生成”。初始卡、下一页和 slot 先生成有限的体验骨架，再生成 CardSpec；25秒规划超时/格式错误回退原生成，不增加自动审稿调用。成功骨架替换重复设计建议；三阶段复用原交互规划。当前保留 direct 默认，只有质量门槛通过后才提升 experience。图片可使用 Pexels query 或宿主签名 assetRef；图节点选择高亮关联、图表数值平滑过渡。实施与真实回归见 `artifacts/experience-qa/report.html`，匿名回放入口 `/experience-qa.html`。更新仅本地8787。

CardSpec 提供受控状态/动作、稳定节点身份、通用区域滚动/分页/详情、固定字号的离散布局密度，以及通用月历组件。日历和新闻的关联由模型生成的数据绑定完成。测试实验室：启动服务后打开 `/cardspec-lab.html`。

移动端增补：CardSpec 的 carousel 现有吸附、页码及前后操作；新增 mindmap、flowchart、chart（柱状/折线）、slider。模型会按任务选择 carousel，不要求所有列表轮播。Pexels 图片支持 headline 大图、循环条目小图、本地下载缓存及署名，服务端默认读取桌面 `pexels.txt`。可在实验室选择六种新样例并切换“Pexels 实图”。详见 [组件与图片契约](docs/CARDSPEC.md)。

```bash
npm test             # 编译器、表达式、状态、DIL 回归
npm run test:e2e     # Playwright + 独立模拟上游，不消耗模型额度
npm run qa:cardspec -- --base=http://127.0.0.1:8787  # 真实模型，默认42次请求
npm run qa:replay -- --base=http://127.0.0.1:8787    # 回放真实结果并检查布局/交互
```

浏览器测试需先安装 Playwright Chromium，或通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向本机 Chromium 可执行文件。真实 QA 结果包含原始 DSL、完整 SSE、指标和错误，保存于 `artifacts/cardspec-qa/`；测试上游使用独立假密钥。

```
用户输入 ──► 服务端
              ├─ 调上游模型(glm-5.3-flash @ 火山云网关,流式)
              ├─ 每个 flush:容错重解析(recovered parse) + 重编译
              │    ├─ parts[0]           模型原始 DIL 源文本(append)
              │    ├─ model_dil_v2.code  编译出的 JSX 程序(整段 replace)
              │    ├─ model_dil_v2.constants 静态文案常量表(按 key 流式 append)
              │    ├─ model_dil_v2.fallbackMarkdown 降级 markdown(并行维护)
              │    └─ recoveryDiagnostics 未闭合标签/块的恢复诊断
              ├─ AsyncImage 解析:resolutionId(uuid) → url_moderation → componentResults patch(占位→Pexels 实图)
              └─ delta_encoding v1 帧流(SSE):message 控制事件 + JSON-Patch 变体(含简写帧)
                     │
客户端 ◄────────────┘
  ├─ delta 引擎:root add / patch 批 / {v:…} 简写;append = 串拼接 / 字典按键合并 / 数组 push
  ├─ DIL 运行时:new Function("DIL","AsyncImage", code) 执行程序
  │    ├─ __dilSafe 全包裹(表达式异常→null,卡片不白屏)
  │    ├─ DIL.useState(v,{key}) keyed 状态存储 → 流中反复整段重编译仍保交互状态
  │    ├─ 字符串 tag → 宿主 React 组件库(data-d-* 属性 + design tokens + 自动间距)
  │    └─ 降级链:DIL → fallbackMarkdown → 空
  └─ 流式动画:文本按词切 span(data-d-stream-word),新词淡入不触碰旧词
```

## 三阶段管线与 reasoning 展示

顶栏 `Pipeline` 可切换:

- **3-phase（可选）**:
  1. `阶段 1 · 信息规划` —— 模型推理(意图/需展示信息/交互能力/资源/边界),产出 markdown 规划文档
  2. `阶段 2 · 交互方案` —— 基于规划发散设计(概念/布局/状态/交互流/视觉基调/逐字文案),prompt 骨架取自 ui-skills `mengto/design-first-ui-prompting`
  3. `阶段 3 · 卡片成型` —— 按方案输出 DIL,服务端增量编译渲染;视觉规范融合参考卡结构 + ui-skills `ibelick/baseline-ui`(单强调色、禁随意渐变、字阶层级、入场 ≤200ms ease-out)
- **direct（默认）**: 跳过 1/2，单步生成所选协议。
- **experience（CardSpec 可选）**: 体验规划 → 卡片生成，页面/slot沿用同一机制；数据刷新和历史恢复不规划。

每个阶段都会把上游 `reasoning_content` 流式 patch 到 `/message/reasoning`,前端以**浅色折叠块**实时展示(流式中展开,阶段结束自动收起,可手动展开)。

**glm 网关的 effort 语义**(实测):默认档会流式输出 reasoning,但内部思考 token 计入 max_tokens 且常超 10k,预算不足时可见内容为空甚至断流;`reasoning_effort: low/high` 则完全不下发思考流;`max` 思考更长。因此本实现:阶段 1/2 用默认档 + 8192 预算(思考可见、内容存活),阶段 3 固定 `low`(稳定完整出卡),阶段 3 断流自动同参重试一次。

## 运行

```bash
npm install
npm run build     # 构建客户端到 dist/
npm start         # http://127.0.0.1:8787(单进程,同时服务 API 与静态文件)
# 或开发模式(两个进程 + 热更新):
npm run dev       # web @5173(proxy /api -> 8787), api @8787
```

## API Key(黑盒)

密钥从 `C:/Users/USER/Documents/trae_projects/cot-genui/flywheel_genui.env` 在**服务端启动时**读取,
仅在进程内用于 `Authorization: Bearer …`,不会进入日志、响应流或前端。可用环境变量覆盖:

- `APIKEY_FILE` — env 文件路径(支持裸 token 文件或 `KEY=VALUE` 行)
- `MODEL_BASE_URL` — 模型网关(默认火山云 `…/v1`)
- `MODEL_NAME` — 默认 `glm-5.3-flash`

## 协议形态(与参考实现逐项对齐)

| 参考实现 | 本项目 |
| --- | --- |
| `delta_encoding v1` WS 帧 | 同形态 SSE 帧(`message` 事件 + delta 对象) |
| `{"p":"","o":"add","v":{message…}}` | 相同 |
| `{"o":"patch","v":[{p,o,v}…]}` | 相同(append 语义扩展也一致) |
| 简写帧 `{"v":"…"}` 沿用上个 op | 相同(连续纯文本 append 时发送) |
| `model_dil_v2.code` 形态 | `__dilSafe` preamble + `DIL.render((()=>{…})())`；避免每次增量创建新的 React 组件类型 |
| constants 常量表外置 + 按 key append | 相同(值相同的字符串去重复用) |
| `recoveryDiagnostics`(unterminated_tag / unclosed_block / unterminated_braced_value) | 相同,流末干净后 remove |
| AsyncImage:resolutionId 常量 + `componentResults` + `url_moderation` + 三层 `safe_urls` | 相同(图片由本地 `/api/image` SVG 占位服务模拟搜索结果) |
| `genui_components`(tree_range / start_index / end_index / genui_attributes) | 相同 |
| 逐词 `data-d-stream-word` span 动画 | 相同 |
| keyed `DIL.useState` 流中保状态 | 相同 |
| fallback markdown(含 `\ue200image_group\ue202{…}\ue201` 标记) | 相同 |

## 安全说明

客户端用 `new Function` 执行**服务端编译产物**——这等价于执行模型生成的代码,
仅适用于本地演示;生产环境应放进沙箱 iframe(带 postMessage RPC + token 握手)。
`url_moderation` / `safe_urls` 在本项目中由同源图服务承担,保留完整管线形态。

## 目录

```
server/            Node 无框架服务端
  env.mjs            黑盒 key 加载
  prompt.mjs         DSL 规范 system prompt
  compiler/parse.mjs 容错流式解析器(AST + 诊断)
  compiler/codegen.mjs 编译器(程序字符串 + 常量表 + fallback + genui_components)
  index.mjs          SSE / delta 协议 / 上游调用 / AsyncImage 管线 / 占位图 / 静态托管
src/
  delta.js           客户端 delta 引擎
  App.jsx            聊天 UI + Stream Inspector(frames / compiled / source / fallback)
  dil/runtime.jsx    DIL 运行时(jsx/render/useState/useConstants/useAppData + 降级链)
  dil/components.jsx 宿主组件库(box/row/text/title/badge/button/checkbox/input/grid/AsyncImage…)
  dil/icons.jsx      内联图标集
  styles/            tokens(明暗) / dil 组件样式 / 应用样式
```

---

## 渲染系统 v2(2026-10)

**6 种设计语言 × 3 配色,由模型在阶段 2 选择,渲染端实现全部视觉:**

| 语言 id | 名称 | 配色 a/b/c |
|---|---|---|
| editorial | 编辑杂志 | 宣纸朱砂 / 冷刊钴蓝 / 暖沙墨绿 |
| soft | 柔和氛围 | 奶油蜜桃 / 薄荷奶白 / 云朵丁香 |
| precision | 精密数据 | 石墨电光蓝 / 冷白祖母绿 / 炭黑琥珀 |
| playful | 玩趣块状 | 柠檬黄墨线 / 糖果粉天蓝 / 草地绿橙 |
| dark | 暗夜沉浸 | 午夜霓虹青 / 炭紫品红 / 墨绿酸黄 |
| minimal | 无感极简 | 纯白雾蓝 / 暖纸赭石 / 石墨冰蓝 |

- 阶段 2 输出 `视觉语言: <id>/<a|b|c>` → 服务端校验 → SSE `theme` 事件 → 客户端 `.dil-stage[data-theme][data-palette]`(`src/styles/themes.css` 重映射全部 DIL token)。
- 模型 DSL **零颜色、零尺寸**:层级只靠组件选型与 text/title 的 size 档位;语义色 success/warning/danger/info 是唯一例外。
- 静态预览: `/demos/`(六语言 demo 页,`demos/` 为源,build 后需重新 `cp -r demos dist/demos`)。

**自动布局引擎(`src/dil/autolayout.js`)— 尺寸的唯一权威:**
- 输入:4:4 方形画布边长、同类组件数量、文本长度、父子上下文;输出 `--spacing/--font-scale/--u-*` CSS 变量。
- 溢出分档吸收:间距 → 媒体高度(carousel/hero)→ 控件高度 → 字号(下限 0.68)→ 仍溢出则卡内滚动(带底部渐隐)。
- 流式感知:MutationObserver + ResizeObserver + 稳定性衰减定时器(约 10s 稳定后停止)。

**x 轴利用(steering):**
- chips:响应式二维网格(`--u-chip-col` 列宽)。
- 清单/勾选组:容器含 4+ 项自动两列、7+ 三列(`:has()` nth-child 规则);10+ 项组件内滚动。
- 新组件 `stats`/`stat`:页头指标条,多列网格;相邻 caption 自动横排。
- 标题图:扁平全出血横幅(负边距抵卡片 padding,高度 `--u-hero-h`,下限 46px),加载后应用上清晰→下透明 mask。

**Pexels 真图(steering):**
- key 黑箱读取:`Desktop/pexels.txt`(或 env 文件 `PEXELS_API_KEY=` 行 / 环境变量);与模型 key 隔离,值永不入日志/上下文。
- AsyncImage 解析:查询 Pexels(横向、缓存 24 条、4.5s 超时)→ 真实照片 URL 走既有 url_moderation + images patch 协议;失败自动回退本地纸纹占位图。
- 流尾排空:关闭 SSE 前等待未完成解析(上限 9s),消除"图永远 loading"竞态。

**对话流与卡片分离(steering):**
- 开场/收尾散文句子从编译程序中剥离(`splitCardText`),经 `metadata.card_intro/card_outro` 增量下发,渲染在卡片上/下的对话流里(带流式光标)。

运行:`npm run build && npm start` → http://127.0.0.1:8787 (demos 需重新拷入 dist)。

---

## 布局改造(2026-10,P0 落地)

依据 docs/LAYOUT-REFORM-PLAN.md 与 docs/SPATIAL-PLANNING-ANALYSIS.md:

- **防爆破契约**: 全组件 min-width:0;icon/badge/button/rating/divider 不收缩;媒体按上下文定尺寸(根直下=hero 全出血横幅、横排 row 内=3:4 竖版缩略图、carousel/grid=槽位)——模型永不写图片尺寸。
- **文本引擎变量化**: 字号/行高/字距走 --text-* 变量;字重令牌 --font-weight-*;小字号 strong 自动降为 medium;正文默认 tabular-nums。
- **密度分档引擎**: 字号只在 natural(1.0)/compact(0.92)/dense(0.84)/floor(0.78) 四档移动,不再连续缩放;挤压按优先级(媒体→间距→控件→密度);流式期间密度档单调不回升,消除 grow-shrink 震荡。
- **截断契约**: <text clamp={2}/> 行数预算,计入引擎高度预算。
- **预算菜单 prompt**: 单位表(header≈12u/hero≈15u/行≈10u/页脚≈10u)让模型显式算术;polish 规则(同块≤2种字号、单一对齐、数字独立成列)。
