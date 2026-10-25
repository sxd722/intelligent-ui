import React,{useMemo,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from './Renderer.jsx'
import {CardSizeControl} from '../CardSize.jsx'
import {MotionControl} from '../MotionControl.jsx'
import {TEMPLATE_FIXTURES} from '../../shared/cardspec/template-fixtures.mjs'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {getDesign} from '../../shared/cardspec/designs.mjs'
import {LAYOUT_TEMPLATES} from '../../shared/cardspec/layout-templates.mjs'
import '../styles/tokens.css'
import '../styles/themes.css'
import './template-gallery.css'
const demos=[['pearl','templatePearl'],['atlas','templateAtlas'],['rebel','templatePersona'],['default','templateDefault'],['parchment','templateParchment'],['business','templateBusiness'],['academy','templateAcademy']]
function Gallery(){
 const [width,setWidth]=useState(432),[unified,setUnified]=useState(false)
 const [preset,setPreset]=useState(()=>{const id=new URLSearchParams(location.search).get('preset');return Object.hasOwn(LAYOUT_TEMPLATES,id)?id:'all'})
 const cards=useMemo(()=>demos.map(([design,fixture])=>({design,fixture,spec:compileCard(TEMPLATE_FIXTURES[unified?'templatePearl':fixture],{final:true}).spec})),[unified])
 return <main className="ct-gallery"><header><small>CARDSPEC / HOST COMPOSITIONS</small><h1>六种设计语言，一套交互引擎。</h1><p>模型提供内容与交互。宿主提供构图、比例、材质和动效。</p><nav><CardSizeControl/><MotionControl/><label>卡片宽度 <select value={width} onChange={e=>setWidth(Number(e.target.value))}>{[320,360,432].map(w=><option key={w}>{w}</option>)}</select></label><label><input type="checkbox" checked={unified} onChange={e=>setUnified(e.target.checked)}/> 用同一内容对照风格</label></nav></header>
 <nav aria-label="设计 preset" className="ct-preset-nav">{[['all','全部模板'],...Object.entries(LAYOUT_TEMPLATES).map(([id,t])=>[id,t.label])].map(([id,label])=><button key={id} aria-pressed={preset===id} onClick={()=>{setPreset(id);const url=new URL(location.href);if(id==='all')url.searchParams.delete('preset');else url.searchParams.set('preset',id);history.replaceState(null,'',url)}}>{label}</button>)}</nav>
 <div className="ct-gallery-grid" style={{'--gallery-width':width+'px'}}>{cards.filter(c=>preset==='all'||c.design===preset).map(({design,fixture,spec})=><article key={design}><div className="ct-gallery-label"><strong>{LAYOUT_TEMPLATES[design].label}</strong><code>design="{design}"</code></div><CardRenderer key={`${design}-${unified}`} spec={{...spec,design,cardId:`gallery-${design}-${unified}`}} toolsReady={true} persistenceKey={`cardspec:template-gallery:${design}:${unified}`}/><p>{getDesign(design).description}</p><a href={`/cardspec-lab.html?fixture=${unified?'templatePearl':fixture}&design=${design}`}>查看 DSL 与调试 ↗</a></article>)}</div>
 <footer>确定性示例，无真实工具调用。旧 design 与 DIL 保留。<a href="/pearl-review.html">新版 Pearl 整卡样板与旧版对照 ↗</a><a href="/">返回自由生成</a>{import.meta.env.VITE_CLOUD_DEMO_TOOLS!=='1'&&<a href="/design-template-review/">尺寸截图与验证记录</a>}</footer></main>
}
createRoot(document.getElementById('root')).render(<Gallery/>)
