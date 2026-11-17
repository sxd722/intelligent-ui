// DOM counterpart of sandboxGraphic. Only one standalone SVG/canvas qualifies.
export function standaloneGraphic(root){
 let el=root,wrappers=[]
 for(let depth=0;el&&depth<=9;depth++){
  const tag=el.tagName?.toLowerCase()
  if(tag==='svg'){
   const box=String(el.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number)
   if(box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0)return null
   if(el.querySelector('foreignObject,a'))return null
   // Keep SVG labels at least 10 CSS pixels; do not blindly shrink a labelled diagram.
   const fonts=[...el.querySelectorAll('text')].map(t=>parseFloat(getComputedStyle(t).fontSize)).filter(n=>n>0)
   return {kind:'svg',ratio:box[2]/box[3],minimum:Math.max(144,fonts.length?Math.ceil(box[2]*10/Math.min(...fonts)):144),wrappers}
  }
  if(tag==='canvas')return {kind:'canvas',ratio:el.width/el.height||1,minimum:220,wrappers}
  if(!['div','section','main','figure'].includes(tag)||[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||el.children.length!==1)return null
  wrappers.push(el);el=el.firstElementChild
 }
 return null
}
