# Project: InkPi Desktop Plugin Ecosystem Refactoring & Overhaul

## Architecture
InkPi Desktop follows a modular hexagonal architecture:
- **Core Engine (`src/core/`)**: Application host, route router, plugin registry (`PluginRegistry`), desktop plugin host context provider (`DesktopPluginHostContext`), and decoupled pub/sub event bus (`PluginEventBus`).
- **Editor Layer (`src/components/editor/`)**: RichEditor (TipTap-based) as the sole production editor, containing dynamic drawer dock (`DrawerDock`), reactive chapter state synchronization, and CAS optimistic concurrency writeback. `WriterDesk.tsx` dead view logic is cleanly consolidated into `RichEditor.tsx`.
- **Domain & Plugins Layer (`src/plugins/` - 44 plugins)**: Independent feature plugins implementing `mainView` and `drawerSnippetView`. All plugins consume live reactive context and emit/subscribe through tenant-scoped event channels.
- **Data & Storage Layer (`src/db/`, `src/ports/`, `src/adapters/`)**: IndexedDB (`inkpi-studio`) storage with composite tenant keys (`${projectId}::${entityId}`), explicit `projectId` indexes on `chapters`/`volumes`, and strictly partitioned repository ports.
- **Mathematical & Algorithmic Engines**: Rigorous algorithms for Poset DAG transitive closure, 0-1 Knapsack DP, corpus IDF, Chinese Pinyin phonetics, and OLS polynomial regression.

```
+-----------------------------------------------------------------------------------+
|                                InkPi Desktop App                                  |
|                                                                                   |
|  +--------------------------- DesktopPluginHostContext -------------------------+ |
|  | State: activeChapter, activeChapterId, revision, bookHierarchy               | |
|  | Actions: mutateActiveChapter(CAS), mutateCodexEntity, refreshBookHierarchy    | |
|  | EventBus: scopedBus(projectId).emit / .on                                    | |
|  +-------------------------------------------------------------------------------+ |
|         |                                                           |             |
|         v                                                           v             |
|  +------------------ RichEditor -------------------+     +---- 44 Domain Plugins --+ |
|  | - TipTap ProseMirror Canvas                     |     | - Drawer Snippet Views  | |
|  | - Dynamic Drawer Dock (<Drawer />)              | <-> | - Master Views          | |
|  | - CAS Transactional Patch Dispatcher            |     | - Mathematical Engines  | |
|  +-------------------------------------------------+     +-------------------------+ |
|                                                                     |             |
|  +----------------------------- Storage Layer ------------------------------------+ |
|  | IndexedDB (52 stores) with Strict Composite Tenant Keys: ${projectId}::${id}  | |
|  | IndexedDB Repositories (Strict projectId isolation, zero permissive fallback) | |
+-----------------------------------------------------------------------------------+
```

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | DesktopPluginHostContext | Expose reactive activeChapter, full bookHierarchy, revision sequence, and CAS writeback | M1 | ORIGINAL_REQUEST §R1 |
| F2 | Drawer Dock Activation | Integrate dynamic drawer dock into RichEditor and retire WriterDesk dead view logic | M1 | ORIGINAL_REQUEST §R1 |
| F3 | Decoupled Event Bus Wireup | Add tenant-scoped event channels and wire real pub/sub across domain plugins | M1 | ORIGINAL_REQUEST §R5 |
| F4 | Permissive Match Eradication | Eliminate `!record.projectId` fallback filtering across all 24 plugin locations | M2 | ORIGINAL_REQUEST §R2 |
| F5 | Tenant Key Collision Resolution | Fix voiceprints (`vp-${name}`), form data, keyValueStore ('mirror'), and timeline nodes | M2 | ORIGINAL_REQUEST §R2 |
| F6 | IndexedDB Schema & Repository Isolation | Add `revision` to ChapterRecord, add `projectId` indexes, and enforce tenant ports | M2 | ORIGINAL_REQUEST §R2 |
| F7 | Aftermath-Sync Physical Writeback | Apply patch writes back to living Codex entities (`codexEntities`) and emits event | M3 | ORIGINAL_REQUEST §R3 |
| F8 | Diff-Reviewer CAS Writeback | "Apply All" and hunk adoption commit merged text to chapter via CAS writeback | M3 | ORIGINAL_REQUEST §R3 |
| F9 | Text Plugins Physical Writeback | Water-Meter, Safe-Gate, Narrative-Linter write fixes back to active chapter | M3 | ORIGINAL_REQUEST §R3 |
| F10 | Domain Plugins Writeback | Promise-Ledger, Faction-Matrix, Chekhov-Radar commit genuine mutations to entities/bus | M3 | ORIGINAL_REQUEST §R3 |
| F11 | Poset DAG Power Tier Engine | True DAG graph, Kahn's topological sort/cycle detection, Warshall transitive closure | M4 | ORIGINAL_REQUEST §R4 |
| F12 | 0-1 Knapsack Token Optimizer | Authentic 0-1 Knapsack dynamic programming with capacity backtracking in GraphStore | M4 | ORIGINAL_REQUEST §R4 |
| F13 | Corpus IDF Scrap Matching | Corpus-level document frequency tracking and smoothed TF-IDF cosine vector matching | M4 | ORIGINAL_REQUEST §R4 |
| F14 | Chinese Phonetics Tonal Engine | Authentic Pinyin tonal lookup (Tones 1,2=Ping, 3,4=Ze), 13-rhymes, remove parity | M4 | ORIGINAL_REQUEST §R4 |
| F15 | OLS Narrative Arc Regression | Authentic 2nd-degree OLS polynomial regression with legitimate R^2 and vertex analysis | M4 | ORIGINAL_REQUEST §R4 |
| F16 | E2E Opaque-Box Test Suite | Comprehensive 4-tier requirement-driven integration test suite published as TEST_READY | E2E Track | ORIGINAL_REQUEST §Acceptance |
| F17 | Final E2E Pass & Mock Elimination | Remove evasive mocks, test real IndexedDB persistence, fix tsconfig test exclusion | M5 | ORIGINAL_REQUEST §Acceptance |
| F18 | Adversarial Coverage Hardening | Tier 5 white-box stress testing, boundary hardening, and victory audit clearance | M5 | ORIGINAL_REQUEST §Acceptance |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Planning | Architectural mapping, 3 explorer surveys, PROJECT.md creation | none | DONE |
| M-E2E | E2E Testing Track | Independent requirement-driven test infra and Tiers 1-4 test cases -> TEST_READY.md | M0 | IN_PROGRESS |
| M1 | Host Contract & Drawer Activation | DesktopPluginHostContext, RichEditor drawer dock, WriterDesk consolidation, Event Bus wireup (F1, F2, F3) | M0 | PLANNED |
| M2 | Data Isolation & Tenant Namespace | Eradicate permissive matching, fix key collisions, add revision & indexes, tenant repos (F4, F5, F6) | M1 | PLANNED |
| M3 | Closed-Loop Physical Writeback | Real mutations for aftermath-sync, diff-reviewer, water-meter, safe-gate, linter, codex (F7, F8, F9, F10) | M2 | PLANNED |
| M4 | Mathematical Rigor & Heuristics | Poset DAG, 0-1 Knapsack DP, Corpus IDF, Pinyin phonetics, OLS regression (F11, F12, F13, F14, F15) | M2 | PLANNED |
| M5 | Final E2E Pass & Adversarial Hardening | Pass 100% E2E tests, remove evasive mocks, verify TypeScript & lint, Tier 5 hardening, Victory Audit (F17, F18) | M3, M4, M-E2E | PLANNED |

---

## Interface Contracts

### Host Layer ↔ Plugin Ecosystem (`DesktopPluginHostContext`)
```typescript
// src/types/pluginHost.ts
export interface ChapterMutationPatch {
  chapterId: string
  expectedRevision: number // CAS token
  type: 'full_replace' | 'diff_hunks' | 'text_replace'
  content?: string
  search?: string | RegExp
  replacement?: string
  hunks?: Array<{ id: string; resolution: 'applied' | 'rejected' }>
}

export interface ChapterMutationResult {
  success: boolean
  conflict?: boolean
  currentRevision?: number
  updatedContent?: string
  error?: string
}

export interface DesktopPluginHostContextValue {
  projectId: string
  projectName: string
  activeChapter: ChapterRecord | null
  activeChapterId: string | null
  revision: number
  bookHierarchy: {
    volumes: VolumeRecord[]
    chapters: ChapterRecord[]
  }
  mutateActiveChapter: (patch: ChapterMutationPatch) => Promise<ChapterMutationResult>
  mutateCodexEntity: (
    entityId: string,
    mutation: (prev: CodexEntity) => Partial<CodexEntity>
  ) => Promise<void>
  refreshBookHierarchy: () => Promise<void>
  activeDrawerPluginId: string | null
  openDrawer: (pluginId: string) => void
  closeDrawer: () => void
  toggleDrawer: (pluginId: string) => void
}
```

### Event Bus Scoped Channel Contract (`PluginEventBus`)
```typescript
// src/core/pluginEventBus.ts
export interface ScopedPluginEventBus {
  projectId: string
  emit<T extends PluginEventType>(type: T, payload: PluginEventPayloads[T]): void
  on<T extends PluginEventType>(type: T, handler: (payload: PluginEventPayloads[T]) => void): () => void
}
```

### Power Tier Poset Contract (`ConsistencyEngine`)
```typescript
// src/plugins/consistency-sentinel/types.ts
export interface TierNode {
  id: string
  name: string
  rank?: number
}
export interface TierEdge {
  from: string
  to: string
}
export interface PosetValidationResult {
  valid: boolean
  hasCycle: boolean
  cyclePath?: string[]
  topologicalOrder?: string[]
}
```

---

## Code Layout
```
src/
├── core/
│   ├── engine.tsx                     # Production route mount
│   ├── pluginHostContext.tsx          # DesktopPluginHostContext Provider & hook
│   ├── pluginRegistry.tsx             # Plugin registration & activation
│   └── pluginEventBus.ts              # Event bus with scopedBus(projectId)
├── types/
│   ├── index.ts                       # ChapterRecord with revision: number
│   ├── plugin.ts                      # Plugin interface definitions
│   └── pluginHost.ts                  # Host context & CAS mutation interfaces
├── components/editor/
│   ├── RichEditor.tsx                 # Unified production editor
│   ├── EditorToolbar.tsx              # Toolbar with dynamic drawer switch dock
│   ├── EditorCanvas.tsx               # Canvas layout rendering Drawer
│   └── WriterDesk.tsx                 # Consolidated / utility re-exports
├── db/
│   └── indexedDB.ts                   # Schema upgrade, indexes, composite keys
├── ports/                             # Storage interfaces with required projectId
├── adapters/                          # IndexedDB adapters with tenant isolation
└── plugins/                           # 44 domain plugins
    ├── consistency-sentinel/          # Poset DAG power tier engine
    ├── living-codex/                  # 0-1 Knapsack token budget optimizer
    ├── scrapbook-recycler/            # Corpus IDF cosine scrap matching
    ├── name-forge/                    # Chinese Pinyin tonal phonetics engine
    ├── volume-master/                 # OLS quadratic regression narrative arc
    ├── aftermath-sync/                # Closed-loop Codex writeback
    ├── diff-reviewer/                 # Closed-loop CAS chapter writeback
    └── ... (remaining plugins)
```
