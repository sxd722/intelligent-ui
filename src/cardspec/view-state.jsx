import React,{createContext,useContext,useRef,useState,useCallback} from 'react'
const Context=createContext(null)
export const ViewStateProvider=Context.Provider
export function useViewState(key,initial){
  const context=useContext(Context),current=useRef(context);current.current=context
  const [value,setValue]=useState(()=>context&&Object.hasOwn(context.values,key)?context.values[key]:initial)
  const valueRef=useRef(value);valueRef.current=value
  const set=useCallback(next=>{
    const result=typeof next==='function'?next(valueRef.current):next
    valueRef.current=result;setValue(result)
    if(current.current){current.current.values[key]=result;current.current.save?.()}
  },[key])
  return [value,set]
}
