import {newQuickJSWASMModuleFromVariant} from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-wasmfile-release-sync'
import wasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url'
import {createSandboxVM} from '../../shared/cardspec/sandbox-engine.mjs'
const ready=newQuickJSWASMModuleFromVariant({...variant,importModuleLoader:async()=>{const loader=await variant.importModuleLoader();return options=>loader({...options,locateFile:()=>wasmUrl})}})
let vm,queue=Promise.resolve()
self.onmessage=({data:m})=>{queue=queue.then(async()=>{try{
 if(m.type==='init'){vm?.dispose();vm=createSandboxVM(await ready,m.payload)}
 const result=m.type==='input'?vm.input(m.payload):m.type==='event'?vm.event(m.handler,m.payload):vm.snapshot()
 self.postMessage({id:m.id,result})
}catch(e){self.postMessage({id:m.id,error:String(e.message).slice(0,240)})}})}
