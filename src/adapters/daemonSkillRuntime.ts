import type {
  SkillActivationResult,
  SkillLoadResult,
  SkillManifest,
  SkillResolveQuery,
  SkillRuntimeRegistrationSnapshot,
} from '@inkpi/protocol'
import type { DaemonSkillRuntime, RpcClient } from '../ports/aiGateway'

/** Keeps Runtime skill RPC method names out of Desktop views and orchestration. */
export const createDaemonSkillRuntime = (client: RpcClient): DaemonSkillRuntime => ({
  discover: () => client.request<SkillManifest[]>('skill.discover'),
  resolve: (query = {}) => client.request<SkillManifest[]>('skill.resolve', query),
  load: (skillId: string) => client.request<SkillLoadResult>('skill.load', { skillId }),
  activate: (skillId: string) => client.request<SkillActivationResult>('skill.activate', { skillId }),
  status: () => client.request<SkillRuntimeRegistrationSnapshot>('skill.status'),
})
