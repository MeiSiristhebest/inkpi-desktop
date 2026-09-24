# Closure decisions

This record keeps intentionally deferred comparison items explicit. A deferral is not a claim that the capability is implemented.

## Deferred until evidence exists

- **Memory Palace Runtime FTS (#48):** the current first-party Runtime tool contract requires a chapter snapshot. Desktop now maintains an incremental workspace index and subscribes to successful chapter-save events, but moving the authoritative index into Runtime requires a workspace-sync/index RPC contract first. Do not send full chapter collections per keystroke as a future design goal; use the existing incremental boundary until that contract is defined.
- **Generic Runtime telemetry / Desktop bug-report policy (#33–#34):** Runtime now exposes a bounded, sanitized `runtime.diagnostics` `DiagnosticSnapshot` RPC and typed clients. A broader cross-product telemetry/bug-report policy and Desktop user-facing consumption remain deferred until GUI/provider evidence justifies them.
- **Prompt-cache warming (#35):** deferred until route-level cache-miss/latency telemetry demonstrates a measurable benefit. No speculative provider-specific warming is added.
- **Meta direct provider support (#36):** deferred. The catalog/route split is complete, but no supported production route or acceptance evidence justifies adding a direct Meta transport.
- **CLI compile cache (#37):** deferred until a reproducible compile bottleneck is measured. Context budgeting and bounded compaction are the current performance controls.
- **Async clipboard backend (#38):** deferred. Clipboard writes already cross the `clipboardWriter` port; a native async backend change needs platform acceptance evidence and is not required for the current correctness boundary.
- **Extension model gateway (#57):** deferred. Runtime remains the sole model-routing authority and extension workflows do not receive provider credentials or route-selection authority. Add a gateway only after an extension contract and trust policy are approved.
- **Duplicate domain concepts (#52):** deferred pending a migration map for legacy and advanced plugin data. No speculative schema merge is performed during closure hardening.

## Evidence currently available

- Runtime: pinned-dependency check, TypeScript build, 177 files / 827 tests, process restart recovery, cache persistence, route fallback, dual-instance sync, and cross-boundary freeze tests pass.
- Desktop: typecheck, Oxlint (warnings only), 243 files / 1123 tests (2 skipped), production build, frontend parity, NSIS build, and opt-in packaged sidecar RPC acceptance pass.
- GUI acceptance and real-provider acceptance remain explicit manual/opt-in gates; they are not represented as completed by this record.
- The current dirty Runtime contract fingerprint is `28f36aed`; `runtime.lock.json` records that hash while retaining the historical pinned commit. Advance the pinned commit together with the Runtime changes before formal release sign-off.
