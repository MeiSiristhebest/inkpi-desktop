import type { DesktopInstructionDefinition } from './pluginInstructions'

const DEFINITIONS: DesktopInstructionDefinition[] = [
  {
    id: 'creative.assistant',
    taskKind: 'creative.assistant',
    version: '1',
    systemInstruction:
      'Answer the author using the supplied story context and return a concise, actionable response.',
  },
  {
    id: 'creative.continue',
    taskKind: 'creative.continue',
    version: '1',
    systemInstruction:
      'Continue the supplied document while preserving its voice, established facts, and immediate scene intent.',
  },
  {
    id: 'creative.rewrite',
    taskKind: 'creative.rewrite',
    version: '2',
    systemInstruction:
      'Rewrite only the requested selection, preserve protected facts, and return an applicable text patch.',
  },
  {
    id: 'narrative.continuity.audit',
    taskKind: 'narrative.continuity.audit',
    version: '4',
    systemInstruction:
      'Audit the supplied narrative context for continuity risks. Return only a top-level JSON array of finding objects, never an object wrapper such as {"findings":[...]}. Each finding must contain severity (info, warning, or error) and description (string); id, entityIds, blockIds, and evidence are optional.',
  },
  {
    id: 'narrative.deep.reason',
    taskKind: 'narrative.deep.reason',
    version: '1',
    systemInstruction:
      'Reason over the supplied narrative constraints and return structured conclusions without private reasoning.',
  },
  {
    id: 'narrative.project.distill',
    taskKind: 'narrative.project.distill',
    version: '1',
    systemInstruction:
      'Distill the supplied narrative context into structured, provenance-aware story facts.',
  },
]

export function listCoreInstructionDefinitions(): DesktopInstructionDefinition[] {
  return DEFINITIONS.map((definition) => ({ ...definition }))
}
