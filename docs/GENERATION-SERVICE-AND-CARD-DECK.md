# 统一生成、生成前取数与卡组

实施日期：2026-10-16。仅本地 8787；保留 DIL，不涉及 GPT Site。

## 架构边界

`server/cardspec/generation.mjs` 是初始卡、相关卡、下一页、slot 和 JSON 输出的共同入口。负责提示词、尺寸预算、体验规划、编译、富内容及引用校验、一次修复、媒体解析。HTTP handler 和工具服务只负责传输、会话编排及权限。原有 action 事务解释器和浏览器隔离机制不变。

参考 review 的“降低认知负担、让宿主承担重复逻辑”方向；该 review 实际检查的是旧 DIL，所列缺少图表、可信时间、外部数据等结论不直接套用现行 CardSpec。不重写 DSL，不把既有校验迁回 prompt。

## 生成前工具

共享研究会话增加 `cli_discover`、`cli_describe`、`cli_read`、`dataset_read`、`plan_cards`。工具 ID 来自现有目录，输入/输出继续经过同一 JSON Schema 校验。只开放当前可用的只读工具，拒绝写工具、未知工具以及递归 `glm.generate`。

- 初始请求总期限 300 秒；研究工具窗口 240 秒。
- 共享最多 3 轮工具请求、10 次总调用、6 次 CLI 读取、18,000 字符工具上下文、256,000 字符宿主数据。修复与相关卡共用预算。
- 数据集存于 `spec.context.datasets.D1` 等路径；模型只收字段、覆盖范围、总数及 4 条样本，按需再读最多 8 条。样本数量不代表源数据总量。
- 同工具同参数复用；可见时 binding 与预取参数一致，直接初始化结果，不重复查询。改参数按原 binding 规则刷新。
- 失败执行记录进入 trace，并保留到修复调用，明确区别失败与空结果。工具返回始终作为数据处理。

## 渐进披露

新增 `collection`：必需 `items`（含稳定 `rowKey` 或 `id`）；可选 `label/titleKey/fields/groupBy/presentation/partial/onSelect`。默认每页 4 项、宿主筛选、可选分组、最多三项关键值、选中反馈、可展开完整详情。`onSelect` 提供 `{id,value,item}`。支持 compact/gallery/timeline；只使用受信任 assetRef 图片，缺图保留文字。图片引用、选择、筛选及页码可恢复。

长 list 自动每 6 项披露；仅包含 each 的长 scroll region 转为现有 paginate，混合摘要、表单、动作的 region 不自动改写。工具结果浏览器保留表格选项并分页。

## 后续意图和卡组

模型可用 `plan_cards` 提交 1–3 张互补卡的标题/目标，及当前页至多两个后续意图。它不生成正文、不再调用一次规划模型。DSL 每次仍只能有一个 card。宿主先发布首卡，再逐张生成剩余卡；各卡独立 ready/error，不因一张失败清空其他卡。提交后锁定计划，禁止递归扩展卡组。

后续按钮触发时读取当前状态、宿主 collection 选择及有限工具证据；合并重复点击，输入变更或离页时不提交陈旧结果。默认生成下一页，用户返回恢复原状态。现有显式 slot / binding 方式继续可用。

卡组导航与每卡历史栈分离，切换相关卡不等于下一页。导航条及卡片边缘支持 swipe，内部 carousel/slider/图表/表格优先；有历史时边缘先交给该卡历史。已完成卡片切换不重复 GLM。sessionStorage 保存卡组位置，每卡使用独立现有会话存储；存储失败明确提示。

### 卡内宿主操作区

后续生成、页面历史、卡组导航、工具结果浏览/重排/重试均渲染在卡片边界内，由宿主通过 footer/overlay 插槽交给 CardContent 或 ResultBrowser。方形卡保持既定外尺寸，正文使用扣除操作区后的实际空间；不限高模式自然展开。工具管理入口默认折叠，复杂状态下操作区可内部滚动；没有操作时不留空白。布局测量监听正文尺寸变化，正文溢出时仍能滚动访问。卡组导航手势不被卡内历史拦截。

这是面向独立卡片载体的宿主布局调整，不改变生成协议或增加 prompt。未来 HMOS 渲染适配可采用同样的“正文、宿主操作、状态覆盖层”职责划分；平台能力映射需在移植时实现。

## 验证和当前限制

详见 `artifacts/generation-refactor-qa/report.html`：258 项自动测试、原有完整 20 例真实 GLM、6 类新场景、真实 12306/豆瓣，以及浏览器交互和六种尺寸回放。

原有 20 例首次 12/20、一次修复后 18/20。不能把编译通过当作业务正确。新场景仍有跳过查询、时间筛选错误、失败误写成空结果、事件参数复用错误；这些保留原文。工具前置是模型可用能力，不保证模型每次主动使用。不做按示例关键词强制选工具。当前后续意图清单属于首卡；相关卡可继续通过 DSL 声明自己的交互，不自动复制首卡意图。

回归命令：`npm test`、`npm run build`、`node scripts/benchmark-direct.mjs --formats=cardspec --out=<目录>`、`node scripts/qa-generation-refactor.mjs`、`node scripts/qa-generation-live.mjs`。测试脚本不直接创建/关闭真实 OpenCLI 服务；真实查询走正在运行的宿主，保留 Owl 绑定。
