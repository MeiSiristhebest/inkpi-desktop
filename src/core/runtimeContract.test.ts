import {
  DESKTOP_REQUIRED_RUNTIME_CAPABILITIES,
  RUNTIME_CONTRACT_VERSION,
  RUNTIME_PROTOCOL_VERSION,
  RUNTIME_SCHEMA_HASH,
} from '@inkpi/protocol'
import runtimeLock from '../../runtime.lock.json'
import { describe, expect, it } from 'vitest'
import { assertRuntimeHandshakeResponse, createRuntimeHandshakeRequest } from './runtimeContract'

function compatibleResponse(overrides: Record<string, unknown> = {}) {
  return {
    accepted: true,
    protocolVersion: RUNTIME_PROTOCOL_VERSION,
    contractVersion: RUNTIME_CONTRACT_VERSION,
    schemaHash: RUNTIME_SCHEMA_HASH,
    runtimeVersion: '2.0.0',
    runtimeCommit: runtimeLock.pinnedCommit,
    rpcMethods: [...DESKTOP_REQUIRED_RUNTIME_CAPABILITIES],
    capabilities: [...DESKTOP_REQUIRED_RUNTIME_CAPABILITIES],
    skillManifestHash: runtimeLock.skillManifestHash,
    storageSchemaVersion: runtimeLock.storageSchemaVersion,
    missingCapabilities: [],
    missingRpcMethods: [],
    ...overrides,
  }
}

describe('Desktop Runtime identity pin', () => {
  it('sends the pinned Runtime identity in the handshake request', () => {
    const request = createRuntimeHandshakeRequest({ clientName: 'inkpi-desktop-test' })

    expect(request.expectedRuntime).toEqual({
      runtimeCommit: runtimeLock.pinnedCommit,
      skillManifestHash: runtimeLock.skillManifestHash,
      storageSchemaVersion: runtimeLock.storageSchemaVersion,
    })
  })

  it('accepts only a Runtime that matches the lock identity', () => {
    expect(() => assertRuntimeHandshakeResponse(compatibleResponse())).not.toThrow()
    expect(() =>
      assertRuntimeHandshakeResponse(compatibleResponse({ runtimeCommit: '0'.repeat(40) })),
    ).toThrow('Runtime commit does not match runtime.lock.json')
    expect(() =>
      assertRuntimeHandshakeResponse(compatibleResponse({ skillManifestHash: '0'.repeat(64) })),
    ).toThrow('Runtime skill manifest does not match runtime.lock.json')
    expect(() =>
      assertRuntimeHandshakeResponse(
        compatibleResponse({ storageSchemaVersion: runtimeLock.storageSchemaVersion + 1 }),
      ),
    ).toThrow('Runtime storage schema does not match runtime.lock.json')
  })
})
