import { compileCard } from './compiler.mjs'

// A rejected program is never executable. Extract only unconditional literal
// copy, never expressions, data, hidden branches, list templates or actions.
export function recoveryDraft(source = '', goal = '') {
  const draft = { title: '', text: [], fields: [], goal: String(goal).slice(0, 4000) }
  const raw = String(source).slice(0, 262144)
  if (!/<\/?[a-z][\w-]*\b/i.test(raw)) {
    if (raw.trim() && !/[{}]/.test(raw)) draft.text.push(raw.trim().slice(0, 4000))
    return draft
  }
  try {
    const { spec } = compileCard(raw, { final: true })
    const literal = ast => ast?.type === 'literal' && typeof ast.value === 'string' ? ast.value : ''
    const textOf = node => node.type === 'run' ? literal(node.value)
      : (node.children || []).every(n => n.type === 'run' && n.value?.type === 'literal')
        ? node.children.map(n => literal(n.value)).join('') : ''
    const walk = nodes => {
      for (const node of nodes || []) {
        if (['if', 'each', 'slot'].includes(node.type) || node.props?.visible) continue
        if (['title', 'text', 'caption', 'strong'].includes(node.type)) {
          const text = (node.type==='title' && node.children?.every(n=>n.type==='run')
            ? node.children.map(n=>n.value?.type==='literal'?literal(n.value):'〔待确认〕').join('')
            : textOf(node)).trim().slice(0, 1200)
          if (node.type === 'title' && text && !draft.title) draft.title = text
          else if (text && draft.text.length < 8 && !draft.text.includes(text)) draft.text.push(text)
        } else if (['input', 'textarea', 'select', 'slider', 'date-picker'].includes(node.type)) {
          const label = literal(node.props?.label)
          if (label && draft.fields.length < 12 && !draft.fields.includes(label)) draft.fields.push(label)
        } else if (!['button','pressable','chip','link'].includes(node.type)) walk(node.children)
      }
    }
    walk(spec?.children)
  } catch { /* The original request still provides a useful recovery surface. */ }
  return draft
}
