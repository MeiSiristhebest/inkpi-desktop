import type {
  SkillActivationResult,
  SkillLoadResult,
  SkillManifest,
  SkillResolveQuery,
  SkillRuntimeRegistrationSnapshot,
} from '@inkpi/protocol'
import type { RpcClient } from '../ports/aiGateway'

/** The first-party Runtime skills shipped with the Desktop application. */
export const FIRST_PARTY_SKILL_IDS = [
  'hook',
  'promise',
  'character-voice',
  'timeline-consistency',
] as const

export type FirstPartySkillId = (typeof FIRST_PARTY_SKILL_IDS)[number]

export interface DaemonSkillRuntime {
  discover(): Promise<SkillManifest[]>
  resolve(query?: SkillResolveQuery): Promise<SkillManifest[]>
  load(skillId: string): Promise<SkillLoadResult>
  activate(skillId: string): Promise<SkillActivationResult>
  status(): Promise<SkillRuntimeRegistrationSnapshot>
  ensureFirstPartySkillsActivated(): Promise<SkillRuntimeRegistrationSnapshot>
}

export interface DaemonSkillRuntimeOptions {
  firstPartySkillIds?: readonly FirstPartySkillId[]
}

/** Keeps Runtime skill RPC method names out of Desktop views and orchestration. */
export const createDaemonSkillRuntime = (
  client: RpcClient,
  options: DaemonSkillRuntimeOptions = {},
): DaemonSkillRuntime => {
  const configuredSkillIds = [...new Set(options.firstPartySkillIds ?? FIRST_PARTY_SKILL_IDS)]
  let firstPartyActivationReady: Promise<SkillRuntimeRegistrationSnapshot> | undefined

  const runtime: DaemonSkillRuntime = {
    discover: () => client.request<SkillManifest[]>('skill.discover'),
    resolve: (query = {}) => client.request<SkillManifest[]>('skill.resolve', query),
    load: (skillId: string) => client.request<SkillLoadResult>('skill.load', { skillId }),
    activate: (skillId: string) =>
      client.request<SkillActivationResult>('skill.activate', { skillId }),
    status: () => client.request<SkillRuntimeRegistrationSnapshot>('skill.status'),
    ensureFirstPartySkillsActivated: () => {
      if (!firstPartyActivationReady) {
        firstPartyActivationReady = (async () => {
          let snapshot = await runtime.status()
          const activated = new Set(snapshot.activatedSkills)

          for (const skillId of configuredSkillIds) {
            if (activated.has(skillId)) continue
            const result = await runtime.activate(skillId)
            snapshot = result.snapshot
            for (const activatedSkillId of snapshot.activatedSkills) activated.add(activatedSkillId)
            activated.add(skillId)
          }

          return snapshot
        })().catch((error) => {
          // A failed activation must not poison the assistant for the rest of
          // the session. Successful skills remain known, while the next call
          // asks the daemon for its current status and retries the missing one.
          firstPartyActivationReady = undefined
          throw error
        })
      }
      return firstPartyActivationReady
    },
  }

  return runtime
}
