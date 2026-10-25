import { renderMermaidSVG } from 'beautiful-mermaid'
import { validateMermaidSource } from './mermaid-policy.mjs'

const cache=new Map()
// Same renderer and limits on the server and in the lazy browser chunk.
export function renderDiagram(source) {
  validateMermaidSource(source)
  if(cache.has(source)) return cache.get(source)
  const svg=renderMermaidSVG(source,{
    bg:'var(--color-bg)',fg:'var(--color-text-prose)',accent:'var(--color-primary)',
    line:'var(--color-text-prose)',muted:'var(--color-text-prose)',surface:'var(--cs-field-mask)',border:'transparent',
    transparent:true,font:'system-ui',padding:16,nodeSpacing:22,layerSpacing:28,interactive:true,
  }).replace(/@import\s+url\([^;]+;/g,'')
  const dimensions=svg.match(/viewBox="([\d. -]+)"/)
  if(!dimensions) throw new Error('Mermaid renderer returned no viewBox')
  const [,,width,height]=dimensions[1].split(/\s+/).map(Number)
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>10000||height>10000) throw new Error('Mermaid diagram exceeds layout limits')
  const entities=[...svg.matchAll(/<g class="(?:node|actor|class-node|entity)" data-id="([^"]+)" data-label="([^"]*)"/g)].map(m=>({id:m[1],label:m[2]}))
  const nodes=[...new Map(entities.map(n=>[n.id,n])).values()]
  if(nodes.length>40) throw new Error('Mermaid requires at most 40 entities')
  if(!nodes.length&&!source.trim().startsWith('xychart-beta')) throw new Error('Mermaid diagram has no supported entities; check its syntax')
  const result={svg,width,height,nodes}
  if(cache.size>=24) cache.delete(cache.keys().next().value)
  cache.set(source,result)
  return result
}
