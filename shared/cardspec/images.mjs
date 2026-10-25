import { evaluate } from './expression.mjs'
import { createStore, makeScope } from './store.mjs'
export const photoKey = (query, role = 'hero') => JSON.stringify([String(query || '').trim().toLowerCase(), role])
export function collectImages(spec) {
  const jobs = new Map(), scope = makeScope(spec, createStore())
  // Resolve the whole-card backdrop first, within the existing resource budget.
  if (spec.visualStyle && typeof spec.backgroundQuery === 'string' && spec.backgroundQuery.trim()) {
    const query = spec.backgroundQuery.trim(), role = 'background', key = photoKey(query, role)
    jobs.set(key, { key, query, role })
  }
  let visited = 0
  const visit = (nodes, local) => {
    for (const n of nodes) {
      if (++visited > 5000) return
      if(n.type==='logic'){visit(n.children,{...local,local:evaluate(n.props.initial,local)});continue}
      if (n.type === 'each') {
        const items = evaluate(n.props.items, local)
        if (Array.isArray(items)) items.forEach((item,index) => visit(n.children, { ...local, item, index, [n.props.as?.value || 'item']: item }))
        continue
      }
      if (n.type === 'image') {
        try {
          const query = evaluate(n.props.query, local), role = n.props.mediaRole ? evaluate(n.props.mediaRole, local) : 'hero'
          if (typeof query === 'string' && query.trim()) jobs.set(photoKey(query,role), { key:photoKey(query,role), query, role })
        } catch { /* query may only become available after a user selection */ }
      }
      visit(n.children || [], local)
    }
  }
  visit(spec.children, scope); return [...jobs.values()]
}
// Host resources use a hashed disk path locally or a bounded Pexels proxy in Workers.
// Keep existing absolute HTTP(S) fixture/resource compatibility.
export function safePhotoUrl(value) {
  if(typeof value!=='string')return null
  if(/^\/api\/media\/[a-f0-9]{64}\.jpg$/.test(value))return value
  try {
    if(value.startsWith('/api/media?')){
      const proxy=new URL(value,'https://host.invalid'),source=new URL(proxy.searchParams.get('src'))
      if(proxy.hash||[...proxy.searchParams.keys()].length!==1||source.protocol!=='https:'||source.hostname!=='images.pexels.com'||source.port||source.username||source.password)return null
      return value
    }
    const url=new URL(value)
    return ['http:','https:'].includes(url.protocol)?url.href:null
  } catch { return null }
}
