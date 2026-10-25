# 项目接入：按需读取

路径均相对 intelligentUI 项目根。根目录需同时包含 `package.json`、`src/baseline/host.mjs`、`shared/cardspec/compiler.mjs`。在专用 Trae 工作区时，根目录可能是上方四级；先验证标识，不凭目录名猜测。工作区权限以 AGENTS.md 为准，找到项目根不等于获得修改权限。

## H5 + 宿主工具桥（五例路线）

| 目的 | 源码 / 入口 |
| --- | --- |
| 案例注册、工具白名单、日期/数学纯函数 | `src/baseline/core.mjs` |
| React 入口、持久状态、基础交互、错误边界 | `src/baseline/card.jsx` |
| 主体体验、图表、地图、渐进披露 | `src/baseline/experience-v2.jsx` |
| 宿主、iframe、取消、媒体、受控外链 | `src/baseline/host.mjs` |
| SSE 工具请求与完整性检查 | `src/baseline/transport.mjs` |
| GLM 资料压缩、schema、引用验证与统计 | `src/baseline/insights.mjs` |
| 多来源失败降级与评论采集 | `src/baseline/sentiment-sources.mjs` |
| 可控工具与模型替身 | `src/baseline/fixtures.mjs`、`insight-fixtures.mjs` |
| 样式与页面 | `src/baseline/card.css`、`index.html` |

新增案例使用独立组件/模块，再接入注册表、组件选择、最小工具白名单、状态/fixture 和任务相关验收。现有地图/分析分支有 case 限定，不能只加一个按钮就宣称新案例获得该能力。也不要一次开放所有工具；仅在任务授权范围内扩展需要的宿主能力。

构建：项目根执行 `node scripts/build-h5-baseline.mjs`。已有服务器预览 `/h5-baseline/index.html?case=ID&width=432&size=square`；替身模式附加 `&fixtures=1`。它会写 `public/h5-baseline` 和 `dist/h5-baseline`，不部署云端、不启动服务器。

子页面通过既有 `call(tool,input)`、`send(...)`、`useSaved` 与宿主通信；`transport.mjs` 只能在宿主使用，不放进无网络 iframe。复用 source/origin/token 校验和白名单。不要复制账号 cookie/API key 到卡片，也不要给 iframe 加直接 fetch、外部脚本或宽泛网络权限。

## CardSpec 路线

先按 [快速生成与调试](cardspec-generation.md) 查 `shared/cardspec/capability-index.mjs`，只读取命中组件/表达式的 `registry.mjs`、`contracts.mjs`。需要语义解释时再查 `docs/CARDSPEC-JAVASCRIPT-UPGRADE.md`、`docs/CARDSPEC.md` 的相关章节；工具绑定查 `docs/tool-bindings.md`，复杂 Web 查 `docs/CARDSPEC-REACT-SANDBOX.md`。不要把所有 prompt 拼成超长上下文。

五例功能对照：`shared/cardspec/baselines/cards.mjs`、`docs/CARDSPEC-HANDCRAFTED-BASELINES.md`。这些是参考实现，不代表所有最新生成结果均通过 H5 等价验收。

## 已有 Trae 工作台

`artifacts/rsi-agent/workspace` 是独立任务工作区，其 AGENTS.md 限制修改宿主。`trae-cardspec` 输出 `card.xml`；`trae-html` 输出离线 `index.html`。不能把离线轨道改为联网而不更新宿主/验收契约。

对于**已注册**案例，在项目根调用：

```text
node scripts/rsi-agent.mjs check CASE_ID trae-cardspec
node scripts/rsi-agent.mjs verify CASE_ID trae-cardspec
```

HTML 轨道把最后参数替换为 `trae-html`。案例目录必须含 `tests.json`（至少有断言）和 `REVIEW.md`。浏览器自动化须符合当前执行器的工具政策；未获准执行相应浏览器驱动时，使用可用浏览器工具复现并记录验证限制。

新 ID 不会被现有 `agentCase()` 自动接受。新联网场景优先在主项目按 H5 路线接入；若要进入队列，需单独修改 `shared/rsi-agent.mjs` 的案例来源及相应 harness。技能安装不等于完成注册、派发或运行。不要为安装 skill 执行 `rsi-agent init`，它会重写任务文件。

本 skill 的主副本在项目 `.trae/skills/interactive-card-baseline`。运行 `node scripts/sync-card-baseline-skill.mjs` 仅同步到旧专用 Trae 工作区；`--workspace round2` 同步到新一轮工作区，`--check` 只检查。不会修改 TASK/AGENTS、队列或业务文件，也不会让已暂停会话自动重读或续跑。历史 round1 副本保留以便复现实验。
