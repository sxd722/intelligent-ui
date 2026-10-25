import {logicJson} from '../../shared/cardspec/logic-contract.mjs'
export function createLogicController({source,initial,input={},saved,run,validate=()=>{},save=()=>{},notify=()=>{},reactive=false,afterCommit=()=>{}}){
 const initialKey=logicJson(initial,{record:true});let state=structuredClone(initial)
 if(saved?.source===source&&saved.initialKey===initialKey)try{logicJson(saved.state,{record:true});state=structuredClone(saved.state)}catch{}
 let inputKey=logicJson(input),error='',busy=false,ready=!reactive,disposed=false,epoch=0,active=null,queue=[],enabled=false,needsSync=reactive,initialized=false,inFlight=null
 const userEvent=event=>event&&!['init','input','tick'].includes(event.type)
 const snapshot=()=>({state,error,busy,ready,source,initialKey})
 const emit=()=>notify(snapshot())
 function cancel(){epoch++;active?.abort();active=null;inFlight=null;queue=[];busy=false;emit()}
 async function drain(){
  if(busy||disposed||!queue.length)return
  busy=true;error='';const generation=epoch,controller=new AbortController();active=controller;const event=queue.shift(),eventInput=JSON.parse(inputKey);inFlight={event,committed:false};emit()
  let committed=false
  try{
   const result=await run({source,state:structuredClone(state),event,input:eventInput},controller.signal)
   if(disposed||generation!==epoch)return
   logicJson(result,{record:true});validate(result);state=structuredClone(result);ready=true
   committed=true
   inFlight.committed=true
   save({source,initialKey,state:structuredClone(state)})
   if(!['init','input','tick'].includes(event.type))afterCommit({event:structuredClone(event),result:structuredClone(state),input:eventInput})
  }catch(e){if(!disposed&&generation===epoch){error=(committed?'本地结果已保存，宿主操作未完成：':'已保留之前的局部状态：')+String(e.message).slice(0,240);queue=[]}}
  finally{if(!disposed&&generation===epoch){active=null;inFlight=null;busy=false;emit();void drain()}}
 }
 function sync(){if(!enabled||!needsSync||disposed)return;needsSync=false;queue.push({type:initialized?'input':'init',args:{}});initialized=true;void drain()}
 return {snapshot,setActive(value){enabled=value;if(!value){if(busy&&reactive)needsSync=true;cancel()}else sync()},dispatch(event){
  if(disposed)return
  logicJson(event,{record:true})
  if(queue.length>=8){error='操作过快，请等待当前计算完成';emit();return}
  queue.push(structuredClone(event));void drain()
 },setInput(next){const serialized=logicJson(next);if(serialized!==inputKey){
  // Data arriving during a click must not silently erase that click. Only
  // uncommitted user events are re-evaluated, against the latest input; effects
  // already committed to the host are never replayed. Explicit cancel/leave
  // still discards everything.
  const pending=enabled?[...(inFlight&&!inFlight.committed&&userEvent(inFlight.event)?[inFlight.event]:[]),...queue.filter(userEvent)]:[]
  cancel();inputKey=serialized;needsSync=reactive
  if(enabled){
   if(reactive){needsSync=false;queue.push({type:initialized?'input':'init',args:{}});initialized=true}
   queue.push(...pending);void drain()
  }
 }},cancel,
 reset(){cancel();state=JSON.parse(initialKey);ready=!reactive;error='';save({source,initialKey,state:structuredClone(state)});needsSync=reactive;emit();sync()},
 dispose(){disposed=true;epoch++;active?.abort();queue=[]}}
}
