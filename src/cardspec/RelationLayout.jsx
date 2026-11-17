import React from 'react'
import {relationPartRoles} from '../../shared/cardspec/content-skeleton.mjs'
import './relation-layout.css'

// Layout only: never copy, summarize, reorder or execute child contents.
// Keeping the original scoped React children preserves native actions/bindings.
export function RelationLayout({kind,children}){
 const parts=React.Children.toArray(children),roles=relationPartRoles(kind,parts.map(c=>c.props?.contentKind))
 return <div className="cs-relation" data-relation={kind}>{parts.map((child,i)=><div className="cs-relation-part" key={child.key??i} data-part={i} data-compare={roles[i].compare||undefined} data-step={roles[i].step||undefined} data-control={roles[i].control||undefined}>
  {roles[i].step&&<span className="cs-relation-step" aria-hidden="true">{roles[i].step}</span>}{child}
 </div>)}</div>
}
