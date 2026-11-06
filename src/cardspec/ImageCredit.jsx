import React,{useRef} from 'react'
import {safeLink} from '../../shared/cardspec/result-view.mjs'

export function ImageCredit({resource,asset=false,background=false}){
 const dialog=useRef(null)
 if(!asset&&!['OpenAI','Pexels'].includes(resource?.provider))return null
 const url=safeLink(resource?.photoUrl)
 return <div className={background?'cs-background-credit':'cs-thumbnail-credit'}>
  <button type="button" className="cs-credit-toggle" aria-label={background?'背景图片信息':'图片信息'} title="图片信息" onClick={()=>dialog.current?.showModal()}>ⓘ</button>
  <dialog ref={dialog} className="cs-image-credit-dialog" aria-label="图片信息">
   <strong>{resource?.provider==='OpenAI'?'AI 生成插画':asset?'来源图片':'摄影素材'}</strong>
   {resource?.provider==='OpenAI'?<p>OpenAI · {resource.model||'GPT Image'}</p>:asset?<p>来自当前工具返回的图片资源。</p>:<p>Photo by {url?<a href={url} target="_blank" rel="noreferrer">{resource.photographer||'photographer'}</a>:resource.photographer} · <a href="https://www.pexels.com" target="_blank" rel="noreferrer">Pexels</a></p>}
   <button type="button" onClick={()=>dialog.current?.close()}>关闭来源</button>
  </dialog>
 </div>
}
