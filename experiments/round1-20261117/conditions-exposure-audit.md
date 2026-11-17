# C1 / S2: exposure, actual adoption, and attribution limits

Read-only audit of saved actual requests, model responses, source versions and retained artifacts. No model, browser, CLI or product changes. `conditions-exposure-audit.json` preserves request-level exposure booleans and raw model-source hashes. Counts below describe the recorded runs, not independent repeats or causal effectiveness.

## C1: option disclosed, behavior expansion not adopted

|Run|Exact C1 contract in actual system request|Raw model source submissions / unique sources|`<behavior>`|`<collection>`|
|---|---:|---:|---:|---:|
|T1 recording kit C1 r2|6/6|3/2|0 in every source|0 in every source|
|T4 luminous library C1 r2|6/7|3/2|0 in every source|0 in every source|

T4's first request is task routing; the subsequent generation/repair requests contain the exact C1 contract. The missing route-stage exposure is not failure to deliver the behavior option to the code generator. Raw responses were checked, not merely expanded compiler output: expansion cannot explain the absence. Saved `01.cardspec`, `02.cardspec` and final artifacts likewise contain neither tag.

- **T1:** manually declares `cmp`, `final`, `reason`, `saved`, derives picked rows, and writes `toggle`, `setFinal`, `setReason`, `save`. It uses each/button choices and a `region presentation="compare"`. That styling is not the proposed selected-entity/detail/back behavior owner. It does not use host collection internal detail as an equivalent substitute. It also lacks an explicit detail/back flow in the retained source; do not infer fulfillment of that requirement merely from comparison text being present.
- **T4:** manually declares `title`, `view`, `pinned`, writes `open` to set title+detail, and `back` to set list while retaining title. `if` branches render the two views; existing bindings fetch search/page. This is manual implementation of similar inspect/back semantics, not C1 expansion and not collection-owned detail. The extra `region overflow="details"` holds pinned evidence; it is not the selected article's state mechanism.

**Interpretation:** these runs estimate only an *intention-to-treat* effect of **offering** optional C1 syntax (including extra prompt cost and model choice). Observed behavior-unit adoption is **0/2 task-runs**. They provide no treated artifact with which to measure whether expansion reduces wiring bugs. No per-protocol/use-effect estimate exists. A hypothesis that collection made C1 redundant is plausible generally, but is **not supported by these two outputs**, which contain no collection.

Do not label a C1 artifact win/loss as “behavior encapsulation helped/hurt.” Equally, absence of adoption does not establish that encapsulation is useless. Forcing adoption would be a new treatment/revision, not retroactive relabeling. Minimal next experiment: an explicit inspect-return task with optional versus required macro usage and equal capabilities; verify raw-source adoption before evaluating expansion benefits. Do not count a hand-expanded/hand-repaired source as model adoption.

## S2: two fixed examples were genuinely delivered

`experimental-mechanisms.mjs` supplies exactly the same two examples for every S2 request:

1. `inspect-return`: stable selected ID, derived current record, separate detail boolean, back preserving selection.
2. `snapshot-next`: increment a scalar and compute a dependent result using `next.n` in the same snapshot transaction.

Actual exact-source/system-material exposure:

|Task|Requests containing both exact examples|Applicability of inspect-return|Applicability of snapshot-next|
|---|---:|---|---|
|T1 equipment comparison|7/7|Relevant to requested details/back identity. Does not teach two-item comparison, missing values, constraint updates or saved decision reasons.|Only if the implementation chains dependent writes. Deriving filters/comparison from current state does not need it.|
|T2 job allocation|8/8|Relevant to job details and returning without losing assignment.|Narrow relevance to dependent state writes; does not supply allocation arithmetic, capacity constraints or one-job-one-device invariants.|
|T3 water transfer / clock|8/8|Not central: no record selection/detail navigation is required.|Only superficially resembles “advance one step.” It does **not** demonstrate logic init/input/tick, host play/pause, manual step while paused, boundary conservation, snapshot-to-graphic subscription or restoration of timer state.|
|T4 evidence reading|6/7 (route first)|Relevant to selected-article identity and return.|Does not teach asynchronous binding transactions, stale-result isolation, query changes, detail-fetch dependencies or source-bound quotes.|

The package metadata has `notFor` clauses (including “no new clock”), but `executableMechanismMaterial` serializes intent, counterexample and executable source only. The exact `notFor` strings are **not** in actual prompts. A metadata field's existence must not be reported as model-visible guidance. This is recorded without changing the frozen S2 material.

### Actual code versus inferred influence

- T1 S2 builds `openDetail`/`back` with selected object and view state; T2 builds `open`/`back` and a derived current job; T4 builds its own detail/list view and selected title. These are structurally consistent with inspect-return, but common idioms also exist in B1 and the base contract. Similarity alone cannot prove the example caused adoption or improvement.
- None of the inspected S2 raw sources or retained source versions uses `next.`. That does **not** prove the second example was ignored in all reasoning: deriving output or using independent writes can legitimately avoid next. It does mean no direct execution/adoption test of the demonstrated `next.n` mechanism occurred in these outputs.
- T3 uses a `logic` reducer rather than the example's root state/action transaction. There is no mechanism-matched clock example in this treatment. T3's failure therefore cannot invalidate executable-skill examples as a strategy or prove that clock behavior is unteachable through examples.

## What can and cannot be concluded

Valid: all six named task-runs received their relevant experimental material during implementation; C1 raw syntax adoption was zero; S2 was a **fixed two-example bundle**, not adaptive mechanism retrieval. Test and replay failures are separately documented elsewhere.

Invalid attribution:

- “C1 expansion caused the observed quality” when the macro was never emitted.
- “C1 was replaced by equivalent collection behavior” for these particular two runs.
- “Executable skill examples fail on time simulation” when neither supplied example covers that mechanism.
- “Snapshot-next example fixed snapshot semantics” without dependent-write evidence or a matching task assertion.
- “Two samples are two independent repeats”: C1 has two different tasks, one attempt condition each; repair submissions are not fresh draws.
- Pooling r1/r2/r3 calibration changes as if they were repeated measurements of one unchanged condition.

Next minimal decisions should separate selection/adoption from execution: audit exact material and raw-source use first, then assess the matching business paths. For S2, preserve this fixed-bundle result and, if pursuing it, introduce a separately versioned mechanism-matched example arm for clock/lifecycle behavior. Keep model, task data, runtime and repair budget fixed; do not add H2 capabilities at the same time and attribute the change to the example.
