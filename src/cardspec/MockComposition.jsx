import {MockDesignContext} from './MockDesignContext.jsx'
import React from 'react'
import {useCardSize} from '../CardSize.jsx'
import './mock-composition.css'
export function MockComposition({design,header,body,footer,recipe}){
 const size=useCardSize(),[failed,setFailed]=React.useState(false),a=design.art
 const valid=/^\/api\/media\/[a-f0-9]{64}\.jpg$/.test(design.url||'')
 React.useEffect(()=>setFailed(false),[design.url])
 return <MockDesignContext.Provider value={design}><section className="cs-mock-composition" data-recipe={recipe} data-layout={design.layout} data-size={size} style={{'--mock-bg':design.background,'--mock-ink':design.ink,'--mock-accent':design.accent,'--mock-on-accent':design.onAccent||design.ink}}>
  <header className="cs-mock-head" data-image-status={valid&&!failed?'ready':'fallback'}>
   <div className="cs-mock-art" aria-hidden="true">{valid&&!failed&&<svg viewBox={`${a.x*10} ${a.y*10} ${a.width*10} ${a.height*10}`} preserveAspectRatio="xMidYMid slice"><image href={design.url} width="1000" height="1000" onError={()=>setFailed(true)}/></svg>}</div>
   <div className="cs-mock-head-shade" aria-hidden="true"/>
   <div className="cs-mock-heading">{recipe!=='folio'&&header}</div>
  </header>
  {recipe==='folio'&&<div className="cs-folio-banner">{header}</div>}
  <div className="cs-mock-body cs-composition-body" data-composition-single="true">{body}</div>
  {footer?.length>0&&<footer>{footer}</footer>}
 </section></MockDesignContext.Provider>
}
