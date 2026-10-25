// Positions refer to the original document (UTF-16 offsets, one-based lines).
// Keep excerpts small even when the model puts an entire program on one line.
export function diagnosticContext(source, diagnostic) {
 const text=String(source),d={...diagnostic}
 let at=Number.isInteger(d.offset)?d.offset:null
 if(at===null&&Number.isInteger(d.line)&&d.line>0){
  const lines=text.split('\n');if(d.line<=lines.length)at=lines.slice(0,d.line-1).reduce((n,l)=>n+l.length+1,0)+Math.max(0,(d.column||1)-1)
 }
 if(at===null)return d
 at=Math.max(0,Math.min(text.length,at))
 const line=text.slice(0,at).split('\n').length,column=at-(at?text.lastIndexOf('\n',at-1):-1)
 const start=Math.max(0,at-180),end=Math.min(text.length,at+300)
 return {...d,offset:at,line,column,context:{startOffset:start,endOffset:end,startLine:text.slice(0,start).split('\n').length,caretOffset:at-start,text:text.slice(start,end)}}
}
export const contextualDiagnostics=(source,diagnostics)=>diagnostics.map(d=>diagnosticContext(source,d))
