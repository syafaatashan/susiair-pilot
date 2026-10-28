/**
 * Runs the API-down scenario end to end:
 *   1. starts the built Nuxt server on 3021 pointed at a dead API base
 *   2. runs scripts/e2e-api-down.mjs against it
 *   3. stops the server
 *
 *   node scripts/e2e-api-down-run.mjs
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const server = spawn(process.execPath, [join(root, '.output/server/index.mjs')], {
  cwd: root,
  stdio: 'ignore',
  env: { ...process.env, PORT: '3021', NUXT_API_BASE: 'http://localhost:3011' } // 3011: nothing listening
})

const stop = () => {
  try {
    server.kill()
  } catch {
    /* already gone */
  }
}
process.on('exit', stop)

// Wait for the server to accept connections.
const deadline = Date.now() + 30000
for (;;) {
  try {
    await fetch('http://localhost:3021/login')
    break
  } catch {
    if (Date.now() > deadline) {
      stop()
      console.error('server on 3021 did not start')
      process.exit(1)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

const test = spawn(process.execPath, [join(here, 'e2e-api-down.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, UI_BASE: 'http://localhost:3021' }
})

test.on('exit', (code) => {
  stop()
  process.exit(code ?? 1)
})
