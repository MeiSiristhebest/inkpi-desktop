# InkPi Desktop E2E and Contract Test Infrastructure

**Document Version**: 1.1.0  
**Author**: Test Writer Agent (`teamwork_preview_test_writer_e2e`)  
**Status**: ACTIVE / TEST_READY  
**Scope**: In-process, requirement-driven integration testing for the InkPi Desktop plugin ecosystem (44 plugins, host context, storage layer, and mathematical engines), plus a separate Tauri packaging/startup smoke path.

**Source of truth**: The [Runtime v1 specification](https://github.com/MeiSiristhebest/inkpi/blob/master/docs/specs/AI_RUNTIME_SPEC_v1.md), this repository's `ARCHITECTURE.md`, and the executable contracts under `src/` and `tests/`. Historical external drafts are not test inputs.

**Audit snapshot (2026-09-14)**: The Desktop suite contains 213 test files and 927 tests; the latest full run passed 925 tests and skipped 2. V8 coverage was 87.07% lines, 76.82% branches, 84.52% statements, and 76.47% functions against the configured thresholds of 80% / 70% / 75% / 75%.

---

## 1. Test Philosophy: Opaque-Box & Requirement-Driven

The InkPi Desktop E2E test suite adheres to strict engineering principles:

1. **Opaque-Box Verification (Black-Box / Grey-Box by Contract)**:
   - Tests exercise public host APIs, component mount boundaries, real domain engines, and IndexedDB persistence boundaries. They do not assert private component state or arbitrary implementation details.
   - Tests do NOT assert on internal private variables, component implementation details, or arbitrary React state hooks.
   - Every assertion verifies observable system side-effects: database records altered, events delivered, CAS revision tokens incremented, active chapter content mutated, or mathematically computed values verified against theoretical ground truth.

2. **Authoritative Oracle & Expected Output Derivation**:
   - Every test case has an explicit authoritative source of truth derived from the Runtime v1 specification and `ARCHITECTURE.md`:
     - **Power Tier Poset DAG**: Kahn's topological sorting algorithm ($O(V+E)$) and Warshall's transitive closure algorithm ($O(V^3)$). Expected order and cycle detection derive from strict poset mathematics.
     - **Token Budget Optimization**: Dynamic Programming 0-1 Knapsack recurrence:
       $$DP[i][w] = \max(DP[i-1][w], DP[i-1][w - w_i] + v_i)$$
       Expected selection verifies maximum total value without exceeding capacity $W$.
     - **Corpus-Level Scrap Matching**: Smoothed TF-IDF cosine metric:
       $$\text{IDF}(t, D) = \ln\left(1 + \frac{|D|}{\text{DF}(t) + 1}\right) + 1, \quad \text{sim}(q, d) = \frac{\vec{v}_q \cdot \vec{v}_d}{\|\vec{v}_q\| \|\vec{v}_d\|}$$
     - **Chinese Phonetics Tonal Classification**: Modern Standard Mandarin Pinyin tonal dictionary: Tone 1 (阴平) and Tone 2 (阳平) $\to$ Ping (平); Tone 3 (上声) and Tone 4 (去声) $\to$ Ze (仄). Zero dependence on Unicode parity heuristics.
     - **Volume Narrative Arcs**: 2nd-degree Ordinary Least Squares (OLS) polynomial regression $y = \beta_0 + \beta_1 x + \beta_2 x^2$ with analytical $R^2 = 1 - \frac{SS_{res}}{SS_{tot}}$ and vertex $x_{apex} = -\frac{\beta_1}{2\beta_2}$.
     - **Optimistic Concurrency Control (CAS)**: Monotonic revision increment; patch rejected with `conflict: true` if `expectedRevision !== currentRevision`.
     - **Tenant Data Quarantine**: Multi-tenant database queries with tenant $A$ key cannot access, overwrite, or enumerate records belonging to tenant $B$.

3. **No Facade Tests**:
   - Every test executes real computational logic or transactional storage workflows.
   - Tests that trivially pass with `expect(true).toBe(true)` or `expect(screen.getByText(...)).toBeDefined()` without mutation checks are prohibited.

4. **Self-Containment & Multi-Tenant Isolation**:
   - Persistence tests that need cross-project isolation generate scoped IDs such as `test-proj-${crypto.randomUUID()}`; other deterministic fixtures use fixed IDs and clean up their stores.
   - Database tables are seeded and cleaned up using isolated scopes.

---

## 2. Feature Inventory Test Mapping (Tiers 1–4)

| Tier | Test Suite File | Covered Features | Test Case Count | Description |
|---|---|---|---|---|
| **Tier 1** | `tests/e2e/tier1-features/hostContract.test.ts` | **F1**: DesktopPluginHostContext | $\ge 5$ | Reactive chapter exposure, CAS optimistic concurrency, book hierarchy sync, and mutation dispatcher |
| **Tier 1** | `tests/e2e/tier1-features/drawerActivation.test.ts` | **F2**: Dynamic Drawer Dock | $\ge 5$ | Dynamic drawer dock activation in production editor, drawer toggle/open/close, snippet rendering, WriterDesk consolidation |
| **Tier 1** | `tests/e2e/tier1-features/eventBus.test.ts` | **F3**: Decoupled Event Bus | $\ge 5$ | Scoped event bus (`scopedBus(projectId)`), real pub/sub across plugins, cross-tenant leak prevention |
| **Tier 1** | `tests/e2e/tier1-features/tenantIsolation.test.ts` | **F4, F5, F6**: Tenant Namespace & Storage | $\ge 5$ | Composite keys (`${projectId}::${id}`), elimination of `!record.projectId`, voiceprint & form data collisions |
| **Tier 1** | `tests/e2e/tier1-features/physicalWriteback.test.ts` | **F7, F8, F9, F10**: Physical Writeback | $\ge 5$ | Aftermath-Sync Codex mutations, Diff-Reviewer CAS commit, Water-Meter/Safe-Gate/Linter text mutations |
| **Tier 1** | `tests/e2e/tier1-features/mathEngines.test.ts` | **F11, F12, F13, F14, F15**: 5 Math Engines | $\ge 5$ | Poset DAG transitive closure, 0-1 Knapsack DP, Corpus IDF TF-IDF, Chinese Pinyin tones, OLS polynomial regression |
| **Tier 2** | `tests/e2e/tier2-boundaries/boundaryAndCornerCases.test.ts` | Boundary & Corner Cases | $\ge 8$ | Empty text inputs, concurrent CAS race conditions, cyclic power tier DAGs, knapsack capacity overflow, single-doc IDF extremes, tonal mismatches, degenerate flat tension curves |
| **Tier 3** | `tests/e2e/tier3-combinations/crossFeatureFlows.test.ts` | Cross-Feature Workflows | $\ge 5$ | Full closed-loop: Drawer analysis $\to$ CAS writeback $\to$ Event Bus dispatch $\to$ Subscriber update $\to$ Living Codex entity mutation |
| **Tier 4** | `tests/e2e/tier4-scenarios/novelWritingScenarios.test.ts` | Real-World Writing Lifecycles | $\ge 4$ | Multi-project novel session: Cultivation breakthrough, Combat power breach alert, Timeline causality synchronization, and Chapter draft revision |

---

## 3. Test Architecture & Runner Configuration

### Directory Layout
```
tests/
└── e2e/
    ├── harness/
    │   ├── testHostHarness.ts       # Opaque-box host harness, CAS dispatcher reference, memory DB & bus helpers
    │   ├── mathOracles.ts          # Pure mathematical oracles derived from specs (Warshall, Kahn, 0-1 Knapsack, TF-IDF, Pinyin, OLS)
    │   └── index.ts                # Harness exports
    ├── tier1-features/
    │   ├── hostContract.test.ts     # F1 tests
    │   ├── drawerActivation.test.ts # F2 tests
    │   ├── eventBus.test.ts         # F3 tests
    │   ├── tenantIsolation.test.ts  # F4, F5, F6 tests
    │   ├── physicalWriteback.test.ts# F7, F8, F9, F10 tests
    │   └── mathEngines.test.ts      # F11, F12, F13, F14, F15 tests
    ├── tier2-boundaries/
    │   └── boundaryAndCornerCases.test.ts
    ├── tier3-combinations/
    │   └── crossFeatureFlows.test.ts
    └── tier4-scenarios/
        └── novelWritingScenarios.test.ts
```

### Test Runner Environment
- **Test Runner**: Vitest (`npm run test -- tests/e2e`)
- **Execution Environment**: `jsdom` with `fake-indexeddb` and in-memory mock storage
- **Setup Script**: `src/test/setup.ts` (auto-loaded)
- **Reporter**: Standard text reporter with test case execution timings and failure stack traces

### Execution Commands
```bash
# Run complete E2E test suite
npm run test -- tests/e2e

# Run individual tiers
npm run test -- tests/e2e/tier1-features
npm run test -- tests/e2e/tier2-boundaries
npm run test -- tests/e2e/tier3-combinations
npm run test -- tests/e2e/tier4-scenarios
```

### Tauri release smoke

The Windows GNU release path is also covered locally:

```bash
npm run tauri:build
```

A recorded Windows GNU verification produced the NSIS installer at
`src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/InkPi Desktop_0.1.0_x64-setup.exe`,
verified that the package contains the `inkpi.exe` sidecar, four skill manifests,
WebView2Loader, and MinGW runtime DLLs, and started the release application twice.
Both starts spawned the sidecar and exposed the default TCP ports 8848 and 8849;
the test processes were closed after each run. This is a startup/restart smoke test, not
the full App task-recovery or production-provider gate.

The `Architecture Gates` workflow accepts an optional `runtime_ref` input when
started with `workflow_dispatch`. Use a Runtime branch or commit there when the
Desktop change must be verified against an unpublished Runtime revision; normal
push and pull-request runs continue to use Runtime `master`.
