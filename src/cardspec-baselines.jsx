import React,{useMemo,useState,useCallback} from 'react'
import {createRoot} from 'react-dom/client'
import BASELINE_CARDS from '../shared/cardspec/baselines/generated.json'
import {fixtureTransport} from '../shared/cardspec/baselines/fixtures.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {CardRenderer} from './cardspec/Renderer.jsx'
import {toolTransport} from './cardspec/tool-session.mjs'
import {CardSizeControl} from './CardSize.jsx'
import './styles/tokens.css'
import './styles/themes.css'
import './cardspec-baselines.css'
const params=new URLSearchParams(location.search)
const DEMO_ONLY=import.meta.env.VITE_BASELINE_DEMO_ONLY==='1'
const DEMO_SCOPES={
 sentiment:'新闻、评论和态度标签均为预设样本；用于体验统计、时间线与原文联动，不代表真实舆情。',
 family:'地点为虚构示意，地图不提供导航。选择地点后按固定规则安排两天，不调用 AI 或查询营业信息。',
 movies:'影片标题、评分与资料为演示数据；不查询热映、片源或票价。官方购票链接仅用于跳转。',
 transformer:'真实执行固定教学矩阵的注意力、FFN 与残差计算；可调整输入和神经元，不使用真实大模型权重。',
 trains:'车次和余票为模拟数据；可固定去返程、设置起售提醒。倒计时基于你填入的时间，不代表官方开票时间。'
}
const feedbackKey=id=>'native-baseline-feedback:'+id+':'+BASELINE_CARDS.find(c=>c.id===id)?.sha256
function App(){
 const [id,setId]=useState(BASELINE_CARDS.some(c=>c.id===params.get('case'))?params.get('case'):'sentiment'),[mode,setMode]=useState(!DEMO_ONLY&&params.get('mode')==='live'?'live':'fixture'),[width,setWidth]=useState(360),[revision,setRevision]=useState(0),[trace,setTrace]=useState([]),[note,setNote]=useState(()=>localStorage.getItem(feedbackKey(params.get('case')||'sentiment'))||'')
 const card=BASELINE_CARDS.find(x=>x.id===id)||BASELINE_CARDS[0]
 const compiled=useMemo(()=>compileCard(card.source,{final:true,context:{localDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),timeZone:'Asia/Shanghai'}}),[card])
 const record=useCallback(event=>setTrace(prev=>[...prev.slice(-199),{at:new Date().toISOString(),...event}]),[])
 const transport=useCallback(async(payload,signal,progress)=>{
  record({type:'tool-start',case:id,mode,tool:payload.tool,input:payload.input,requestId:payload.requestId});
  try{
   if(DEMO_ONLY&&(payload.target&&payload.target!=='binding'||payload.tool==='glm.generate'&&!payload.input?.context?.rows))throw new Error('公开演示不连接模型或工具；请使用卡内预设交互。');
   const result=await (DEMO_ONLY||mode==='fixture'?fixtureTransport:toolTransport)(payload,signal,progress);
   // Fictional source records must not imply a correspondence to real movie/video URLs.
   if(DEMO_ONLY&&Array.isArray(result.value?.items))result.value.items=result.value.items.map(({url,...row})=>row);
   record({type:'tool-result',tool:payload.tool,requestId:payload.requestId,result});return result;
  }
  catch(e){record({type:'tool-error',tool:payload.tool,requestId:payload.requestId,error:e.message});throw e;}
 },[id,mode,record]);
 const download=(content,name,type='application/json')=>{const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function change(id){setId(id);const url=new URL(location.href);url.searchParams.set('case',id);history.replaceState(null,'',url);setNote(localStorage.getItem(feedbackKey(id))||'');}
 const key=`native-baseline-v1:${id}:${mode}`;
 return <main className={'native-reference'+(DEMO_ONLY?' demo-only':'')}><header><small>HANDCRAFTED / NATIVE CARDSPEC / 01</small><h1>同一件事，换一种表达。</h1><p>五个可独立加载的 DSL。原生组件 + 隔离 JS，业务逻辑不藏在此页面中。</p>{DEMO_ONLY&&<p className="reference-demo-badge">可互动演示 · 不连接 OpenCLI / GLM · 反馈仅保存于此浏览器</p>}</header>
 <nav className="reference-cases">{BASELINE_CARDS.map(c=><button key={c.id} aria-pressed={id===c.id} onClick={()=>change(c.id)}>{c.title}</button>)}</nav>
 <div className="reference-controls">{!DEMO_ONLY&&<label>数据模式 <select aria-label="数据模式" value={mode} onChange={e=>setMode(e.target.value)}><option value="fixture">测试数据（可重复）</option><option value="live">真实 OpenCLI / GLM</option></select></label>}<label>宽度 <select aria-label="宽度" value={width} onChange={e=>setWidth(Number(e.target.value))}>{[320,360,432].map(v=><option key={v}>{v}</option>)}</select></label><CardSizeControl/></div>
 <p className="reference-notice" role="note">{DEMO_ONLY?DEMO_SCOPES[id]:mode==='fixture'?'当前是明确标记的测试数据，未执行外部工具。':'真实模式：点击卡内按钮才取数，失败不会替换成测试数据。涉及 GLM 的分析/规划使用现有网关。'}</p>
 <div className="reference-columns"><section>
 <div style={{width,maxWidth:'100%',margin:'auto'}} data-testid="card-container" onClick={e=>{const b=e.target.closest('button');if(b)record({type:'interaction',case:id,label:b.textContent.slice(0,100)});}}>
 {compiled.complete?<CardRenderer key={key+revision} spec={compiled.spec} resources={{}} streaming={false} toolsReady transport={transport} persistenceKey={key}/>:<pre role="alert">{JSON.stringify(compiled.diagnostics,null,2)}</pre>}
 </div><div className="reference-actions"><button onClick={()=>{sessionStorage.removeItem(key);setRevision(v=>v+1);record({type:'reset',case:id});}}>重置此卡</button>{!DEMO_ONLY&&<a href={`/h5-baseline/index.html?case=${id}${mode==='fixture'?'&fixtures=1':''}`} target="_blank" rel="noreferrer">H5 原基线 ↗</a>}</div>
 </section><aside><h2>可审查的实现</h2><p>状态、校验与计算在 DSL 中。刷新恢复当前选择；运行中的请求不自动重放。</p><button onClick={()=>download(card.source,id+'.cardspec','text/plain')}>下载完整 DSL</button><details><summary>查看 CardSpec 原文 · {card.source.length.toLocaleString()} 字符</summary><pre>{card.source}</pre></details><details><summary>编译诊断</summary><pre data-testid="diagnostics">{JSON.stringify(compiled.diagnostics,null,2)}</pre></details>
 <h2>功能与差异反馈</h2><small>产物 {card.sha256.slice(0,12)} · 未经人工审核，不进入训练集</small><textarea aria-label="本例反馈" value={note} onChange={e=>{setNote(e.target.value);localStorage.setItem(feedbackKey(id),e.target.value);}} placeholder="功能是否等价？哪些操作或信息仍然缺失？"/>
 <button onClick={()=>download(JSON.stringify({version:1,case:id,artifactHash:card.sha256,track:'native-handcrafted',reviewStatus:'unreviewed',trainingEligible:false,mode,note,source:card.source,trace},null,2),id+'-review-trace.json')}>导出反馈与 trace</button><details><summary>本次 trace · {trace.length} 事件</summary><pre>{JSON.stringify(trace,null,2)}</pre></details>
 {DEMO_ONLY?<p className="reference-notice">这些案例由人工编写，用于展示当前渲染器能力，不代表模型的自动生成成功率。搜索、分析与行程生成按钮只运行预设演示；下载的 DSL 保留可供本地宿主连接的工具声明。</p>:<a href="/cardspec-baselines/report.html">功能验收与 DSL 缺陷报告 ↗</a>}
 </aside></div></main>;
}
createRoot(document.getElementById('root')).render(<App/>)
