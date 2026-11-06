import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {reuseCases} from '../shared/cardspec/reuse-cases.mjs'
import {CardRenderer} from './cardspec/Renderer.jsx'
import {CardSizeOverride} from './CardSize.jsx'
import {SameKind} from './SameKind.jsx'
import './styles/tokens.css'
import './styles/dil.css'
import './styles/themes.css'
function Review(){
 const [index,setIndex]=useState(0),[result,setResult]=useState(null),[width,setWidth]=useState(432)
 const c=reuseCases[index],context={expressionDialect:'js-v1',cardSize:'square',renderMode:'native'},compiled=compileCard(c.source,{final:true,context})
 return <main style={{padding:24,maxWidth:1000,margin:'auto',fontFamily:'system-ui'}}><h1>云端做同款 · 真正增量生成</h1><p>一次内容补丁；不重做规划，浏览器验证后才提交。工具场景使用云端标注的演示数据。</p><label>场景 <select value={index} onChange={e=>{setIndex(Number(e.target.value));setResult(null)}}>{reuseCases.map((c,i)=><option key={c.id} value={i}>{c.name}</option>)}</select></label> <label>宽度 <select value={width} onChange={e=>setWidth(Number(e.target.value))}><option>432</option><option>320</option></select></label><p>{c.prompt}</p><div style={{display:'flex',gap:20,flexWrap:'wrap'}}><section style={{width,maxWidth:'100%'}}><h2>原卡</h2><CardSizeOverride.Provider value="square"><CardRenderer key={c.id} spec={compiled.spec}/></CardSizeOverride.Provider><SameKind key={c.id} source={c.source} spec={compiled.spec} browserValidation onResult={r=>{setResult(r);if(location.hostname==='127.0.0.1')fetch('/qa/result/'+c.id,{method:'POST',body:JSON.stringify(r)})}}/></section>{result&&<section style={{width,maxWidth:'100%'}}><h2>新卡 · 验证通过</h2><CardSizeOverride.Provider value="square"><CardRenderer spec={result.spec}/></CardSizeOverride.Provider><p>1次模型调用 · {(result.elapsedMs/1000).toFixed(1)}秒服务端耗时</p><details><summary>浏览器验证记录</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(result.browserValidation,null,2)}</pre></details></section>}</div>{!compiled.complete&&<pre>{JSON.stringify(compiled.diagnostics)}</pre>}</main>
}
createRoot(document.getElementById('root')).render(<Review/> )
