# CardSpec 快速生成与有界调试

用于原生或混合 CardSpec；H5 作者继续使用宿主兼容与功能验收指南。本文按需加载，不追加到每次生成的系统 prompt，不增加固定规划或审稿调用。

## 最短正确路径

1. 先确定一个核心操作闭环及状态、数据依赖。简单任务直接实现；只有多个独立视图或复杂依赖才做短规划，不强制 `plan_cards`。
2. 使用能力索引找候选，再读精确契约：源码入口 `shared/cardspec/capability-index.mjs`，契约在 `registry.mjs`、`contracts.mjs`。生成服务提供 `capability_find`、`component_describe`（一次最多 6 个）；CLI 使用 `cli_discover` / `cli_describe`。这些是宿主暴露的模型工具，不是假定 Trae 可执行的 shell 命令。不要整份粘贴组件库和全部工具目录。
3. 用工具的真实 Schema 建立数据边界。先用可辨认的 fixture 完成布局、筛选、详情和恢复；实际取数后校验 ID、时间、空值，保留失败/空状态。不要为了布局等待所有工具；也不要把 fixture 当真实证据交付。
4. 输出一个完整 card，主视觉 + 当前选择 + 按需详情。优先复用原生组件，只有高阶表达才用已允许的 sandbox；禁止 Web 时核心功能仍完整。遵循既有 snapshot/state/next 事务语义，先确认读取时点再写多步动作。

## 已支持的容错不是新的写法负担

标准输出仍用明确的 `onPress="actionId"`。编译器兼容无冲突的字面量 onClick 动作引用；不接受 JSX 回调函数或冲突事件。可点击 list-item 与富内容 button 支持结构化子内容，但不能嵌套交互控件。单一完整 card 外的普通说明可被记录为 warning；多 card、残缺结构和不安全表达式仍需修复。

## 调试与提交

- GLM 生成服务**启用调试时**才提供 `card_test` / `card_commit`。测试后使用返回的可见控件 handle，不猜选择器；标签改变后不要依赖旧文案。定位失败时修正步骤，沿用同一源码版本复测。
- 已测试版本用 `card_commit({version})` 提交原样源码，不再重写一遍，不把提交与取数放同轮。failed/unverified/stale 版本不能提交；partial 必须保留未测范围。工具不可用时走已有正常生成流程，不虚构调试结果。
- Trae 自主编码使用工作区 build、单元测试和允许的浏览器驱动；上述模型工具不是公共 HTTP 路由。已注册案例可用项目的 rsi-agent check/verify，未注册案例按 TASK 指定验证。
- 固定源码/宿主/fixture 版本，记录实际执行步骤。正常、空、失败场景分别定义预期；前置定位失败后的依赖步骤标 skipped。mock 交互通过不等于真实 CLI 成功。
- 本地浏览器调试与云端编译检查分开报告：云端 compile-only 不证明 DOM、点击、布局或恢复通过。体验不足是 warning，不用增加一次模型调用来全面重写。

提交仍须满足主 skill 的证据与独立验收要求。详细实现边界见 `docs/GENERATION-DEBUG-P0.md`。
