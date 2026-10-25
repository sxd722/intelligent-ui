# Intelligent UI — Generative Interactive Cards

A local-first experimental engine for model-generated interactive cards. It supports **CardSpec v1**, the legacy **DIL** path, isolated JavaScript logic, React/SVG sandbox views, host-owned design presets, tool bindings, and persistent card navigation.

## Run locally

Use Node.js 22 or newer and npm. Model and Pexels credentials stay on the server.

```bash
npm ci
# Copy .env.example to .env.local; set MODEL_BASE_URL and MODEL_API_KEY.
npm run build
npm start
```

Open http://127.0.0.1:8787/. For development, `npm run dev` starts Vite on 5173 and the API on 8787. The supplied endpoint is an intentionally invalid placeholder: bring your own OpenAI-compatible model gateway and supported model IDs. Deep/Flash profile names reflect the original development gateway and may need adapting for another provider.

Optional credentials: `PEXELS_API_KEY` enables image search. `APIKEY_FILE` and `PEXELS_API_KEY_FILE` can reference private files outside this repository. Never place credentials in frontend source or commit `.env.local`.

## Main capabilities

- Declarative CardSpec compilation, state/actions, derived data, progressive layouts, diagrams, charts, forms, and interactive collections.
- Optional isolated JS logic and React/SVG enhancement, with host-controlled state, effects, and error recovery.
- Direct, experience-planning, and staged generation modes with bounded tool research and iterative validation/repair.
- OpenCLI and other host-managed tools, explicit structured parameters, local connection setup, cancellation, refresh, and provenance.
- Multiple visual style families; square or natural-height cards; persistent page/deck navigation.
- Authored H5 and native CardSpec baselines, a workbench, and reusable Trae card-development skill.

## Useful pages

- `/` — free generation
- `/cardspec-lab.html` — compiler and component fixtures
- `/design-templates.html` — host design presets
- `/h5-baseline/index.html` — authored interactive H5 baselines
- `/cardspec-baselines.html` — authored native CardSpec baselines
- `/opencli-probe.html` — explicit local browser connection setup
- `/workbench.html` and `/agent-workbench.html` — local evaluation/agent workflows

Historical generated results and user feedback are deliberately not bundled. Review/workbench pages that depend on those datasets become populated after new local runs. Authored baseline sources remain included and are rebuilt by `npm run build`.

## Tools and verification

```bash
npm run tools:install  # optional OpenCLI installation
npm test              # deterministic compiler/runtime tests
npm run test:e2e      # requires Playwright browser installation
```

Browser-backed CLI commands require your own compatible browser bridge and, where applicable, site login. The repository includes neither login sessions nor binding leases. Real-model QA scripts can consume model credits and perform tool reads; inspect their prompts/configuration before running. Some historical replay tests are explicitly skipped without their excluded private artifacts.

This is a local development/demo system, not an internet-hardened multi-user service. Do not expose it publicly without separately reviewing authentication, tool permissions, and generated-code execution boundaries. Building this repository does not deploy GPT Site or alter a browser connection.

## Architecture and specifications

- [CardSpec contract](docs/CARDSPEC.md)
- [Schema definition](docs/specs/cardspec-schema.md)
- [Prompt specification](docs/specs/glm-prompt-spec.md)
- [Generation service and card deck](docs/GENERATION-SERVICE-AND-CARD-DECK.md)
- [React sandbox](docs/CARDSPEC-REACT-SANDBOX.md)
- [Tool bindings](docs/tool-bindings.md)
- [Reusable interactive-card skill](.trae/skills/interactive-card-baseline/SKILL.md)
- [Export and privacy boundary](EXPORT-PRIVACY.md)

Original architecture notes are preserved in [ARCHITECTURE-LEGACY.md](docs/ARCHITECTURE-LEGACY.md); dated behavior and report links there may refer to the original local workspace.
