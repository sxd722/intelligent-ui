import test from 'node:test'
import assert from 'node:assert/strict'
import {compileWebSandbox} from '../server/cardspec/web-sandbox.mjs'
import {compileSandbox} from '../server/cardspec/sandbox.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {sandboxMode,sandboxInstruction} from '../shared/cardspec/sandbox-policy.mjs'
import {generationSettings} from '../shared/cardspec/generation-settings.mjs'
import {generationLayout} from '../shared/cardspec/generation-layout.mjs'
import {webDocument} from '../src/cardspec/web-document.mjs'
import {validateDebugInput} from '../server/cardspec/debug-session.mjs'
import {compactBuildTestSteps} from '../server/cardspec/build-test-steps.mjs'
import {resolveWebImport} from '../shared/cardspec/web-policy.mjs'
import {applyWebStateUpdate} from '../shared/cardspec/web-state.mjs'
const source=`import React,{useState,useEffect} from 'react'; export const styles='.app{animation:fade 1s}@keyframes fade{from{opacity:0}}'; export default function App(){const [n,set]=useState(0);useEffect(()=>{const t=setInterval(()=>set(x=>x+1),1000);return()=>clearInterval(t)},[]);return <div className="grid gap-2"><button onClick={()=>set(n+1)}>{n}</button><canvas/></div>}`

test('persistent JSON updates isolate mutation, commit fresh values and retain no-op identity',()=>{
 const old={counter:0,items:[{value:1}]}
 const next=applyWebStateUpdate(old,d=>{d.counter++;d.items[0].value=2;return d})
 assert.deepEqual(old,{counter:0,items:[{value:1}]});assert.equal(next.counter,1);assert.equal(next.items[0].value,2)
 assert.equal(applyWebStateUpdate(next,d=>d),next)
 const replacement={counter:4};const committed=applyWebStateUpdate(next,replacement);replacement.counter=9;assert.equal(committed.counter,4)
})
test('invalid or throwing state transactions never mutate the committed snapshot',()=>{
 const old={count:1}
 assert.throws(()=>applyWebStateUpdate(old,d=>{d.count=2;throw Error('failed')}),/failed/);assert.equal(old.count,1)
 for(const value of [{n:Infinity},{f:()=>{}},undefined,{text:'x'.repeat(65536)}])assert.throws(()=>applyWebStateUpdate(old,value))
})
test('async assertions have bounded waits and are not folded into an earlier snapshot',()=>{
 const steps=[{op:'click',name:'开始',expect:{text:'准备'}},{op:'check',waitMs:500,expect:{text:'完成'}}]
 assert.equal(validateDebugInput({source:'<card/>',steps}).steps[1].waitMs,500)
 assert.equal(compactBuildTestSteps(steps).length,2)
 assert.throws(()=>validateDebugInput({source:'<card/>',steps:[{op:'check',waitMs:999999}]}),/waitMs/)
})
test('Web mode is explicit, enables debugging and retains distinct strict contract',()=>{
 assert.equal(sandboxMode('web'),'web');assert.equal(sandboxMode('anything'),'native')
 assert.equal(generationSettings({renderMode:'web'}).debugGeneration,true)
 assert.match(sandboxInstruction('web'),/完整Web应用/)
 assert.match(sandboxInstruction('hybrid'),/no imports/i)
 assert.equal(generationLayout('square','page',{webApplication:true}).maxSourceCharacters,120000)
})
test('Web compiler accepts hooks and timers but never executes author code',async()=>{
 delete globalThis.WEB_AUTHOR_EXECUTED
 const m=await compileWebSandbox('globalThis.WEB_AUTHOR_EXECUTED=true;'+source)
 assert.equal(globalThis.WEB_AUTHOR_EXECUTED,undefined)
 assert.equal(m.kind,'web');assert.match(m.css,/\.grid/);assert.match(m.code,/setInterval/)
 await assert.rejects(compileSandbox(source),/no imports/i)
})
test('CDN modules remain browser imports, unsupported server/filesystem imports fail',async()=>{
 const url=new URL(resolveWebImport('https://esm.sh/some-react-library@1.0.0?target=es2022'))
 assert.equal(url.searchParams.get('external'),'react,react-dom');assert.equal(url.searchParams.get('target'),'es2022')
 const m=await compileWebSandbox("import {nanoid} from 'https://cdn.jsdelivr.net/npm/nanoid@5.1.5/non-secure/index.js';export default function App(){return <div>{nanoid()}</div>}")
 assert.equal(m.dependencies.length,1);assert.match(m.code,/https:\/\/cdn/)
 for(const name of ['node:fs','/etc/passwd','http://localhost:8787/api/health','react-router'])await assert.rejects(compileWebSandbox(`import x from '${name}';export default function App(){return <div>{x}</div>}`),/unsupported import/)
 await assert.rejects(compileWebSandbox('export const n=1'),/No matching export/)
})
test('CardSpec selects correct compiler and pure native mode still rejects sandbox',async()=>{
 const dsl=`<card><sandbox id="app" brief="应用" source={${JSON.stringify(source)}}/></card>`
 const r=compileCard(dsl,{final:true,context:{renderMode:'web'}})
 await validateRichContent(r);assert.equal(r.complete,true);assert.equal(r.spec.sandboxModules.app.kind,'web')
 const strict=compileCard(dsl,{final:true,context:{renderMode:'hybrid'}})
 await validateRichContent(strict);assert.equal(strict.complete,false)
 assert.equal(compileCard(dsl,{final:true,context:{renderMode:'native'}}).complete,false)
})
test('opaque document CSP allows HTTPS CDN but excludes host HTTP and forms',async()=>{
 const m=await compileWebSandbox(`export default function App(){return <div>{'</script><script>not-an-injected-script</script>'}</div>}`)
 const html=webDocument(m,'test-token')
 assert.match(html,/connect-src https:/);assert.match(html,/form-action 'none'/)
 assert.doesNotMatch(html,/allow-same-origin/)
 assert.equal((html.match(/<\/script>/g)||[]).length,3)
})
