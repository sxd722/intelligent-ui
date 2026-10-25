// Read-only DOM evidence. Also embedded in the trusted sandbox renderer.
// No model code, network or state mutations; explicit scrolling stays observable.
export function auditLayout(root, {noScroll = false} = {}) {
  const win = root.ownerDocument.defaultView, bounds = root === root.ownerDocument.documentElement ? {left:0,top:0,right:win.innerWidth,bottom:win.innerHeight} : root.getBoundingClientRect()
  const describe = el => el.getAttribute('data-cs-node') || el.id || el.getAttribute('aria-label') || (el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : ''))
  const elements = [root,...root.querySelectorAll('*')], containers = [], controls = [], issues = []
  const closedDetailContent=el=>{for(let p=el;p&&p!==root.parentElement;p=p.parentElement)if(p.matches('details:not([open])')&&p!==el&&!p.querySelector(':scope > summary')?.contains(el))return true;return false}
  function requiredContentOutside(el,axis){
    const r=el.getBoundingClientRect(),out=b=>b.width>0&&b.height>0&&(axis==='y'?b.top<r.top-1||b.bottom>r.bottom+1:b.left<r.left-1||b.right>r.right+1)
    const walker=root.ownerDocument.createTreeWalker(el,4)
    while(walker.nextNode()){
      const n=walker.currentNode;if(!n.textContent.trim()||n.parentElement.closest('[aria-hidden="true"],script,style')||closedDetailContent(n.parentElement))continue
      if(win.getComputedStyle(n.parentElement).visibility==='hidden')continue
      const range=root.ownerDocument.createRange();range.selectNodeContents(n)
      if([...range.getClientRects()].some(out))return true
    }
    return [...el.querySelectorAll('iframe,img,canvas,input,button,select,textarea')].some(n=>!n.closest('[aria-hidden="true"]')&&!closedDetailContent(n)&&out(n.getBoundingClientRect()))
  }
  for (const el of elements) {
    if (!el.getClientRects().length || el.closest('[aria-hidden="true"]') || closedDetailContent(el) || el.namespaceURI?.includes('svg')) continue
    const s = win.getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') continue
    const declared = el.closest('[data-layout-scroll]')?.getAttribute('data-layout-scroll')
    const explicit = declared === 'allow' || !!el.closest('[data-overflow="scroll"],[data-overflow="paginate"],.cs-carousel-track,.cs-table-pan,.cs-mermaid-pan,.cs-diagram-pan')
    const forbidden = noScroll || declared === 'none'
    for (const [axis, client, demand, mode] of [['y',el.clientHeight,el.scrollHeight,s.overflowY],['x',el.clientWidth,el.scrollWidth,s.overflowX]]) {
      if (demand <= client+1 || s.display === 'inline' || ['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) continue
      if (el !== root && !['auto','scroll','hidden','clip'].includes(mode)) continue
      const decorativeOnly=['hidden','clip'].includes(mode)&&!requiredContentOutside(el,axis)
      const record = {element:describe(el),axis,available:client,demand,overflow:demand-client,mode,decorativeOnly,allowed:decorativeOnly||explicit&&!forbidden}
      containers.push(record)
      if (!record.allowed) issues.push({code:['hidden','clip'].includes(mode)?'clipped-content':'internal-overflow',...record})
    }
    if (!el.matches('button,input,select,textarea,a[href],summary,[role="slider"]')) continue
    const r = el.getBoundingClientRect();if (!r.width || !r.height) continue
    let left=Math.max(bounds.left,r.left),top=Math.max(bounds.top,r.top),right=Math.min(bounds.right,r.right),bottom=Math.min(bounds.bottom,r.bottom)
    for (let p=el.parentElement;p&&p!==root.parentElement;p=p.parentElement) {
      const ps=win.getComputedStyle(p),pr=p.getBoundingClientRect()
      if (/(auto|scroll|hidden|clip)/.test(ps.overflowX)) {left=Math.max(left,pr.left);right=Math.min(right,pr.right)}
      if (/(auto|scroll|hidden|clip)/.test(ps.overflowY)) {top=Math.max(top,pr.top);bottom=Math.min(bottom,pr.bottom)}
    }
    const visible=right-left>=r.width-1&&bottom-top>=r.height-1
    // Check several hit targets. Off-browser-viewport points are unknown, not failures.
    const points=[[.5,.5],[.2,.5],[.8,.5]].map(([x,y])=>[r.left+r.width*x,r.top+r.height*y]).filter(([x,y])=>x>=0&&y>=0&&x<win.innerWidth&&y<win.innerHeight)
    const occluded=visible&&points.length>0&&points.every(([x,y])=>{const hit=root.ownerDocument.elementFromPoint(x,y);return hit&&!el.contains(hit)})
    const c={element:describe(el),visible,occluded,width:Math.round(r.width),height:Math.round(r.height),hitTest:points.length?'checked':'outside-viewport'}
    controls.push(c)
    if (!visible && (!explicit || forbidden)) issues.push({code:'control-not-fully-visible',...c})
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
  return {containers,controls,issues,innerOverflow:Math.max(0,...containers.filter(c=>!c.decorativeOnly).map(c=>c.overflow)),pass:issues.length===0}
}
