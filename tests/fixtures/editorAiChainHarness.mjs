import * as net from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const fixtureDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)))
const inkpiRoot = resolve(fixtureDirectory, '../../../inkpi')
const serverEntry = pathToFileURL(resolve(inkpiRoot, 'packages/server/dist/index.js')).href
const { InkPiDaemon } = await import(serverEntry)

const daemon = new InkPiDaemon({ host: '127.0.0.1', port: 0 })
daemon.getTaskRouter().registry.register({
  id: 'editor-ai-chain-fixture',
  kinds: ['creative.continue'],
  async execute(context) {
    context.reportProgress(0.5)
    return {
      output: { format: 'text', text: 'editor-ai-chain-fixture:continuation' },
      provenance: { fixture: 'editor-ai-chain-harness' },
    }
  },
})

await daemon.start(0, '127.0.0.1')
const wsPort = await findFreePort()
await daemon.startWebSocket(wsPort, '127.0.0.1')
await daemon.getTaskRouter().ready

process.stdout.write(
  `${JSON.stringify({
    type: 'ready',
    tcpPort: daemon.getStatus().port,
    wsPort,
  })}\n`,
)

let stopping = false
const shutdown = async () => {
  if (stopping) return
  stopping = true
  await daemon.stop()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not discover a free TCP port'))
        return
      }
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolvePort(address.port)
      })
    })
  })
}
