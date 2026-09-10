import * as net from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const fixtureDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)))
const inkpiRoot = resolve(fixtureDirectory, '../../../inkpi')
const serverEntry = pathToFileURL(resolve(inkpiRoot, 'packages/server/dist/index.js')).href
const { InkPiDaemon } = await import(serverEntry)
const { createDaemonPersistence } = await import(serverEntry)

const persistence = createDaemonPersistence({
  dbPath: process.env.INKPI_FIVE_SLICE_GATE_DB?.trim() || ':memory:',
})
const daemon = new InkPiDaemon({
  host: '127.0.0.1',
  port: 0,
  skillSearchDirs: [resolve(inkpiRoot, 'skills')],
  context: {
    ...persistence.context,
  },
})

daemon.getTaskRouter().registry.register({
  id: 'desktop-five-slice-gate-fixture',
  kinds: [
    'creative.continue',
    'creative.rewrite',
    'narrative.continuity.audit',
    'narrative.deep.reason',
    'narrative.project.distill',
  ],
  async execute(context) {
    context.reportProgress(0.5)
    switch (context.task.kind) {
      case 'creative.continue':
        return {
          output: { format: 'text', text: 'desktop-five-slice-gate:continuation' },
          provenance: { fixture: 'desktop-five-slice-gate-harness' },
        }
      case 'creative.rewrite':
        return {
          output: { format: 'patch', patch: { from: 0, to: 6, text: '雨停后只剩冷灯。' } },
          provenance: { fixture: 'desktop-five-slice-gate-harness' },
        }
      case 'narrative.continuity.audit':
        return {
          output: {
            format: 'structured',
            data: [
              {
                id: 'gate-continuity-finding',
                severity: 'warning',
                description: 'Gate continuity finding.',
              },
            ],
          },
          provenance: { fixture: 'desktop-five-slice-gate-harness' },
        }
      case 'narrative.deep.reason':
        return {
          output: {
            format: 'structured',
            data: {
              answer: 'Keep the cold-light motif.',
              assumptions: ['The scene remains after the rain.'],
              alternatives: ['Change the motif to warm light.'],
              risks: ['A tonal shift may weaken continuity.'],
            },
          },
          provenance: { fixture: 'desktop-five-slice-gate-harness' },
        }
      case 'narrative.project.distill':
        return {
          output: {
            format: 'structured',
            data: {
              summary: 'A character pauses after the rain.',
              entities: [{ id: 'gate-character', kind: 'character', name: '她' }],
              events: [{ id: 'gate-event', type: 'pause', description: 'She does not look back.' }],
              promises: [{ id: 'gate-promise', statement: 'The cold light remains.', status: 'open' }],
              confidence: 0.9,
            },
          },
          provenance: { fixture: 'desktop-five-slice-gate-harness' },
        }
      default:
        throw new Error(`Unexpected fixture task kind: ${context.task.kind}`)
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
  persistence.close()
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
        reject(new Error('Could not discover a free WebSocket port'))
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
