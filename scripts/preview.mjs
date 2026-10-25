// One-shot helper: build the client, then start the server serving dist/.
import { execSync } from 'node:child_process'
import { spawn } from 'node:child_process'

execSync('npx vite build', { stdio: 'inherit', cwd: new URL('..', import.meta.url) })
const server = spawn('node', ['server/index.mjs'], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url)
})
server.on('exit', (code) => process.exit(code ?? 0))
