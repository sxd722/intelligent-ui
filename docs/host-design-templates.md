# Host-owned design variations

New generations choose `design="default|pearl|atlas|rebel"`. Display names are 默认 / 月距力 / 动态学术 / persona. Existing atmospheric, friendly, cinematic and editorial values remain accepted for old cards. No model CSS, layout tree, shader, extra planning call or new state contract is required.

## Composition and adaptation

`shared/cardspec/layout-templates.mjs` registers versions, names and trusted decorations. `projectTemplate` promotes only a leading unscoped title/caption/badge group. Everything else retains its AST order, expression scope, identity and original event handler. Conditional, repeated and local-logic containers are never flattened. A nested/absent title or title-only card retains the default layout with its selected color recipe.

`TemplateLayout.jsx` provides the editorial hero and shared interaction body; `templates.css` provides the three complete compositions. Native components render once inside that body, using the existing store, tools, error boundaries and component view state. The template scroll position is saved in the page view state. Unknown or failed components remain locally recoverable.

Art geometry scales proportionally with card width. Square mode uses a shorter hero; typography and touch targets have minimum sizes. The body scrolls inside the card if necessary, with the existing edge/scroll affordances. Natural template content is bounded at 656px (additional host tools/history controls retain their own space and may extend the complete card). No content is deleted to fit. This is an adaptation of the reference language, not a claim that a 1000px reference is pixel-identical in a 432px square.

月距力 uses the supplied reference's host shader with corrected premultiplied alpha; a bounded Canvas mesh is the fallback. Rendering is capped at 20fps, DPR 1.25, 420×375px and pauses offscreen/hidden/reduced motion. 动态学术 transforms only real heatmap cells, lifts the selected row and preserves exact numeric events; it does not invent matrices for unrelated content. persona uses decorative SVG paper shapes, halftone, selection slips and existing host cut-paper transitions. Decorative art is hidden from accessibility APIs and has no tool privileges.

## Adding a verified variation

1. Save the reference, brief and intended tasks. Specify a stable ID/version in the layout registry and matching `DESIGNS` recipe. Keep the public disclosure short.
2. Add scoped host CSS and, if needed, one bounded trusted effect. Reuse native controls and actions. Do not match domain keywords or duplicate business state in a template.
3. Include a meaningful fixture plus another domain using the same design. Verify 320/360/432px in square/auto, content access, exact event values, state/scroll restoration, keyboard, reduced motion and visual failure fallback. Record screenshots and trace.
4. Add the variation to the generator's recommended list only after review. A new variation need not change the DSL version. Keep old IDs readable. Never label an author self-test as independent acceptance or training gold.

Preview: `/design-templates.html`; same-content toggle distinguishes composition from content quality. Evidence: `/design-template-review/`. Current fixtures are teaching/simulation data, not live tool or model-quality claims.
