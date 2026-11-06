// Read-only geometry evidence, shared by the opaque Web frame and local QA.
// This detects collapsed visual surfaces, not whether a drawing is meaningful.
export function auditVisuals(root){
 const win=root.ownerDocument.defaultView,surfaces=[]
 for(const el of root.querySelectorAll('svg,canvas')){
  if(el.parentElement?.closest('svg,defs,symbol,clipPath,mask'))continue
  let hidden=false
  for(let p=el;p;p=p.parentElement){
   const s=win.getComputedStyle(p)
   if(p.hidden||p.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0){hidden=true;break}
   if(p.matches('details:not([open])')&&!p.querySelector(':scope > summary')?.contains(el)){hidden=true;break}
   if(p===root)break
  }
  if(hidden)continue
  const rect=el.getBoundingClientRect(),style=win.getComputedStyle(el),kind=el.localName
  const vb=kind==='svg'?el.viewBox?.baseVal:null
  const intrinsicWidth=vb?.width||Number(el.getAttribute('width'))||0,intrinsicHeight=vb?.height||Number(el.getAttribute('height'))||0
  // Small icons and sprite definitions aren't the main drawing. A collapsed
  // chart still declares a large viewBox, canvas bitmap, or one large dimension.
  const icon=(rect.width>0&&rect.height>0&&rect.width<=48&&rect.height<=48)||(el.closest('button,a,[role=button]')&&rect.width<=48&&rect.height<=48)
  const primary=!icon&&((Math.max(rect.width,rect.height)>=64)||(intrinsicWidth>=64&&intrinsicHeight>=48)||(kind==='canvas'&&el.width>=64&&el.height>=48))
  if(!primary)continue
  const collapsed=rect.width<2||rect.height<2
  surfaces.push({kind,element:el.id||el.getAttribute('aria-label')||kind,width:Math.round(rect.width*10)/10,height:Math.round(rect.height*10)/10,visible:!collapsed&&Number(style.opacity)!==0,collapsed})
 }
 return {surfaces,visible:surfaces.filter(s=>s.visible).length,issues:surfaces.filter(s=>s.collapsed).map(s=>({code:'visual-zero-size',...s,message:`${s.element} 主视觉尺寸 ${s.width}×${s.height}px；检查父容器的确定高度与 flex 空间，不能删除图形来通过验证。`}))}
}
