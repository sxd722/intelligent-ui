# Optional React surface inside CardSpec

Implemented locally on port 8787. DIL is unchanged. Nothing is published to GPT Site.

## Native CardSpec remains the baseline

The toolbar's **UI** setting defaults to **仅 CardSpec**. In this mode, planning and generation explicitly require native components, actions and isolated `logic`. The compiler rejects `sandbox`; the normal one-repair path can turn a mistaken sandbox output into native UI. This policy also applies to next pages and generated siblings. Slots remain native in this first version.

Select **CardSpec + React 沙箱** to allow optional enhancements. Each sandbox must contain native content **and interaction controls** that implement its task. Generation instructs the model to place all related controls and results in that subtree. The host shows native content while generating and on failure. Users can switch presentations. Native and React progress are independent and this is stated in the UI; switching does not copy or reconcile business state.

For a deployment that prohibits web surfaces, set `CARDSPEC_SANDBOX_ENABLED=0` before starting the server. The server refuses sandbox generation and compiles new cards in native mode. Its capability response also disables the UI option and prevents restored hybrid cards from starting a Worker/iframe. Missing capability discovery fails closed. Existing CardSpec actions and `logic` continue to operate.

## Small declaration, separate code generation

```xml
<card>
  <state id="n" type="number" initial={0}/>
  <sandbox id="counter" label="Visual counter" height={260}
    brief="Display a visual counter. Add increments by one; reset restores zero. Include both controls."
    input={{}} initial={{n:0}}>
    <stat label="Count" value={state.n}/>
    <button onPress="add">Add</button>
    <button onPress="reset">Reset</button>
  </sandbox>
  <action id="add"><increment target="n"/></action>
  <action id="reset"><set target="n" value={0}/></action>
</card>
```

One sandbox per card, explicit ID, fixed literal brief, height 160–480. No nesting or placement inside `each`, `logic` or `slot`. The brief includes behavior, boundaries and reset; the initial CardSpec contains no React source.

Only a complete, visible card in hybrid mode starts the asynchronous `glm.generate` surface request. Compilation and streaming previews execute no tools. The call receives the brief and explicit JSON inputs, not the whole conversation. JSX compilation, Tailwind generation and VM preflight precede publication. There is at most one repair. Changing `input` updates the running component without another model call. Leaving the page or hiding the tab cancels generation and stops the Worker; stale responses cannot commit. Interrupted/failed generation is retried manually.

The generated component is plain React:

```jsx
export default function App({data, state, setState}) {
  return <button className="rounded-lg px-4 py-2 bg-teal-600 text-white"
    onClick={() => setState(s => ({...s, n:s.n+1}))}>{state.n}</button>
}
```

Use `state/setState` for host-restored progress. React's own hook state is transient. Inputs are copied JSON, not host object handles. Static Tailwind utilities, inline styles, standard local controls and a restricted SVG vocabulary are supported. No imports, DOM refs, canvas, media URLs, external packages or real timers. Native CardSpec continues to own images, tools, links and external operations.

## Isolation and recovery

Generated JS executes in QuickJS in a dedicated Worker. Trusted bundled React and its renderer produce a bounded JSON UI tree. **Generated JS never executes in the iframe.** The opaque `sandbox="allow-scripts"` iframe runs only a trusted DOM patcher, receiving whitelisted nodes, scalar props, styles and event IDs. Message source, channel token and revision are checked. Event delivery is serialized; rapid input is coalesced without replacing focused controls.

The VM has no host callbacks or module loader and no `fetch`, XHR, WebSocket, Worker, DOM, storage, Node or tool capabilities. The iframe CSP separately denies network, frames, media, fonts, forms and objects. URLs, HTML injection and unsupported nodes are rejected before rendering. This is a capability boundary, not a JavaScript keyword denylist.

Limits: source 20,000 chars, compiled JS 36,000 chars, CSS 70,000 chars, state 64 KiB, 800 UI nodes, VM memory 64 MiB, initialization 1.5 s, event/input evaluation 150 ms; the browser also terminates unresponsive Workers. Failed rendering or events show native content and preserve the last valid saved state. Reduced-motion preferences disable CSS animations and transitions.

Module code, CSS and persistent state use the existing page view-state/sessionStorage mechanism. Restoring a generated surface does not call GLM again. Failed/interrupted requests are not replayed. Storage quota limitations follow the existing session warning behavior.

## Validation and limits of the guarantee

- `tests/sandbox.test.mjs`: native policy, fallback validation, equivalent simulator actions, React state/input/restoration, unavailable globals, hostile DOM/CSS, infinite loop, invalid state, bounded repair, native slot generation.
- `tests/browser/sandbox.spec.mjs`: real Worker/iframe interaction, restore without generation, failure isolation, native host policy, fast input/multi-step forms, 320/360/432px in square/auto sizing.
- `scripts/qa-sandbox-live.mjs` and `qa-sandbox-ui.mjs`: real GLM native/hybrid generation, async React generation, advance/reset/depletion/charge behavior; sources and traces under `artifacts/sandbox-qa`.

Structural validation cannot prove arbitrary generated business logic or native/React equivalence. Live QA exposed an output with sibling fallback controls; the contract and compiler now reject missing controls inside the fallback. A later generated component also failed a reset observation during development; it was not counted as passing. Final retained sources are tested separately. Treat hybrid as optional, evaluate the task's actual behavior, and retain pure CardSpec as the complete deployment path.

Extended native/DIL browser checks: 16/17 after updating stale pipeline selection, research-system classification and cancellation expectations in the fixture harness. The remaining `precision/c` selected-control contrast assertion reports 1.16 versus 4.5; native theme styles were not changed in this work. This is tracked separately and the full browser suite is not claimed green.
