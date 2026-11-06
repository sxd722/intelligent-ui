import React,{useState} from 'react'
import {Thinking} from './Thinking.jsx'
import {useCardSize} from './CardSize.jsx'
import './styles/design-preview.css'

// The event carries a host-owned cached asset, never a model-authored URL.
export function DesignPreview({design,pending,children}){
 const size=useCardSize(),[failedUrl,setFailedUrl]=useState(null)
 const url=design?.status==='ready'&&/^\/api\/media\/[a-f0-9]{64}\.jpg$/.test(design.url||'')?design.url:null
 if(!url)return children
 if(!pending)return <div className="design-preview-result">{children}</div>
 return <section className="design-preview" data-card-size={size} aria-label="设计图预览" aria-busy="true">
  {failedUrl!==url?<img src={url} alt="正在实现的卡片设计参考图" onError={()=>setFailedUrl(url)}/>:<div className="design-preview-placeholder">设计图暂不可见</div>}
  <div className="design-preview-overlay"><div className="design-preview-status"><Thinking/><span>设计已就绪，正在实现并验证交互…</span></div></div>
 </section>
}
