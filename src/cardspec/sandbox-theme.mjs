// Trusted iframe adapter. Repair neutral surfaces, never recolor semantic marks.
export function installSandboxTheme(root) {
 const doc=root.ownerDocument, html=doc.documentElement
 let dark=false, scheduled=false
 const owned=new Map()
 const colors=new Map();let colorContext
 function rgb(value){
  const m=String(value).match(/^rgba?\(([^)]+)\)$/)
  if(m){const n=m[1].split(/[\s,/]+/).map(Number);return n.length>=3&&n.every(Number.isFinite)?n:null}
  if(colors.has(value))return colors.get(value)
  if(!CSS.supports('color',value))return null
  colorContext ||= doc.createElement('canvas').getContext('2d',{willReadFrequently:true})
  if(!colorContext)return null
  colorContext.clearRect(0,0,1,1);colorContext.fillStyle=value;colorContext.fillRect(0,0,1,1)
  const p=colorContext.getImageData(0,0,1,1).data,c=[p[0],p[1],p[2],p[3]/255]
  if(colors.size>512)colors.clear();colors.set(value,c);return c
 }
 function light(value){const c=rgb(value);return c&&Math.min(...c.slice(0,3))>180&&(c[3]??1)>.8}
 function neutralWhite(value){const c=rgb(value);return c&&Math.min(...c.slice(0,3))>225&&Math.max(...c.slice(0,3))-Math.min(...c.slice(0,3))<22&&(c[3]??1)>.9}
 function lightForeground(el){
  if(el.localName==='canvas')return light(getComputedStyle(el).color)
  let bright=false,other=false
  const walker=doc.createTreeWalker(el,NodeFilter.SHOW_TEXT)
  while(walker.nextNode()){
   const node=walker.currentNode;if(!node.textContent.trim())continue
   const parent=node.parentElement;if(!parent||!parent.getClientRects().length)continue
   let covered=false
   for(let p=parent;p&&p!==el;p=p.parentElement){const s=getComputedStyle(p),c=rgb(s.backgroundColor);if(s.backgroundImage!=='none'||c&&(c[3]??1)>.1){covered=true;break}}
   if(covered)continue
   const s=getComputedStyle(parent),color=parent.closest('svg')?s.fill:s.color
   if(light(color))bright=true;else other=true
  }
  return bright&&!other
 }
 function fix(el,property){
  if(el.style.getPropertyValue(property)==='var(--cs-graphic-surface)')return
  owned.set(el,{property,value:el.style.getPropertyValue(property),priority:el.style.getPropertyPriority(property)})
  el.style.setProperty(property,'var(--cs-graphic-surface)','important')
 }
 function audit(){
  scheduled=false
  for(const el of owned.keys())if(!el.isConnected)owned.delete(el)
  if(!dark)return
  for(const el of [doc.body,root,...root.querySelectorAll('div,section,main,article,svg,canvas')]){
   const s=getComputedStyle(el)
   // Preserve intentional white cards with dark text, photos, gradients and charts.
   if(s.backgroundImage==='none'&&neutralWhite(s.backgroundColor)&&lightForeground(el))fix(el,'background-color')
  }
  for(const svg of root.querySelectorAll('svg')){
   const box=svg.viewBox?.baseVal;if(!box?.width||!box.height)continue
   const text=[...svg.querySelectorAll('text')];if(!text.length||!text.every(t=>light(getComputedStyle(t).fill)))continue
   const rect=svg.querySelector(':scope > rect');if(!rect)continue
   let b;try{b=rect.getBBox()}catch{continue}const s=getComputedStyle(rect)
   if(b.x<=box.x&&b.y<=box.y&&b.width>=box.width*.98&&b.height>=box.height*.98&&neutralWhite(s.fill))fix(rect,'fill')
  }
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(audit)}}
 const observer=new MutationObserver(schedule)
 observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','fill','color']})
 return {apply(theme){
  const next=theme?.colorScheme==='dark'
  if(next!==dark){for(const [el,o]of owned){if(el.style.getPropertyValue(o.property)==='var(--cs-graphic-surface)'){if(o.value)el.style.setProperty(o.property,o.value,o.priority);else el.style.removeProperty(o.property)}}owned.clear()}
  dark=next;html.style.colorScheme=dark?'dark':'light';html.dataset.cardColorScheme=dark?'dark':'light'
  // Opaque stage pairing also protects transparent canvas buffers and native controls.
  html.style.backgroundColor='var(--cs-graphic-surface,var(--cs-base))'
  doc.body.style.color='var(--cs-ink)'
  schedule()
 },audit:schedule,close(){observer.disconnect()}}
}
