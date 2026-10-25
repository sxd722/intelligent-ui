# CardSpec Web 创作（本地）

2026-10-21 更新。入口：8787 顶栏的 **Web 内容 → 开启 · React / SVG**。
沿用原有用户偏好，新用户仍默认关闭。GPT Site 本轮未同步、未发布。

## 行为

- hybrid 模式鼓励动画讲解、空间操作、复杂模拟、小游戏用一个 React + SVG 主体；简单清单、表单、标准图表继续原生实现。
- 首次 CardSpec 只描述短 brief、显式数据和初始状态。完整校验、可见后再异步生成 React；无需新增规划调用。
- Web 开关独立于外部工具开关。关闭外部工具仍能生成本地 React 交互；关闭 Web 会卸载增强视图，使用完整原生 fallback。
- 现有卡仍按其生成时的 native/hybrid 契约恢复。开启 Web 不自动改写已经生成的纯原生卡。
- 无 actions 的旧 React 视图仍独立保存进度。新视图通过 `actions` 声明与原生状态联动：共享业务值只存 CardSpec state，经 input 送给 React；React state 只保存独立的局部进度。外部已有控件时不要求在 fallback 里重复一套控件，但仍须有原生内容。
- `initial` 不声明原生 state/action。完整短例与现有一次修复中的定向建议解释此差异，不新增自动重写。

## 渲染边界

模型 React 在 QuickJS Worker 中计算，只发送白名单 UI 树给 opaque iframe。
模型不能直接访问宿主 DOM、网络、工具、外链图片、存储或任意 HTML；工具须通过显式暴露的 CardSpec 动作调用。
SVG 支持形状、局部渐变、裁剪、marker 箭头及 pattern；图形资源只接受本地 `url(#id)`，外部 URL 和 CSS 资源仍被拒绝。

允许 `export const styles="..."` 静态 CSS，包含自主循环 keyframes、媒体查询和状态过渡。CSS 不访问资源；不提供 JS 计时器或自动业务操作。离开视口、标签页隐藏时暂停动画，尊重减少动态效果，视图选项菜单可手动暂停。
iframe 透明，继承字体、前景色、强调色与材质变量；去掉常驻技术说明与单独背景。简单 UI 用原生组件，图形内部选择等高阶操作才放 React。复杂内容仍可能需要内部滚动，不能保证任意生成布局都完全一屏。
局部执行错误回退原生视图，不破坏外部内容；保存的 React 状态可恢复。

## 双向桥接契约

CardSpec 只新增一个可选属性 `actions`，最多 8 个固定别名。桥接不暴露组件实例或任意函数，修改组件绑定的 state 即可同步所有使用它的原生组件与 React。

```xml
<state id="n" type="number" initial={30}/>
<slider label="强度" min={0} max={100} value={state.n} onChange="adjust"/>
<button onPress="reset">归零</button>
<sandbox id="diagram" height={220} input={{n:state.n}}
  actions={{adjust:"adjust"}}
  brief="用SVG和CSS动画展示强度。点击图形调用adjust并传value；不重复外部滑杆。">
  <stat label="强度" value={state.n}/>
</sandbox>
<action id="adjust"><set target="n" value={clamp(event.value,0,100)}/></action>
<action id="reset"><set target="n" value={0}/></action>
```

React 的接口仍为四个 props，没有额外页面协议：

```jsx
export const styles = '@keyframes breathe{from{opacity:.5}to{opacity:1}}.signal{animation:breathe 1.6s ease-in-out infinite alternate}';
export default function App({data,state,setState,bridge}) {
  return <svg viewBox="0 0 240 180" height={180} style={{width:'100%'}}>
    <g role="button" tabIndex={0} aria-label="设为75"
      onClick={()=>bridge.call('adjust',{value:75})}
      onKeyDown={e=>{if(e.key==='Enter')bridge.call('adjust',{value:75})}}>
      <circle className="signal" cx={120} cy={80} r={25+data.n/3} fill="var(--cs-accent)"/>
      <text x={120} y={85} textAnchor="middle" fill="var(--cs-ink)">{data.n}</text>
    </g>
  </svg>;
}
```

- `bridge.call(alias,payload)` 返回 void。payload 同时作为原生动作的 event/args，须是至多 4 KiB 的 JSON object。每次真实用户操作最多提交一个宿主动作；多步 set/invoke 放在该原生动作中，复用现有事务。
- 工具调用：宿主声明 binding → 原生 action 执行 invoke → sandbox.actions 暴露该 action。加载、结果、错误通过 `input={{status:bindings.feed.status,result:bindings.feed.value,...}}` 回传。写操作确认、工具开关、取消与请求去重继续由现有宿主控制。
- 外部按钮/滑杆更新 state 后，React 收到新的 data；工具 onSuccess/onError 也走同一路径。没有跨隔离环境传函数、Promise 或组件引用。
- 编译/初始化/输入更新不会执行桥接。渲染与 effect 中调用桥接报局部错误。旧页面的响应、非真实事件、未暴露的别名被拒绝；事务或事件失败不提交宿主 effects。
- 刷新恢复保存状态，不重放桥接和工具请求。关闭 Web 保留共享原生状态；重新开启后读最新状态。动画是展示效果，不作为业务时钟。
- 本地演示：[联动实验](http://127.0.0.1:8787/cardspec-lab.html?fixture=sandboxLinked)。演示的真实资讯调用只由点击触发；测试中使用受控替身。

## 2026-10-21 联动验收

- 17 项单元测试通过：命名能力校验、CSS/模块安全边界、编译零 effects、失败事务、非法调用隔离及旧模式兼容。
- 14 项浏览器测试通过：原生滑杆↔SVG、工具替身及回调、刷新不重放、纯原生回退、生成期间输入变化、离屏暂停、局部异常、320/360/432px 与两种尺寸，以及两个真实 GLM 输出回放。
- GLM-5.3-flash 网络传播图最新一次约 19 秒首轮完成，CSS 动画、adjust/refresh 和数据更新检查通过。储能图原始请求约 63 秒、一次修复后仍被编译器拒绝；原因包含代码块后解释、CSS `>` 子选择器误判和缺少 SVG dx/dy 支持。补齐通用提取/白名单后原始输出回放通过；这不是新的首轮生成成功记录，也不代表总体成功率。
- 两个真实产物在浏览器中均完成键盘触发宿主动作及工具替身调用。测试没有执行真实 CLI，更没有修改 Owl 连接。完整原文、错误、用量及回放位于 `artifacts/sandbox-linked-qa/`；浏览器与单元日志位于 `artifacts/sandbox-linked-browser.log`、`artifacts/sandbox-new-unit.log`。
- CSS 只展示运动，不承担业务时钟。静态 styles 不接受网络资源、HTML、转义资源地址；JS 仍没有网络、DOM 或 timers。视觉融合依赖生成内容使用共享材质变量，无法保证每一次模型输出都同样美观。

## 2026-10-20 验证记录及既有限制

- 16 项单元测试、7 项浏览器回归通过：模式开关、关闭工具、错误隔离、无网络能力、渐变安全性、状态恢复、320/360/432px、两种尺寸。
- 真实 GLM-5.3-flash，用户 prompt 不点名 React/sandbox：
  - 储能模拟器：首轮原生 fallback 声明缺失；补齐通用短例后，CardSpec 约 11.3 秒，含 React 共约 25.7 秒。真实产物回放验证推进、充能、重置、耗尽、刷新恢复。
  - 向量投影：首次约 33.6 秒完成 React，但人工看图发现外部滑杆与局部状态重复控制；新增生成门控可识别此结构。其 React 本身滑杆与刷新恢复通过。后续两次生成仍有原生数学表达式/作用域错误，不能记作整卡质量通过。
  - 原生模拟器约 20.1 秒、简单清单约 13.0 秒，均未生成 sandbox，均使用一次已有修复。
- 储能回放最初的检查器只匹配“推进一步”，而实际按钮叫“−10 步进”；保留该失败记录，随后用语义匹配和数值变化验证通过。
- UI 测试最初向 opaque iframe 注入 localStorage，触发隔离错误；修正 QA 注入后通过。未放宽 sandbox 权限。
- 完整 trace 与截图在 `artifacts/web-creation/`。真实模型调用与受控回放分开记录；不将组件数或语法通过等同于语义正确。

下一阶段优先减少复杂 fallback 的作用域负担；当前不承诺所有复杂任务稳定生成，也不通过移除原生功能来掩盖失败。
