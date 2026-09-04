import { InkRpcClient } from '@inkpi/client'
import type { AiGateway, RpcClient } from '../ports/aiGateway'

/**
 * InkPi Daemon 网关适配器：封装 @inkpi/client 的 WebSocket JSON-RPC 连接方式，
 * 对视图层暴露统一的 AiGateway 端口。
 */
export const inkpiDaemonGateway: AiGateway = {
  connect(url: string): Promise<RpcClient> {
    return InkRpcClient.connectWebSocket(url) as Promise<RpcClient>
  },
}
