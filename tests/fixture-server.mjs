import {SANDBOX_REACT} from '../shared/cardspec/sandbox-fixtures.mjs'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FIXTURES } from '../shared/cardspec/fixtures.mjs'
import { DIL_MULTILINE } from './dil-fixture.mjs'
import { RESOURCE_CARD, BROKEN_RESOURCE_CARD } from './repair-fixture.mjs'
import { TOOL_DEMO } from '../shared/cardspec/tool-fixtures.mjs'
mkdirSync('artifacts/cardspec-qa', { recursive: true })
const keyFile = resolve('artifacts/cardspec-qa/fixture-key.env')
writeFileSync(keyFile, 'MODEL_API_KEY=qa-not-a-real-key\n')
let active = 0
const requests = []
const upstream = http.createServer(async (req, res) => {
  if (req.url === '/stats') { res.end(JSON.stringify({ active, requests })); return }
  let body = ''; for await (const c of req) body += c
  const input = JSON.parse(body), joined = input.messages.map((m) => m.content).join('\n'), system = input.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n')
  const planning=input.response_format?.type==='json_object'&&system.includes('JSON对象')
  const record = { marker:joined.match(/QA_[A-Z_]+/)?.[0], phase:planning ? system.includes('"regions"') ? 'plan' : 'analysis' : 'dsl', responseFormat:input.response_format, assistantDsl:input.messages.some(m=>m.role==='assistant'&&m.content.includes('<card')), emitted:0 }
  requests.push(record)
  if (joined.includes('QA_FAILURE')) { res.writeHead(502).end('controlled failure'); return }
  let source
  if (system.includes('Card DSL')||system.includes('你设计320–432px交互卡片')) source = FIXTURES.counter.replace(/<outro>[\s\S]*$/, `<outro>${'流式状态验证。'.repeat(80)}</outro>`)
  else if (planning) source = system.includes('"regions"') ? JSON.stringify({ theme: { language: 'soft', palette: 'a' }, regions: [{ id: 'body', role: 'content', overflow: 'scroll', content: ['计数'] }], state: {}, rules: [] }) : JSON.stringify({ goal: '计数验证', facts: [], interactions: ['增加一次'], requiredInformation: ['计数'], supportingInformation: [], unavailableData: [] })
  else source = '{@body const [count,setCount]=DIL.useState(0);}\n<title>原版 DIL 计数</title><text>当前计数 {count}</text><button onClick={() => setCount(count+1)}>增加一次</button>\n' + '流式状态验证。'.repeat(80)
  const repairingPlan=/JSON校验错误|当前规划未通过校验/.test(joined)
  if (planning && joined.includes('QA_BAD_PLAN') && !repairingPlan) source = '{"goal":"broken"'
  const wrongDsl = planning && joined.includes('QA_PLAN_DSL') && !repairingPlan
  if (wrongDsl) source = FIXTURES.counter.repeat(30)
  if (joined.includes('QA_MULTI_REPAIR')) source = joined.includes('修复以下诊断') ? RESOURCE_CARD : BROKEN_RESOURCE_CARD
  if (joined.includes('QA_TOOL_CARD')) source=TOOL_DEMO
  if(system.includes('export default function App'))source=SANDBOX_REACT
  if (joined.includes('QA_DIL_MULTILINE')) source = DIL_MULTILINE
  if (joined.includes('QA_DIL_UNCLOSED')) source = '{@body const items=[\n{name:"unfinished"}'
  if (joined.includes('QA_DIL_INVALID')) source = '{@body const items=;}\n<text>invalid</text>'
  res.writeHead(200, { 'Content-Type': 'text/event-stream' })
  active++
  let pos = 0, timer, closed = false
  const stop = () => { if (!closed) { closed = true; active--; clearTimeout(timer) } }
  res.once('close', stop)
  const first = joined.includes('QA_DIL_') ? 40 : source.includes('</card>') ? source.indexOf('</card>') + 7 : source.includes('</button>') ? source.indexOf('</button>') + 9 : 50
  function send() {
    if (closed) return
    const size = wrongDsl ? 8 : pos === 0 ? first : 40
    const piece = source.slice(pos, pos + size); pos += piece.length
    record.emitted = pos
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`)
    if (pos < source.length) timer = setTimeout(send, 100)
    else {
      if (!joined.includes('QA_TRUNCATED')) res.write('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
      res.end(); stop()
    }
  }
  if (joined.includes('QA_THINK')) timer=setTimeout(send,800)
  else send()
})
const qaPort=process.env.CARDSPEC_QA_PORT||'8790',upstreamPort=process.env.CARDSPEC_QA_UPSTREAM_PORT||'8791'
if(Number(qaPort)===8787||Number(upstreamPort)===8787)throw Error('QA must not use the application port')
await new Promise((r) => upstream.listen(Number(upstreamPort), '127.0.0.1', r))
const child = spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit', windowsHide: true, env: { ...process.env, PEXELS_DISABLED:'1', PORT:qaPort, MODEL_BASE_URL: 'http://127.0.0.1:'+upstreamPort, APIKEY_FILE: keyFile } })
function close() { child.kill(); upstream.closeAllConnections(); upstream.close(); }
process.on('SIGINT', close); process.on('SIGTERM', close); process.on('exit', close)
