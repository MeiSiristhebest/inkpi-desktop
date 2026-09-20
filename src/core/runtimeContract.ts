import * as InkPiProtocol from '@inkpi/protocol'

export interface RuntimeHandshakeRequest {
  protocolVersion: string
  contractVersion: number
  schemaHash: string
  clientName: string
  clientVersion?: string
  requiredCapabilities: readonly string[]
}

export interface RuntimeHandshakeResponse {
  accepted: boolean
  protocolVersion: string
  contractVersion: number
  schemaHash: string
  runtimeVersion: string
  capabilities: string[]
  missingCapabilities: string[]
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
  })
}

export function assertRuntimeHandshakeResponse(
  value: unknown,
): asserts value is RuntimeHandshakeResponse {
  const assertResponse: RuntimeContractApi['assertRuntimeHandshakeResponse'] =
    getRuntimeContract().assertRuntimeHandshakeResponse
  assertResponse(value, getDesktopRequiredRuntimeCapabilities())
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
