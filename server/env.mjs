// Black-box API key loader.
// Keys NEVER enter logs, error messages, or the response stream.
// Supported env-file shapes:
//   1. bare token file (single non-empty line, no '=')  -> whole trimmed line is the key
//   2. KEY=VALUE / export KEY=VALUE lines               -> first plausible key variable wins
//      (a single bare token line may coexist with KEY=VALUE lines and is used as fallback)
import { readFileSync } from 'node:fs'

export const DEFAULT_ENV_PATH =
  '.env.local'

const CANDIDATES = [
  'MODEL_API_KEY',
  'ARK_API_KEY',
  'VOLC_API_KEY',
  'VOLCENGINE_API_KEY',
  'GLM_API_KEY',
  'ZHIPU_API_KEY',
  'FLYWHEEL_API_KEY',
  'API_KEY'
]

function parseVars(raw) {
  const vars = new Map()
  const bareLines = []
  for (const line of raw.trim().split(/\r?\n/)) {
    if (!line.trim()) continue
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m) vars.set(m[1], m[2].trim().replace(/^["']|["']$/g, ''))
    else bareLines.push(line.trim())
  }
  return { vars, bareLines }
}

export function loadApiKey(path = process.env.APIKEY_FILE || DEFAULT_ENV_PATH) {
  for (const name of CANDIDATES) {
    if (process.env[name]?.trim()) return { ok: true, value: process.env[name].trim(), source: 'process-env' }
  }
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return { ok: false, reason: `env file not readable: ${path}` }
  }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'env file is empty' }

  const { vars, bareLines } = parseVars(raw)

  // Pexels (and any other non-model service key) must never be picked as the model key
  const isModelKeyName = (name) => /KEY|TOKEN|SECRET/i.test(name) && !/PEXELS/i.test(name)

  for (const name of CANDIDATES) {
    if (vars.get(name)) return { ok: true, value: vars.get(name), source: name }
  }
  for (const [name, value] of vars) {
    if (isModelKeyName(name) && value) return { ok: true, value, source: name }
  }
  const bare = bareLines[0]
  if (bare) return { ok: true, value: bare, source: 'bare-token-file' }
  return { ok: false, reason: 'env file has KEY=VALUE lines but no api-key-like variable' }
}

export function loadPexelsKey(path = process.env.APIKEY_FILE || DEFAULT_ENV_PATH) {
  if (process.env.PEXELS_DISABLED === '1') return { ok:false, reason:'disabled for this process' }
  if (process.env.PEXELS_API_KEY) {
    return { ok: true, value: process.env.PEXELS_API_KEY, source: 'process-env' }
  }
  try {
    const { vars, bareLines } = parseVars(readFileSync(process.env.PEXELS_API_KEY_FILE || '.pexels.local', 'utf8'))
    const value = vars.get('PEXELS_API_KEY') || bareLines[0]
    if (value) return { ok:true, value, source:'pexels-key-file' }
  } catch { /* dedicated file optional */ }
  try {
    const { vars } = parseVars(readFileSync(path, 'utf8'))
    const v = vars.get('PEXELS_API_KEY')
    if (v) return { ok: true, value: v, source: 'env-file' }
  } catch { /* env file optional here */ }
  return { ok: false, reason: 'no PEXELS_API_KEY (environment, .env.local, or configured key file)' }
}
