// Debug-only discovery. Handles are derived from rendered component identities
// (including each keys), never from selectors supplied by the model.
const selector='button,input,select,textarea,summary,[role="button"],[role="tab"],[role="radio"]'
export function debugControls(card){
 if(!card)return []
 const all=[...card.querySelectorAll(selector)]
 return all.filter(el=>{
  if(el.closest('[hidden],[inert],[aria-hidden="true"]')||!el.getClientRects().length)return false
  if(el.checkVisibility&&!el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))return false
  for(let p=el;p&&p!==card.parentElement;p=p.parentElement){
   const css=getComputedStyle(p)
   if(css.display==='none'||css.visibility==='hidden'||css.visibility==='collapse')return false
   if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(el))return false
  }
  return true
 }).map(el=>{
  const owner=el.closest('[data-cs-node]'),path=owner?.getAttribute('data-cs-node')
  const siblings=all.filter(c=>c.closest('[data-cs-node]')===owner)
  const role=el.getAttribute('role')||(el.tagName==='INPUT'?(['checkbox','radio'].includes(el.type)?el.type:'textbox'):el.tagName==='TEXTAREA'?'textbox':el.tagName==='SELECT'?'combobox':el.tagName==='SUMMARY'?'button':el.tagName.toLowerCase())
  const labelled=(el.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim()
  const name=(el.getAttribute('aria-label')||labelled||el.labels?.[0]?.textContent||el.innerText||el.textContent||'').trim()
  const handle=encodeURIComponent(path||`unowned:${role}:${name}`)+':'+siblings.indexOf(el)
  el.setAttribute('data-debug-handle',handle)
  return {handle,component:path,role,name,disabled:!!el.disabled||el.getAttribute('aria-disabled')==='true'}
 }).slice(0,40)
}
