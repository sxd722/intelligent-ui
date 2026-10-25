import { parse, splitCardText, stripCodeFences } from './parse.mjs'
import { compile } from './codegen.mjs'

// Syntax validation only. Never execute model programs on the server.
export function validateDil(source) {
  const { markup } = splitCardText(stripCodeFences(source))
  const parsed = parse(markup)
  const diagnostics = [...parsed.diagnostics]
  if (!parsed.nodes.some(node => node.t !== 'text' || node.segs.some(s => s.k !== 's' || s.v.trim()))) {
    diagnostics.push({ code: 'missing_card', message: 'No card content was generated' })
  }
  try {
    new Function('DIL', 'AsyncImage', compile(parsed).code)
  } catch (error) {
    diagnostics.push({ code: 'invalid_program', message: error.message })
  }
  return diagnostics
}
