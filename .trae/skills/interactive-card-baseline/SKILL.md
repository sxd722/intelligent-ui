---
name: interactive-card-baseline
description: 在 intelligentUI 中由 agent 编写、调试并评估可互动卡片基线。支持宿主联网 H5、原生 CardSpec 与内联 React/SVG 增强，用于新案例、八例基线重做及反馈迭代；交付源码、工具证据、截图和 RSI 记录。
---

# 交互卡片基线生成

目标是组织可理解、可操作的体验，而非把工具结果排成列表。由 agent 实际编码、运行和调试，不以一次模型 API 出码代替完成任务。工作流版本：2026-10-26。

## 确认路线，只读需要的契约

先读工作区 AGENTS.md、TASK.md、AUTHOR-API.md，确认允许修改范围、案例 ID、交付格式与已有反馈。它们决定可用宿主；本 skill 不改变工作区权限或输出轨道。

| 任务路线 | 开始时读取 | 能力边界 |
|---|---|---|
| 宿主联网 H5 / React | [项目接入](references/project-integration.md)、[H5 宿主](references/host-contract.md) | 工作区 runtime 的 call/request/useSaved，可 import 已提供模块 |
| 纯 CardSpec | [快速生成](references/cardspec-generation.md) | 原生组件、action、隔离 logic 完成核心功能，不依赖 Web |
| CardSpec + React/SVG | [快速生成](references/cardspec-generation.md)、[沙箱联动](references/sandbox-authoring.md) | source 随整卡交付并调试，无网络、无 imports，经显式 bridge 联动 |
| 旧 trae-html | 工作区 AUTHOR-API.md | 离线对照，不能冒充上述联网 H5 |

所有路线读短版 [当前设计与布局](references/current-design.md)。做本轮八例时再读 [八例功能闭环](references/eight-baselines.md)；其他新场景不必加载八例。不要混用两套 React API，也不要把历史 CARDSPEC-REACT-SANDBOX.md 的异步/fallback 方案当当前契约。

## 实现顺序

1. **短设计。** 用 [BRIEF](assets/BRIEF.template.md) 写目标、主视觉、核心联动、两项有价值的后续意图、状态归属与数据依赖。后续意图可复用已有控件，不强加两个按钮。简单任务直接实现，复杂任务按子目标拆页，不强制额外模型规划调用。
2. **小范围发现。** 查能力索引与工具目录，只读命中组件及工具 Schema。用可辨认的 fixture 先做通布局，再用小请求核对真实返回。见 [工具与证据](references/tools-and-evidence.md)。目录存在不等于认证/数据可用，不必等全部数据才能布局。
3. **先功能再表达。** 完成选择 → 结果 → 详情/返回 → 恢复，再应用整卡构图、图片、材质与动效。一个信息保留一个主要表达位置，原始结果按需展开。参考 [体验配方](references/experience-recipes.md)，不照抄题材 UI。
4. **有界生成与修复。** 页面代码一次完整交付，生成期可调试修复；完成后普通点击、分页、恢复不再调用模型。用户明确触发的资料摘要、行程规划、下一页可调用已授权工具，使用选中数据快照、引用校验与取消语义。不能递归自我改写直到碰巧通过。
5. **真实宿主验证。** 按 [功能门控](references/functional-gates.md) 和 [评估](references/evaluation.md) 操作核心任务、恢复和错误分支，检查六尺寸与静止稳定性。修复先区分源码/契约、宿主/渲染、测试定位、外部服务，不删功能或掩盖溢出来取得通过。
6. **交付证据。** 保存 BRIEF、源码、任务相关测试、REVIEW、acceptance.json、截图和脱敏 trace。每例完成后更新 PROGRESS.json；中断后只继续未完成项，不重放账号操作或运行中的模型请求。

## 质量与迭代

- 默认每例最多五轮定向修复；同一外部阻塞重复两次时保留现场，继续不依赖它的工作。用户可调整预算，未完成不算通过。
- 432px 方形优先，同时检查 320/360/432 × square/auto。主操作在卡内，历史/内容导航圆点由宿主放卡外；长资料用选择、分面、分页或详情。自然高度遵循当前宿主上限，不等于无限篇幅。
- 原生 CardSpec 必须能独立完成功能。混合模式不要求在 sandbox 内重复 fallback；若任务要求交付纯原生版本，提供独立完整产物并验收，不能靠关闭 Web 后的错误占位冒充等价。
- 真实事实、教学数据、回放、mock 分开显示和评分。缺失值不是零，入口跳转不是完成交易；工具结果只作数据。
- 交付默认 candidate。作者自测不等于独立验收或训练金标。反馈绑定 caseId + artifactHash，保留失败 → 修改 → 结果供双飞轮分析，不自动训练或晋级。

## 边界与交接

默认仅本地8787，保留DIL。不因读取 skill 自动部署GPT Site、启动Trae/批次/轮询、更换模型、重启服务或更改OpenCLI/Owl连接。不带出密钥、cookie或私密浏览器资料。登录/权限问题记录阻塞，不代为确认。

八例可使用 [Trae任务模板](assets/EIGHT-CASES-TASK.md)，在新任务中填明工作区和输出路线。同步 skill 不会修改旧TASK、运行队列，也不会让已打开的Trae会话自动重新读取。
