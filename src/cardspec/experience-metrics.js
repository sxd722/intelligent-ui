// Bounded DOM observation only. Counts estimate text intersecting the card and
// its scroll clips; no truncation, model calls, raw text telemetry or DOM writes.
export function clippedBox(box,clip,{x=true,y=true}={}){
 const left=x?Math.max(box.left,clip.left):box.left,right=x?Math.min(box.right,clip.right):box.right
 const top=y?Math.max(box.top,clip.top):box.top,bottom=y?Math.min(box.bottom,clip.bottom):box.bottom
 return {left,right:Math.max(left,right),top,bottom:Math.max(top,bottom)}
}
export function measureVisualViewports(stage){
 const visuals=[]
 for(const element of [...stage.querySelectorAll('.cs-point-map-canvas,.cs-chart-pan,.cs-diagram-pan,.cs-heatmap-scroll,.cs-collection-items,.cs-experience-results,.cs-table-pan,.cs-carousel-track')].slice(0,24)){
  const rect=element.getBoundingClientRect();if(!rect.width||!rect.height)continue
  let box=rect,hidden=false
  for(let ancestor=element;ancestor;ancestor=ancestor.parentElement){
   const style=getComputedStyle(ancestor)
   if(style.visibility==='hidden'||style.display==='none'){hidden=true;break}
   box=clippedBox(box,ancestor.getBoundingClientRect(),{x:ancestor===stage||/auto|scroll|hidden|clip/.test(style.overflowX),y:ancestor===stage||/auto|scroll|hidden|clip/.test(style.overflowY)})
   if(ancestor===stage)break
  }
  if(hidden)continue
  const visibleWidth=Math.round(box.right-box.left),visibleHeight=Math.round(box.bottom-box.top)
  visuals.push({kind:element.classList[0],width:Math.round(rect.width),height:Math.round(rect.height),visibleWidth,visibleHeight,
   cramped:visibleWidth<Math.min(100,rect.width/2)||visibleHeight<Math.min(100,rect.height/2)})
 }
 return visuals
}
export function measureExperience(stage){
 const card=stage?.querySelector('.cs-card');if(!card)return null
 let rendered=0,visible=0,visited=0
 const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT)
 for(let node=walker.nextNode();node&&visited++<2500;node=walker.nextNode()){
  const text=node.textContent.trim(),element=node.parentElement
  if(!text||!element||element.closest('[aria-hidden="true"],dialog:not([open]),.cs-diagram-measure'))continue
  const range=document.createRange();range.selectNodeContents(node)
  const rects=[...range.getClientRects()].filter(r=>r.width&&r.height);if(!rects.length)continue
  rendered+=text.length
  let fraction=0
  for(const rect of rects){let left=rect.left,right=rect.right,top=rect.top,bottom=rect.bottom
   for(let ancestor=element;ancestor;ancestor=ancestor.parentElement){
    const style=getComputedStyle(ancestor),r=ancestor.getBoundingClientRect()
    if(style.visibility==='hidden'||style.display==='none'){right=left;break}
    if(ancestor===stage||/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right)}
    if(ancestor===stage||/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom)}
    if(ancestor===stage)break
   }
   fraction+=Math.max(0,right-left)*Math.max(0,bottom-top)/(rect.width*rect.height)
  }
  visible+=text.length*fraction/rects.length
 }
 const visualViewports=measureVisualViewports(stage)
 return {renderedTextCharacters:rendered,visibleTextCharacters:Math.round(visible),width:Math.round(stage.clientWidth),size:stage.dataset.cardSize,visualViewports,warnings:visualViewports.filter(v=>v.cramped).map(v=>({code:'visual_clipped',kind:v.kind,visibleHeight:v.visibleHeight,visibleWidth:v.visibleWidth})),approximate:true}
}
