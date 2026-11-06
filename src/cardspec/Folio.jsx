import React from 'react'
import {Icon} from '../dil/icons.jsx'
// Semantic shell only: all child actions/state remain owned by CardSpec.
export function DetailStage({p,attrs,children}){
 return <section {...attrs} className="cs-detail-stage" aria-label={p.title||'当前详情'} data-motion={p.motion||'fade'} data-motion-key={p.motionKey}>
  <div className="cs-detail-heading"><div>{p.eyebrow&&<small>{p.eyebrow}</small>}{p.title&&<h3>{p.title}</h3>}{p.description&&<p>{p.description}</p>}</div>
   {p.icon&&<div className="cs-detail-emblem" aria-hidden="true"><Icon name={p.icon}/></div>}
  </div>
  {children?.length>0&&<div className="cs-detail-content">{children}</div>}
 </section>
}
