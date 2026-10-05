## 📝 Description

<!-- Briefly describe the goal and changes introduced by this pull request. -->

## 🛡️ Atomic Focus & Quality Checklist

- [ ] **Single-Defect Atomic Focus (RFC-100)**: This PR addresses a single focused concern.
- [ ] **Test Coverage Gate**: Tests have been added/updated and `npm run test:coverage` passes against the thresholds declared in `vitest.config.ts`. Coverage thresholds are the measured floor for the files under audit — raise the tested surface instead of lowering the numbers.
- [ ] **Full Check Gate**: `npm run check` (typecheck + lint + tests) succeeds cleanly.
- [ ] **Lint Verification**: `npm run lint` (oxlint) passes without errors.
- [ ] **Formatting Verification**: `npm run format:check` (prettier) passes; formatting fixes belong in this PR, not in trailing dirty state.
- [ ] **Typecheck & Build**: `npm run build` succeeds cleanly without warnings, including the frontend-parity verification.
- [ ] **Rust Gate** (only when `src-tauri/` changed): `cargo fmt --check` and `cargo check` pass.
- [ ] **Runtime Lockstep** (only when the pinned Runtime changed): `runtime.lock.json` and the literals in `tests/integration/runtimeCompatibilityGate.test.ts` were regenerated together.

## 🧪 Verification Evidence

```bash
# Paste verification command output here (e.g. vitest output, build logs)
```
