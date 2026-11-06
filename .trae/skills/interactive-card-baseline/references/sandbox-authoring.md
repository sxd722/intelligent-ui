# CardSpec 内联 React/SVG：不要混用 H5 API

事实源：`shared/cardspec/sandbox-policy.mjs`、`react-surface-prompt.mjs`、`sandbox-bridge.mjs`、`contracts.mjs`。只在需要 Web 高阶表达时读取；取代旧文档的“异步生成、强制 fallback、两份独立业务状态”描述。

- hybrid 且宿主允许时，最多四个独立 sandbox 承载复杂 SVG、模拟或空间视觉，每个使用唯一 id；跨模块通过宿主 state/input/actions 联动，各自局部状态独立恢复。普通列表/表单/按钮优先原生。
- JSX 固定字符串写在 source，随整卡生成、预编译、调试；brief 为短说明。无挂载后自动生成，不声明 glm.generate 补源码，不要求 fallback 子组件。
- `export default function App({data,state,setState,bridge})`。共享数据经 input → data；局部可恢复状态用 initial + state/setState。不要在 initial/hook 中再次拥有原生 slider 的共享值；React.useState/useReducer 也不是此运行时的持久化接口。
- actions 映射固定别名到 CardSpec action；React 用户事件调用 `bridge.call(alias,payload)`，payload 进入 event/args；action 可 set 或 invoke 已声明 binding。该调用不返回 Promise，结果经更新后的 data 到达。原生状态变化自动刷新 input。
- 每手势最多一个宿主 action，多步放在该 action 中，遵守 snapshot/next 语义。bridge 不是任意工具接口、DOM 查询或 component.setValue API；初始化/render/useEffect/自动动画不能触发工具。
- 无 imports、fetch、DOM/window/storage、外链脚本或任意包。生成代码运行于隔离 VM；iframe 为可信渲染器。React/事件/SVG/CSS 子集从源码查询，不假定是完整浏览器 React。
- CSS 在模块内 `export const styles="..."`，支持受校验的 keyframes；不用 sandbox styles 属性或 style 元素。复用 --cs-* token、透明根、父材质，不再嵌套完整卡框。height 160–480，SVG viewBox 适配宽度。
- 原生控件 → 图形、图形 → 原生控件双向验证；检查刷新恢复、局部异常和关闭动效。交付后的交互与恢复不得再调模型；明确的用户规划动作另记为业务调用。

可编译的最小联动示例：

```xml
<card schemaVersion="1" actionMode="snapshot">
  <state id="n" type="number" initial={30}/>
  <title>参数实验</title>
  <sandbox id="visual" brief="半径随共享参数变化" height={200}
    input={{n:state.n}} actions={{adjust:"adjust"}}
    source={'export default function App({data,bridge}){return <svg viewBox="0 0 300 200" width="100%" height={200}><circle cx={150} cy={100} r={20+data.n/2} fill="var(--cs-accent)"/><g role="button" tabIndex={0} aria-label="设为60" onClick={()=>bridge.call("adjust",{value:60})} onKeyDown={e=>{if(e.key==="Enter")bridge.call("adjust",{value:60})}}><rect x={105} y={80} width={90} height={40} fill="transparent"/><text x={150} y={105} textAnchor="middle" fill="var(--cs-ink)">{data.n}</text></g></svg>}'} />
  <slider label="参数" min={0} max={100} value={state.n} onChange="adjust"/>
  <action id="adjust"><set target="n" value={clamp(event.value,0,100)}/></action>
</card>
```

纯 CardSpec 版本以原生图表/heatmap/logic 达成核心语义，不等于在每个混合 sandbox 中复制完整 UI。
