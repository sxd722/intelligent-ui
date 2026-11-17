import {contentColumns,valueFontSize,editorialSpans,isCompactDecision} from './content-fit.mjs'
import {localComposition} from './local-composition.mjs'

// DOM-only adaptation: no model call, child reordering, truncation or remount.
export function attachContentFit(stage){
 if(!stage)return ()=>{}
 const selector='.cs-grid,.cs-relation[data-relation="compare"],.cs-segmented-field[data-choice-variant="cards"] .cs-segmented'
 const ctx=document.createElement('canvas').getContext('2d')
 let frame=0,disposed=false
 const observed=new Map()
 let fitted=new WeakMap()
 const px=(s,k)=>parseFloat(s[k])||0
 const width=el=>{const s=getComputedStyle(el);return el.clientWidth-px(s,'paddingLeft')-px(s,'paddingRight')}
 const measure=(el,text,size)=>{const s=getComputedStyle(el);ctx.font=`${s.fontWeight} ${size}px ${s.fontFamily}`;return ctx.measureText(text).width+Math.max(0,text.length-1)*Math.max(0,px(s,'letterSpacing'))}
 function choiceMinimum(el){
  const parts=el.children.length?[...el.children]:[el]
  if((el.textContent||'').trim().length>60||parts.some(c=>(c.textContent||'').trim().length>28))return null
  const s=getComputedStyle(el)
  return Math.max(64,...parts.map(c=>measure(c,(c.textContent||'').trim(),px(getComputedStyle(c),'fontSize'))))+px(s,'paddingLeft')+px(s,'paddingRight')
 }
 function minimum(el){
  if(el.matches('button')){const min=choiceMinimum(el);if(min!==null)return min}
  if(el.matches('.cs-stat')){const v=el.querySelector('strong'),s=getComputedStyle(el);return Math.max(76,measure(v,v.textContent,14)+px(s,'paddingLeft')+px(s,'paddingRight')+8)}
  // A chart, map or computation stage needs a readable horizontal scale.
  if(el.querySelector('.cs-chart,.cs-series-chart,.cs-map-stage,.cs-diagram,canvas,svg[role="img"],iframe'))return 260
  const text=(el.innerText||'').trim(),blocks=[...el.querySelectorAll('.cs-text,.cs-caption,.cs-prose p,.cs-detail-stage p')]
  const longest=Math.max(0,...blocks.map(b=>(b.innerText||'').trim().length))
  if(longest>110||text.length>300)return 240
  if(longest>48||text.length>130)return 216
  if(el.querySelector('.cs-prose,button,input,select')&&text.length>35)return 164
  return 132
 }
 const set=(el,k,v)=>{if(el.style.getPropertyValue(k)!==v)el.style.setProperty(k,v)}
 function fit(){
  frame=0;if(disposed)return
  for(const el of stage.querySelectorAll('.cs-grid > button')){
   const compact=choiceMinimum(el)!==null
   if(el.dataset.compactChoice!==String(compact))el.dataset.compactChoice=String(compact)
  }
  // Region-local composition preserves source order, React keys and all scopes.
  for(const body of stage.querySelectorAll('.cs-region:not([data-overflow]) > .cs-region-body')){
   if(!observed.has(body)){observed.set(body,-1);resize.observe(body)}
   const kids=[...body.children].filter(c=>getComputedStyle(c).display!=='none')
   const unwrap=c=>c.matches('.cs-fragment')&&c.children.length===1?c.firstElementChild:c
   const items=kids.map(child=>{
    const c=unwrap(child)
    if(c.matches('.cs-sandbox[data-sandbox-graphic=true]'))return {kind:'graphic',minimum:Number(c.dataset.graphicMinimum)||260}
    if(c.matches('.cs-segmented-field,[data-cs-component=segmented]'))return {kind:'choices',count:c.querySelectorAll('button').length,minimum:140}
    if(c.matches('.cs-grid')&&c.children.length&&[...c.children].every(b=>b.matches('button[data-compact-choice=true]')))return {kind:'choices',count:c.children.length,minimum:180}
    if(c.matches('.cs-facts')||c.matches('.cs-row,.cs-grid')&&c.children.length&&[...c.children].every(s=>s.matches('.cs-stat')))return {kind:'facts',minimum:140}
    if(c.matches('.cs-row')&&c.children.length&&[...c.children].every(s=>s.matches('button'))&&c.textContent.length<40)return {kind:'controls',minimum:180}
    if(c.matches('.cs-stack')&&c.querySelector('.cs-title,strong')&&!c.querySelector('button,input,select,.cs-grid,iframe,.cs-region')&&c.textContent.length<240)return {kind:'detail',minimum:180}
    return {kind:'other'}
   })
   const plan=localComposition(items,width(body))
   if(plan){
    if(body.dataset.localComposition!==plan.kind)body.dataset.localComposition=plan.kind
    set(body,'--cs-local-columns',plan.columns)
    kids.forEach((c,i)=>{set(c,'--cs-local-column',plan.cells[i].column);set(c,'--cs-local-row',plan.cells[i].row)})
   }else if(body.dataset.localComposition)delete body.dataset.localComposition
   kids.forEach((c,i)=>{
    const node=unwrap(c)
    if(node.matches('.cs-sandbox')){
     if(plan?.graphic===i){const ratio=Number(node.dataset.graphicRatio)||1;set(node,'--cs-local-graphic-height',`${Math.max(144,Math.ceil(items[i].minimum/ratio))}px`)}
     else node.style.removeProperty('--cs-local-graphic-height')
    }
    const detail=items[i].kind==='detail'&&i>0&&items[i-1].kind==='choices'
    if(node.dataset.localDetail!==String(detail))node.dataset.localDetail=String(detail)
   })
  }
  for(const el of stage.querySelectorAll('.cs-magazine .cs-prose')){
   const compact=el.children.length<=2&&(el.textContent||'').trim().length<=180
   const value=String(compact);if(el.dataset.compactCopy!==value)el.dataset.compactCopy=value
  }
  // Fit outer editorial rows first, so nested grids measure their usable width.
  for(const el of stage.querySelectorAll('.cs-magazine > .cs-region-body,.cs-prose')){
   if(!observed.has(el)){observed.set(el,-1);resize.observe(el)}
   const w=width(el);if(w<1)continue
   const kids=[...el.children].filter(c=>getComputedStyle(c).display!=='none')
   const items=kids.map(child=>{
    const c=child.classList.contains('cs-fragment')?child.firstElementChild:child
    if(!c)return {minimum:w}
    if(c.matches('.cs-stat'))return {kind:'stat',minimum:minimum(c)}
    if(c.matches('.cs-prose,p')&&!c.querySelector('button,input,svg,canvas,iframe'))return {kind:'prose',minimum:240}
    if(c.matches('.cs-button'))return {kind:'action',minimum:Math.max(132,minimum(c))}
    return {minimum:w}
   })
   const spans=editorialSpans(w,items,px(getComputedStyle(el),'columnGap'))
   kids.forEach((child,i)=>{const value=String(spans[i]);if(child.dataset.editorialSpan!==value)child.dataset.editorialSpan=value})
  }
  const containers=[...stage.querySelectorAll(selector)]
  for(const [el]of observed)if(!el.isConnected){resize.unobserve(el);observed.delete(el)}
  for(const el of containers){
   if(!observed.has(el)){observed.set(el,-1);resize.observe(el)}
   const w=width(el);if(w<1)continue
   const kids=[...el.children].filter(c=>getComputedStyle(c).display!=='none'&&(!el.classList.contains('cs-segmented')||c.matches('button')))
   const requested=el.classList.contains('cs-segmented')?Math.min(3,kids.length):el.classList.contains('cs-relation')?2:el.dataset.gridColumns==='auto'?kids.length:Number(el.dataset.gridColumns)||2
   const s=getComputedStyle(el),gap=px(s,'columnGap'),columns=contentColumns(w,requested,kids.map(child=>{const span=Math.min(requested,Number(child.dataset.gridSpan)||1);return (minimum(child)-gap*(span-1))/span}),gap)
   if(el.dataset.adaptiveColumns!==String(columns))el.dataset.adaptiveColumns=String(columns)
   set(el,'--cs-fit-columns',String(columns))
   for(const child of kids)if(child.dataset.gridSpan)set(child,'grid-column',`span ${Math.min(columns,Number(child.dataset.gridSpan)||1)}`)
  }
  for(const el of stage.querySelectorAll('.cs-grid > .cs-stack,.cs-region-body > .cs-stack')){
   const kids=[...el.children].filter(c=>getComputedStyle(c).display!=='none')
   const parts=kids.map(c=>{
    let kind='other'
    if(c.matches('.cs-button'))kind='action'
    else if(c.matches('.cs-title,strong')||c.matches('.cs-text')&&c.children.length===1&&c.firstElementChild.matches('strong')&&c.textContent.trim()===c.firstElementChild.textContent.trim())kind='title'
    else if(c.matches('.cs-prose,.cs-text,.cs-caption')&&!c.querySelector('button,input,select,a,svg,canvas,iframe'))kind='copy'
    return {kind,length:(c.textContent||'').trim().length}
   })
   const layout=isCompactDecision(parts)?(width(el)>=300?'row':'stack'):''
   if(layout){if(el.dataset.decisionLayout!==layout)el.dataset.decisionLayout=layout}
   else if(el.hasAttribute('data-decision-layout'))el.removeAttribute('data-decision-layout')
  }
  for(const el of stage.querySelectorAll('.cs-stat')){
   if(!observed.has(el)){observed.set(el,-1);resize.observe(el)}
   const v=el.querySelector(':scope > strong'),w=width(el);if(!v||w<1)continue
   const signature=[Math.round(w*10),v.textContent,stage.dataset.design,stage.dataset.csDensity,stage.dataset.cardSize].join('|')
   if(fitted.get(v)===signature)continue
   fitted.set(v,signature)
   // Restore the theme size before measuring. Previous fitting must not become
   // the next baseline when the viewport grows or a selected value gets shorter.
   v.style.removeProperty('font-size')
   const base=px(getComputedStyle(v),'fontSize'),measured=measure(v,v.textContent,base)
   const size=valueFontSize(w,measured,base)
   v.style.setProperty('font-size',`${size}px`,'important')
   const fits=measure(v,v.textContent,size)<=w+1
   v.dataset.valueFit=fits?'line':'wrap'
  }
 }
 function schedule(){if(!frame&&!disposed)frame=requestAnimationFrame(fit)}
 const resize=new ResizeObserver(entries=>{let changed=false;for(const e of entries){const w=Math.round(e.contentRect.width*10);if(observed.get(e.target)!==w){observed.set(e.target,w);changed=true}}if(changed)schedule()})
 resize.observe(stage)
 const attributes=['class','hidden','open','data-design','data-cs-density','data-card-size','data-grid-columns','data-grid-span','data-sandbox-graphic','data-graphic-minimum']
 const mutations=new MutationObserver(schedule)
 mutations.observe(stage,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes})
 const fontsChanged=()=>{fitted=new WeakMap();schedule()}
 document.fonts?.addEventListener('loadingdone',fontsChanged)
 fit()
 return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutations.disconnect();document.fonts?.removeEventListener('loadingdone',fontsChanged)}
}
