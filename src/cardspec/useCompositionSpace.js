import {useLayoutEffect,useRef,useState} from 'react'
export function useCompositionSpace({reservePagination=false}={}){
 const ref=useRef(null),[height,setHeight]=useState(null)
 useLayoutEffect(()=>{const body=ref.current?.closest('.cs-composition-body');if(!body)return
  const update=()=>setHeight(Math.max(60,body.clientHeight-(reservePagination||body.dataset.paginated==='true'?44:0)))
  const ro=new ResizeObserver(update);ro.observe(body);const mo=new MutationObserver(update);mo.observe(body,{attributes:true,attributeFilter:['data-paginated']});update()
  return()=>{ro.disconnect();mo.disconnect()}
 },[reservePagination])
 return [ref,height]
}
