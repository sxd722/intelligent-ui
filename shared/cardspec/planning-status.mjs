export function planningStatusText(result) {
  if (!result) return ''
  if (result.status !== 'fallback') return result.plan?.primary || ''
  const labels = {
    PLAN_JSON_FORMAT: '规划 JSON 格式错误',
    PLAN_JSON_AMBIGUOUS: '规划返回多个 JSON 文档，无法唯一确定',
    PLAN_SCHEMA: '规划字段不符合契约',
    PLAN_TIMEOUT: '体验规划超时',
    PLAN_LIMIT: '规划输出超出长度或 token 上限',
    PLAN_UPSTREAM: '规划模型调用失败'
  }
  // Old saved conversations retain their reason without requiring migration.
  const reason = String(result.reason || '')
  const legacy = /JSON|Unexpected|Expected/.test(reason) ? '规划 JSON 格式错误' : /超时|timeout/i.test(reason) ? '体验规划超时' : '体验规划失败'
  return `${labels[result.code] || legacy}，已回退快速生成。`
}
