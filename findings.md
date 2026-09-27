# findings — toolprivacy

What each iteration learned, including negative results. The ledger of
proven/unproven/disproven is in `status.json`; this file carries the narrative
and the friction.

---

## Iteration 1 (Round 1 — BUILD)

Scaffolded the notebook and built the load-bearing gate. The headline pair is
green and red-before-green is mechanical (disable the purpose-mismatch check →
3 tests fail; restore → 8/8 pass). Receipts 01 and 02 written.

Key design decision: **purpose-binding, not presence.** The first instinct is
"redact any private value that appears in outbound text." That is wrong, and the
negative result below proves it: the *same* email is legitimate in the invite it
was fetched for and a leak in an unrelated summary. Presence is identical in both
cases. Only the bound-purpose vs. sink-purpose comparison separates them.

Safety technique carried from a credential-leak-guard: the gate's own
output must never re-leak the secret. Verified by asserting the serialized
verdict contains neither the raw value nor a recognizable fragment, only an
`fnv1a:` fingerprint. A gate that prints the secret in its violation report would
be a second leak.

> Superseded: this fnv1a mechanism was later disproved (the fingerprint was brute-forced) and removed entirely — see NR-2 and receipts/05.

---

## flare-ui / `@cloudflare/gen-ui` feedback

This section captures **real, hands-on friction** from building the dogfood
surface (`app/`) against the `@cloudflare/gen-ui` (cloudflare/eti/flare-ui)
consumption pattern. It is for Jordan to relay to the owning team. flare-ui is
**read-only** here — we consume the package, we do not edit it.

> These notes are from actually building `app/` (Round 2), not speculation.
> Reproduction commands are included so the team can confirm.

### Feedback #1 — package now resolves (RESOLVED ✓)

> **UPDATE (Round 3): RESOLVED.** The package shipped to **public npm** as
> **`jsx2ui`** (not `@cloudflare/gen-ui`). `bun add jsx2ui` succeeds and the
> render path now goes through the **real package**: `app/` renders the whole
> page with `createCatalog(...)` + `Renderer` from **`jsx2ui/react`** (wired in
> `catalog.tsx` and `App.tsx`). The local render shim (`app/src/genui/react.tsx`)
> is **deleted**; only a thin `ui()` authoring helper remains (`genui/core.ts`),
> and it now builds — and re-exports — the package's own `UINode` type. The 404
> below is historical context for the owning team.
>
> **One residual packaging bug in `jsx2ui@0.0.3`** (worth flagging upstream): the
> published `package.json` `exports` map points at `./src/...` (e.g.
> `"./react": "./src/react/index.tsx"`), but `files` only ships `dist`, so `src`
> is **not in the tarball** — `import 'jsx2ui/react'` fails with *Cannot find
> module*. The `publishConfig.exports` block (which correctly points at `./dist`)
> was evidently **not applied at publish time**. Workaround in this notebook: a
> committed **`bun patch`** (`app/patches/jsx2ui@0.0.3.patch`) rewrites `exports`
> (and `types`) to `./dist/*`. **Ask:** republish so the top-level `exports`
> resolve to `dist` (or run publish so `publishConfig` is honored); then the
> patch can be dropped.

This was the original headline friction: **I could not install the package at all.**

- `bun add @cloudflare/gen-ui` → **404** from
  `https://registry-gateway.cloudflare-ui.workers.dev/@cloudflare%2fgen-ui`.
- It is **not the registry being down or auth failing** — sibling `@cloudflare/*`
  packages resolve fine from the *same* gateway in the *same* shell:
  - `bun pm view @cloudflare/workers-types version` → `4.20260629.1` ✓
  - `bun pm view @cloudflare/vite-plugin version` → `1.42.3` ✓
  - `bun pm view @cloudflare/gen-ui version` → **404** ✗
- It is also **not on public npm** (`registry.npmjs.org` 404s too), so the local
  `.npmrc` `@cloudflare:registry=…npmjs.org` override does not help either.
- Probed name variants — all 404: `@cloudflare/gen-ui`, `@cloudflare/genui`,
  `@cloudflare/flare-ui`, `@cloudflare/gen-ui-react`.
- **Ask for the team:** what is the *exact* published package name + registry +
  access group for gen-ui? A one-liner in the flare-ui README ("install with
  `bun add <name>` against `<registry>`, requires ACL `<group>`") would unblock
  external consumers immediately. Right now the documented name (`@cloudflare/gen-ui`)
  is unfindable from a configured Cloudflare dev machine.

**Consequence at the time (now superseded):** to still dogfood the *pattern* (and
keep the build green) I wrote a small local adapter (`app/src/genui/core.ts` +
`react.tsx`) mirroring the documented contract — `core`: model-JSX → UI-JSON;
`react`: `renderUI(uiJson, catalog)` → React. **The swap is now done**
(Round 3): the render shim is deleted and rendering goes through the real
`jsx2ui/react` `Renderer` + `createCatalog`. Because everything downstream
(`catalog.tsx`, `page-ui.ts`, `verdict-to-ui.ts`) was written to that contract,
the drop-in was clean — the package's `UINode` shape (`{ type, props, children }`)
matched the shim's exactly, so only the *render* call sites changed.

### Feedback #2 — entrypoints now confirmed against the real package (RESOLVED ✓)

> **UPDATE (Round 3):** with `jsx2ui` in hand the entrypoints are confirmed.
> The React renderer is **`jsx2ui/react`**, exporting `createCatalog(components)`,
> `Renderer({ node, catalog })`, `InteractiveRenderer`, `GenUIStateProvider`, and
> the `UINode` type. The core/model side is `jsx2ui` (`transformJsxToJson`,
> `defineComponents`, `buildSystemPrompt`) and the AI-SDK server bits live under
> `jsx2ui/ai-sdk` — not needed for this static demo, which authors `UINode` trees
> directly and renders them with `Renderer`. The node schema matched my inferred
> `{ type, props, children }` exactly.

- (Original ask, now satisfied by the published types) The earlier friction was
  that with the package unavailable I had to **infer** the import specifiers, the
  catalog-registration API, and the UI-JSON node schema from example descriptions.
- **Still worth doing:** publish the `UINode` schema and `createCatalog` signature
  in human docs (not only `.d.ts`), so consumers can build to the contract before
  they `bun add` — and document the residual exports-map bug fix from #1.

### Feedback #3 — the catalog + worker/schema shape is good; document it as the contract

- Modeling `app/` on the example shape (**Vite + React + worker/ + catalog +
  worker/schema**) worked cleanly. "Model emits UI-JSON `type` keys; host binds
  keys → its own components" is a nice separation; an unknown-type **fail-safe
  fallback** turned out to be essential (a model can emit a node the host catalog
  doesn't define) — worth shipping in the renderer by default.
- **Confirmed in the real `jsx2ui` `Renderer` (Round 3):** an unknown node type
  does **not throw** — the renderer `console.warn`s `Component "<type>" not
  found in catalog` and renders `null` for that node, while sibling
  text/children still render (verified with `renderToStaticMarkup`). That is a
  reasonable fail-safe, though quieter than the local shim's **visible** marker
  (`[unknown gen-ui node: <type>]`). **Possible ask:** an opt-in visible
  placeholder (or `onUnknown` hook) would make missing-catalog-entry bugs obvious
  in the UI, not just the console.
- Our gate `Verdict` (already redaction-safe — no raw value, no value-derived
  token) maps to UI-JSON with zero extra plumbing (`verdict-to-ui.ts`), which is
  a good sign the gen-ui boundary is at the right layer.

### Feedback #4 — React-only vs. my svelte-hono default (structural, confirmed)

- Confirmed hands-on: every example is React, there is no Svelte renderer, so I
  dropped to **React for this one surface** (my default per `MY_REPO_SHAPE.md` is
  svelte-hono). Because my local adapter's `core` (UI-JSON) layer is plain data,
  a Svelte renderer over the same UI-JSON would be straightforward.
- **Ask:** is the real `core` entrypoint framework-agnostic (UI-JSON is just
  data)? If so, a documented "bring your own renderer" path would let svelte-hono
  users adopt gen-ui without switching frameworks for one panel.

### Feedback #5 — authoring a WHOLE page through UI-JSON (10x dogfood friction)

Round 1b pushed gen-ui past "render the verdict" to "render the entire
explainer + interactive surface as one UI-JSON tree" (`app/src/page-ui.ts`,
rendered via `renderUI(catalog)`). New, hands-on friction from doing that:

- **Interactivity vs. a pure data tree (the central tension).** UI-JSON is plain
  serializable data, so a node *cannot* carry a function prop — but a live
  scenario runner needs an `onClick`. There is no documented pattern for this.
  I resolved it with a host-side `ScenarioContext` (`scenario-context.ts`): the
  picker is authored as DATA (which options exist, which is active) and the
  catalog component pulls behavior from context. It works and keeps the tree
  serializable, but it is a convention I invented. **Ask:** document the blessed
  way to bind events/handlers to UI-JSON nodes (action ids dispatched to a host
  handler map? a slots API?). Every non-trivial generative surface hits this on
  day one.

- **Embedding a dynamic subtree into a static tree.** The page is authored once;
  the verdict changes per run. Passing the verdict subtree in as a child of the
  page builder (`buildPage({ verdictTree })`) was clean, but only because `ui()`
  accepts pre-built `UINode` children. **Ask:** confirm/encourage this
  composition (builders that accept sub-trees) in docs, and clarify whether
  there is a "slot"/placeholder node concept so a tree can name where a host
  injects a subtree without the builder owning it.

- **Structured props beyond strings.** Real components need array/object props
  (`FlowDiagram.steps: string[]`, `Legend.items: {term,plain}[]`,
  `ScenarioPicker.options: {key,label}[]`). The catalog receives these as
  `unknown` and must defensively narrow each one, which is verbose and easy to
  get subtly wrong. **Ask:** publish the UI-JSON prop **type** story — are props
  typed per catalog entry, or is runtime narrowing expected? A typed catalog
  registration API (component + prop schema) would remove a whole class of
  boilerplate and footguns.

- **No-children vs. empty-children ambiguity.** `renderUI` passes `undefined`
  when a node has no children; layout components (`Section`, `Hero`) had to treat
  "no body" gracefully. Minor, but a documented convention (always-array
  children, or a `leaf` marker) would help.

- **The "view the UI-JSON" affordance is worth shipping in the framework.**
  Adding a toggle that dumps `toUIJSON(tree)` turned the page genuinely
  inspectable and was the single best honesty/debug tool. **Ask:** ship a
  first-class dev affordance (or devtool) that renders the live UI-JSON next to
  the output. It makes "is this actually data-driven?" answerable at a glance.

- **Where to humanize jargon.** Translating internal terms to plain labels
  (`boundPurpose` to "fetched for") belongs at the model/mapper step
  (`verdict-to-ui.ts`), not in the catalog — keeping the catalog about layout
  and the mapper about meaning. This separation felt right; worth stating as
  guidance so teams don't bake copy into components.

Net: the pattern scaled to a full page without fighting it, and the data-driven
claim is now provable on screen. The friction is all at the **interactivity and
typing** seams — and these now apply to the **real package** (`jsx2ui`), which is
consumed here as of Round 3 (#1 RESOLVED), not a local shim. The asks above
(handler binding, slot/placeholder nodes, typed catalog registration) are the
places where `jsx2ui` could most improve the consumer experience.

---

## Negative results

Recorded so they are not re-discovered. A negative result is a first-class
artifact (see `MY_REPO_SHAPE.md`).

### NR-1 — Substring-presence-only detection is insufficient (verified-disproved)

- **Hypothesis tested:** "Flag any outbound occurrence of a fetched private
  value" is enough to catch leaks.
- **Result:** disproved. Under presence-only logic, the benign in-purpose use
  (email fetched for `send_calendar_invite`, then placed *into* the invite tool
  call) is flagged identically to the leak (same email in an unrelated summary).
  Presence is byte-identical in both; the only separating signal is the
  declared-purpose-vs-sink-purpose comparison.
- **Consequence:** purpose-binding is load-bearing, not decorative. The gate
  tracks `boundPurpose` per value and consults `PURPOSE_COMPATIBILITY`.
- **Receipt:** `receipts/02-substring-only-insufficient.json`.

### NR-2 — The unkeyed 32-bit fingerprint was NOT non-reversible (verified-disproved)

- **Hypothesis tested:** the round-1 verdict's `fnv1a:` token (unkeyed 32-bit
  FNV-1a of the private value) is "non-reversible", so emitting it is safe.
- **Result:** **disproved.** Reproducing the round-1 `fnv1a()` and forward-
  searching the structured US-SSN space (3-2-4 digits, ~10^9 ≈ 30 bits)
  recovered the **exact** planted SSN preimage in **123,456,789 iterations /
  21.3s**, single-threaded, in bun. For low-entropy fields a 32-bit unkeyed
  digest is trivially reversible by exhaustive search. (Dane reached the same
  result independently in R2.)
- **Consequence / fix:** the fingerprint was **removed entirely**. A violation
  now carries only `{sinkId, sinkKind, fieldPath, privateClass, boundPurpose,
  observedPurpose, reason}` — no hash, no value-derived token. With no
  secret-derived bits in the verdict, there is nothing to invert; this is
  *provably* non-reversible (two different secrets of the same class/flow yield
  byte-identical verdicts — see `test/gate.test.ts → NON-REVERSIBILITY`).
- **If cross-receipt correlation is ever needed** it must use a **keyed HMAC
  with a per-run random salt that is never emitted**, not an unkeyed digest.
- **Rule generalized:** a leak-guard's own output must contain *no value-derived
  token*, not merely "no raw value".
- **Receipt:** `receipts/05-fingerprint-reversible.json`. No raw secret and no
  fingerprint are stored in the receipt.

### NR-3 — False positive: digit runs misread as payment cards (fixed)

- **Observed (Dane R2):** a 13-19 digit order ID / concatenated digit run was
  flagged as a `payment_card` (the detector matched any 13-19 digit group), and
  the `digitsOnly(sink)` normalization could substring-match a long digit run.
- **Fix:** `payment_card` now requires a **Luhn-valid** 13-19 digit run with
  digit boundaries; `phone_number` requires **phone-shaped grouping** (a `+`
  prefix or NANP separators) rather than any bare 10+ digit run. A 16-digit
  order ID now classifies as nothing (`trackedFields = 0`); a Luhn-valid
  synthetic card (`4111…`) is still caught. See the false-positive-control tests.
