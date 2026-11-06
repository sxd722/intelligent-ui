import React,{createContext,useContext} from 'react'
import {MockDesignContext,MockCrop} from './MockDesignContext.jsx'
import {BoardImage} from './BoardImage.jsx'
import './list-layout.css'
const Appearance=createContext('plain')
export function ListLayout({p,attrs,flow,children}){
 const columns=p.columns||1,style=p.presentation||'plain'
 return <Appearance.Provider value={style}><ul {...attrs} aria-label={p.label} className={`cs-stack cs-list${columns>1?' cs-list-columns':''}`} data-list-style={style} data-columns={columns} style={{...flow,'--list-columns':columns}}>{children}</ul></Appearance.Provider>
}
export function ListGroup({p,attrs,heading,children}){return <li {...attrs} className="cs-list-group"><header className="cs-list-group-heading">{heading||p.label}</header><ul className="cs-list-group-items">{children}</ul></li>}
export function ListItem({p,attrs,flow,identity,fire,children,streaming}){
 const appearance=useContext(Appearance),mock=useContext(MockDesignContext),rect=mock?.tiles?.[p.mockTile],enhanced=appearance!=='plain'
 const art=enhanced&&(rect||p.imageQuery)?<span className="cs-list-thumbnail" aria-hidden="true">{rect?<MockCrop design={mock} rect={rect}/>:!streaming&&<BoardImage query={p.imageQuery} title=""/>}</span>:null
 const content=<>{p.label&&<strong>{p.label}</strong>}{children}</>
 return <li {...attrs} className={`cs-stack cs-list-item${enhanced?' cs-list-item-designed':''}`} data-actionable={!!p.onPress} style={flow}>{p.onPress?<button type="button" data-cs-node={`${identity}/@press`} className="cs-button cs-pressable cs-stack" style={flow} aria-label={p.label} disabled={p.disabled} onClick={()=>fire('onPress')}>{art}{content}</button>:<>{art}{content}</>}</li>
}
