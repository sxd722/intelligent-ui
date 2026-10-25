// Public adapters do not inherit browser cookies. Detect an explicit access
// gate before an adapter mistakes a 200 login page for a changed data schema.
const loginPath = /(?:^|\/)(?:login(?:-required)?|log-in|signin|sign-in)(?:\/|$)/i
export function publicResponseError(response, requestedUrl) {
  let requested, resolved
  try { requested = new URL(requestedUrl); resolved = new URL(response.url) } catch { return null }
  let code
  if (response.status === 401) code = 'AUTH_REQUIRED'
  else if (response.status === 429) code = 'RATE_LIMITED'
  else if (response.status === 403) code = 'ACCESS_RESTRICTED'
  else if (response.redirected && loginPath.test(resolved.pathname) && !loginPath.test(requested.pathname)) code = 'AUTH_REQUIRED'
  if (!code) return null
  const detail = code === 'AUTH_REQUIRED'
    ? `${requested.hostname} 要求登录（${resolved.origin}${resolved.pathname}）。当前是公共 HTTP 适配器，不使用浏览器登录态；在浏览器登录后也不能保证此命令恢复。`
    : `${requested.hostname} HTTP ${response.status}`
  return Object.assign(new Error(detail), {code})
}
export function guardPublicFetch(fetchImpl) {
  return async (input, init) => {
    const response = await fetchImpl(input, init)
    const error = publicResponseError(response, typeof input === 'string' || input instanceof URL ? String(input) : input.url)
    if (error) { void response.body?.cancel().catch(() => {}); throw error }
    return response
  }
}
