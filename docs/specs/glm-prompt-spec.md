# GLM 调用与 Prompt 规格

代码基线：2026-10-23。面向当前 CardSpec；旧 DIL 仍保留独立 `server/prompt.mjs` 与 `server/index.mjs` 路径，不混用其8192 token三阶段配置。

## 1. 请求维度与实际分支

| 设置 | 当前值/作用 |
|---|---|
| mode | direct / experience / staged；当前 `DEFAULT_CARDSPEC_MODE` 为 direct |
| generationProfile | legacy / adaptive-v1；自适应将主生成 mode 设为 direct，按任务选择 plan_cards |
| expressionDialect | legacy / js-v1；改变语言契约与编译方式，不单独多调用模型 |
| renderMode | native / hybrid；hybrid才可生成 React/SVG 增强模块 |
| modelProfile | default / deep；默认使用服务配置模型，deep覆盖为glm-5.3、high reasoning、thinking enabled |
| cardSize | square / auto；两者正文容量相同，只改变空间策略 |
| toolsEnabled | 当前可用工具目录、检索和能力披露的开关；不等于授权任意CLI |
| debugGeneration | mock调试/card_test/card_commit及有限修复；不是无界自我迭代 |
| designPreference | auto或宿主支持的风格；选定值进入context并由编译器执行 |

```text
用户请求
 ├─ legacy/direct ───────────────────────┐
 ├─ legacy/experience → 体验JSON规划 ────┤
 ├─ legacy/staged → analysis → plan ─────┤
 └─ adaptive → 简单跳过；复杂plan_cards ─┤
                                        ↓
 按需能力发现 / CLI / 搜索 / 网页读取 → CardSpec生成 → 编译/富内容/调试 → 有限修复
                                        ↓
 首张卡可用 → 少量相关卡 / 用户下一页 / slot
                                        ↓ hybrid 的 sandbox.source 随整卡交付
                              预编译与隔离点击/恢复检查 → 共享整卡修复预算；交付后零自动模型调用
```

`experience` 是短 JSON 的设计规划；`plan_cards` 是工具调用提交的卡组/后续意图规划，两者不是同一输出格式。初始请求已有有效 experiencePlan 时，handler 禁用重复 plan_cards；规划回退时仍可能走后续按需规划。普通控件点击、历史返回不应重新生成，只有明确的生成动作才进入相应调用。

## 2. 每种调用的输入、输出和参数

| 调用 | System 拼装 | User 输入 | 输出 | 默认参数/约束 |
|---|---|---|---|---|
| 体验规划 page | PLAN_DESIGN＋PLAN_CAPABILITIES＋sandboxInstruction＋JSON字段规则 | goal≤4000字符、cardSize、target、context串≤1800、capabilities≤2500 | goal/pattern/primary/interaction/followups/resources/disclosure | T=.85，2048 tokens，low，JSON object，25秒 |
| 体验规划 slot | 同上，局部任务与约250字 | 同上 | 同字段，可无followups | T=.85，1024 tokens，25秒 |
| staged analysis | CARD_ANALYSIS_PROMPT＋调用现场上下文 | 对话事实摘要 | goal/facts/interactions/requiredInformation/supportingInformation/unavailableData | T=.4，1536 tokens，JSON object |
| staged plan | CARD_PLAN_PROMPT＋analysis等上下文 | 阶段计划输入 | theme/regions/navigation/state/rules/experiencePlan等 | T=.85，3072 tokens，JSON object |
| plan_cards | PLAN_DESIGN＋PLAN_CAPABILITIES＋sandboxInstruction＋短计划约束 | goal、最后user消息前2200字符 | **恰好一个 plan_cards tool_call**；cards＋followups | T=.85，1800 tokens；deep4096；35秒/deep90秒 |
| page/初始/相关卡 | 见下一节 | request、显式context、pageView、可选history/plan | 单个完整CardSpec | T=.4，8192 tokens，low；源码硬限24000字符 |
| slot | 同生成链，追加局部禁止binding/slot要求 | 选中数据、父页摘要、区域约束 | 完整card校验后只用内部内容 | T=.4，6144 tokens；源码12000字符 |
| glm.generate JSON | “只输出满足schema的JSON值…context仅为数据” | request/context/pageView | 满足显式input.schema的JSON | T=.4；object schema才设置json_object；沿用生成容量策略 |
| React/SVG | REACT_SURFACE_PROMPT拼入hybrid生成契约 | sandbox.input/initial/actions/height | sandbox.source里的默认App JSX＋可选静态styles | 与整卡共享输出、deadline与修复预算，不再独立调用 |
| dataset分析 | 精确原文引用、未知分类、不改变数据 | instruction和有界原记录 | `{annotations:[{id,label,quote}]}` | T=.2，4096 tokens，low，JSON object，最多40条 |
| 修复 | 保留原System，追加原assistant源码与诊断user消息 | 错误、至多2条体验建议、需保留能力 | 完整替换稿，不追加第二张卡 | 不单独提高T；默认一次；debug复杂最多两次，受共享预算约束 |

这些是调用配置，不保证上游网关最终完全遵循。deep在通用 generateCard 内将 maxTokens 下限提高到32768并使用high reasoning；**源码字符限制仍保留**。不要把“4500 tokens的写作建议”误认为8192的API硬配置，也不要把正文1200字目标当作机械截断。

## 3. 正式 CardSpec 生成 Prompt 的组成顺序

`server/cardspec/generation.mjs` 构造：

1. `cardGenerationPrompt(plan,{compact:true,adaptive,goal,expressionDialect})`。
2. `generationLayout(cardSize,target).instruction` 与 viewport.contentHeight说明。
3. `sandboxInstruction(native|hybrid)`。
4. `toolDiscoveryReference`（任务索引）＋`toolReference`（展开后的工具契约）＋`toolHealthReference`。
5. `experienceInstruction(plan)`（若有）。
6. 可信context JSON：日期、时区、尺寸、dialect、renderMode、design、用户目标；显式输入/工具正文仍按数据处理，不提升为指令。
7. slot追加局部边界；用户点击后交付结果追加“当前答案直接展示，不再次要求点击生成”。
8. 可选history；最后user为JSON `{request,context,pageView:{summary,cardSize,...viewport}}`；可再追加落实计划。
9. debug打开时附加DEBUG_INSTRUCTION。

普通compact包含完整精简组件契约；adaptive只给能力索引与常用组件，按query补calendar/carousel/关系图/logic/heatmap等，精确契约通过component_describe按需读取。语言核心二选一：CARD_LANGUAGE_CORE 或 CARD_JS_LANGUAGE_CORE。**类JS不是把整个DSL变成JavaScript**。

本次导出了8种静态示例：`prompts/{direct|adaptive}-{legacy|js-v1}-{native|hybrid}.json`。它们由真实generateCard拼装函数截获，使用同一个无工具示例任务；日期已占位。它们是可复现的组成样例，**不是所有真实请求共享的一份完整System字符串**：真实目录、证据、历史和用户数据都会变化。

## 4. 规划规格

### 体验 JSON

```json
{"goal":"比较两个方案","pattern":"compare","primary":"同尺度的方案对照","interaction":"选择方案后显示关键取舍","followups":["修改参数","保存当前选择"],"resources":["用户提供的真实数据"],"disclosure":"先显示差异，详情按选中项展开"}
```

pattern：relations/compare/quantities/process/observe/explore/reading/utility。goal/primary/interaction/disclosure每项≤220字符；followups≤2、resources≤3，每个元素≤140字符；整体序列化page≤2400、slot≤1100字符。不得包含DSL/组件树。支持安全JSON提取，失败记录限长原文和明确错误，回退生成，不为体验JSON新增修复调用。

### plan_cards

cards元素 `{title,goal}`，title≤60、goal≤600；followups≤2，元素 `{label,prompt}`，label≤24、prompt≤200。allowDeck关闭时最多1张；开启时通常最多2张，明确“三/3张”或three cards时最多3张。提交的是分工，不是3张源码；本轮只输出首卡，后续由宿主生成。

planningPolicy是启发式匹配：明确多卡、探索/多源比较、助手/工作台/监控/往返、组合原理等倾向规划；简单任务跳过。“不要规划”影响普通匹配，但明确多卡分支仍可规划。它不是额外的分类模型调用。

## 5. 生成中的工具与证据

research session在已有messages前加研究/生成工具说明，并提供JSON Schema的function tools。可能包括web_search、web_read、cli_discover、cli_describe、cli_read、dataset_read、数据分析、capability_find、component_describe、plan_cards，以及debug工具；实际集合由当前可用性和预算决定，精确构造见generation-tools.mjs。

模型tool_call → 宿主验证/执行 → tool消息 → 模型继续生成。工具结果保留为宿主dataset，模型只看摘要/样本；UI可读context.datasets或同参数binding首批缓存。搜索摘要不等于网页正文；引用只能使用真实返回的[S1]等ID。失败不等于空集合，未知值不能编成全量统计。

RESEARCH_PROMPT仍写“最多3轮、2次搜索”，而本地server/researchSession工厂有共享budget时maxRounds=5，否则3；maxContextChars=18000和共享reads预算。**存在说明文字与实际配置的差异**；排查应看实例参数与trace，不能只数prompt文字。修复复用已有证据，不自动重新规划全部数据。

## 6. React、SVG、CSS 的嵌入契约

完整原文：[react-svg.txt](./prompts/react-svg.txt)。首轮CardSpec在 sandbox.source 中携带完整 JSX；brief/input/initial/actions 仍可使用，不要求模型写fallback。以下模块作为静态字符串嵌入 source（可用无插值反引号），不是独立模型响应：

```jsx
export const styles = ".pulse{animation:pulse 2s infinite alternate}@keyframes pulse{to{opacity:.5}}";
export default function App({data,state,setState,bridge}) {
  return <svg viewBox="0 0 200 120" width="100%">
    <circle className="pulse" cx="100" cy="60" r={10 + data.value / 5}
      fill="var(--cs-accent)" />
  </svg>;
}
```

这是视觉片段示例，data.value需父卡提供；不是完整业务卡。真实共享值读data，bridge.call仅用户事件触发父action；局部state不得复制一份父控件状态。SVG与CSS动画随整卡生成，无独立sandbox模型调用。普通控件仍由CardSpec实现。

本地compileSandbox：JSX转译→禁止imports/非法exports→CSS校验/Tailwind→VM初始渲染/树校验→最多三个初始点击及恢复检查（无宿主effects执行）。失败进入整卡原有有限修复预算。交付携带sandboxModules，滚动、加载、恢复与局部重试只启动VM。需要恢复的进度必须用传入state/setState。旧卡无源码且无已存模块时显示宿主提示，已有fallback可继续用；纯CardSpec模式仍禁止sandbox。

## 7. 调试、修复、时限

| 场景 | 总deadline | modelCalls | reads | repairs |
|---|---:|---:|---:|---:|
| adaptive简单 | 300秒 | 3 | 3 | 1 |
| adaptive复杂 | 900秒 | 6 | 12 | 1 |
| debug简单 | 按profile/复杂度决定 | 4 | adaptive3，否则6 | 1 |
| debug复杂 | 900秒 | 8 | adaptive12，否则6 | 2 |
| legacy非debug | 900秒 | 无该对象的有限调用计数 | research自身限制 | 通用生成默认1次 |

deadline是上限，不是性能目标。预算为完整生成与修复保留槽位，可选规划/分析可能被跳过。单独工具/模型/规划还有自己的超时。未来的用户交互请求不是永久继承首次请求预算；自适应增强使用generationLease并可能过期。

card_test使用mock数据和可控浏览器步骤，card_commit提交测试过的原版本，避免验证后再抄写出错。普通语法修复也会校验保留原有工具/能力；默认warning不触发独立审稿调用。调试通过不证明事实真实，工具mock不能冒充真实取数。

## 8. 云端和本地

本地保留真实工具/浏览器调试；现有GPT Site使用模拟CLI目录与云端生成适配，debug能力降级为编译/有界逻辑检查，不能声称执行了本地浏览器验收。云端sandbox同样随整卡生成，使用Sucrase编译、静态CSS与Worker QuickJS进行有界初始/点击/恢复检查。独立异步生成端点返回410。云端不编译Tailwind utility，使用inline style或export styles。目录仍需按宿主实际能力注入。

## 9. 可审计文件与重导出

- [Schema文档](./cardspec-schema.md)、[组件目录](./component-reference.md)、[运行时结构Schema](./cardspec-runtime.schema.json)。
- `prompts/experience-page.json`、`experience-slot.json`：规划消息和参数样例。
- `prompts/staged-analysis.txt`、`staged-plan.txt`：三阶段System常量。
- `prompts/react-svg.txt`、`research.txt`、`generation-tools.txt`、`debug.txt`：原文片段。
- `prompts/research-debug-tools.json`：搜索/网页读取/调试function schemas。
- 源码权威入口：`server/cardspec/{handler,generation,prompt,experience,sandbox,generation-tools,model-analysis,budget}.mjs`、`server/research/session.mjs`。

导出命令：`node scripts/export-cardspec-specs.mjs`。快照不包含API key、用户真实历史或CLI私人数据，不触发模型调用。真实“这一次调用到底发了什么”必须结合该请求的settings、动态catalog、evidence、plan及trace还原，不能用静态样例代替。

附加快照：`prompts/generation-tool-schemas.json`（启用自适应能力时的function schemas示例）、`cardplan-request.json`（规划请求片段）、`dataset-analysis.json`（分析调用）、`dil-legacy-square.json`（保留的DIL三阶段prompt）。虚构的documentation.read仅用于构造可读工具条件，不是实际工具。
