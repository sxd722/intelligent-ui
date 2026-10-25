import runtimeSource from './sandbox-runtime.generated.mjs'
import {SANDBOX_LIMITS,validateSandboxTree,validateSandboxState} from './sandbox-policy.mjs'
import {logicJson} from './logic-contract.mjs'
import {validateSandboxEffects} from './sandbox-bridge.mjs'
export function createSandboxVM(QuickJS,{code,input={},state={},capabilities=[]}){
 if(typeof code!=='string'||code.length>SANDBOX_LIMITS.compiled)throw Error('Invalid sandbox code')
 logicJson(input);validateSandboxState(state)
 const runtime=QuickJS.newRuntime();runtime.setMemoryLimit(SANDBOX_LIMITS.memory);runtime.setMaxStackSize(512*1024)
 let deadline=0,disposed=false
 runtime.setInterruptHandler(()=>Date.now()>deadline)
 const vm=runtime.newContext()
 function run(script,budget=SANDBOX_LIMITS.timeMs){
  if(disposed)throw Error('Sandbox disposed');deadline=Date.now()+budget
  const result=vm.evalCode(script,'sandbox.js')
  if(result.error){const error=vm.dump(result.error);result.error.dispose();throw Error(error?.message==='interrupted'?'Sandbox computation timed out':String(error?.message||'Sandbox failed').slice(0,240))}
  try{return vm.dump(result.value)}finally{result.value.dispose()}
 }
 function read(script){const raw=run(script);if(typeof raw!=='string'||raw.length>SANDBOX_LIMITS.tree+SANDBOX_LIMITS.state)throw Error('Sandbox output too large');const out=JSON.parse(raw);out.diagnostics=[];validateSandboxTree(out.tree,{diagnostics:out.diagnostics});validateSandboxState(out.state);validateSandboxEffects(out.effects);return out}
 try{run(`var console={log(){},warn(){},error(){}};var setTimeout=function(){return 0},clearTimeout=function(){};${runtimeSource}\nvar React=SandboxRuntime.React;var exports={};var module={exports};${code}\nvar app=SandboxRuntime.createApp(module.exports.default,${logicJson(input)},${logicJson(state,{record:true})},${logicJson(capabilities)});`,1500)}catch(e){vm.dispose();runtime.dispose();throw e}
 return {snapshot:()=>read('app.snapshot()'),input:input=>read(`app.input(${logicJson(input)})`),event:(handler,event)=>read(`app.event(${JSON.stringify(handler)},${logicJson(event,{record:true})})`),dispose(){if(!disposed){disposed=true;vm.dispose();runtime.dispose()}}}
}
