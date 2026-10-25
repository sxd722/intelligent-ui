# CardSpec 通用能力升级 · 2026-10-19

本轮从五个 H5 基线反推可复用能力，保持 CardSpec v1、原 DIL 与原有会话兼容，只部署本地 8787。没有把五个网页逐一重写成 CardSpec，也没有引入业务专用标签。

## 能力映射

| 基线体验 | 本轮通用能力 | 仍需由生成内容正确表达 |
|---|---|---|
| 尊界信息统计与时间线 | `logic reactive` 随宿主输入重算；结果可驱动 chart/collection；显式 action 映射连接后续工具 | 去重口径、事实与评论分离、时间与样本缺失；不能把样本当全网统计 |
| Transformer 数值演示 | heatmap、图节点数值与边权重，QuickJS 计算与残差开关 | 正确的计算模型、矩阵维度、示例与真实模型的区别 |
| 杭沪往返安排 | datetime-local/time 输入、绝对时间 countdown、copy；原 link/状态机制复用 | 开票时刻必须有来源或用户确认；不推测固定提前天数 |
| 电影候选与比较 | collection 受控 selectedId、external 详情，原真实图片 assetRef 通道 | 正确的实体 ID、比较维度、选中集合与真实工具结果 |
| 两天亲子行程 | reactive 预算重算、局部多步逻辑、显式提交、记录快照 | 换天与替换的业务规则、开放时间与实际地点 |

## 计算和宿主的边界

简单表单继续使用 state/derive/action。复杂数值计算可用现有隔离 `logic`：

```xml
<logic id="calc" reactive={true}
  input={{rows:bindings.feed.value.items}}
  initial={{total:0}}
  source={"function update(state,event,input){state.total=input.rows.length;return state;}"}
  actions={{save:"saveResult"}}>
  <stat label="当前样本" value={local.total}/>
  <button onPress="save">保存结果</button>
</logic>
<action id="saveResult"><set target="saved" value={event.result.total}/></action>
```

`feed` 与 `saved` 需照常声明。initial 必须能直接渲染，source 只包含一个同步 update 函数；所有常量在函数内或通过 input 传入。模型不需要编写 Worker、网络协议、定时器或恢复逻辑。

完整且可见时才发送 init；输入变化发送 input 并取消旧计算。init/input/tick 不触发宿主 action。只有用户事件成功计算且候选视图通过校验，才按 literal actions 映射触发宿主事务。宿主读取 event.result/event.input，可执行已有 invoke；失败事务不产生工具 effects。编译与流式预览不执行 JS 或工具。没有给 QuickJS 添加网络、DOM、存储、异步 I/O 或工具对象。

局部状态沿用页面栈的视图快照恢复；重新进入时可基于当前输入重算，用户选择应由 update 保留。持久化仍是原有 sessionStorage 语义，不承诺关闭标签页后的长期保存。

## 声明式展示

- `heatmap`：rows/columns 为 1–12 个唯一 `{id,label}`；values 是对应二维矩阵，元素为有限数或 null。点击返回 rowId/columnId/value；支持受控选择，未知值与零区分，保留内部横向浏览。
- flowchart/mindmap 节点可带 `value`；flowchart 边可带 `value`，宿主以符号和相对大小表现颜色与粗细。旧节点、无权重边保持原行为。
- `collection selectedId={state.selected} detailMode="external"`：选择由宿主状态控制，内置详情可关闭，避免两个详情所有者；原搜索、分页、真实图片与 onSelect 保留。
- `countdown target={...}`：明确带 Z 或时区偏移的 ISO 时间。未知、无效、已到期分别显示；按宿主真实时间计算，标签页恢复后重新同步，不自动订票或调用工具。
- `input inputType="time|datetime-local"`；datetime-local 本身不带时区，任务明确后再附加时区。
- `copy value={...}`：用户点击复制，浏览器拒绝时提供可选中文本，不依赖沙箱权限。
- record 写入缺失 ID 不再静默生成 `"null"` 键；编译预演和运行事务均返回明确诊断、完整回滚。

## 控制模型负担

保留完整组件目录，但将原重复语言规则合并成短核心。只提供可运行短例和关键类型/事件/事务规则，不增加规划、审稿或模型调用层数。普通 direct 仍一次生成，只有原有校验失败时允许一次修复；原规划模式和工具预算保持不变。

第一次压缩尝试减少了文本却增加语法错误，因此没有直接发布该版本。后续补回 namespace、步骤条件和事件的精确短例，以及 logic 的一个完整示例。所有迭代的原始生成与失败 trace 均保留，报告区分编译成功、真实交互和时间，不用“生成完成”等同于业务正确。

## 验证入口

`/cardspec-lab.html?fixture=capabilityData`、`capabilityMatrix`、`capabilityCollection`、`capabilityTime` 为无外部服务依赖的交互样例。它们是运行时验收 fixtures，不能算作模型生成成功。

`scripts/qa-capabilities-v2.mjs` 运行原 20 例真实 GLM direct；不导入服务主进程、不初始化 OpenCLI、不访问浏览器桥。`scripts/qa-capabilities-browser.mjs` 在隔离 Chromium 验证新增能力和 320/360/432px × 方形/不限高度。`scripts/replay-capabilities-v2.mjs` 回放原始生成物，保留失败和定位器不确定性。

目标是常见单卡几十秒可交互。网络、检索、长剧情及修复造成长尾，不能承诺所有请求几十秒完成。业务语义仍需回归，尤其多步资源恢复、历史明细和条件筛选；不通过增加自动模型轮次来掩盖这些错误。
