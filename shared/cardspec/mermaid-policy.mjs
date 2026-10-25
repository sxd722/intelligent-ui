export const MERMAID_TYPES = ['flowchart','graph','stateDiagram-v2','sequenceDiagram','classDiagram','erDiagram','xychart-beta']
export function validateMermaidSource(source) {
  if (typeof source !== 'string' || !source.trim() || source.length > 6000) throw new Error('mermaid.source requires 1–6000 characters')
  const type=source.trim().split(/[\s;]/)[0]
  if (!MERMAID_TYPES.includes(type)) throw new Error(`mermaid supports ${MERMAID_TYPES.join(', ')}; other diagram types are not supported`)
  if (source.split('\n').length > 100) throw new Error('mermaid requires at most 100 lines; use a focused overview')
  // Source supplies relationships only. Host owns CSS, URLs, JS and configuration.
  if (/%%\{|^---|(?:^|[;\n])\s*(?:click|style|classDef|linkStyle|accDescr|accTitle)\s|:::|<\/?[a-z][^>]*>|(?:https?:|javascript:|data:|url\s*\()/im.test(source) || (type!=='classDiagram'&&/(?:^|[;\n])\s*class\s/im.test(source))) throw new Error('mermaid source cannot contain directives, HTML, links, callbacks or custom styles; use onSelect and host tokens')
  return type
}
