# Trae 网页制作与返工

入口：`http://127.0.0.1:8787/agent-workbench.html`。原对照工作台的工具栏也可进入。Tailscale 使用相同路径。

选择任务和 CardSpec / H5 路线，点击“让 Trae 开始制作”。Trae 使用当前选中的默认模型，在独立的 `artifacts/rsi-agent/workspace` 编写、check、浏览器回放并修正。网页保留旧版本，完成后展示可交互的新版本。填写意见后点击“提交意见并让 Trae 返工”；意见、基础版本、任务状态和产物 hash 存在 `artifacts/rsi-agent/jobs/`，历史源码在 snapshots 中。自动回放不代表事实和体验通过，仍需人工评审。

## 启动

主站保持 8787；以后正常启动主站会检查并启动任务服务（`AGENT_WORKBENCH=0` 可禁用）。独立任务服务：`node server/agent-jobs.mjs`，监听 loopback 8791，不重启主服务器或 OpenCLI。若 Trae 工作区未打开，开始按钮会尝试打开专用工作区；扩展仍须已安装。Trae 工作区为 `artifacts/rsi-agent/workspace`。首次安装扩展：

```
python scripts/package-trae-bridge.py
trae-cn --install-extension artifacts/rsi-agent/cardspec-workbench.vsix --force
```

扩展源码位于 integrations/trae-workbench；只在带专用 marker 的工作区激活。网页显示桥接心跳；未就绪时会明确报错，不把 CLI 打开窗口当成已生成。Trae 升级导致内部命令不可用时，需更新桥接，不能静默改用 API。

## 完成协议

同一时间只有一项任务。前端和服务端均防止重复提交；队列文件只领取一次。任务末尾执行 `node scripts/rsi-agent.mjs finish JOB_ID`。服务核对当前源码、编译结果、测试 hash、本次任务之后的新 QA 时间及六种宽度/高度结果，然后发布完成状态。失败检查不会自动标记成功。一分钟未接收会显示桥接排查提示；超过 25 分钟仍无完成信号会提示人工查看 Trae，避免重复执行还在运行的 agent。

这不是 Trae 的操作系统沙箱：工作区边界由任务约定约束。H5 预览仍运行在原有无网络 iframe 沙箱中；原生 CardSpec 保持完整功能。自动验证用独立 Chromium，实时工具默认关闭。网页不提供任意命令/路径入口，任务服务限制 loopback 和精确来源；Tailscale 只开放启动任务和状态读取，不开放 OpenCLI 绑定管理或完成回调。

用户主动在 Trae 停止任务后，可点击网页“Trae 已停止，结束跟踪”释放队列；该按钮不会替用户终止 agent，也不会删除旧产物。

## 全量批次

任务服务的 `/api/agent-jobs/batch/start` 创建 30 场景 × 两路线的持久队列。已完成任务复用，当前执行中的任务优先纳入。每次只提交一项；finish/fail 后等待 15 秒才推进，失败不算通过。队列在 `artifacts/rsi-agent/batch.json` 保存，服务重启后继续跟踪同一任务 ID，不重复提交。工作台显示完成数、失败数及逐项链接。超时或未确认停止的任务会阻塞队列，避免并发 agent 修改文件。浏览器可关闭，但电脑、Trae、8787 和任务服务必须保持运行。
