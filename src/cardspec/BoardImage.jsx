import React from 'react'
import {safePhotoUrl} from '../../shared/cardspec/images.mjs'
const cache=new Map()
export function BoardImage({query,title}){
 const [src,setSrc]=React.useState(null),[failed,setFailed]=React.useState(false)
 React.useEffect(()=>{let active=true;setSrc(null);setFailed(false);if(!query)return
  if(!cache.has(query)){const task=fetch('/api/photo?role=thumbnail&query='+encodeURIComponent(query)).then(r=>r.ok?r.json():null).then(v=>safePhotoUrl(v?.url)).catch(()=>null);cache.set(query,task);if(cache.size>100)cache.delete(cache.keys().next().value)}
  cache.get(query).then(url=>{if(active)setSrc(url)});return()=>{active=false}
 },[query])
 return src&&!failed?<img src={src} alt={title} onError={()=>setFailed(true)}/>:null
}
