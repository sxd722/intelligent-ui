import {PageDots,usePageSwipe} from './PageDots.jsx'
import {usePageTransition} from './page-transition.jsx'
import {CardPile} from './CardPile.jsx'
import React,{useState,useRef,useEffect,useLayoutEffect} from 'react'
import {CardRenderer} from './Renderer.jsx'
import {toolTransport} from './tool-session.mjs'
import {useCardSize} from '../CardSize.jsx'
import {Thinking} from '../Thinking.jsx'
import {generationSettings} from '../../shared/cardspec/generation-settings.mjs'
import {deckItemState} from './deck-status.mjs'
export function CardDeck({deck,spec,resources,streaming,transport=toolTransport,storageNamespace='cardspec',...props}){
 const root=useRef(null)
 const key=storageNamespace+':pages:deck:'+spec?.cardId,size=useCardSize(),requests=useRef(new Map())
 const [saved]=useState(()=>{try{return JSON.parse(sessionStorage.getItem(key))||{}}catch{return {}}})
 const [index,setIndex]=useState(saved.index||0),[overrides,setOverrides]=useState(saved.overrides||{}),[notice,setNotice]=useState('')
 const items=(deck?.length?deck:[{id:spec?.cardId,spec,resources,status:streaming?'generating':'ready'}]).map(item=>({...item,...overrides[item.id]})),current=Math.min(index,items.length-1)
 const transition=usePageTransition(root,current)
 const save=(nextIndex,nextOverrides)=>{try{sessionStorage.setItem(key,JSON.stringify({index:nextIndex,overrides:nextOverrides}))}catch{setNotice('存储空间不足，刷新后可能无法恢复卡组位置')}}
 const move=n=>transition(n,()=>{const next=Math.max(0,Math.min(items.length-1,n));for(const c of requests.current.values())c.abort();requests.current.clear();setIndex(next);save(next,overrides)})
 useEffect(()=>()=>{for(const c of requests.current.values())c.abort()},[])
 async function retry(item){
  if(requests.current.has(item.id))return
  const c=new AbortController();requests.current.set(item.id,c);setOverrides(o=>({...o,[item.id]:{...o[item.id],status:'generating',error:''}}))
  try{
   const result=await transport({tool:'glm.generate',input:{prompt:item.goal||item.title},target:'page',cause:'user',requestId:crypto.randomUUID(),pageId:item.id,sessionId:spec.cardId,view:{...generationSettings(spec.context),renderMode:spec.context?.renderMode,goal:spec.context?.userGoal,cardSize:size,generationMode:'direct'}},c.signal)
   if(c.signal.aborted)return
   if(result.kind!=='page'||!result.spec)throw Error('生成结果不是完整卡片')
   setOverrides(o=>{const next={...o,[item.id]:{...result,status:'ready'}};save(current,next);return next})
  }catch(e){setOverrides(o=>({...o,[item.id]:{status:'error',error:c.signal.aborted?'已中断，可重试':e.message}}))}
  finally{requests.current.delete(item.id)}
 }

 const swipe=usePageSwipe(items.length,current,move,root)
 const item=items[current],{ready,busy,incomplete}=deckItemState(item,{streaming,retrying:requests.current.has(item.id)})
 const navigation=<PageDots count={items.length} index={current} onChange={move} label="切换相关卡片" className="cs-deck-nav"/>
 return <div className="cs-deck" {...swipe}><div className="cs-page-viewport"><div ref={root}>

  {item.spec?<><CardRenderer key={item.id} {...props} hostNotice={notice} deckNavigation={items.length>1?{count:items.length,index:current,move,cards:items.map(c=>({id:c.id,title:c.title}))}:null} transport={transport} spec={item.spec} resources={item.resources} persistenceKey={storageNamespace+':pages:'+item.spec.cardId} streaming={!ready} toolsReady={ready&&props.toolsReady!==false}/>{!ready&&<div role={incomplete?'alert':'status'} className="cs-deck-draft"><span>{incomplete?(item.error||'此卡未完成，保留最后调试稿；其他卡片仍可使用。'):'调试预览 · 验证完成后启用工具'}</span>{incomplete&&<button onClick={()=>retry(item)}>重试此卡</button>}</div>}</>:incomplete?<CardPile cards={items} index={current}><section role="alert" className="cs-deck-empty" data-card-size={size}><p>{item.error||'此卡尚未完成，已有卡片仍可使用。'}</p><button onClick={()=>retry(item)}>重试此卡</button>{notice&&<small role="status">{notice}</small>}</section></CardPile>:<CardPile cards={items} index={current}><section className="cs-deck-empty" data-card-size={size}><Thinking/><p>{item.title||'正在生成卡片'}</p>{notice&&<small role="status">{notice}</small>}</section></CardPile>}
 </div></div>{!item.spec&&navigation}</div>
}
