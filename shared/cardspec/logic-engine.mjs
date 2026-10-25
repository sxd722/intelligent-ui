import {validateLogicSource,logicJson,LOGIC_LIMITS} from './logic-contract.mjs'
import {createNumeric} from './numeric.mjs'
// QuickJS has no host callbacks or module loader. Never eval in the host realm.
export function executeLogic(QuickJS,{source,state,event,input={}}){
 validateLogicSource(source)
 const args=[logicJson(state,{record:true}),logicJson(event,{record:true}),logicJson(input)]
 const runtime=QuickJS.newRuntime();runtime.setMemoryLimit(LOGIC_LIMITS.memory);runtime.setMaxStackSize(256*1024)
 const vm=runtime.newContext()
 try{
  const code=`(function(){"use strict";
   const stringify=JSON.stringify.bind(JSON), finite=Number.isFinite, proto=Object.getPrototypeOf, plain=Object.prototype, isArray=Array.isArray, paths=new WeakMap();
   const values=${JSON.stringify(args)}.map(s=>JSON.parse(s));
   const numeric=(${createNumeric.toString()})();
   ${source}
   const result=update(values[0],values[1],values[2]);
   if(!result||typeof result!=='object'||isArray(result)||proto(result)!==plain)throw Error('update must return a plain state object');
   return stringify(result,function(key,v){
    if(v===undefined&&!isArray(this))return undefined;
    const parent=paths.get(this),path=parent===undefined?'state':parent+(isArray(this)?'['+key+']':'['+stringify(key)+']');
    if(typeof v==='number'&&!finite(v)||['undefined','function','symbol','bigint'].includes(typeof v))throw Error('state must contain only finite JSON values: '+path+' is '+(typeof v==='number'?String(v):typeof v));
    if(v&&typeof v==='object')paths.set(v,path);
    return v;
   });
  })()`
  // Bound guest execution, excluding host context initialization and code assembly.
  // Worker clocks can stay fixed during CPU work. Bound interpreter checkpoints
  // as well as wall time so a synchronous loop cannot bypass interruption.
  let interrupts=0
  const deadline=Date.now()+LOGIC_LIMITS.timeMs;runtime.setInterruptHandler(()=>++interrupts>LOGIC_LIMITS.interrupts||Date.now()>deadline)
  const result=vm.evalCode(code,'card-logic.js')
  if(result.error){const error=vm.dump(result.error);result.error.dispose();const message=String(error?.message||'逻辑执行失败');throw Error(message==='interrupted'?'逻辑计算超过时间预算，已中止':message.slice(0,240))}
  let raw;try{raw=vm.getString(result.value)}finally{result.value.dispose()}
  if(raw.length>LOGIC_LIMITS.json)throw Error('逻辑状态超过容量限制')
  const value=JSON.parse(raw);logicJson(value,{record:true});return value
 }finally{vm.dispose();runtime.dispose()}
}
