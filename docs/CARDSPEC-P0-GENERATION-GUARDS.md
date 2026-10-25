# Generation correctness gates (2026-10-22)

This change is local to the CardSpec generation pipeline. DIL, runtime snapshot semantics, tool permissions and the one-repair limit remain unchanged.

## Data paths

A binding is an envelope with `value`, `status`, `error`, `updatedAt`. Literal paths such as `bindings.search.items` now produce `binding_result_path` with the source location and `bindings.search.value.items` as the correction. The check visits inactive branches and actions in both dialects. It does not rewrite arbitrary data or assume every tool returns a collection. Runtime preflight is skipped for this structural error so it cannot mask the cause with an unrelated collection-capacity message.

## Logic lifecycle and event probes

Final generation validation runs isolated QuickJS initialization and bounded real-control event samples for both legacy and JS expressions. Compilation and streaming previews still execute no JS, tool or host action. Reactive modules initialize before their computed view is validated; nonreactive modules do not receive an invented init event. The existing limits remain 16 event samples per module, two interaction layers, and the isolated execution time/memory limits.

A narrow AST check recognizes input-dependent work exclusively under `event.type === 'input'`, including simple input aliases. This catches missed first-mount synchronization even in a closed conditional view. Explicit init handling or unconditional consumption is permitted. It is not full control-flow or taint analysis; other initialization mistakes still require interaction testing.

Control probes reject a number becoming a non-number when that local field is used in concrete numeric operations/comparisons in the view. They do not coerce events, impose a global JSON state schema, or reject unrelated union/display fields. This catches numeric-stage corruption, but cannot verify arbitrary formulas or the mathematical meaning of a simulation.

## Repair capability ledger

The first parseable candidate records available tools' automatic load, refresh and invocation kinds. The one repair receives a compact capability reminder. A lost capability raises `repair_capability_lost` before publication; the existing recoverable error UI is used. Binding/action IDs may change. A CLI's invalid slot/page target may become a data invocation. Verified matching prefetch plus a retained binding and an actual dataset consumer can replace redundant first-load execution, but copied literal text cannot. Explicit polling and user-triggered capabilities must remain.

This ledger is intentionally conservative and does not prove general semantic equivalence, action reachability, output consumption in all states, or completeness of local-only business logic. Unavailable tools and unparseable/truncated drafts cannot establish these invariants. Failed repairs retain raw output in trace and never silently claim feature parity.

## Evidence

See `artifacts/cardspec-p0-20261022/`: untouched eight-source replay, generic unit regressions, local build, before/after connection identity, and separate fresh browser-generation checks. The old browser evaluation remains an immutable control. Rejected old source is evidence of better detection, not evidence that all eight tasks now generate correctly.
