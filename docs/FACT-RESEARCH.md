# CardSpec 按需事实检索

本地实现日期：2026-10-15。默认模型仍为 `glm-5.3-flash`，保留 DIL；本次没有发布 GPT Site。

## 调用流程

CardSpec 生成前向模型提供两个 function tools：`web_search({query, domain?})` 和 `web_read({url, focus?})`。模型按需选择；已有材料或纯创作可以零检索。工具轮次中的中间 content 不编译，只有最终 CardSpec 进入原有编译、富内容校验和一次修复流程。工具调用之间原样回传 assistant 的 `reasoning_content` 和 `tool_calls`，并以对应 `tool_call_id` 提交结果。

- 搜索：当前网关没有可用的独立 `/web_search` 接口。provider 使用同一 endpoint/key 发起一次短的原生 `web_search` 请求，只接收顶层 `web_search` 结构化来源，忽略该请求生成的答案。每次搜索因此另有一次模型请求和费用。
- 阅读：经固定的 `https://r.jina.ai/` 获取公开页面；不携带用户 Cookie，不占用 OpenCLI/Owl。只允许公开 HTTP(S) URL，拒绝本机、IP、显式端口和带凭据 URL。限制响应字节数，识别拦截页。去除图片及纯链接导航后，按 focus 选择有长度上限的正文节选。
- 证据：宿主分配 S1、S2 等 ID，附 URL、标题、摘要/正文类别和时间。相同 URL 的正文可升级搜索摘要。模型用 `[S1]` 就近引用，渲染器生成链接及折叠来源面板；不存在的 ID 进入修复诊断。来源可追溯不等于所有断言已经通过语义核验。

## 范围与预算

支持初始 CardSpec 的 DSL 生成阶段、`glm.generate` 的 page/slot 输出。staged 的前两步和 JSON 输出没有接入检索，DIL 保持原流程。

默认每次生成至多 3 个工具轮次、5 次实际工具执行，其中至多 2 次搜索；新增工具数据预算 12,000 字符，单页节选最多 3,500 字符、单条搜索摘要最多 700 字符、每次最多 4 条搜索结果、最多 12 个来源。此预算不包括系统 prompt、推理、对话及修复时重复回传的已有证据。单次工具最多 40 秒，检索窗口 120 秒，并受宿主请求取消约束。重复工具请求复用会话结果；页面文本缓存 5 分钟，最多 8 页。

修复共用同一检索预算和证据，不重新开始无限检索。失败、空结果和预算耗尽作为工具结果交给模型，要求说明未核实；不会把模型记忆或未来才执行的 binding 冒充当前证据。证据随 `spec.research` 保存，刷新恢复不重查。

## 配置与维护

- `RESEARCH_DISABLED=1` 关闭检索增强。
- 初始请求 `toolsEnabled:false` 不启用检索。
- `MODEL_NAME=glm-5.3` 可改用完整模型，endpoint/key 沿用现有配置；本次两个模型都通过 tool calling 探针，尚无必要默认升级。
- `server/research/model-client.mjs`：流式网关轮次。
- `server/research/providers.mjs`：搜索、公开页面阅读、节选。
- `server/research/session.mjs`：工具契约、预算、循环和证据。
- `src/cardspec/Evidence.jsx`：行内引用与来源面板。
- `scripts/qa-research.mjs`：真实生成测试；`RESEARCH_QA_CASES=page` 等可指定子集，`RESEARCH_QA_OUT` 指定独立输出目录。

OpenCLI 租约恢复仅由主服务器显式开启 `restoreHandoff:true`。默认创建的服务及注入 run 的测试替身不读取交接文件，测试替身也不能控制真实绑定。维护时必须先完成测试，再按已有租约交接流程重启；不得关闭桥接 daemon 或用户绑定页。

## 已知边界

网关搜索偶尔返回空来源或不相关结果；阅读器受第三方可用性和源站拦截影响。无法保证每个网页都提取到完整正文。模型仍可能多写事实、遗漏行内编号、对节选做过强推断；现有校验检查来源 ID 与协议，不是自动逐句事实裁判。此阶段没有增加第二个固定审稿模型调用。
