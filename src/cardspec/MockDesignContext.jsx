import React from 'react'
export const MockDesignContext=React.createContext(null)
export function MockCrop({design,rect,label}){
 if(!rect||!/^\/api\/media\/[a-f0-9]{64}\.jpg$/.test(design?.url||''))return null
 return <svg role="img" aria-label={label} viewBox={`${rect.x*10} ${rect.y*10} ${rect.width*10} ${rect.height*10}`} preserveAspectRatio="xMidYMid slice" style={{width:'100%',height:'100%',position:'absolute',inset:0,background:'transparent'}}><image href={design.url} width="1000" height="1000"/></svg>
}
