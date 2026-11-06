// Read-only DOM evidence. Also embedded in the trusted sandbox renderer.
// No model code, network or state mutations; explicit scrolling stays observable.
export function auditLayout(root, {noScroll = false, allowCssScroll = false} = {}) {
  // A modal intentionally occludes the underlying card. Audit its active
  // interaction surface; audit the full card again after it closes.
  const modal=[...root.querySelectorAll('dialog[open],[role="dialog"][aria-modal="true"]')].filter(el=>el.getClientRects().length&&(el.matches(':modal')||el.getAttribute('aria-modal')==='true')).at(-1)
  if(modal)root=modal
  const win = root.ownerDocument.defaultView, bounds = root === root.ownerDocument.documentElement ? {left:0,top:0,right:win.innerWidth,bottom:win.innerHeight} : root.getBoundingClientRect()
  const describe = el => el.getAttribute('data-cs-node') || el.id || el.getAttribute('aria-label') || (el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : ''))
  const elements = [root,...root.querySelectorAll('*')], containers = [], controls = [], issues = []
  // A bounded, usable Web list/log may intentionally scroll. Root overflow and
  // tiny strips remain errors; CSS overflow:hidden is never a scroll exemption.
  const cssScrollable=el=>{
    if(!allowCssScroll||el===root||el===root.ownerDocument.body)return false
    const s=win.getComputedStyle(el),line=parseFloat(s.lineHeight)||parseFloat(s.fontSize)*1.2||16
    return el.clientHeight>=Math.max(44,line*2)&&el.clientWidth>=44&&((/^(auto|scroll)$/.test(s.overflowY)&&el.scrollHeight>el.clientHeight+1)||(/^(auto|scroll)$/.test(s.overflowX)&&el.scrollWidth>el.clientWidth+1))
  }
  const closedDetailContent=el=>{for(let p=el;p&&p!==root.parentElement;p=p.parentElement)if(p.matches('details:not([open])')&&p!==el&&!p.querySelector(':scope > summary')?.contains(el))return true;return false}
  // Accessible alternate text/MathML is intentionally clipped to a 1px box.
  // It is not a second visible formula. Never exempt hidden interactive controls.
  const hiddenCache=new WeakMap()
  const accessibleOnly=el=>{
    if(hiddenCache.has(el))return hiddenCache.get(el)
    const interactive='button,input,select,textarea,a[href],[role="button"],[role="slider"]'
    let hidden=false
    if(!el.matches(interactive)&&!el.querySelector(interactive))for(let p=el;p&&p!==root.parentElement;p=p.parentElement){
      const s=win.getComputedStyle(p)
      if(['absolute','fixed'].includes(s.position)&&p.clientWidth<=1&&p.clientHeight<=1&&['hidden','clip'].includes(s.overflow)&&((s.clip&&s.clip!=='auto')||(s.clipPath&&s.clipPath!=='none'))){hidden=true;break}
    }
    hiddenCache.set(el,hidden);return hidden
  }
  function requiredContentOutside(el,axis){
    const r=el.getBoundingClientRect(),out=b=>b.width>0&&b.height>0&&(axis==='y'?b.top<r.top-1||b.bottom>r.bottom+1:b.left<r.left-1||b.right>r.right+1)
    const walker=root.ownerDocument.createTreeWalker(el,4)
    while(walker.nextNode()){
      const n=walker.currentNode;if(!n.textContent.trim()||n.parentElement.closest('[aria-hidden="true"],script,style')||closedDetailContent(n.parentElement))continue
      if(win.getComputedStyle(n.parentElement).visibility==='hidden'||accessibleOnly(n.parentElement))continue
      const range=root.ownerDocument.createRange();range.selectNodeContents(n)
      if([...range.getClientRects()].some(out))return true
    }
    return [...el.querySelectorAll('iframe,img,canvas,input,button,select,textarea')].some(n=>!n.closest('[aria-hidden="true"]')&&!closedDetailContent(n)&&out(n.getBoundingClientRect()))
  }
  for (const el of elements) {
    if (!el.getClientRects().length || el.closest('[aria-hidden="true"]') || closedDetailContent(el) || accessibleOnly(el) || el.namespaceURI?.includes('svg')) continue
    const s = win.getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') continue
    const declared = el.closest('[data-layout-scroll]')?.getAttribute('data-layout-scroll')
    const explicit = declared === 'allow' || !!el.closest('[data-overflow="scroll"],[data-overflow="paginate"],.cs-carousel-track,.cs-table-pan,.cs-mermaid-pan,.cs-diagram-pan')
    const forbidden = noScroll || declared === 'none'
    for (const [axis, client, demand, mode] of [['y',el.clientHeight,el.scrollHeight,s.overflowY],['x',el.clientWidth,el.scrollWidth,s.overflowX]]) {
      if (demand <= client+1 || s.display === 'inline' || ['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) continue
      if (el !== root && !['auto','scroll','hidden','clip'].includes(mode)) continue
      const decorativeOnly=['hidden','clip'].includes(mode)&&!requiredContentOutside(el,axis)
      const contributors=[...el.querySelectorAll('[data-cs-node]')].map(n=>({element:describe(n),extent:axis==='y'?n.getBoundingClientRect().height:n.getBoundingClientRect().width})).filter(n=>n.extent>Math.max(50,client*.35)).sort((a,b)=>b.extent-a.extent).slice(0,8)
      const cssScroll=cssScrollable(el)&&/^(auto|scroll)$/.test(mode)
      const record = {element:describe(el),axis,available:client,demand,overflow:demand-client,mode,decorativeOnly,allowed:decorativeOnly||(explicit||cssScroll)&&!forbidden,scrollPolicy:cssScroll?'bounded-css':explicit?'declared':undefined,contributors}
      containers.push(record)
      if (!record.allowed) issues.push({code:['hidden','clip'].includes(mode)?'clipped-content':'internal-overflow',...record})
    }
    if (!el.matches('button,input,select,textarea,a[href],summary,[role="button"],[role="slider"]')) continue
    const r = el.getBoundingClientRect();if (!r.width || !r.height) continue
    let left=Math.max(bounds.left,r.left),top=Math.max(bounds.top,r.top),right=Math.min(bounds.right,r.right),bottom=Math.min(bounds.bottom,r.bottom),scrollReachable=false,hardClip=false,reachableBounds=r
    for (let p=el.parentElement;p&&p!==root.parentElement;p=p.parentElement) {
      const ps=win.getComputedStyle(p),pr=p.getBoundingClientRect()
      if(cssScrollable(p)){scrollReachable=true;reachableBounds=pr}
      if((/^(hidden|clip)$/.test(ps.overflowX)&&(reachableBounds.left<pr.left-1||reachableBounds.right>pr.right+1))||(/^(hidden|clip)$/.test(ps.overflowY)&&(reachableBounds.top<pr.top-1||reachableBounds.bottom>pr.bottom+1)))hardClip=true
      if (/(auto|scroll|hidden|clip)/.test(ps.overflowX)) {left=Math.max(left,pr.left);right=Math.min(right,pr.right)}
      if (/(auto|scroll|hidden|clip)/.test(ps.overflowY)) {top=Math.max(top,pr.top);bottom=Math.min(bottom,pr.bottom)}
    }
    const visible=right-left>=r.width-1&&bottom-top>=r.height-1
    // Check several hit targets. Off-browser-viewport points are unknown, not failures.
    const points=[[.5,.5],[.2,.5],[.8,.5]].map(([x,y])=>[r.left+r.width*x,r.top+r.height*y]).filter(([x,y])=>x>=0&&y>=0&&x<win.innerWidth&&y<win.innerHeight)
    const occluded=visible&&points.length>0&&points.every(([x,y])=>{const hit=root.ownerDocument.elementFromPoint(x,y);return hit&&!el.contains(hit)})
    const c={element:describe(el),visible,occluded,width:Math.round(r.width),height:Math.round(r.height),hitTest:points.length?'checked':'outside-viewport'}
    controls.push(c)
    if (!visible && (hardClip||!(explicit||scrollReachable)||forbidden)) issues.push({code:'control-not-fully-visible',...c})
    if (occluded) issues.push({code:'control-occluded',...c})
  }
  for (const el of root.querySelectorAll('[data-layout-audit]')) {
    try {
      const child=JSON.parse(el.dataset.layoutAudit), prefix=describe(el)+' / iframe / '
      for(const c of child.containers||[])containers.push({...c,element:prefix+c.element})
      for(const c of child.controls||[])controls.push({...c,element:prefix+c.element})
      for(const c of child.issues||[])issues.push({...c,element:prefix+c.element})
    } catch {} // Diagnostic data cannot break an otherwise usable card.
  }
  return {scope:modal?'modal':'card',containers,controls,issues,innerOverflow:Math.max(0,...containers.filter(c=>!c.decorativeOnly).map(c=>c.overflow)),pass:issues.length===0}
}
