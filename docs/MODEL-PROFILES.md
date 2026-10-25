# 生成模型选择

配置面板 → 模型：保留默认 GLM-5.3 Flash 与 GLM-5.3 深度思考，新增 DeepSeek V4.1 Flash、Qwen 3.8 Flash。选择保存在当前浏览器；既有卡片按自身 context.modelProfile 继续生成，不迁移或覆盖旧会话。DIL 原路径保留。

| profile | 网关 model ID | 请求参数 |
| --- | --- | --- |
| default | 服务端 MODEL_NAME（当前 glm-5.3-flash） | 保留现有默认参数 |
| deep | glm-5.3 | high，thinking enabled |
| deepseek-flash | volcengine/deepseek-v4.1-flash | thinking disabled，省略 GLM reasoning_effort |
| qwen-flash | qwen3.8-flash | thinking disabled，省略 GLM reasoning_effort |

所有模型使用现有 endpoint 与服务端 key。前端只提交 allowlisted profile，不接收任意 endpoint 或凭据。规划、初始卡、修复、下一页、slot、JSON 和资料分析沿用所选配置；trace 区分请求模型与网关实际报告的版本。

验证（2026-10-23）：50 项本地相关测试、47 项云端测试通过。两模型均实际完成 tool calling 与工具结果续写。储能卡包含原生滑块、SVG 圆环、bridge 充能、持久观察计数；本地与 Worker 预览交互及刷新恢复通过，无渲染后额外模型调用。

单样本结果：DeepSeek 12.6 秒、0 次修复；Qwen 复杂沙箱 143.8 秒、3 次修复；Qwen 原生计数器 17.7 秒、1 次修复。这不是综合模型排名；Qwen 的格式错误与测试步骤错误已保留在 trace，不掩盖首次失败。

证据：artifacts/model-integration/。GPT Site 使用相同选项，保留现有模拟 CLI；未将本地 OpenCLI/Owl 凭据或会话发布到云端。
