import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react'

const Context=createContext(null)
export function NavigationProvider({children}) {
  const registry=useMemo(()=>{
    const r={owners:new Map(),controllers:new Map(),listeners:new Set(),version:0}
    r.emit=()=>{r.version++;for(const listener of r.listeners) listener()}
    r.subscribe=fn=>{r.listeners.add(fn);return()=>r.listeners.delete(fn)}
    r.snapshot=()=>r.version
    return r
  },[])
  return <Context.Provider value={registry}>{children}</Context.Provider>
}
function useRegistry() {
  const r=useContext(Context)
  useSyncExternalStore(r.subscribe,r.snapshot,r.snapshot)
  return r
}
export function useNavigationOwner(id, external, model) {
  const r=useRegistry()
  const signature=JSON.stringify([model.label,model.value,model.count,model.disabledPrevious,model.disabledNext,model.previousLabel,model.nextLabel])
  useLayoutEffect(()=>{
    if(!external) return
    const old=r.owners.get(id);r.owners.set(id,{model,signature})
    if(old?.signature!==signature) r.emit()
  })
  useEffect(()=>()=>{if(external){r.owners.delete(id);r.emit()}},[r,id,external])
  return !external || !r.controllers.get(id)?.size
}
export function NavigationBar({model, className='cs-navigation'}) {
  if(!model || model.count<=1) return null
  return <nav className={className} aria-label={model.label || '导航'}>
    <button type="button" aria-label={model.previousLabel || '上一页'} disabled={model.disabledPrevious} onClick={model.previous}>{model.previousText || '上一页'}</button>
    <span aria-live="polite">{model.value}</span>
    <button type="button" aria-label={model.nextLabel || '下一页'} disabled={model.disabledNext} onClick={model.next}>{model.nextText || '下一页'}</button>
  </nav>
}
export function ExternalNavigation({target,identity,label}) {
  const r=useRegistry()
  useLayoutEffect(()=>{
    if(!r.controllers.has(target)) r.controllers.set(target,new Set())
    r.controllers.get(target).add(identity);r.emit()
    return()=>{r.controllers.get(target)?.delete(identity);r.emit()}
  },[r,target,identity])
  // A malformed/old spec cannot mount two active controllers for one owner.
  if(r.controllers.get(target)?.values().next().value!==identity) return null
  const model=r.owners.get(target)?.model
  return <NavigationBar model={model && {...model,label:label || model.label}}/>
}
