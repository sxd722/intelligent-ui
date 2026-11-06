import React from 'react'
import {CANVAS_METHODS,CANVAS_PROPERTIES,validateCanvasDrawing} from '../../shared/cardspec/canvas-contract.mjs'

export function Canvas({draw,width=320,height=180,children,...props}){
 const commands=[],stack=[],values={fillStyle:'#000',strokeStyle:'#000',lineWidth:1,globalAlpha:1,lineCap:'butt',lineJoin:'miter',font:'10px sans-serif',textAlign:'start',textBaseline:'alphabetic',lineDashOffset:0,shadowColor:'rgba(0,0,0,0)',shadowBlur:0,shadowOffsetX:0,shadowOffsetY:0}
 const add=c=>{if(commands.length>=1200)throw Error('Canvas drawing exceeds 1200 commands');commands.push(c)}
 const ctx={}
 for(const op of Object.keys(CANVAS_METHODS))ctx[op]=(...args)=>{
  if(op==='save')stack.push({...values})
  if(op==='restore'&&stack.length)Object.assign(values,stack.pop())
  add([op,...args])
 }
 for(const key of Object.keys(CANVAS_PROPERTIES))Object.defineProperty(ctx,key,{get:()=>values[key],set:value=>{values[key]=value;add(['set',key,value])}})
 if(typeof draw!=='function')throw Error('Canvas requires draw(ctx)')
 draw(Object.freeze(ctx))
 validateCanvasDrawing(commands,width,height)
 return <canvas {...props} width={width} height={height} drawing={commands}>{children}</canvas>
}
