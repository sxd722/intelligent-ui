# Source export and privacy boundary

This repository begins with a new, source-only commit. It contains no previous Git history.

Included: renderer, CardSpec/DIL compiler and contracts, generation services, tool adapters, authored H5 baselines, synthetic test fixtures, build/QA scripts, architecture documentation, and the reusable card skill.

Excluded: API key files, local environment files, credentials, browser profiles and bindings, cookies, caches, tool binaries, installed dependencies, generated bundles, raw model traces/reasoning, tool-response archives, conversation and feedback records, screenshots, generated report datasets, local agent job state, and the separate hosted-site checkout.

Machine-specific user paths were anonymized. Private model gateway, hosted-site, and tailnet addresses were replaced with examples. Configure your own endpoint and credentials in `.env.local`; this file is ignored. The local working application's credentials and runtime state were not deleted or modified by this export.

The source snapshot was checked with Gitleaks 8.30.1 (official release archive checksum verified), followed by targeted checks for private endpoints, local identity, credential files, and staged contents. A clean scanner result is not a guarantee that arbitrary future files are safe: inspect staged files before every push. Do not force-add ignored runtime data.

Historical replay tests may require deliberately excluded local artifacts. Such cases must report skipped, never passed, when their data is absent. Generated report/workbench pages may be empty until new local runs populate their datasets. Core app, authored baselines, and compiler fixtures remain source-controlled.

No production deployment or public ingress is created by cloning or building this repository. The application is a local experimental development tool; review tool permissions and generated-code boundaries before enabling network access or exposing it to other users.
