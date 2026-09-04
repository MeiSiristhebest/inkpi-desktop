# Contributing to InkPi Desktop

Thank you for your interest in contributing to InkPi Desktop!

## 🛡️ Core Contribution Principles

1. **Strict Single-Defect / Atomic Focus (RFC-100)**: PRs must be hyper-focused and minimal ($\le 30\text{--}50$ lines of core change).
2. **Test Coverage Gate ($\ge 85\%$ Lines, $\ge 80\%$ Branches)**: All PRs touching logic must include unit or component tests satisfying the coverage gate.
3. **Exact Dependency Pinning**: Dependencies must be strictly pinned to exact versions.
4. **Clean Architecture & Separation of Concerns**: Maintain decoupling between Tauri Rust host, externalBin daemon sidecar, and Vite/React editor SPA.
5. **Frontend Ports & Adapters**: Never import `db/indexedDB` or call `window.confirm` / `navigator.clipboard` / `URL.createObjectURL` / `Date.now()` / `Math.random()` from `components/`, `domain/`, `core/`, `hooks/`, `plugins/**/components/`. Depend on `src/ports/` interfaces and consume `src/adapters/` implementations. Inject non-determinism via the `Clock` / `IdGenerator` / `RandomSource` ports. The `src/architecture.test.ts` guard fails the build on any violation.
   - Repositories expose **per-project** queries (`getVolumesByProject` / `getChaptersByProject`); do not fetch the global store and filter by `projectId` in memory.
   - Use the semantic `AiAssistant` port (`openSession` / `suggestContinuation` / `prompt`); never hand-write `'session.*'` RPC strings.
   - Keep `RichEditor` a passive view: add editor interactions via `useChapterEditorModel` actions, not new `useState`; extract reusable blocks into `src/components/editor/organisms/`.

## 🚀 Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Typecheck & Build SPA
npm run build

# 3. Run test suite & coverage gate
npm run test:coverage

# 4. Run linter
npm run lint

# 5. Run the unified check gate (typecheck + lint + tests)
npm run check

# 6. Run desktop app in development mode
npm run tauri:dev
```

## 📜 Pull Request Guidelines

- Verify `npm run check` (typecheck + lint + tests) and `npm run test:coverage` pass locally before opening a PR.
- Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Clearly explain the problem, the solution, and provide verification evidence in the PR description.
