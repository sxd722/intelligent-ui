# B0 / B1：首轮基线校准

本地研究 `round1-20261117`，2026-11-17。遵守 AGENTS.md；不替换 CardSpec/legacy DIL，不发布 GPT Site，不推送 GitHub，不变更 OpenCLI/Owl 连接。

## 源码身份

- 原工作区不是 Git checkout：`workspaceGitCommit=null`，不能把镜像提交冒充当前工作区 HEAD。
- 最近脱敏 GitHub 镜像提交：`d9ea2fc44ecf9947965f53529dfad2d31bd8eae0`。
- B0 原样源码归档：`B0-source.zip`；逐文件清单：`B0-files.json`，共 1382 个文件。
- 归档文件清单的源码摘要：`11a6a38efc96da1b584a71bbaec985d3d3ad15f6462785bea861058b2afb83c8`。
- 最终候选构建、文件内容及实际请求参数以主 manifest 和每个 run 的 `effective-config.json` 为准；本文件不提前猜测它们的值。

## B1 共同基线

本轮 P0 没有引入公共能力修复，B1 的产品语义沿用 B0。新增实验配置、精确参数记录与验收材料不计作某个处理的质量收益；候选能力均按单个请求的实验标记启用，其他请求保持默认路径。

| 已有能力核对 | 结论 |
|---|---|
| 组件选择与按需精确契约 | 已存在。S1 只对“初始已选相关契约 vs 短索引后按需展开”做披露消融，不声称新发明按需发现 |
| 工具发现、describe、读取、binding recipe | 已存在；首批不同时改排序、工具目录与权限 |
| LogicPanel tick、单步/播放、离屏暂停、保存 | 已存在；不另造业务时钟 |
| logic → sibling sandbox 当前状态 | 原有边界未提供通路。H2 是新增架构能力，不是 B1 修复 |
| 宿主空间预算和 compact 布局 | 已存在。H1 在相同视口下比较现状与主体空间/紧凑操作候选，不把增加高度作为唯一收益 |
| debug/repair/最佳候选与 RSI | 已存在；实验复用并保留源版本、实际配置和全部尝试 |
| 写操作确认/去重/unknown | 隔离测试 9/9；细节及账号身份局限见 `p0-write.md` |

## 已探测环境

读取 `capabilities.json` 的实测：

- 编译器 fixture：通过；真实独立浏览器回放探针：完成。
- Chrome/157 独立 headless 浏览器；Canvas2D=true，WebGL=true，截图=true，WebGPU API=false。
- 文本与图像模型探针均完成。请求 `volcengine/deepseek-v4.1-flash`，实际返回 `deepseek-v4-1-flash-261017`；本次图像颜色探针正确，不等于复杂界面识别质量已验证。
- 真实 OpenCLI 公共 Wikipedia 读取已执行四次，证据在 `data/live-attempts.json`。这些调用证明具体端点当次可读取，不证明需要登录的网站或真实写可用。
- 产品生成比较使用上述真实返回的固定 `recorded-live` 快照；不将回放成功宣传成当前网站在线。
- 本轮没有对 GPT Site、其他云端或用户已登录浏览器做能力复验；相关结论不外推。

## 公平性冻结

产品链路每条件上限：8 次模型请求、2 个定向源码修复版本、240 秒墙钟、12 次外部读取。评估器不调用模型。图像修复分支与无图分支共享同一 B1 初稿，其初稿模型成本只计一次。

相同任务固定领域数据、工具快照、能力清单、表达式模式、视口、资源政策与验收深度；模型不支持可核实 seed 时不声称固定模型随机性。任务/浏览器模拟种子与调度种子可以固定，须与模型采样区分。

成本只使用实际 API 返回 usage 与已知价目；未知价格保留 null。工程构建/机制测试成本、P0 探针、产品生成、独立验收分别记录。模型失败不得用基础设施重跑覆盖。

## B1 成功的边界

P0 fixture 成功只证明对应宿主路径，不证明四个新任务或任意生成产物通过。B1 每题仍需实际生成、独立业务断言、恢复和截图验收。展示上保留 failed/partial/unverified，不因能渲染或截图好看提升为 passed。

## 共同基线演变索引

初始 P0 的“没有公共修复”结论保持原样；不能把之后校准追写成首批原本已具备的能力。各阶段分开统计：

| 阶段 | 共同基线与变化 | 运行和归档边界 |
|---|---|---|
| 首批筛选 | B1 r1；C1 r2 为首次使用前的候选诊断修复，V1 r2 为同稿分叉 harness 校准 | progress 前 28 槽，21 次实际条件尝试，7 项 NA；原结果不覆盖 |
| r3 校准 | expect 公开 Schema 对齐；唯一 CardSpec 修复计数与耗尽停止；显式 recorded-only 与授权有序前缀回放；H1 v2/H2 契约是候选变化 | 4 个新增主运行；candidate-r3-20261117T075427Z，独立新 source/build hash |
| r4 确认 | 共同修复严格回放与 intentional empty/failure 的区分；仍保留旧 H1 v1，比较明确使用 v2 | 12 个新任务条件运行，不并入首批；candidate-r4-20261117T081202Z |
| P2 pilot | 共同基线仍为 r4；增加 H1S1 实验编排轴，00/10/01/11 四格；不改产品或 renderer | experimentPhase=P2-pilot-r1，8 个新主运行；candidate-p2-pilot-20261117T084302Z；源代码身份更新、r4 构建逐文件未变 |

具体公共修复的原承诺、最小复现和边界见 common-calibration/README.md；所有实际身份见各 run.code 和 provenance。初批进程加载身份缺口单独记在 provenance/README.md。后续运行不是免费基础设施重抽。

P2 pilot 是已预登记的互补机制探索例外，12 次 r4 确认没有获得默认晋级候选。其理由与停止条件见 continuation-r4.md；报告不提前宣称组合有效，也不将新运行与旧版本混算。
