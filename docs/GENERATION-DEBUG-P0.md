# Generation debug P0 — 2026-10-22

## Scope and design

Keep the existing bounded generation service and optional debug flag. Reduce
unnecessary source rewriting and distinguish product errors from test-plan
errors. Preserve DIL, local port 8787, mock-only debug transport, and existing
OpenCLI/Owl state. No GPT Site deployment.

1. `card_test` stores a source hash, context hash, result and executed steps in
   the request-local candidate registry. `card_commit({version})` delivers that
   exact source without another output-generation round or duplicate browser
   run. Compile, tool allowlist, citations and other publication checks still
   run. Failed/unverified/foreign/stale candidates cannot commit. Partial
   results remain explicitly partial. Commit cannot share a turn with reads.
2. Debug controls belong to the visible `.cs-card` only. Component identity and
   repeated-item key form opaque handles. Handles survive label changes;
   model-supplied selectors and code remain forbidden. Normal steps do not run
   on empty/error fixtures unless explicitly assigned to those scenarios.
   Stop dependent steps after a failed locator, record skipped steps, and
   classify them as incomplete tests, never product failures or repair debt.
   Runtime errors and failed state restoration remain publication failures.
3. Compiler tolerance only preserves unambiguous semantics: literal `onClick`
   action references map to `onPress`; conflicting handlers/callbacks fail.
   `list-item` supports an accessible clickable row with visible label and
   structured children; buttons permit structured content. Nested interactive
   controls fail with a composition hint. Plain envelope commentary around one
   complete card becomes a traceable warning; multiple/incomplete cards,
   unknown markup and executable expressions remain errors.

## Verification

- 527 unit regressions passed, recorded in `artifacts/p0-debug-tests.log`.
- Isolated browser checks: `scripts/qa-p0-debug.mjs`, results/screenshots in
  `artifacts/p0-debug-qa`. Old feed: 320/360/432 × square/auto; normal/empty/error;
  refresh → select → restore → back. Also duplicate names, changing labels,
  hidden controls, rich rows, dependency skipping, and independent replay of
  the new real-model artifacts.
- Real GLM: `DEBUG_QA_OUTPUT=artifacts/p0-debug-model node
  scripts/qa-generation-debug-model.mjs`. External tools disabled; CLI results
  are mock-only, not verified real data. Both candidates committed unchanged.
  Simulator: 25.1s / 2 calls / 0 repairs; feed: 43.2s / 3 calls / 0 repairs.
  Feed first guessed an incorrect button name, then used the returned handle
  to test the same source successfully. Prior samples: 46.5s / 3 calls / 1
  repair and 71.0s / 3 calls / 1 repair. Single runs are not a speed benchmark.

## Remaining boundaries

Debug is still opt-in. Browser pass is bounded mock interaction evidence, not
proof of data correctness, quality, full task coverage or live CLI availability.
Semantic fixture enrichment and task-specific expected-result assertions are
the next step, not included in P0. Dynamic handles for controls without a
component identity are best effort and cannot promise identity across layout
changes. Deployment status must be reported separately from code/test status.

## Local activation status

The earlier restart attempt was rejected and did not execute. On 2026-10-22,
after the user explicitly requested the local update, a fresh build and scoped
restart activated the latest backend on 8787 (PID 31176). AGENT_WORKBENCH=0
prevented the restart from starting/resuming the separate Trae queue. Health
confirms CardSpec and DIL. The checkpoint preserved daemon 18836/profile r7cf8suq;
its pre-existing bound-mode/unbound state is unchanged. No publication was
performed during this local maintenance task.

The parallel suite had one isolated-JS time-budget failure under load; its
targeted rerun passed 20/20, and a serial full rerun passed 527/527 without
changing execution limits. Logs: artifacts/local-update-build.log,
artifacts/local-update-tests.log, artifacts/local-update-tests-serial.log.
The P0 browser replay was rerun against the fresh build in an isolated browser;
results are in artifacts/local-update-browser-qa.log and artifacts/p0-debug-qa.

## Skill alignment and Trae inspection (2026-10-22)

The project skill now links an on-demand cardspec-generation guide: index-first
contract discovery, contract-based mock-first layout, tested-version commit,
and product/test-plan/external-failure classification. This adds no mandatory
model call or default system-prompt text. It was validated and synchronized to
the active round2 workspace; older round1 evidence remains unchanged. Sync does
not resume Trae or make the interrupted model automatically reread the skill.

Round2 PROGRESS records four candidates (movies, transformer, reading, family),
trains built/unit-tested with browser acceptance pending, and three pending
cases (podcasts, outdoors, sentiment). All four candidate evidence records pass
the completeness checker; independent acceptance remains outstanding. The
observed Trae window reports HTTP 504 Gateway Timeout / model request failure.
No retry, new task, model switch or queue mutation was performed.
