import test from 'node:test'
import assert from 'node:assert/strict'
import {generationSettings} from '../shared/cardspec/generation-settings.mjs'
import {sandboxInstruction} from '../shared/cardspec/sandbox-policy.mjs'
import {compileWebSandbox} from '../server/cardspec/web-sandbox.mjs'
import {webDocument} from '../src/cardspec/web-document.mjs'
test('GPU opt-in is a boolean, scoped to Web, carried on subsequent generation',()=>{
 assert.equal(generationSettings({renderMode:'web',webGraphics:true}).webGraphics,true)
 for(const view of [{renderMode:'hybrid',webGraphics:true},{renderMode:'web',webGraphics:'true'},{}])assert.equal(generationSettings(view).webGraphics,undefined)
 assert.match(sandboxInstruction('web',{webGraphics:true}),/完整shader/)
 assert.match(sandboxInstruction('web',{}),/高级图形未开启/)
 assert.doesNotMatch(sandboxInstruction('hybrid',{webGraphics:true}),/graphics.shader/)
})
test('Web shader compiles as inert JS, document opt-in preserves opaque isolation',async()=>{
 const mod=await compileWebSandbox('export default function App({graphics}){return <canvas data-ready={graphics.enabled}/>}')
 assert.match(webDocument(mod,'test'),/data-web-graphics="false"/)
 const enabled=webDocument(mod,'test',{webGraphics:true})
 assert.match(enabled,/data-web-graphics="true"/)
 assert.doesNotMatch(enabled,/allow-same-origin/)
 assert.match(enabled,/frame-src 'none'/)
})
