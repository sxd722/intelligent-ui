import {newQuickJSWASMModuleFromVariant} from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-wasmfile-release-sync'
import wasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url'
import {executeLogic} from '../../shared/cardspec/logic-engine.mjs'
// The only network read is trusted runtime initialization from a bundled asset.
// Generated code executes inside QuickJS, with no reference to this worker.
const ready=newQuickJSWASMModuleFromVariant({...variant,importModuleLoader:async()=>{
 const loader=await variant.importModuleLoader()
 return options=>loader({...options,locateFile:()=>wasmUrl})
}})
self.onmessage=async({data})=>{
 try{const result=executeLogic(await ready,data.payload);self.postMessage({id:data.id,result})}
 catch(e){self.postMessage({id:data.id,error:String(e.message).slice(0,240)})}
}
