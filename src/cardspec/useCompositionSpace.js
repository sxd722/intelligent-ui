import {useLayoutEffect,useRef,useState} from 'react'
import {blockBox} from './layout-measure.js'
import {useCardSize} from '../CardSize.jsx'
export function useCompositionSpace({reservePagination=false,fill=true,sharePage=false}={}){
  const ref=useRef(null),[height,setHeight]=useState(null)
 const size=useCardSize()
 useLayoutEffect(()=>{if(size==='full'){setHeight(null);return}const compositionBody=ref.current?.closest('.cs-composition-body'),body=compositionBody||ref.current?.closest('.cs-card');if(!body)return
  const el=ref.current
  if(fill)el.dataset.compositionSpace='fill'
  const update=()=>{
   let used=0
   if(!compositionBody){const css=getComputedStyle(body);used=(parseFloat(css.paddingTop)||0)+(parseFloat(css.paddingBottom)||0);for(const sibling of body.children){if(sibling===el||sibling.contains(el)||sibling.hidden)continue;used+=blockBox(sibling).outer+(parseFloat(css.rowGap)||0)}}
   if(sharePage&&compositionBody){
    const item=el.closest('.cs-composition-item'),gap=parseFloat(getComputedStyle(body).rowGap)||0
    for(const sibling of body.children){if(sibling===item){if(body.dataset.compositionSingle==='true')continue;break}if(!sibling.hidden)used+=blockBox(sibling).outer+gap}
   }
   setHeight(Math.max(60,body.clientHeight-used-(reservePagination?44:0)))
  }
  const ro=new ResizeObserver(update);ro.observe(body)
  if(sharePage)for(const item of body.children)ro.observe(item)
  const mo=new MutationObserver(update);mo.observe(body,{attributes:true,attributeFilter:['data-paginated']});update()
  return()=>{ro.disconnect();mo.disconnect();if(fill)delete el.dataset.compositionSpace}
 },[reservePagination,fill,sharePage,size])
 return [ref,height]
}
