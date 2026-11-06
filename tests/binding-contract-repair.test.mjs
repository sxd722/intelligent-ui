import test from 'node:test'
import assert from 'node:assert/strict'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {isSupportingContent} from '../shared/cardspec/supporting-content.mjs'
import {bindingCapabilities} from '../shared/cardspec/binding-capabilities.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {repairCapabilities,lostRepairCapabilities} from '../server/cardspec/repair-capabilities.mjs'
const compile=body=>compileCard('<card>'+body+'</card>',{final:true,context:{expressionDialect:'js-v1'}})
test('live receipt/selection remains in card; static references can be moved',()=>{
 for(const body of ['<binding id="b" tool="opencli.spotify.pause" input={{}} load="manual"/><region role="details"><text>{bindings.b.status}</text></region>', '<state id="selected" type="string" initial=""/><region role="details"><text>{state.selected}</text></region>']) {
  const r=compile(body);assert.ok(r.complete,JSON.stringify(r.diagnostics));assert.equal(isSupportingContent(r.spec.children[0]),false)
 }
 assert.equal(isSupportingContent(compile('<region role="details"><text>参考说明</text></region>').spec.children[0]),true)
})
test('unknown action identifies offending node, source location and closed available set',()=>{
 const r=compileCard('<card>\n<button id="x" onPress="invented">打开</button>\n<state id="n" type="number" initial={0}/><action id="valid"><set target="n" value={1}/></action></card>',{final:true})
 const e=r.diagnostics.find(d=>d.code==='action');assert.equal(e.line,2);assert.match(e.message,/button#x.onPress/);assert.match(e.message,/declared actions: valid/)
})
test('capabilities do not infer detail from sibling source; write samples are not execution',()=>{
 assert.equal(bindingCapabilities({key:'a',detail:{}}).actions.detail,'detail_a')
 assert.equal(bindingCapabilities({key:'b'}).actions.detail,null)
 assert.equal(bindingCapabilities({key:'b'}).detail.available,false)
 assert.match(bindingCapabilities({key:'receipt',readOnly:false}).lifecycle,/idle.*尚未执行/)
})
test('describe explicitly returns unavailable detail without executing any tool',async()=>{
 const id='opencli.spotify.pause';let calls=0
 const g=createGenerationTools({catalog:[{...TOOLS[id],id,available:true}],invoke:async()=>{calls++}})
 const d=await g.execute('cli_describe',{id});assert.equal(d.detail,null);assert.equal(calls,0)
})
test('repair cannot keep dead invoke declarations while removing the user trigger',()=>{
 const base='<binding id="b" tool="opencli.spotify.pause" input={{}} load="manual"/><action id="go"><invoke binding="b"/></action>'
 const before=compile(base+'<button onPress="go">执行</button>').spec
 const after=compile(base+'<text>已成功</text>').spec
 const cap=s=>repairCapabilities(s,['opencli.spotify.pause'])
 assert.ok(lostRepairCapabilities(cap(before),cap(after)).some(d=>/user reachable/.test(d.message)))
 const renamed=compile(base+'<button id="renamed" onPress="go">开始</button>').spec
 assert.equal(lostRepairCapabilities(cap(before),cap(renamed)).length,0)
})
