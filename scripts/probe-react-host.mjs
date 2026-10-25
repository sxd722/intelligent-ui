import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {getQuickJS} from 'quickjs-emscripten'
import {createSandboxVM} from '../shared/cardspec/sandbox-engine.mjs'
import {compileCloudSandbox} from '../sites/intelligent-ui/server/cloud-sandbox.mjs'
const out='artifacts/react-capability-20261020'
await mkdir(out,{recursive:true})
const Q=await getQuickJS(),checks=[]
for(const [id,source]of [
 ['literal-import','export default function App(){return <p>import 与 export 的区别</p>}'],
 ['comment-import','// import is discussed in the caption\nexport default function App(){return <p>模块解释</p>}'],
 ['window-reduced-motion','export default function App(){const r=window.matchMedia("(prefers-reduced-motion: reduce)");return <p>动效</p>}'],
 ['svg-marker','export default function App(){return <svg viewBox="0 0 100 50"><defs><marker id="a" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z"/></marker></defs><line x1="10" y1="25" x2="90" y2="25" stroke="black" markerEnd="url(#a)"/></svg>}']
]){
 let module,vm,stage='compile'
 try{module=await compileCloudSandbox(source);stage='render';vm=createSandboxVM(Q,{code:module.code});vm.snapshot();checks.push({id,pass:true})}
 catch(e){checks.push({id,stage,error:e.message})}finally{vm?.dispose()}
}
const toFile=f=>pathToFileURL(path.resolve(f)).href
// Experimental host capability only: production source and policies are untouched.
let policy=await readFile('shared/cardspec/sandbox-policy.mjs','utf8')
policy=policy.replace("'./logic-contract.mjs'",JSON.stringify(toFile('shared/cardspec/logic-contract.mjs')))
 .replace('clipPath title desc','clipPath marker title desc')
 .replace('gradientUnits gradientTransform clipPath','gradientUnits gradientTransform markerWidth markerHeight refX refY orient markerStart markerMid markerEnd clipPath')
 .replace("['fill','stroke','clipPath']","['fill','stroke','clipPath','markerStart','markerMid','markerEnd']")
await writeFile(out+'/experimental-policy.mjs',policy)
let engine=await readFile('shared/cardspec/sandbox-engine.mjs','utf8')
engine=engine.replace("'./sandbox-runtime.generated.mjs'",JSON.stringify(toFile('shared/cardspec/sandbox-runtime.generated.mjs')))
 .replace("'./logic-contract.mjs'",JSON.stringify(toFile('shared/cardspec/logic-contract.mjs')))
 .replace("'./sandbox-policy.mjs'","'./experimental-policy.mjs'")
await writeFile(out+'/experimental-engine.mjs',engine)
const alternative=(await import(toFile(out+'/experimental-engine.mjs'))).createSandboxVM
for(const [id,paint]of [['local-marker','url(#a)'],['remote-marker','url(https://example.com/a.svg#a)']]){
 let vm
 try{const m=await compileCloudSandbox(`export default function App(){return <svg><defs><marker id="a" markerWidth="6" markerHeight="6"><path d="M0 0L6 3L0 6Z"/></marker></defs><line markerEnd="${paint}"/></svg>}`)
 vm=alternative(Q,{code:m.code});vm.snapshot();checks.push({id,experimental:true,pass:true})}
 catch(e){checks.push({id,experimental:true,error:e.message})}finally{vm?.dispose()}
}
await writeFile(out+'/host-probes.json',JSON.stringify(checks,null,2));console.log(checks)
