// Shared by both opaque iframe renderers; no access to the parent's DOM.
export const CONTENT_HEIGHT_CSS=`html[data-content-height=true]:not([data-fit-graphic]):not([data-host-graphic=true]),html[data-content-height=true]:not([data-fit-graphic]):not([data-host-graphic=true]) body,html[data-content-height=true]:not([data-fit-graphic]):not([data-host-graphic=true]) #root{height:auto!important;min-height:0!important}html[data-content-height=true] #root{display:flow-root}`

export function installContentHeight(surface,post){
 let enabled=false,timer,last=0,width=0,adjustments=0
 const measure=()=>{
  timer=null
  const html=document.documentElement
  if(!enabled||html.hasAttribute('data-fit-graphic')||html.dataset.hostGraphic==='true')return
  const rect=surface.getBoundingClientRect(),nextWidth=Math.round(rect.width)
  if(nextWidth<=0)return
  if(width!==nextWidth){width=nextWidth;adjustments=0;last=0}
  // Root has intrinsic height in full mode. Do not use document.scrollHeight:
  // it has the iframe viewport as a floor and prevents shrinking after collapse.
  const height=Math.ceil(Math.max(rect.height,surface.scrollHeight)+Math.max(0,rect.top))
  if(!Number.isFinite(height)||height<=0||height>100000||Math.abs(height-last)<=1)return
  // A generated vh-based loop must not grow the host indefinitely. Real content
  // changes and width changes reopen measurement; viewport-only churn does not.
  if(++adjustments>6)return
  last=height;post({type:'content-height',height})
 }
 const schedule=(reset=false)=>{if(reset)adjustments=0;if(!timer)timer=setTimeout(measure,80)}
 new ResizeObserver(()=>schedule()).observe(surface)
 new MutationObserver(()=>schedule(true)).observe(surface,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','open','src']})
 surface.addEventListener('load',()=>schedule(true),true)
 addEventListener('resize',()=>schedule())
 document.fonts?.ready.then(()=>schedule(true))
 return value=>{
  if(enabled!==!!value){enabled=!!value;last=0;adjustments=0}
  document.documentElement.dataset.contentHeight=String(enabled)
  if(enabled)schedule()
 }
}
