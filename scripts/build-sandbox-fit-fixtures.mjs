import {readFile,writeFile} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {makeScope,createStore} from '../shared/cardspec/store.mjs'
import {compileSandbox} from '../server/cardspec/sandbox.mjs'
const wrap=(source)=>`<card schemaVersion="1"><state id="n" type="number" initial={1}/><title>图形空间适配</title><caption>示意数据 · 图形与操作同屏</caption><sandbox id="visual" brief="独立图形布局回归" height={310} input={{n:state.n}} source={${JSON.stringify(source)}}/><text>当前选择：{state.n}</text><button onPress="next">下一步</button><action id="next"><increment target="n"/></action></card>`
const sources={
 sandboxWaterFit:await readFile(new URL('../tests/fixtures/sandbox-water.cardspec',import.meta.url),'utf8'),
 sandboxTallFit:wrap('export default function App({data}){return <div><svg viewBox="0 0 100 600" width="100%" aria-label="纵向刻度"><rect x={20} y={10} width={60} height={580} rx={30} fill="#177b86"/><circle cx={50} cy={80+data.n*40} r={22} fill="#ffd66b"/></svg></div>}'),
 sandboxCanvasFit:wrap('export default function App({data}){return <Canvas width={600} height={900} aria-label="画布比例" draw={ctx=>{ctx.fillStyle="#17657b";ctx.fillRect(0,0,600,900);ctx.fillStyle="#ffd66b";ctx.beginPath();ctx.arc(300,400,80+data.n*5,0,Math.PI*2);ctx.fill()}}/>}'),
 sandboxMixedFit:wrap('export default function App({state,setState}){return <div><svg viewBox="0 0 200 80" height={80} width="100%"><circle cx={100} cy={40} r={25} fill="#17657b"/></svg><p>保留文字与表单大小，不整体缩放。</p><button onClick={()=>setState({n:(state.n||0)+1})}>内部操作 {state.n||0}</button></div>}')
}
const fixtures={}
for(const [id,source] of Object.entries(sources)){
 const {spec,diagnostics}=compileCard(source,{final:true,cardId:id,context:{renderMode:'hybrid'}})
 if(diagnostics.some(d=>d.severity==='error'))throw Error(JSON.stringify(diagnostics))
 const scope=makeScope(spec,createStore()),node=spec.children.find(n=>n.type==='sandbox')
 const p=Object.fromEntries(Object.entries(node.props).map(([k,v])=>[k,evaluate(v,scope)]))
 const module=await compileSandbox(p.source,{input:p.input||{},initial:p.initial||{},capabilities:Object.keys(p.actions||{})})
 fixtures[id]={source,sandboxModules:{[node.id]:module}}
}
await writeFile(new URL('../shared/cardspec/sandbox-fit-fixtures.generated.mjs',import.meta.url),'// Deterministic local QA fixtures; rebuild with scripts/build-sandbox-fit-fixtures.mjs.\nexport const SANDBOX_FIT_FIXTURES='+JSON.stringify(fixtures)+'\n')
console.log('Compiled four sandbox layout fixtures without model or tool calls.')
