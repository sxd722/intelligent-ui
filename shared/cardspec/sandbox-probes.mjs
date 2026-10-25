import {createSandboxVM} from './sandbox-engine.mjs'

// Bounded isolated probes, not an exhaustive business or visual correctness claim.
// Effects are inspected but never dispatched to the host.
export function probeSandbox(engine,{code,input={},initial={},capabilities=[]}){
 const vm=createSandboxVM(engine,{code,input,state:initial,capabilities})
 try{
  const first=vm.snapshot(),handlers=[]
  const walk=n=>{if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;
   if(n.props?.onClick?.handler&&!n.props.disabled)handlers.push(n.props.onClick.handler)
   n.children?.forEach(walk)
  };walk(first.tree)
  let clicks=0
  for(const handler of handlers.slice(0,3)){
   const trial=createSandboxVM(engine,{code,input,state:initial,capabilities})
   try{trial.snapshot();const after=trial.event(handler,{type:'click',trusted:true,x:0,y:0,target:{value:''}});
    const restored=createSandboxVM(engine,{code,input,state:after.state,capabilities})
    try{
     const stable=tree=>JSON.stringify(tree,(_k,v)=>v&&typeof v==='object'&&typeof v.handler==='string'?{handler:'event'}:v)
     if(stable(after.tree)!==stable(restored.snapshot().tree))throw Error('Sandbox view does not restore after a click. Store interactive progress in supplied state/setState, not React.useState/useReducer or module variables.')
    }finally{restored.dispose()}
    clicks++
   }finally{trial.dispose()}
  }
  return {diagnostics:first.diagnostics,validation:{initialRender:true,clickProbes:clicks,scope:'isolated render and up to three initial clicks plus state restoration; no host effects'}}
 }finally{vm.dispose()}
}
