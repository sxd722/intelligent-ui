import { useLayoutEffect, useRef, useState } from 'react'

// Measure all mounted content, including off-screen carousel pages. Freeze on
// generation completion; only a viewport-width change establishes a new budget.
export function useIntrinsicHeight(ref, streaming, measure) {
  const [size,setSize]=useState({width:0,height:null})
  const memory=useRef({width:0,locked:false}),read=useRef(measure)
  read.current=measure
  useLayoutEffect(()=>{
    const el=ref.current;if(!el)return
    let frame=0,disposed=false
    const update=()=>{
      frame=0;const width=el.clientWidth
      if(!width)return
      if(memory.current.width!==width){memory.current={width,locked:false}}
      if(streaming)memory.current.locked=false
      if(memory.current.locked)return
      const height=Math.ceil(read.current(el,width))
      if(!Number.isFinite(height)||height<=0)return
      setSize(old=>old.width===width&&old.height===height?old:{width,height})
      if(!streaming)memory.current.locked=true
    }
    const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(update)}
    const resize=new ResizeObserver(schedule);resize.observe(el)
    const mutation=new MutationObserver(schedule);mutation.observe(el,{subtree:true,childList:true,characterData:true})
    schedule();document.fonts?.ready.then(schedule)
    return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect()}
  },[ref,streaming])
  return size
}
