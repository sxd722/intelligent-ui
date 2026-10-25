# CardSpec v1：Schema 与执行语义

代码基线：2026-10-23；源文件哈希见 [source-manifest.json](./source-manifest.json)。本文描述当前实现，不把历史计划当作已实现能力。

## 1. 三种格式的边界

| 格式 | 谁产生 | 用途 |
|---|---|---|
| CardSpec 源码 | GLM | XML-like 标签＋受限表达式；**不是 HTML，也不是 JSON** |
| 编译后 spec | `compileCard()` | 对象形式的声明、组件树、表达式 AST、动作；供 renderer/store 使用 |
| React sandbox 模块 | 首轮 CardSpec 的 sandbox.source | 一个默认 JSX 组件与可选静态 CSS；通过隔离运行时嵌入，不替代整卡协议 |

本目录的 [cardspec-runtime.schema.json](./cardspec-runtime.schema.json) 是 **Draft 2020-12 结构定义**，用于理解/检查序列化后的 spec 外形；不是新增的生产验证器。表达式 AST 内部、求值后组件数据形状、跨引用和事务语义仍由编译器与 `validateRichContent()` 验证，不能把“通过 JSON Schema”当作可执行正确。运行时追加的资源、诊断、规划等元数据允许保留。

完整组件属性、required、数据形状、事件载荷、示例：[component-reference.md](./component-reference.md)；机器可读：[component-contracts.json](./component-contracts.json)。两者直接由 REGISTRY/CONTRACTS 导出，避免维护第二份手写目录。

## 2. 源码语法

```text
document := [<intro>短介绍</intro>] card [<outro>短说明</outro>]
card     := <card root-attributes> (declaration | component | action)* </card>
value    := "静态字符串" | {受限表达式}
content  := 文本 | {表达式} | 注册组件
```

必须恰好一个完整 card；多张卡由宿主卡组机制逐张生成。不要输出 Markdown 围栏或第二份修正版。数字/布尔值用表达式，例如 `columns={2}`、`disabled={false}`。字符串属性内部不插值，动态标签写 `label={...}`。普通组件 ID 可由宿主生成，显式 ID 必须稳定字面量；循环用 `itemKey`，不要动态拼 ID。

### 根属性

| 属性 | 定义 |
|---|---|
| schemaVersion | 当前仅 `"1"`；编译后为数字 1 |
| theme | editorial / soft / precision / playful / dark / minimal；默认 editorial |
| palette | a / b / c；默认 a |
| design | 已注册 design recipe；主入口提供 default / pearl / atlas / rebel / parchment / business / academy；完整兼容目录见 `shared/cardspec/designs.mjs` |
| composition | auto / focus / stage / menu / flow |
| visualStyle | photo-glass / tinted-glass / liquid-glass / frosted-glass / smoked-glass |
| backgroundQuery | 1–100 字符的摄影检索词，不能是 URL |
| backgroundPosition | center / top / bottom / left / right |
| backgroundMask | spotlight / fade-left / mist |
| actionMode | snapshot / sequential；新生成提示要求显式 snapshot |

以上均为静态属性。出现 visualStyle/backgroundQuery/backgroundPosition 中任一项时，必须给出有效 visualStyle 和 backgroundQuery。宿主明确选择的 designPreference 可以覆盖模型 design。`expressionDialect`、`renderMode`、尺寸和模型档位由请求 context 决定，**不是新增 card 属性**。

### 声明

```xml
<data id="items" value={[{id:"a",label:"A",price:3}]}/>
<state id="n" type="number" initial={2}/>
<derive id="total" value={state.n * 3}/>
```

- data→`data.id`；state→`state.id`；derive→`derived.id`。
- state 类型：number/string/boolean/array/record，initial 必填；data/derive 的 value 必填。
- 声明 ID 满足 `[A-Za-z][\w-]{0,63}`，禁止 constructor/prototype/__proto__。同命名空间不可重复；生成契约建议全局唯一，便于别名解析。
- context 包含日期、时区、尺寸、显式输入、宿主取得的数据集等；`context.localDate` 不是实时钟，实时显示使用 clock。

### 动作与事务

```xml
<action id="consume">
  <set target="n" value={state.n - 1} when={state.n > 0}/>
  <set target="done" value={true} when={next.n == 0}/>
</action>
```

每个 action 是 card 的直接子节点，1–16 个步骤：set/toggle/increment/append/update/remove/invoke。普通步骤可用 target、value、key、when；`when` 是属性，不是标签。target 指向已声明 state；record 的 set 可以指定 key，数组 update/remove 按对象 ID 匹配 key。

snapshot 下 state/derived 固定为动作入口快照，next 读取前序步骤结果。**旧卡未写 actionMode 时，store 按 sequential 路径执行**，不要把 prompt 的 snapshot 建议误认为所有旧卡的默认语义。所有步骤验证成功才提交状态和 effects；编译预演不调用工具。

button 不自动携带条目ID；使用 args 显式传值。input→event.value，checkbox→event.checked，collection/chart/关系图→event.id，calendar→event.date / event.month。完整事件以组件契约为准。异步成功/失败回调作为新事务处理，不续用旧草稿。

### Binding、slot 与工具

```xml
<binding id="detail" tool="glm.generate" load="manual"
  input={{prompt:"解释当前选择",context:{selected:state.selected}}}/>
<slot id="explanation" label="解释"><text>选择后可查看解释</text></slot>
<action id="explain"><invoke binding="detail" target="slot:explanation"/></action>
```

binding 属性：id、tool、input、initial、load、refresh、requires。load=manual（默认）或 visible；refresh=0 或 **30–86400 秒**，`true` 归一为60秒。不是早期方案中的30–300秒。requires 是逗号/空格分隔的 binding ID，依赖必须存在且无环。

每卡最多16个 binding，其中最多4个 visible 自动加载。GLM、dataset.analyze 和写工具只允许 manual，不能轮询。CLI 通常要求 initial；js-v1 下可由已知工具契约推导安全初值。结果路径是 `bindings.id.value/status/error/updatedAt`，不能省略 value。

invoke 可用 binding、target、input、when、onSuccess、onError；target 默认 binding，也可 page 或 slot:id。只有 glm.generate 可创建 page/slot。slot 生成仍提交完整 card 作为校验单位，不能再含 binding/slot；宿主只呈现内部内容、隔离状态。工具 ID/输入 JSON Schema 以当前服务目录为准，不让模型生成 shell。

## 3. 表达式、隔离逻辑、React 的能力分层

| 层 | 语法/输入输出 | 边界 |
|---|---|---|
| legacy 表达式 | `filter(rows,item.x>0)` 等注册函数，算术/比较/三元/对象/数组 | 无 JS 方法、箭头、任意函数调用 |
| js-v1 表达式 | `rows.filter(row=>row.x>0)`、reduce显式初值、Math白名单、?. / ?? / 展开 / 模板字符串 | 纯表达式，编译降级为宿主 AST；无赋值/异步/任意调用/sort/正则 |
| logic | 同步 `function update(state,event,input){...;return state}` | QuickJS，无网络/DOM；返回完整有限 JSON 状态 |
| sandbox | `export default function App({data,state,setState,bridge})` | 受支持的 React 子集，虚拟树桥接，不是任意浏览器 JS |

js-v1 支持数组 filter/find/map/some/every/findIndex/reduce、includes/indexOf/slice/join/concat/at；字符串 trim/toLowerCase/toUpperCase/startsWith/endsWith/split/replace/replaceAll；toFixed；Math/Number/Object/Array 静态白名单。精确列表见 `javascript-expression.mjs`。JSX 子内容的 map/条件可以编译为原生 each/if，**不意味着任意 HTML 可用**。map 使用命名参数和稳定 key。undefined 可省略于对象可选字段，但数组项/根状态不得是 undefined，NaN/Infinity 不可提交。

logic 的 source 至多12000字符，JSON至多65536字符、深度16、4000节点；VM16MiB、50ms执行限制。初始/交互/恢复由宿主管理；`local` 是模块自己的状态，不是父卡 state。reactive 与 tickMs 是宿主控制机制，不授权自行开网络或定时器。

sandbox 只有 hybrid 模式可生成，最多一个，不嵌套、不放each/slot/logic，不要求模型提供 fallback；source 必须携带完整静态 JSX 字符串，最终校验会预编译到 spec.sandboxModules，再交付卡片。source 可用单/双引号字符串或无插值反引号字符串，不受外层表达式 dialect 限制。brief 固定简短任务；input 为父卡当前数据；initial 仅独立局部状态；actions 为固定别名到父卡action的映射；height160–480。

React 只允许默认组件和可选 `export const styles="静态CSS"`，支持 Tailwind 字面类名、inline CSS、内联 SVG 与 CSS keyframes 循环。不导入包，无 window/document/fetch/DOM refs/定时器/storage/HTML注入。SVG支持的局部 defs/渐变/marker/pattern 可引用 `url(#id)`，不能加载外部资源。桥接 `bridge.call(name,payload)` 只在用户事件中调用一次，非 Promise；结果通过更新 data 回传。修改 slider 的方式是改变其绑定 state，不调用组件私有实例方法。

sandbox prompt 建议源码小于18000字符，硬限制20000；compiled36000、自定义styles16000、合并Tailwind后的CSS70000、state65536、tree180000、VM64MiB、执行150ms。CSS动画可持续播放，但不能代替业务状态推进。完整原文见 [React prompt](./prompts/react-svg.txt)。

## 4. 可编译的最小完整示例

```xml
<intro>调整比例并保存当前值。</intro>
<card schemaVersion="1" actionMode="snapshot" design="pearl" theme="soft" palette="a">
  <state id="ratio" type="number" initial={40}/>
  <state id="saved" type="number" initial={40}/>
  <stat label="当前比例" value={state.ratio}/>
  <slider label="比例" min={0} max={100} value={state.ratio} onChange="adjust"/>
  <button onPress="save">保存</button>
  <caption>已保存：{state.saved}%</caption>
  <action id="adjust"><set target="ratio" value={event.value}/></action>
  <action id="save"><set target="saved" value={state.ratio}/></action>
</card>
```

验证入口：`compileCard(source,{final:true,context:{expressionDialect:'js-v1',renderMode:'native'}})`；再执行富内容验证和真实浏览器交互检查。编译正确不等于布局、事实或业务正确。

## 5. 维护

运行 `node scripts/export-cardspec-specs.mjs` 重新导出机器定义、组件清单及 prompt 快照，不调用模型或网络。文档不改变生产协议，不更新云端。新增属性必须同时维护 registry、contracts、compiler、renderer、prompt披露和回归，而不是只修改本文。
