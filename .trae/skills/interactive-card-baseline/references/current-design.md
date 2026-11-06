# 当前设计与布局（2026-10-26）

原生能力以 `shared/cardspec/compositions.mjs`、`registry.mjs`、`contracts.mjs` 和 `src/cardspec/CompositionLayout.jsx` 为准。在独立 H5 中借用设计语言，不假定 CardSpec 组件或 CSS 自动存在。

## 整卡构图，不是装饰页头

| design | 适合表达 | 已有实现可参考 |
|---|---|---|
| pearl（月距力） | 整体比例、参数模拟 | 珠光主体 + 大数值 + 一条比例表达 + 紧凑控制 |
| atlas（动态学术） | 关系、矩阵、计算 | 一个计算舞台 + 当前步骤解释 + 固定操作 |
| rebel（Persona） | 活动、候选、人物 | 海报菜单、时间排版、标签与选中层级 |
| parchment（羊皮纸） | 阅读、叙事、历史 | collection folio 章节插画与视角切换 |
| business（专业商务） | 统计、趋势、比较 | 共用刻度、清晰口径、少量关键指标 |
| academy（辉石学院） | 探索、揭晓、反思 | collection spread 选择与揭晓，不强套不相关任务 |
| default | 通用工具和表单 | 清晰的主体、控制、操作分区 |

风格服务任务；同一任务可以有多种表达。`composition="auto"` 通常足够；显式值只有 `focus/stage/menu/flow`，不要发明 token。固定实例的风格、素材和裁切，点击/刷新不重新随机选图。

CardSpec 顶层建议：title + 短 caption → 一个主体 → slider 或单一 segmented → 末尾 button / region role="actions"。宿主只投影直接节点，不会拆开任意嵌套作用域来救布局。保留必要作用域并在真宿主验证。`surface="bare"` 去组件外壳，由整卡管理层次；不要重复标题、数值和底板。

比例用 chart kind="proportion"（非负部分/整体）；正负比较用 comparison 且共用 scaleMax；计算用 heatmap/flowchart；候选用 collection gallery/poster。缺数值不硬画统计图，无关系的条目不强行连图。

## 图片、材质与动效

- 图、短标签、当前解释承担信息；一般非阅读首屏约 180–260 字是设计目标，不是硬截断。必要答案与证据始终可达。
- 图片用于识别/比较，背景不计作内容图片。实体优先工具 assetRef，Pexels query 为示意，保留来源。失败后文字、选择、操作仍可用。
- 宿主 PhotoStage 负责裁切、蒙版和回退；backgroundPosition 与 backgroundMask 分别控制主体位置与显露方向，只用注册值，不给文字再套照片蒙版。
- 半透明面区分区域，减少边框和嵌套玻璃。交互通过选中态、可辨认按钮、焦点和反馈可发现；保留键盘焦点与合理触控区域。
- 宿主 motion/motionKey 表达更新；CSS 持续动画用于轻量氛围/运行状态，避免循环改变 width/height/margin/font-size。reduced-motion/off 下仍可理解结果。
- 宿主管左右滑动、平移过渡与卡外圆点，不再重复“上一屏/下一屏”控件。内部 carousel、slider、图表拖动保留自己的手势。

## 高度与稳定性

预算属于宿主，不把所有路线写死为 680px。CardSpec 自然上限依 viewport 和宿主控件计算（上界 780px）；旧 H5 工作区可能是 auto max680px，按其 AUTHOR-API.md 实现，不为统一数字修改宿主。

原生布局已修复小数 DOMRect 与整数 clientHeight 混用导致的 433/434px 循环。随父空间展开的组件经 useCompositionSpace 声明需求，宿主先给确定预算，避免“父高由子高决定、子高又读父高”。作者不再写第二套 ResizeObserver/iframe 高度回传循环，不以冻结首次高度、关闭动画或裁切必需内容掩盖问题。

在字体/图片完成、切换动效结束后连续采样。检查内层 scrollHeight/clientHeight、主操作遮挡、分页是否反复增减；正常 transform 动画不能改变布局预算，真实内容/视口变化仍须适配。

入口：`/design-templates.html`、`/cardspec-lab.html`。模板是参考，不是全尺寸通过保证：本轮 academy 仍有装饰旋转相关溢出诊断，应看 DOM/截图判定，不能无条件忽略。
