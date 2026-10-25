import React from 'react'
import Renderer from 'react-test-renderer'
export {React}
export function createApp(App,input,initial,capabilities=[]){
 let data=input,state=initial,root,handlers={},revision=0,effects=[],inGesture=false
 const allowed=new Set(capabilities)
 const bridge=Object.freeze({call(name,payload={}){
  if(!inGesture)throw Error('bridge.call requires a user event; never call during render/effect initialization')
  if(!allowed.has(name))throw Error('Sandbox action is not exposed: '+name)
  if(effects.length)throw Error('Use one host action per gesture')
  effects.push({type:'action',name,payload})
 }})
 function Wrapper(){const [value,set]=React.useState(state);state=value
  return React.createElement(App,{data,state:value,bridge,setState:next=>set(old=>typeof next==='function'?next(old):next)})
 }
 const update=()=>Renderer.act(()=>{root?root.update(React.createElement(Wrapper)):root=Renderer.create(React.createElement(Wrapper))})
 function snapshot(){
  handlers={};let count=0;const rev=++revision
  function json(value,ancestors=new Set(),depth=0){
   if(depth>24||typeof value==='number'&&!Number.isFinite(value))throw Error('State must be finite JSON')
   if(value===null||['string','boolean','number'].includes(typeof value))return
   if(typeof value!=='object'||ancestors.has(value)||(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype))throw Error('State must be plain JSON')
   ancestors.add(value);for(const child of Object.values(value))json(child,ancestors,depth+1);ancestors.delete(value)
  }
  if(!state||Array.isArray(state)||typeof state!=='object')throw Error('State must be a JSON object')
  json(state)
  function tree(n,depth=0){
   if(n==null||typeof n==='string')return n
   if(depth>24||++count>800)throw Error('UI tree exceeds budget')
   if(Array.isArray(n))return n.map(x=>tree(x,depth+1))
   const props={};for(const [k,v]of Object.entries(n.props||{})){
    if(typeof v==='function'&&/^on[A-Z]/.test(k)){const id=rev+':'+Object.keys(handlers).length;handlers[id]=v;props[k]={handler:id}}
    else if(typeof v!=='function')props[k]=v
   }
   return {type:n.type,props,children:(n.children||[]).map(x=>tree(x,depth+1))}
  }
  const result=JSON.stringify({tree:tree(root.toJSON()),state,revision,effects});effects=[];return result
 }
 update()
 return {snapshot,input(next){data=next;update();return snapshot()},event(id,payload){
  const fn=handlers[id];if(!fn)throw Error('Stale UI event')
  const e={...payload,target:{value:payload.value,checked:payload.checked},currentTarget:{value:payload.value,checked:payload.checked},preventDefault(){},stopPropagation(){}}
  effects=[]
  try{Renderer.act(()=>{inGesture=['click','input','change','pointerup','keydown'].includes(payload.type);try{fn(e)}finally{inGesture=false}});return snapshot()}finally{inGesture=false;effects=[]}
 }}
}
