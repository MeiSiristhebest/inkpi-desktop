import * as net from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const fixtureDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)))
const inkpiRoot = resolve(fixtureDirectory, '../../../inkpi')
const serverEntry = pathToFileURL(resolve(inkpiRoot, 'packages/server/dist/index.js')).href
const storageEntry = pathToFileURL(resolve(inkpiRoot, 'packages/storage/dist/index.js')).href
const { InkPiDaemon } = await import(serverEntry)
const { InkDb, SqliteArtifactStore } = await import(storageEntry)

const artifactDb = new InkDb(':memory:')
const daemon = new InkPiDaemon({
  host: '127.0.0.1',
  port: 0,
  context: { artifactStore: new SqliteArtifactStore(artifactDb) },
})
daemon.getTaskRouter().registry.register({
  id: 'desktop-vertical-slices-fixture',
  kinds: [
    'creative.rewrite',
    'narrative.continuity.audit',
    'narrative.deep.reason',
    'narrative.project.distill',
  ],
  async execute(context) {
    context.reportProgress(0.5)
    switch (context.task.kind) {
      case 'creative.rewrite':
        return {
          output: { format: 'patch', patch: { from: 0, to: 6, text: '雨停后，门外只剩冷灯。' } },
          provenance: { fixture: 'desktop-daemon-vertical-slices-harness' },
        }
      case 'narrative.continuity.audit':
        return {
          output: {
            format: 'structured',
            data: [
              {
                id: 'fixture-continuity-finding',
                severity: 'info',
                description: 'Fixture continuity check passed.',
              },
            ],
          },
          provenance: { fixture: 'desktop-daemon-vertical-slices-harness' },
        }
      case 'narrative.deep.reason':
        return {
          output: {
            format: 'structured',
            data: {
              answer: 'Keep the established cold-light image.',
              assumptions: ['The current scene remains in the same location.'],
              alternatives: ['Shift the image to a warmer light.'],
              risks: ['A tonal shift may weaken continuity.'],
            },
          },
          provenance: { fixture: 'desktop-daemon-vertical-slices-harness' },
        }
      case 'narrative.project.distill':
        return {
          output: {
            format: 'structured',
            data: {
              summary: 'A character pauses after the rain.',
              entities: [{ id: 'fixture-character', kind: 'character', name: '她' }],
              events: [{ id: 'fixture-event', type: 'pause', description: 'She does not look back.' }],
              promises: [{ id: 'fixture-promise', statement: 'The cold light remains a scene motif.', status: 'open' }],
              confidence: 0.9,
            },
          },
          provenance: { fixture: 'desktop-daemon-vertical-slices-harness' },
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
  artifactDb.close()
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
