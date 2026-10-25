# DIL streaming compilation

CardSpec v1 is the default. The original DIL path remains selectable explicitly.

`{@body ...}` starts at a line boundary and ends at its matching brace. Data
declarations may span lines and contain nested objects, quoted strings and
comments. While a directive is incomplete, the parser defers its entire tail;
it does not reinterpret data as visible markup. Setup expressions retain the
existing JavaScript execution semantics in the client runtime.

Conversation prose is separated using the same parser's structural offsets.
Pending directives, tags and control blocks stay in markup until complete.
This prevents data and unfinished nested text from becoming an outro.

At the end of a DIL generation, the server checks parser diagnostics and the
compiled program's JavaScript syntax without executing it. Structural or
syntax errors terminate the phase as failed, with diagnostics and original
source retained. This check does not prove runtime or business semantics.

For generated filters, the prompt requires explicit category IDs and item
membership instead of matching labels against unrelated descriptive fields.
Rendering and counts should share a filtered collection, including an empty
state. The engine never invents category mappings from domain-specific names.

Regression coverage: `tests/dil.test.mjs`, `tests/browser/dil.spec.mjs` and the
domain-independent product fixture in `tests/dil-fixture.mjs`. Saved real
envelopes can be replayed with `node scripts/check-dil.mjs [server-url]`.
