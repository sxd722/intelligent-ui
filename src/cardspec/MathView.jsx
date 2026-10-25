import React, { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
export default function MathView({p}) {
  const result=useMemo(()=>{try{return {html:katex.renderToString(p.value,{displayMode:!!p.block,throwOnError:true,trust:false,maxExpand:100,maxSize:10,strict:'error',output:'htmlAndMathml'})}}catch(e){return {error:e.message}}},[p.value,p.block])
  return result.error?<span data-cs-error="" role="status">公式错误：{result.error}</span>:<span className="cs-math" data-block={p.block||undefined} dangerouslySetInnerHTML={{__html:result.html}}/>
}
