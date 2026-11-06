import {PageDots,PageDotsOutlet,usePageSwipe} from './PageDots.jsx'
import {RenderOrigin} from './RenderOrigin.jsx'
import {usePageTransition} from './page-transition.jsx'
import {CardPile} from './CardPile.jsx'
import {cancelNavigation} from './host-motion.js'
import {followupEntries} from '../../shared/cardspec/followups.mjs'
import React,{createContext,useContext,useEffect,useLayoutEffect,useRef,useSyncExternalStore,useState,useCallback} from 'react'
import { createCardSession } from './tool-session.mjs'
import { useCardSize } from '../CardSize.jsx'
import {useSandboxMode} from '../SandboxMode.jsx'
import { Thinking } from '../Thinking.jsx'
import { ResultBrowser } from './ResultBrowser.jsx'
import {isPartialToolResult,TOOLS} from '../../shared/cardspec/tools.mjs'
import './tool-card.css'
export const ToolSettings=createContext(true)
export function captureView(root){
  if(!root)return {}
  const elements=[...root.querySelectorAll('.cs-card,.cs-experience-body,.cs-experience-tabs,.cs-experience-facets,.cs-host-controls,.cs-result-scroll,.cs-region-body,.cs-carousel-track,.cs-diagram-pan,.cs-chart-pan,.cs-table-pan,.cs-mermaid-pan,.cs-code-block,.tb-body,details')]
  const stage=root.querySelector('.cs-stage')
  return {width:stage?.clientWidth,height:stage?.clientHeight,elements:elements.map((el,i)=>({i,top:el.scrollTop,left:el.scrollLeft,...(el.tagName==='DETAILS'?{open:el.open}:{})}))}
}
function restoreView(root,view){
  const elements=[...root.querySelectorAll('.cs-card,.cs-experience-body,.cs-experience-tabs,.cs-experience-facets,.cs-host-controls,.cs-result-scroll,.cs-region-body,.cs-carousel-track,.cs-diagram-pan,.cs-chart-pan,.cs-table-pan,.cs-mermaid-pan,.cs-code-block,.tb-body,details')]
  for(const saved of view?.elements||[]){const el=elements[saved.i];if(el){if(saved.open!==undefined)el.open=saved.open;el.scrollTo({top:saved.top,left:saved.left,behavior:'instant'})}}
}
export function ToolCard({spec,resources,streaming,toolsReady=true,persistenceKey,transport,hostNavigation,hostNotice,deckNavigation,children,onDebugSession,debugAuthorizeWrite}){
  const slide=useRef(null),[dotsOutlet,setDotsOutlet]=useState(null)
  const cardSize=useCardSize(),sizeRef=useRef(cardSize)
  const renderMode=useSandboxMode(),modeRef=useRef(renderMode);modeRef.current=renderMode
  sizeRef.current=cardSize
  const enabled=useContext(ToolSettings),root=useRef(null),disposeTimer=useRef(null)
  const [confirmation,setConfirmation]=useState(null)
  const [adaptLayout,setAdaptLayout]=useState('list')
  const [session]=useState(()=>createCardSession(spec,{transport,getRenderMode:()=>modeRef.current,getCardSize:()=>sizeRef.current,storage:persistenceKey?window.sessionStorage:null,persistenceKey,authorizeWrite:async(payload,signal)=>{
    if(debugAuthorizeWrite)return debugAuthorizeWrite(payload,signal)
    const response=await fetch('/api/tools/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal})
    const preview=await response.json();if(!response.ok)throw new Error(preview.error||'无法准备操作')
    signal.throwIfAborted()
    return new Promise((resolve,reject)=>{
      const finish=accepted=>{signal.removeEventListener('abort',cancel);setConfirmation(null);accepted?resolve(preview.token):reject(new Error('已取消，尚未提交外部操作'))}
      const cancel=()=>finish(false);signal.addEventListener('abort',cancel,{once:true})
      setConfirmation({...preview,finish})
    })
  }}))
  useSyncExternalStore(session.subscribe,session.snapshot,session.snapshot)
  useEffect(()=>{onDebugSession?.(session)},[session,onDebugSession])
  const page=session.current()
  const [contentNavigation,setContentNavigation]=useState(null),pendingPage=useRef(null)
  const registerNavigation=useCallback(model=>{
    setContentNavigation(model?{...model,pageId:page.id}:null)
    if(model){page.viewState.contentPageCount=model.count;session.save()
      if(pendingPage.current?.id===page.id){const target=pendingPage.current.index;pendingPage.current=null;if(target!==model.index)model.move(Math.min(target,model.count-1))}}
  },[page.id,session])
  const transition=usePageTransition(slide,session.index,page.id)
  useLayoutEffect(()=>{session.updateRoot(spec,resources)},[spec,resources,session])
  useEffect(()=>{let intersecting=false
    const update=()=>session.setActivity({visible:intersecting&&!document.hidden,enabled,complete:!streaming&&toolsReady})
    const observer=new IntersectionObserver(entries=>{intersecting=entries[0]?.isIntersecting;update()})
    observer.observe(root.current);document.addEventListener('visibilitychange',update)
    const timer=setInterval(()=>{update();session.tick()},1000)
    update()
    return()=>{observer.disconnect();clearInterval(timer);document.removeEventListener('visibilitychange',update);session.setActivity({visible:false})}
  },[session,enabled,streaming,toolsReady])
  useEffect(()=>{clearTimeout(disposeTimer.current);return()=>{disposeTimer.current=setTimeout(()=>session.dispose(),0)}},[session])
  useLayoutEffect(()=>{
    let frame=requestAnimationFrame(()=>restoreView(root.current,page.viewState))
    return()=>cancelAnimationFrame(frame)
  },[page.id,session])
  useEffect(()=>{
    const save=()=>session.saveView(captureView(root.current)),el=root.current
    el.addEventListener('scroll',save,true);el.addEventListener('toggle',save,true);window.addEventListener('pagehide',save)
    return()=>{el.removeEventListener('scroll',save,true);el.removeEventListener('toggle',save,true);window.removeEventListener('pagehide',save)}
  },[session])
  const navigate=offset=>{session.saveView(captureView(root.current));transition(session.index+offset,to=>session.navigate(to-session.index))}

 const content=contentNavigation?.pageId===page.id?contentNavigation:null
 const screens=session.pages.flatMap((p,i)=>Array.from({length:cardSize==='full'?1:Math.max(1,p.id===page.id?content?.count||1:p.viewState.contentPageCount||1)},(_,part)=>({page:i,part})))
 const activeScreen=Math.max(0,screens.findIndex(s=>s.page===session.index&&s.part===(content?.index||0)))
 const moveScreen=i=>{const target=screens[i];if(!target)return;if(target.page===session.index){cancelNavigation(slide.current);content?.move(target.part)}else{pendingPage.current={id:session.pages[target.page].id,index:target.part};navigate(target.page-session.index)}}
 const deckOffset=deckNavigation?.index||0,totalScreens=screens.length+(deckNavigation?.count||1)-1
 const moveUnified=i=>{if(i<deckOffset)deckNavigation?.move(i);else if(i>=deckOffset+screens.length)deckNavigation?.move(i-screens.length+1);else moveScreen(i-deckOffset)}
 const swipe=usePageSwipe(totalScreens,deckOffset+activeScreen,moveUnified,slide)
 const pileCards=[...(deckNavigation?.cards||[]).slice(0,deckOffset),...session.pages.map(p=>({id:p.id})),...(deckNavigation?.cards||[]).slice(deckOffset+1)]
  const busyBindings=Object.entries(page.bindings).filter(([,b])=>b.status==='loading')
  const hasTools=Object.keys(page.spec.bindings||{}).length>0
  const overlay=<>    {confirmation&&<section className="cs-write-confirm" role="dialog" aria-modal="false" aria-label="确认外部操作">
      <strong>{confirmation.description}</strong><p>{confirmation.notice}</p>
      {confirmation.connection&&<small>连接：{confirmation.connection}</small>}
      <pre>{JSON.stringify(confirmation.input,null,2)}</pre>
      <button type="button" onClick={()=>confirmation.finish(false)}>暂不执行</button>
      <button type="button" onClick={()=>confirmation.finish(true)}>确认执行</button>
    </section>}
    {(session.busy||busyBindings.some(([id,b])=>b.target==='page'||b.target==='binding'&&page.spec.bindings[id]?.tool==='glm.generate'))&&<Thinking placement="card"/>}
</>
  const footer=<div className="cs-host-controls" aria-label="卡片操作">
    {session.busy&&!hasTools&&<div className="cs-host-progress" role="status"><span>正在生成内容</span><button onClick={()=>session.cancel()}>取消</button></div>}
    {hasTools&&<details className="cs-host-tools"><summary>数据与工具{busyBindings.length?" · 更新中":Object.values(page.bindings).some(b=>b.status==='error')?" · 需处理":""}</summary><div className="cs-tool-status" aria-live="polite">
      {Object.entries(page.bindings).filter(([,b])=>b.cache?.status==='hit'||b.cache?.status==='coalesced').map(([id,b])=><span key={'cache-'+id}>{id} · {b.cache.status==='hit'?'复用近期缓存':'合并相同查询'} · {new Date(b.cache.fetchedAt).toLocaleTimeString()}<button type="button" disabled={!enabled||session.busy||b.status==='loading'} onClick={()=>session.retry(id)}>刷新数据</button></span>)}
      {!enabled?<span>工具增强已关闭</span>:busyBindings.length||session.busy?<><span>{busyBindings.find(([,b])=>b.progress)?.[1].progress||(session.busy?'正在生成内容':'正在更新数据')}</span><button type="button" onClick={()=>session.cancel()}>取消</button></>:<span>{Object.values(page.bindings).some(b=>b.updatedAt)?'数据更新于 '+new Date(Math.max(...Object.values(page.bindings).map(b=>Date.parse(b.updatedAt)||0))).toLocaleTimeString():''}</span>}
      {Object.entries(page.bindings).filter(([,b])=>b.errorInfo&&b.status==='error').map(([id,b])=><details key={'error-'+id}><summary>{b.errorInfo.message} · {b.errorInfo.recovery==='edit_input'?'请修改查询':'自动刷新已暂缓'}</summary><small>{b.errorInfo.code}：{b.errorInfo.detail}</small></details>)}
      {Object.values(page.bindings).some(b=>b.status==='success'&&b.value?.items?.length>0)&&<label>内容重排 <select aria-label="内容重排方式" value={adaptLayout} onChange={e=>setAdaptLayout(e.target.value)}><option value="list">列表</option><option value="gallery">图库</option><option value="table">对照表</option><option value="editorial">分段阅读</option></select></label>}
      {Object.entries(page.bindings).filter(([id,b])=>page.spec.bindings[id]?.tool!=='glm.generate'&&b.updatedAt&&Array.isArray(b.value?.items)).map(([id,b])=><div key={'browse-'+id} className="cs-result-launch"><button type="button" onClick={()=>{session.saveView(captureView(root.current));session.openResults(id)}}>浏览结果 · {id}</button>{b.status==='success'&&b.value.items.length>0&&<button type="button" disabled={!enabled||session.busy} onClick={()=>{session.saveView(captureView(root.current));session.adaptResults(id,adaptLayout)}}>按实际结果调整</button>}</div>)}
      {Object.entries(page.bindings).filter(([,b])=>b.status==='error'&&['AUTH_REQUIRED','ACCESS_RESTRICTED'].includes(b.errorInfo?.code)).map(([id])=>{const url=TOOLS[page.spec.bindings[id]?.tool]?.loginUrl;return url?<a key={'login-'+id} href={url} target="_blank" rel="noreferrer">打开来源登录 / 验证</a>:null})}
      {Object.entries(page.bindings).filter(([,b])=>!b.blockedRetry&&(b.status==='error'||b.status==='cancelled')).map(([id,b])=><button type="button" key={id} disabled={!enabled} onClick={()=>session.retry(id)}>重试 {id}</button>)}
      {Object.entries(page.bindings).filter(([id,b])=>b.updatedAt&&isPartialToolResult(page.spec.bindings[id]?.tool,b.value)).map(([id,b])=><span key={'partial-'+id} role="note">{b.value.coverage?.complete?`${id}：展示 ${b.value.coverage.returned} / ${b.value.coverage.matched} 条匹配结果`:`${id}：仅获取部分结果，可调整工具支持的查询条件或查看来源；不能据此判断全部结果为空`}</span>)}
      {Object.entries(page.bindings).filter(([,b])=>b.blockedRetry).map(([id,b])=><span key={id}>{b.error}<button type="button" onClick={()=>session.acknowledgeWrite(id)}>已核对原站点，允许新操作</button></span>)}
    </div></details>}
    {page.spec.generationPlan?.followups?.length>0&&<div className="cs-row cs-followups" aria-label="后续探索">{followupEntries(page.spec.generationPlan).map(({label,prompt})=><button type="button" className="cs-button" key={prompt} title={prompt} disabled={!enabled||streaming||session.busy} onClick={()=>{session.saveView(captureView(root.current));session.followup(prompt)}}>{label}</button>)}</div>}
    {page.error&&<div className="cs-action-error" role="alert">{page.error}</div>}

    {session.notice&&<small role="status">{session.notice}</small>}

    {hostNotice&&<small role="status">{hostNotice}</small>}
  </div>
  return <div className="cs-tool-card" ref={root} {...swipe}>
    <CardPile cards={pileCards} index={deckOffset+session.index}><PageDotsOutlet.Provider value={{register:registerNavigation}}><div className="cs-page-viewport"><div ref={slide}>
    {page.resultView?<ResultBrowser page={page} session={session} footer={footer} overlay={overlay}/>:children({page,session,streaming:streaming&&session.index===0,footer,overlay})}
    </div></div></PageDotsOutlet.Provider></CardPile>
    <div className="cs-external-pages" ref={setDotsOutlet}/>
    <PageDots count={totalScreens} index={deckOffset+activeScreen} onChange={moveUnified} label="卡片页面" className="cs-history"/>
    {hostNavigation}
    <RenderOrigin root={root} pageId={page.id}/>
  </div>
}
