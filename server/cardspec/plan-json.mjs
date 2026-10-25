// Recover wrappers, never rewrite JSON or choose between competing documents.
export const PLAN_RAW_LIMIT = 5000
export function planJsonError(code, message) { return Object.assign(new Error(message), {code}) }
export function extractPlanJson(raw) {
  if (raw.length > PLAN_RAW_LIMIT) throw planJsonError('PLAN_LIMIT', '规划输出超过长度上限')
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return {value: JSON.parse(text), extracted: false} } catch {}
  const candidates = []
  let start = -1, stack = [], quoted = false, escaped = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (start < 0) {
      if (c === '{' || c === '[') { start = i; stack = [c] }
      else if (c === '}' || c === ']') throw planJsonError('PLAN_JSON_FORMAT', '规划 JSON 存在多余的闭合符号')
      continue
    }
    if (quoted) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') quoted = false
      continue
    }
    if (c === '"') quoted = true
    else if (c === '{' || c === '[') stack.push(c)
    else if (c === '}' || c === ']') {
      if (stack.pop() !== (c === '}' ? '{' : '[')) throw planJsonError('PLAN_JSON_FORMAT', '规划 JSON 括号不匹配')
      if (!stack.length) { candidates.push(text.slice(start, i + 1)); start = -1 }
    }
  }
  if (start >= 0) throw planJsonError('PLAN_JSON_FORMAT', '规划 JSON 不完整')
  if (candidates.length > 1) throw planJsonError('PLAN_JSON_AMBIGUOUS', '规划返回多个 JSON 文档，无法唯一确定')
  if (!candidates.length) throw planJsonError('PLAN_JSON_FORMAT', '规划未返回完整 JSON 对象')
  try { return {value: JSON.parse(candidates[0]), extracted: true} }
  catch { throw planJsonError('PLAN_JSON_FORMAT', '规划 JSON 内部语法错误') }
}

export function planRawDiagnostic(raw, characters) {
  const limit = 2000
  return {rawPreview: raw.slice(0, limit), rawCharacters: characters, rawTruncated: characters > limit}
}
