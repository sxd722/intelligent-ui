# CardSpec 工具绑定与页面历史

仅供本地 8787 使用。DIL 路径保持独立；主界面「工具增强」可关闭此模块，静态 CardSpec 仍可交互。

OpenCLI 的 46 个生活工具、浏览器/OAuth 连接和手动写操作契约见 [opencli.md](./opencli.md)。下文的四个资讯工具仍然保留；OpenCLI 使用独立的结果 Schema，不能套用资讯字段。

## 安装与启动

运行 `powershell -File scripts/install-autocli.ps1` 安装固定 AutoCLI v0.3.8。安装脚本验证官方 Windows archive SHA-256，运行时再次检查 binary checksum。制品与私有 profile 位于 `.tools/autocli/0.3.8/`，不使用系统 PATH 或用户适配器。

运行 `npm run build`，然后 `npm start`。模型及 Pexels 沿用现有服务端配置。AutoCLI 私有 daemon 使用 19926；端口被其他进程占用时报告不可用，不结束其他进程。服务退出仅清理自己创建的进程。每项 CLI 超时 30 秒，stdout 上限 1 MiB，并发上限 2。

## 统一契约

`shared/cardspec/tools.mjs` 是工具目录、输入输出 Schema 和生成提示的共同来源。第一批 ID：

- `autocli.hackernews.top`：`{limit?:1..20}`。
- `autocli.hackernews.search`：`{query:string,limit?:1..20,sort?:"relevance"|"date"}`。
- `autocli.devto.top`、`autocli.lobsters.hot`：`{limit?:1..20}`。
- `glm.generate`：`{prompt:string,context?:object,schema?:object}`。

CLI 资讯返回 `{items,source,fetchedAt}`；每项有稳定 `id`、`title`、`author`、`url`、`rank`、`score`、`scoreLabel`、`comments`、`tags`。未知数值及 URL 为 null，未知文字为空，不推测缺失数据。工具基础设施支持任意符合注册 Schema 的 JSON，资讯标准化仅属于这四个适配器。

`GET /api/tools` 返回工具契约和本地可用状态（不等于外部站点健康检查）。`POST /api/tools/invoke` 接受 `tool,input,target,requestId,pageId,sessionId,cause,view`，SSE 返回 `status/progress/diagnostics/result/error/done`。连接断开即取消。请求 ID 在五分钟内去重，同 ID 不同参数被拒绝。请求仅允许 loopback 和明确允许的本地页面来源；CLI 子进程使用结构化 argv、`shell:false`，搜索查询放在 `--` 之后。

## DSL 示例

```xml
<card schemaVersion="1" actionMode="snapshot">
  <binding id="news" tool="autocli.hackernews.top"
    input={{limit:4}}
    initial={{items:[],source:"Hacker News",fetchedAt:""}}
    load="visible" refresh={60}/>
  <binding id="explain" tool="glm.generate"
    input={{prompt:"直接展示所选文章的中文解释，仅根据标题信息。",context:{article:bindings.news.value.items[0] ?? null}}}/>
  <title>阅读台</title>
  <region overflow="scroll">
    <each items={bindings.news.value.items} itemKey={item.id}>
      <text>{item.title}</text>
    </each>
  </region>
  <slot id="detail"><caption>点击解释查看内容。</caption></slot>
  <row>
    <button onPress="refresh">刷新</button>
    <button onPress="explain" disabled={len(bindings.news.value.items)==0}>解释</button>
    <button onPress="explore" disabled={len(bindings.news.value.items)==0}>深入探索</button>
  </row>
  <action id="refresh"><invoke binding="news"/></action>
  <action id="explain"><invoke binding="explain" target="slot:detail"/></action>
  <action id="explore"><invoke binding="explain" target="page"/></action>
</card>
```

`bindings.<id>` 提供 `value/status/error/updatedAt`。状态是 `idle|loading|success|error|cancelled`。加载或失败均保留最近成功值，不重置表单。`invoke input={...}` 可覆盖一次调用参数，不改变 binding 默认值；重试保留这个覆盖表达式及显式 args。

`load` 默认 manual；visible 仅在完整校验通过、当前页进入视口且标签页可见时加载。最多 16 个 binding，其中最多四个 visible 自动加载，其余 manual 按需调用。`refresh` 省略表示不轮询，true 表示 60 秒，数值允许 30–86400 秒（每小时使用 3600）。参数变化取消旧请求；根据输入签名过滤陈旧结果，与无关表单变化无关。GLM 生成期间暂停自动读取，避免资讯分数刷新使生成失效。

## 动作与生成语义

编译、预演、流式预览和修复只计算纯状态，不执行工具。动作先校验全部本地写入与 effects，再统一提交。snapshot 的 `state/derived` 读取动作入口，`next` 读取当前事务草稿。工具响应中的 `onSuccess/onError` action 是新的事务，通过 `event.result/input/error` 读取响应；调用链最多三次。自动读取链不能触发 GLM。

`glm.generate` 的 target：

- `binding`：输出符合 `input.schema` 的 JSON；schema 必填。
- `slot:ID`：完整 card 校验后，只渲染内部内容，继承外层材质，独立状态和 ID 命名空间。不能含 binding 或下一层 slot。
- `page`：完整 card 校验后才 push 到同一卡片历史。页面请求不传 JSON schema。后续探索要在生成请求中明确要求新页自己的 binding 和按钮。

每卡同一时间只运行一次 GLM；重复操作合并。原内容一直保留，目标位置显示 thinking。失败、取消或输入变化不替换原内容。每次模型输出最多修复一次，并执行富内容校验。上下文只包含本次请求、原始目标、当前页简短摘要和显式 context，最多 24K 字符，不传完整历史栈或完整 CLI 原始输出。`context.input` 是显式传入的数据；工具内容不会提升为系统指令。

新页与 slot 的图片沿用统一 Pexels 资源解析，并随页面保存引用。

## 页面恢复与交互

宿主提供返回/前进、页码和边缘 swipe。组件内部 carousel、slider、图形拖动、横向表格、swipe-stack 优先处理自己的手势。不要让模型再写历史按钮。

每页保存 spec、状态、binding 结果、slot、图片资源、滚动和组件选择/缩放。返回或前进不调用 GLM。后退后生成会截断前进分支。每卡最多 20 页，超出移除最老非当前页并提示。

当前标签页的 conversation 与页面栈使用 sessionStorage；刷新后恢复，运行中的请求标记中断，不自动重放 GLM。存储额度不足保留内存交互并提示恢复能力受限。内容不会跨标签页同步。

## 验证入口

`npm test`；`tests/browser/tools.spec.mjs`；`scripts/tools-smoke.mjs`；原 20 例使用 `scripts/benchmark-direct.mjs` 和 `scripts/replay-direct-benchmark.mjs`。真实服务测试依赖当前网络和模型，不能用 mock 通过率替代。测试产物位于 `artifacts/tools-qa/`，工具演示为 `/cardspec-lab.html?fixture=tools`。
