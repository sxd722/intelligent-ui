# Source snapshot validation — 2026-10-25

## Completed

- Fresh `npm ci --ignore-scripts --no-audit --no-fund` in the sanitized source directory.
- `npm run build`: passed, including sandbox runtime, authored H5 baselines, native baselines, and Vite bundles. Vite reports large-chunk warnings; these are not build failures.
- `npm test`: 565 tests; **550 passed, 6 failed, 9 skipped**.
- All three new portable credential-configuration tests passed.
- Seven skips require excluded historical model/tool trace artifacts. Two skips require the optional locally installed OpenCLI package. These tests remain enabled when the corresponding local inputs exist; skips are not counted as passes.
- Gitleaks 8.30.1 source scan: no findings. Exact Git history is scanned again before upload.
- Targeted checks found no original machine username, private model gateway address, private tailnet domain, or original hosted-site address in the export.

## Six known existing failures

The same six failures were reproduced by running these three test files against the original project before publication. They were not suppressed or fixed as part of the privacy export:

| File | Existing failure |
|---|---|
| `tests/design-recipes.test.mjs` | Shared design disclosure exceeds an older prompt-length assertion. |
| `tests/generation-viewport.test.mjs` | Two assertions expect unbounded natural height (`null`), while current behavior uses a 708px budget. |
| `tests/style-protocol.test.mjs` | Two assertions expect rejection of visual settings now accepted by the current implementation. |
| `tests/style-protocol.test.mjs` | Cached Pexels metadata drops undefined fields, causing deep equality to differ from the uncached object. |

This is a buildable source snapshot, not a claim that the entire existing regression suite is green. No new model generation, live-site login, purchase, or browser rebinding was required for the export. The running application on port 8787 was not restarted.
