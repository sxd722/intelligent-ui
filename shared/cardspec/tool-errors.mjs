const policies = {
  EMPTY_RESULT: ['来源当前没有此项数据', false, 'edit_input', 300000],
  DEPENDENCY_NOT_READY: ['所需数据尚未就绪或查询条件已改变，请先获取对应数据再重试', false, 'retry', 0],
  BROWSER_CONNECT: ['浏览器连接需要重新绑定，请打开工具连接设置', false, 'connect', 300000],
  AUTH_REQUIRED: ['来源需要登录', false, 'open_source', 300000],
  ACCESS_RESTRICTED: ['来源当前要求访问验证', false, 'open_source', 300000],
  RATE_LIMITED: ['来源请求过于频繁，请稍后再试', true, 'retry_later', 60000],
  TIMEOUT: ['数据请求超时', true, 'retry', 30000],
  NETWORK: ['暂时无法连接数据来源', true, 'retry', 30000],
  SCHEMA_MISMATCH: ['来源返回的数据格式不兼容，暂时无法展示', false, 'diagnose', 300000],
  INVALID_INPUT: ['查询参数无效，请修改后重试', false, 'edit_input', 300000],
  CANCELLED: ['请求已取消', false, 'retry', 0],
  TOOL_ERROR: ['工具执行失败', false, 'retry', 60000],
}
export function toolErrorInfo(error, { now = Date.now(), aborted = false } = {}) {
  const detail = String(error?.errorInfo?.detail || error?.message || error || '').replace(/(?:Bearer|token|secret)[=: ]+\S+/gi, '[redacted]').slice(0, 600)
  let code = error?.errorInfo?.code || error?.code
  if (!policies[code]) {
    if (aborted || error?.name === 'AbortError') code = 'CANCELLED'
    else if (/重新绑定|绑定已失效|选中连接测试页/i.test(detail)) code = 'BROWSER_CONNECT'
    else if (/captcha|验证码|access denied/i.test(detail)) code = 'ACCESS_RESTRICTED'
    else if (/AUTH_REQUIRED|需要登录|login required/i.test(detail)) code = 'AUTH_REQUIRED'
    else if (/\b429\b|rate.?limit/i.test(detail)) code = 'RATE_LIMITED'
    else if (/timeout|timed out|超时/i.test(detail)) code = 'TIMEOUT'
    else if (/unexpected payload|invalid JSON|malformed row|output must be|返回.*格式|expected collection/i.test(detail)) code = 'SCHEMA_MISMATCH'
    else if (/network|fetch failed|ECONN|ENOTFOUND|offline/i.test(detail)) code = 'NETWORK'
    else code = 'TOOL_ERROR'
  }
  const [message, retryable, recovery, delay] = policies[code]
  const supplied = Number(error?.errorInfo?.retryAt || error?.retryAt)
  return { code, message, detail, retryable, recovery, retryAt: Number.isFinite(supplied) && supplied > now ? Math.min(supplied, now + 3600000) : now + delay }
}
export function structuredToolError(error, options) {
  const info = toolErrorInfo(error, options)
  return Object.assign(new Error(info.message), { code: info.code, errorInfo: info })
}
