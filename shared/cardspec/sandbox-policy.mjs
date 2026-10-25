import {REACT_SURFACE_PROMPT} from './react-surface-prompt.mjs'
import {logicJson} from './logic-contract.mjs'
export const sandboxMode=value=>value==='hybrid'?'hybrid':'native'
export const SANDBOX_LIMITS={source:20000,compiled:36000,css:70000,state:65536,memory:64*1024*1024,timeMs:150,tree:180000}
export const SANDBOX_CAPABILITY="UI模式：Web创作可用。普通按钮、滑杆、列表、图表用CardSpec，仅复杂空间图/模拟用一个sandbox，与卡片共用材质。source必须在本次CardSpec中写完整JSX字符串（推荐 source={`export default function App(...) {...}`}）；不另行生成，不声明glm.generate用于填充sandbox。不要求fallback子组件。brief为短说明，height160–480。禁止嵌套或放each/slot/logic内。共享状态从input读取为data，actions为别名到宿主action固定映射；React事件用bridge.call(alias,payload)，外部控件改变state后input自动刷新；initial只存局部状态。示例：<state id=\"n\" type=\"number\" initial={30}/><slider label=\"数值\" min={0} max={100} value={state.n} onChange=\"adjust\"/><sandbox id=\"diagram\" brief=\"数值图形\" input={{n:state.n}} actions={{adjust:\"adjust\"}} source={'export default function App({data,bridge}){return <button onClick={()=>bridge.call(\"adjust\",{value:data.n+1})}>{data.n}</button>}'} height={220}/><action id=\"adjust\"><set target=\"n\" value={clamp(event.value,0,100)}/></action>。brief与source固定，不因点击或滚动再调用模型。"+'\nJSX source约定（外层仍输出CardSpec，不单独输出JSX）：'+REACT_SURFACE_PROMPT.replace('Return only JSX:', 'source内容：')
export const NATIVE_CAPABILITY='UI模式：仅原生CardSpec。禁止sandbox/HTML/React。核心任务必须用现有组件、action或隔离logic完整实现；视觉可用关系图/图表/表单/分步视图替代，不把功能留到网页。'
export const sandboxInstruction=mode=>sandboxMode(mode)==='hybrid'?SANDBOX_CAPABILITY+INLINE_MODULE_EXAMPLE:NATIVE_CAPABILITY
const INLINE_MODULE_EXAMPLE='\n完整源码写法（source闭合后不加styles属性，CSS在模块内export；不要<style>元素）：<sandbox id="visual" brief="交互示意" height={200} initial={{count:0}} source={`export const styles=".pulse{animation:pulse 2s infinite alternate}@keyframes pulse{to{opacity:.5}}"; export default function App({state,setState}){return <div><svg viewBox="0 0 100 50"><circle className="pulse" cx={50} cy={25} r={12}/></svg><button onClick={()=>setState(s=>({...s,count:s.count+1}))}>观察 {state.count}</button></div>}`} />。不要声明React.useState；此写法保证刷新恢复。优先紧凑完整源码，勿重复实现原生UI。'
// Generation-only guard: existing cards remain readable. Detect the provable
// collision where a parent-controlled value is also independently owned locally.
export function sandboxOwnershipDiagnostics(spec){
 const outside=[],surfaces=[]
 const walk=nodes=>{for(const n of nodes||[])if(n.type==='sandbox')surfaces.push(n);else{outside.push(n);walk(n.children)}}
 walk(spec.children)
 const stateRef=e=>e?.type==='get'&&e.object?.type==='ref'&&e.object.name==='state'&&e.key?.type==='literal'?e.key.value:null
 return surfaces.flatMap(n=>{
  if(n.props.actions)return [] // explicit shared-state bridge; input owns shared values
  const keys=new Set((n.props.initial?.entries||[]).map(([k])=>k))
  const collisions=new Set((n.props.input?.entries||[]).filter(([k,e])=>keys.has(k)&&stateRef(e)).map(([,e])=>stateRef(e)))
  return outside.filter(c=>c.props?.onChange&&collisions.has(stateRef(c.props.value))).map(c=>({
   severity:'error',code:'sandbox-ownership',
   message:`sandbox ${n.id}: 外部控件 ${c.id} 与React initial重复控制 ${stateRef(c.props.value)}。共享值经input传入React并用actions联动；从initial移除共享值，只保留独立局部状态。`
  }))
 })
}
const tags=new Set('div span section article header footer main aside p h1 h2 h3 h4 h5 strong b em i small label button input textarea select option optgroup ul ol li dl dt dd br hr progress meter output fieldset legend table thead tbody tr th td pre code details summary svg g path rect circle ellipse line polyline polygon text tspan defs linearGradient radialGradient stop clipPath marker pattern title desc'.split(' '))
const events=new Set('onClick onChange onInput onPointerDown onPointerMove onPointerUp onPointerCancel onKeyDown onKeyUp onFocus onBlur'.split(' '))
const attributes=new Set('className id title role tabIndex type value defaultValue checked defaultChecked disabled readOnly multiple min max step placeholder name rows cols htmlFor open width height viewBox preserveAspectRatio d x y dx dy textLength lengthAdjust x1 x2 y1 y2 cx cy r rx ry points fill stroke strokeWidth strokeLinecap strokeLinejoin strokeDasharray strokeDashoffset strokeMiterlimit fillRule clipRule vectorEffect opacity fillOpacity strokeOpacity transform offset stopColor stopOpacity gradientUnits gradientTransform markerWidth markerHeight refX refY orient markerUnits markerStart markerMid markerEnd patternUnits patternContentUnits patternTransform clipPath textAnchor dominantBaseline fontSize fontWeight letterSpacing colSpan rowSpan maxLength autoComplete'.split(' '))
// Compatibility is deliberately finite: normalize known spellings and discard
// inert namespace declarations, never silently remove behaviour or resources.
const attributeAliases=new Map([...attributes].filter(k=>/[A-Z]/.test(k)).map(k=>[k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),k]))
for(const [alias,name]of Object.entries({class:'className',for:'htmlFor',tabindex:'tabIndex',viewbox:'viewBox',preserveaspectratio:'preserveAspectRatio'}))attributeAliases.set(alias,name)
export function validateSandboxTree(tree,{diagnostics=[]}={}){
 let count=0
 const warn=(code,attribute,element)=>{if(diagnostics.length<16&&!diagnostics.some(d=>d.code===code&&d.attribute===attribute&&d.element===element))diagnostics.push({severity:'warning',code,attribute,element})}
 function visit(n,depth=0){
  if(n==null||typeof n==='string')return
  if(depth>24||++count>800)throw Error('Sandbox UI exceeds budget')
  if(Array.isArray(n)){n.forEach(x=>visit(x,depth+1));return}
  if(!n||!tags.has(n.type)||!n.props||!Array.isArray(n.children))throw Error('Unsupported sandbox element '+n?.type)
  for(const k of Object.keys(n.props)){
   if(['xmlns','xmlnsXlink','xmlns:xlink'].includes(k)){
    if(typeof n.props[k]!=='string')throw Error('Namespace must be a string')
    delete n.props[k];warn('sandbox-ignored-namespace',k,n.type);continue
   }
   const canonical=attributeAliases.get(k)
   if(canonical&&canonical!==k){
    if(Object.hasOwn(n.props,canonical)&&n.props[canonical]!==n.props[k])throw Error('Conflicting sandbox attributes '+k+' and '+canonical)
    n.props[canonical]=n.props[k];delete n.props[k];warn('sandbox-normalized-attribute',k,n.type)
   }
  }
  for(const [k,v] of Object.entries(n.props)){
   if(events.has(k)){if(!v||typeof v.handler!=='string'||!/^\d+:\d+$/.test(v.handler))throw Error('Invalid event handler');continue}
   if(k==='style'){
    if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid inline style')
    for(const [name,value]of Object.entries(v))if(!/^(?:[a-zA-Z][a-zA-Z0-9]*|--[\w-]+)$/.test(name)||!['string','number'].includes(typeof value)||/url\s*\(|@import|expression\s*\(|[<>\\]/i.test(String(value)))throw Error('Unsafe inline style')
    continue
   }
   if(!attributes.has(k)&&!/^(?:aria|data)-[a-z][a-z0-9-]*$/.test(k))throw Error('Unsupported sandbox attribute '+k)
   if(!['string','number','boolean'].includes(typeof v)&&v!==null)throw Error('Attribute must be scalar')
   if(k==='type'&&['file','image','submit'].includes(v))throw Error('Unsupported input type')
   // SVG paint/clip references may point only inside this isolated document.
   const localSvgRef=['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan'].includes(n.type)&&['fill','stroke','clipPath','markerStart','markerMid','markerEnd'].includes(k)&&/^url\(#[A-Za-z_][\w-]*\)$/.test(v)
   if(typeof v==='string'&&/url\s*\(|@import|[<>\\]/i.test(v)&&!localSvgRef)throw Error('Unsafe attribute value')
  }
  n.children.forEach(x=>visit(x,depth+1))
 }
 visit(tree);if(JSON.stringify(tree).length>SANDBOX_LIMITS.tree)throw Error('Sandbox UI too large');return tree
}
export function validateSandboxState(value){logicJson(value,{record:true});return value}


