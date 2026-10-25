import React,{useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from '../cardspec/Renderer.jsx'
import {CardSizeOverride} from '../CardSize.jsx'
import {ToolSettings} from '../cardspec/ToolCard.jsx'
import '../styles/tokens.css'
import '../styles/themes.css'
import '../styles/app.css'
import './reference.css'
function sandbox(source,id){
 source=source.replace(/http:\/\/(?:127\.0\.0\.1|localhost):8787(?=\/api\/media\/)/g,location.origin)
 const csp=`default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: ${location.origin}/api/media/; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'`
 const monitor=`<script>addEventListener('error',e=>parent.postMessage({reference:${JSON.stringify(id)},error:e.message},'*'));addEventListener('unhandledrejection',e=>parent.postMessage({reference:${JSON.stringify(id)},error:String(e.reason)},'*'))</script>`
 return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1">${monitor}</head><body>`+source+'</body></html>'
}
function App(){const [data,setData]=useState(null),[id,setId]=useState(new URLSearchParams(location.search).get('case')||'01-counter'),[width,setWidth]=useState(432),[run,setRun]=useState(0),[errors,setErrors]=useState([])
 useEffect(()=>{fetch(new URLSearchParams(location.search).get('variant')==='compact'?'/cardspec-compact/data.json':'/html-reference/data.json').then(r=>r.json()).then(setData)},[run])
 useEffect(()=>{setErrors([]);const receive=e=>{if(e.source===document.querySelector('#html-frame')?.contentWindow&&e.data?.reference===id&&e.data.error)setErrors(old=>[...old,String(e.data.error).slice(0,500)])};addEventListener('message',receive);return()=>removeEventListener('message',receive)},[id,run])
 if(!data)return <main>正在读取实验结果…</main>
 const c=data.manifest.cases.find(c=>c.id===id),html=data.records.find(r=>r.id===id&&r.format==='html'),cs=data.records.find(r=>r.id===id&&r.format==='cardspec')
 return <main className="reference"><h1>自由 HTML / CardSpec{new URLSearchParams(location.search).get('variant')==='compact'?' · 精简版':' · 原版'}</h1><p><a href="?variant=compact">精简版对照</a> · <a href="?variant=baseline">原版对照</a></p><p>同题、同模型、独立新会话。HTML 在 sandbox 中运行；此页是对照实验，不更改生产协议。</p><div className="ref-controls"><label>测试场景 <select aria-label="测试场景" value={id} onChange={e=>setId(e.target.value)}>{data.manifest.cases.map(c=><option key={c.id} value={c.id}>{c.id} · {c.area}</option>)}</select></label><label>卡片宽度 <select aria-label="卡片宽度" value={width} onChange={e=>setWidth(+e.target.value)}>{[320,360,432].map(v=><option key={v}>{v}</option>)}</select></label><button onClick={()=>setRun(n=>n+1)}>重置本例 / 刷新结果</button></div><p>{c.prompt}</p><div className="ref-pair"><section><h2>自由 HTML <small>{html?`${(html.elapsed/1000).toFixed(1)}s · ${html.status}`:'待生成'}</small></h2>{html?.source&&<iframe id="html-frame" key={id+run} title="HTML reference" sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" style={{width,height:width}} srcDoc={sandbox(html.source,id)}/>}<div role="status" data-testid="html-errors">{errors.join('\n')}</div></section><section><h2>CardSpec <small>{cs?`${(cs.elapsed/1000).toFixed(1)}s · ${cs.status}`:'待生成'}</small></h2><div className="ref-cardspec" style={{width}}><CardSizeOverride.Provider value="square"><ToolSettings.Provider value={false}>{cs?.status==='succeeded'&&cs.spec?<CardRenderer key={id+run} spec={cs.spec} resources={cs.resources}/>:<p role="status">{cs?.error||'等待生成'}</p>}</ToolSettings.Provider></CardSizeOverride.Provider></div></section></div><details><summary>本例检查要求</summary><ul>{c.checks.map(t=><li key={t}>{t}</li>)}</ul></details></main>
}
createRoot(document.getElementById('root')).render(<App/> )
