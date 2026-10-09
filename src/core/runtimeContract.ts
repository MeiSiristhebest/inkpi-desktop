import * as InkPiProtocol from '@inkpi/protocol'
import runtimeLock from '../../runtime.lock.json'

export interface RuntimeHandshakeRequest {
  protocolVersion: string
  contractVersion: number
  schemaHash: string
  clientName: string
  clientVersion?: string
  requiredCapabilities: readonly string[]
  expectedRuntime?: RuntimeIdentityExpectation
}

export interface RuntimeIdentityExpectation {
  runtimeCommit: string
  skillManifestHash: string
  storageSchemaVersion: number
}

export interface RuntimeHandshakeResponse {
  accepted: boolean
  protocolVersion: string
  contractVersion: number
  schemaHash: string
  runtimeVersion: string
  runtimeCommit: string
  rpcMethods: string[]
  capabilities: string[]
  skillManifestHash: string
  storageSchemaVersion: number
  missingCapabilities: string[]
  missingRpcMethods: string[]
  reason?: string
}

type RuntimeContractApi = {
  assertRuntimeHandshakeResponse: (
    value: unknown,
    requiredCapabilities?: readonly string[],
  ) => asserts value is RuntimeHandshakeResponse
  createRuntimeHandshakeRequest: (options: {
    clientName: string
    clientVersion?: string
    requiredCapabilities?: readonly string[]
    expectedRuntime?: RuntimeIdentityExpectation
  }) => RuntimeHandshakeRequest
  DESKTOP_REQUIRED_RUNTIME_CAPABILITIES: readonly string[]
  DEFAULT_RPC_HOST: string
  DEFAULT_RPC_WS_PORT: number
}

/**
 * Keep the Desktop build compatible with a file-linked Runtime package whose
 * generated declarations may lag behind its source. Missing contract exports
 * are treated as a connection failure, never as an un-gated fallback.
 */
function getRuntimeContract(): RuntimeContractApi {
  // SAFETY: the runtime package is the single source of this contract; the
  // shape check immediately below narrows the untyped module boundary.
  const candidate = InkPiProtocol as unknown as Partial<RuntimeContractApi>
  if (
    typeof candidate.assertRuntimeHandshakeResponse !== 'function' ||
    typeof candidate.createRuntimeHandshakeRequest !== 'function' ||
    !Array.isArray(candidate.DESKTOP_REQUIRED_RUNTIME_CAPABILITIES) ||
    typeof candidate.DEFAULT_RPC_HOST !== 'string' ||
    typeof candidate.DEFAULT_RPC_WS_PORT !== 'number'
  ) {
    throw new Error('InkPi Runtime package does not provide the compatibility contract')
  }
  return candidate as RuntimeContractApi
}

export function createRuntimeHandshakeRequest(options: {
  clientName: string
  clientVersion?: string
}): RuntimeHandshakeRequest {
  return getRuntimeContract().createRuntimeHandshakeRequest({
    ...options,
    requiredCapabilities: getDesktopRequiredRuntimeCapabilities(),
    expectedRuntime: getExpectedRuntimeIdentity(),
  })
}

export function assertRuntimeHandshakeResponse(
  value: unknown,
): asserts value is RuntimeHandshakeResponse {
  const assertResponse: RuntimeContractApi['assertRuntimeHandshakeResponse'] =
    getRuntimeContract().assertRuntimeHandshakeResponse
  assertResponse(value, getDesktopRequiredRuntimeCapabilities())

  const expected = getExpectedRuntimeIdentity()
  const response = value as RuntimeHandshakeResponse
  if (response.runtimeCommit !== expected.runtimeCommit) {
    throw new Error('Runtime commit does not match runtime.lock.json')
  }
  if (response.skillManifestHash !== expected.skillManifestHash) {
    throw new Error('Runtime skill manifest does not match runtime.lock.json')
  }
  if (response.storageSchemaVersion !== expected.storageSchemaVersion) {
    throw new Error('Runtime storage schema does not match runtime.lock.json')
  }
}

function getExpectedRuntimeIdentity(): RuntimeIdentityExpectation {
  const expected = {
    runtimeCommit: runtimeLock.pinnedCommit,
    skillManifestHash: runtimeLock.skillManifestHash,
    storageSchemaVersion: runtimeLock.storageSchemaVersion,
  }
  if (!/^[0-9a-f]{40}$/.test(expected.runtimeCommit)) {
    throw new Error('runtime.lock.json must contain an exact Runtime commit')
  }
  if (!/^[0-9a-f]{64}$/.test(expected.skillManifestHash)) {
    throw new Error('runtime.lock.json must contain a SHA-256 Skill manifest hash')
  }
  if (!Number.isSafeInteger(expected.storageSchemaVersion) || expected.storageSchemaVersion < 1) {
    throw new Error('runtime.lock.json must contain a valid Runtime storage schema version')
  }
  return expected
}

export function getDesktopRequiredRuntimeCapabilities(): readonly string[] {
  return getRuntimeContract().DESKTOP_REQUIRED_RUNTIME_CAPABILITIES
}

export function getDefaultRuntimeEndpoints(): {
  host: string
  wsPort: number
} {
  try {
    const contract = getRuntimeContract()
    return {
      host: contract.DEFAULT_RPC_HOST,
      wsPort: contract.DEFAULT_RPC_WS_PORT,
    }
  } catch {
    // Endpoint selection is safe to keep available for an older sidecar; the
    // first product RPC still performs the strict handshake and fails closed.
    return { host: '127.0.0.1', wsPort: 8849 }
  }
}
