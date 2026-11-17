# 本轮复现与恢复

本轮仅在本地 `http://127.0.0.1:8787/` 工作；未发布 GPT Site、推送 GitHub、改变 OpenCLI/Owl 连接或执行真实外部写操作。

## 先确认身份与进度

- 原工作区不是 Git checkout。workspaceGitCommit=null；d9ea2fc… 只代表之前的镜像提交。
- B0 原样源码：B0-source.zip 与 B0-files.json。各后续候选：provenance/ 下 source.zip、逐文件 SHA-256、renderer.zip、build-files.json 与 observation.json。
- sourceHash 与 buildHash 的计算范围/算法在 code-version.json 中明确。报告目录属于可变证据，不混入 renderer build 身份。
- 恢复运行先读 progress.json，再查对应 run.json、request.json、effective-config.json、source-versions、trace.redacted.jsonl、根 acceptance.json。已经完成的主运行不重新发模型请求，不重放外部操作。
- 初批 H1/S2/S1 的进程已加载源码身份存在历史缺口，见 provenance/README.md；不能用当前磁盘 hash 冒充旧进程。

## 只重建报告，不调用模型

在项目根目录依次执行：

```powershell
node scripts/exploration/audit-budget.mjs
node scripts/exploration/usage.mjs
node scripts/exploration/summarize.mjs --final=true
node scripts/exploration/summarize-round.mjs
node scripts/exploration/report.mjs
node scripts/exploration/audit-evidence.mjs
```

`summarize` 固定 progress 前 28 槽，不把后续校准/确认/combo 混入首批；`summarize-round` 按相位、条件、修订分层。`report` 仅复制脱敏证据到 public/exploration-round1 和 dist/exploration-round1，不构建或部署应用。

`usage` 按 actual-requests 的实际返回 usage 汇总，不重用旧 run 聚合值；缺失 usage 保留 unknown。`usage-final-freeze.json` 记录最终 45 个主运行的请求文件哈希，后续独立验收不应改变这些文件。`audit-evidence` 仅离线检查读取预算、真实证据指针和公开包；它在本机读取私有 health 中的地址作精确匹配，但不会复制或输出地址值。无该私有文件的接收者可只重建报告，不运行这一精确字面值检查。

浏览入口：`/exploration-round1/`、`/exploration-round1/all-attempts.html`、`/exploration-round1/pairs.html`。配对只匹配同任务、共同基线修订和重复编号；初批 B1 r1 与 C1/V1 r2 属于同一首批共同基线。当前交互预览使用当前 renderer；历史构建结论以精确 hash、截图和验收为准。

## 无模型的隔离检查示例

```powershell
node --test tests/experimental-behaviors.test.mjs tests/experimental-behavior-diagnostics.test.mjs
node --test experiments/round1-20261117/p0-write.test.mjs
```

这些检查不启动真实 OpenCLI/AutoCLI，不证明浏览器、当前账户或外部网站在线。其它校准测试命令与复现见 common-calibration/README.md。不要直接运行未知副作用的整仓脚本作为“复现”。

独立浏览器验收会操作本地回放产物，不产生新的模型调用，但必须使用相应 request.replayMode、原 snapshots 元数据和冻结任务验收要求；不能自动用 synthetic 结果替换 recorded-live 缺口。重新验收需要新证据目录，不能覆盖旧断言和失败。

## r4 与 P2 pilot

固定模型请求为 volcengine/deepseek-v4.1-flash；实际返回模型 ID 与参数以 wire 记录为准。每条件预算 8 次产品链模型请求、2 个唯一 CardSpec 修复版本、240 秒、12 次读取；调用不等于条件运行。金额未核实则 unknown。

P2 pilot 的上下文仍为 `--revision=r4 --repeat=1`，独立阶段标记为 experimentPhase=P2-pilot-r1。四格 B1/S1/H1/H1S1 的 H1 均使用 subject-first-v2。不要擅自改为新 revision 字符串导致单 H1 回退 v1。8 次 pilot 是新的主运行，不是免费基础设施重跑。12 次确认未晋级；pilot 的互补机制例外和停止条件已在 continuation-r4.md 执行前记录。

## 凭据与真实能力边界

私有 health.json、网关地址、API key 与本机登录状态不进入公开报告。恢复模型运行需本机原有受控配置；不要从报告猜 endpoint 或请求用户把密钥贴到页面。报告重建完全不需要密钥。

真实 OpenCLI 采集与 live-read 页面验证证据单独链接；recorded-live 只证明固定回放。模拟写不会升级为真实写成功。无人完成匿名评审时 humanPreference 保持 null，不据模型分数宣称愿意收藏或吸引力。
