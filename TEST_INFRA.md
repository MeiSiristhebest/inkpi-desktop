# InkPi Desktop E2E Test Infrastructure Specification

**Document Version**: 1.0.0  
**Author**: Test Writer Agent (`teamwork_preview_test_writer_e2e`)  
**Status**: ACTIVE / TEST_READY  
**Scope**: Opaque-box, requirement-driven End-to-End integration testing for InkPi Desktop Plugin Ecosystem (44 plugins, host context, storage layer, and mathematical engines).

---

## 1. Test Philosophy: Opaque-Box & Requirement-Driven

The InkPi Desktop E2E test suite adheres to strict engineering principles:

1. **Opaque-Box Verification (Black-Box / Grey-Box by Contract)**:
   - Tests interact exclusively with public API boundaries, interface contracts defined in `PROJECT.md`, component mount boundaries, and IndexedDB storage persistence.
   - Tests do NOT assert on internal private variables, component implementation details, or arbitrary React state hooks.
   - Every assertion verifies observable system side-effects: database records altered, events delivered, CAS revision tokens incremented, active chapter content mutated, or mathematically computed values verified against theoretical ground truth.

2. **Authoritative Oracle & Expected Output Derivation**:
   - Every test case has an explicit authoritative source of truth derived from `ORIGINAL_REQUEST.md` and `PROJECT.md`:
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
   - Every test generates isolated project IDs (`test-proj-${crypto.randomUUID()}`).
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
- **Test Runner**: Vitest (`vitest run tests/e2e`)
- **Execution Environment**: `jsdom` with `fake-indexeddb` and in-memory mock storage
- **Setup Script**: `src/test/setup.ts` (auto-loaded)
- **Reporter**: Standard text reporter with test case execution timings and failure stack traces

### Execution Commands
```bash
# Run complete E2E test suite
npx vitest run tests/e2e

# Run individual tiers
npx vitest run tests/e2e/tier1-features
npx vitest run tests/e2e/tier2-boundaries
npx vitest run tests/e2e/tier3-combinations
npx vitest run tests/e2e/tier4-scenarios
```
