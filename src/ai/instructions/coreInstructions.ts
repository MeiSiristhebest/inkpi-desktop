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
    version: '2',
    systemInstruction:
      'Continue the supplied document while preserving its voice, established facts, and immediate scene intent. Treat canonical facts as established and hypotheses as unconfirmed. Use character-belief facts only for the named character; do not let a character act on project facts they have not learned in the supplied prose or character-belief records. Use provenance evidence to keep details tied to their source.',
  },
  {
    id: 'creative.rewrite',
    taskKind: 'creative.rewrite',
    version: '4',
    systemInstruction:
      'Rewrite only the requested selection and preserve protected facts. Return only one JSON object with exactly three fields: "from" (integer), "to" (integer), and "text" (string). Copy from and to from Input selection; text contains only the replacement prose for that range. Treat canonical facts as established and hypotheses as unconfirmed. Use character-belief facts only for the named character; do not give a character knowledge that the supplied prose or character-belief records do not establish. Use provenance evidence to keep details tied to their source.',
  },
  {
    id: 'narrative.continuity.audit',
    taskKind: 'narrative.continuity.audit',
    version: '5',
    systemInstruction:
      'Audit the supplied narrative context for continuity risks. Report only conflicts directly supported by explicit prose and supplied canonical facts or constraints. Do not infer a contradiction from omitted details, hypotheses, a character’s uncertainty, an explicitly marked flashback, or chapter order. Report a warning only for a concrete, checkable risk; if the prose is ambiguous but does not establish a conflict, return no finding. Every finding must include severity (info, warning, or error), description (string), a short exact quotation copied from the audited prose in evidence, and at least one matching ID in a blockIds array copied from the supplied document context. The field name is exactly blockIds; never use singular blockId. Include entityIds only when they match supplied story records. Never invent quotations or IDs. Return only a top-level JSON array of finding objects, never an object wrapper such as {"findings":[...]}; return [] when there is no supported finding.',
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
    version: '2',
    systemInstruction:
      'Distill the supplied narrative context into structured story facts. For every entity, event, or promise candidate, include sourceDocumentId from one of the supplied document IDs and evidence as an exact verbatim substring from that document. Do not invent document IDs or paraphrase evidence. Omit sourceDocumentId and evidence when no exact source passage can be identified.',
  },
]

export function listCoreInstructionDefinitions(): DesktopInstructionDefinition[] {
  return DEFINITIONS.map((definition) => ({ ...definition }))
}

export function getCoreInstructionDefinition(taskKind: string): DesktopInstructionDefinition {
  const definition = DEFINITIONS.find((candidate) => candidate.taskKind === taskKind)
  if (!definition) throw new Error(`No core instruction registered for task kind: ${taskKind}`)
  return { ...definition }
}
