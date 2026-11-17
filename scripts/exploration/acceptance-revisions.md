# Independent evaluator revisions

## r1

Frozen task/oracle files are separate from generator requests. Task arithmetic, identity, recovery and semantic paths are independently checked. Ambiguous controls and semantic mappings remain unverified. Graphic state is not inferred from element existence or a copied business-state field.

## r2 — evaluation plumbing and layout aggregation

Evidence: the first B1 recording-kit replay passed saved-state assertions but had 87 px inner overflow after selection. The original aggregate excluded all `layout-*` checks. This violated the task book's existing whole-card visibility gate.

- Preserve all earlier r1 reports and browser evidence.
- Expose `businessStatus` and `layoutStatus` separately; whole-card `status` includes both.
- Include disallowed, nondecorative inner overflow and intermediate action layout failures.
- Missing initial/final DOM measurements are unverified, not passed.
- The water arithmetic self-test now asserts `businessStatus: passed`, `layoutStatus: unverified`, `status: partial` because it intentionally contains no real DOM evidence. Its expected business values and frozen oracle are unchanged.
- Added regression: a known 87 px layout failure cannot be overridden by unrelated passing checks.
- Read `snapshots.json` beside the run when no explicit snapshot path is present.
- Batch mode defaults to dry-run and is serial when explicitly started. Completed independent evaluations are skipped; no model calls or product changes.

No task endpoint, formula, dataset, expected entity or oracle hash changed.

## r3 — explicit replay policy propagation

`evaluate-run.mjs` reads the frozen run request's `replayMode`, records it in the evaluation manifest, and passes it unchanged to every behavioral browser replay and `layoutChecks`. `layoutChecks` passes the same mode to all six layout renders. Same-run `snapshots.json` records, including their replay metadata, are preserved as loaded; no synthetic substitute or looser input matching is introduced by the evaluator.

This revision changes evaluation plumbing only. Syntax validation and the ten independent evaluator tests passed; no browser, model or external tool ran during the change.
