# Roolith JS - Feature TODO

Status: decisions confirmed. Reactivity is dropped from scope; rendering stays one-shot.
Last updated: 2026-11-16.
Scope: this file plus `app/tests/`, demo pages, and fixture views as described below.

Baseline today: `r-view` loading with nested views, `r-data` scoped data, `r-for` loops, `{path}` interpolation, request dedupe per render pass, lifecycle events (`r-view:rendered`, `r-view:error`, `r-view:ready`), and a single render pass on `Roolith#run()`.

## Confirmed decisions

- Only `r-if` is added. There is no `r-show`.
- Expressions use JS-like logic without `eval`: paths, `!`, `&&`, `||`, comparison operators, parentheses, and literals. Example: `isOpen && isAdmin`.
- Loop metadata is `$`-prefixed: `$index`, `$first`, `$last`, `$length`.
- `r-remote` works on any element and on `<r-view>` as an alternative to `src`.
- HTML remote responses render into the target. JSON responses feed the target scope.
- JSON detection uses `Content-Type` as the signal.
- `r-data` and remote JSON merge, with remote JSON winning.
- Remote HTML is trusted the same way as `r-view`. If CORS allows the request, the content renders. No sanitizer in v1.
- `r-remote` is GET only.
- Shadow DOM is opted into with the boolean `r-shadow` attribute and is always open.
- Only the loaded view content enters the shadow root. Placeholder children are discarded. No slot forwarding in v1.
- Styles inside a shadow view stay in the shadow root.
- Rendering stays one-shot. The first `Roolith#run()` pass evaluates every directive once. Data changes after that are not observed, and there is no reactivity layer or `update()` API.
- Tests live in one directory, `app/tests`, and cover both existing and new behavior.
- Each feature gets its own demo HTML page and its own fixture views.

## Feature status

Status values: Not started, In progress, Blocked, Done.

| Phase | Feature | Status | Depends on |
| --- | --- | --- | --- |
| 0 | Test foundation | Done | - |
| 1 | Expression evaluator | Not started | - |
| 2 | `r-if` and `r-else` | Not started | Expression evaluator |
| 3 | Loop metadata | Not started | - |
| 4 | `r-remote` | Not started | - |
| 5 | Shadow DOM views | Not started | - |
| 6 | Demos and fixtures | Not started | 0 to 5 |
| 7 | Docs and release | Not started | 0 to 6 |

## Shared principles

- Directives stay declarative and safe: no `eval`, no `new Function`, no code execution.
- Data resolution order stays consistent: element `r-data` overlaid on ancestor scopes and root `data`.
- Every new directive gets a configurable attribute name in `RoolithSettings` with an `r-` default, matching `loopAttribute` and `dataAttribute`.
- Directive attributes are consumed after evaluation so they do not leak into rendered DOM, matching `resolveElementData`.
- Directive failure policy:
  - On a plain element, keep the element in place, add a `data-r-error` attribute with the message, and `console.error`. Content is never silently removed.
  - On a view placeholder, use the existing error element path.
- `undefined` paths are falsy and never throw, consistent with interpolation.
- Anything not listed here is out of scope for this milestone.

## 0. Test foundation

Status: Done.

Purpose: establish observable verification before new behavior. This phase must land first so every later phase can be verified.

- [x] Add `vitest` and `happy-dom` as dev dependencies, with `test` and `test:watch` scripts. No test code is bundled because the build only follows `app/roolith.js`.
- [x] Add `app/tests/` with a small helper module for mounting inline HTML into `document`, constructing a `Roolith` instance with settings and data, stubbing `fetch` with response bodies and `Content-Type`, and awaiting a full render pass plus microtask flush.
- [x] Keep all tests flat inside `app/tests` so there is a single test directory.
- [x] Write regression tests for current behavior before touching it:
  - `resolveUrl`: relative, absolute, missing `src`.
  - Request dedupe for duplicate `src` in one pass.
  - Nested views, data inherited from parent scope, circular reference error.
  - Error element class name and failed view replacement.
  - `r-data` path form, object literal form, invalid literal, prototype safety.
  - Interpolation: missing and null keep the placeholder, functions are not called.
  - `r-for` on an element and on `<template>`, nested loops, invalid expression, non-array value.
  - Lifecycle: `rendered` for matching relative and absolute sources, disabled events throw, `ready` fires once.
- [x] Note any current behavior that tests reveal as a defect, and fix it in the same phase only when the fix is small and clearly correct.

Findings:

- Fixed: view request dedupe was scoped to one `getFragments` batch, so the same absolute URL loaded once at the root and once inside a nested view was fetched twice, while the intended contract is dedupe per render pass. One `requests` map now belongs to the render pass and is threaded through `render()` -> `renderNodes()` -> `renderFragment()` -> `getFragments()`. Regression tests cover a duplicate `src` in one batch, a root plus nested match, and two parent views that each embed the same source.
- Fixed: `View.renderErrorFragment` set `data-view-error` on the placeholder that the same method replaced, so the attribute never reached the DOM. The attribute now sits on the replacement error element alongside the configured error class. Tests assert it for load failures, network failures, circular references, invalid data, and invalid loops (invalid expression, non-array value, and missing path).
- Left unchanged: the request map's promises are shared, so a URL that fails once reports the same failure everywhere it is used in that pass. That matches the intended per-pass dedupe contract; there is no per-call retry.
- Left unchanged: an explicit request map is only created by `render()`. Calling `renderNodes()` or `renderFragment()` directly still starts a fresh map, so direct callers keep per-call dedupe.
- Left unchanged: interpolation placeholders still match `[\w.]+`, so `{ $index }` is not recognized until Phase 3 widens the pattern. Tests do not encode the current limitation as desired behavior.
- Left unchanged: `readDataPath` treats function values as missing and `resolveDataAttribute` never follows inherited members. Tests lock both in as prototype safety rather than change them.
- Left unchanged: a failed view still replaces its placeholder, so fallback children are dropped, and `console.error` plus the `error` lifecycle event remain the reporting channels. Plain-element directive failures use `data-r-error` only from Phase 2 onward.
- Left unchanged: the error element still assigns the message with `innerHTML`. Messages are built by the library from URLs, status codes, and error text, and can embed attribute text taken from trusted view markup, so no untrusted fetched data values reach `innerHTML`. Revisit this when `r-remote` starts reporting remote-content failures.

## 1. Expression evaluator

Status: Not started.

New module: `app/template/expression.js`.

Grammar:

```text
expression := or
or         := and ("||" and)*
and        := unary ("&&" unary)*
unary      := "!" unary | comparison
comparison := primary (("===" | "!==" | ">" | "<" | ">=" | "<=") primary)?
primary    := "(" expression ")" | literal | path
literal    := number | quoted string | true | false | null
path       := identifier ("." identifier)*
identifier := [A-Za-z_$][A-Za-z0-9_$]*
```

- [ ] Implement a tokenizer and a recursive-descent parser that produces an AST. No `eval`, no `new Function`.
- [ ] Implement evaluation with JS short-circuit semantics for `&&` and `||`.
- [ ] Reject function calls, assignment, arithmetic, object and array literals, and loose equality (`==`, `!=`) with clear messages.
- [ ] Reuse `readDataPath` for path lookup so inherited members stay unreachable.
- [ ] Export a single `evaluateExpression(source, scope)` entry point returning `{ value, paths }`.
- [ ] Tests: precedence, parentheses, negation, short-circuit with a missing path, string and number literals, comparison operators, every rejected syntax, and a malformed expression.

## 2. `r-if` with `r-else`

Status: Not started.

- [ ] Add `ifAttribute: "r-if"` and `elseAttribute: "r-else"` to settings.
- [ ] Evaluate `r-if` after the element's own `r-data` is resolved, so `r-data="{ open: false }" r-if="open"` works on one element.
- [ ] Truthy: render the element normally and remove the directive attribute.
- [ ] Falsy: remove the element and its subtree. Nested `r-view` elements inside a false branch must never be fetched.
- [ ] `<template r-if="...">`: render or remove the template content, not the template element.
- [ ] `r-else`: a bare attribute on the element immediately following an `r-if` element. It renders only when the `r-if` was falsy, and has no expression of its own. An `r-else` without a preceding `r-if` is a directive error.
- [ ] Invalid expressions follow the directive failure policy and do not remove content.
- [ ] Tests: true and false on element and template, view inside a false branch is not fetched, `r-else` both ways, `r-else` orphan error, `r-data` on the same element, expression using `&&`.

## 3. `r-for` index and metadata

Status: Not started.

- [ ] Widen the interpolation placeholder pattern to allow `$` in paths so `{ $index }` works. `readDataPath` and the data object tokenizer already accept `$`.
- [ ] In `expandLoop`, build item scope as `{ ...data, [name]: item, $index, $first, $last, $length }`. `$index` is 0-based.
- [ ] Nested loops shadow outer loop metadata inside their own body.
- [ ] Metadata is usable in `r-data` on a nested view, for example `r-data="{ position: $index, name: product.name }"`.
- [ ] Metadata must never leak through the loop's outer scope.
- [ ] Tests: interpolation with every metadata key, `r-view` inside a loop receiving `$index` through `r-data`, nested loops, empty array (`$length` 0, no output), and single-item first and last.

## 4. `r-remote`

Status: Not started.

- [ ] Add `remoteAttribute: "r-remote"` to settings.
- [ ] Before adding remote requests, introduce a small render-pass value object (`{ ancestors, data, requests }`) so `renderNodes()` and `renderFragment()` stop growing positional parameters and `r-remote` has a natural home.
- [ ] Allow it on any element and on `<r-view>`.
- [ ] Treat `r-remote` as the view source when present on `<r-view>` and `src` is absent. If both exist, both are loaded and `r-remote` wins as the content source.
- [ ] Fetch with GET, dedupe by URL per render pass like views, and respect the `viewCache` setting for HTTP cache behavior.
- [ ] Keep the placeholder content visible while the request is pending. Add `data-r-remote="loading"` during the request and remove it on completion.
- [ ] HTML response, detected by a non-JSON `Content-Type`:
  - Plain element: parse and render the markup as the element's new children, running `r-data`, `r-for`, `r-if`, interpolation, nested `r-view`, and `r-remote`.
  - `<r-view>`: render the markup exactly like view content.
  - Relative URLs inside remote markup resolve against the remote URL.
- [ ] JSON response, detected by `Content-Type: application/json`:
  - Merge the payload into the element scope as data, with the payload winning over `r-data` on the same element, then render the element children with that scope.
  - `<r-view>` with an object payload containing an `html` string uses `html` as view content and, when present, an object `data` key as scoped data.
  - `<r-view>` JSON without an `html` string renders `JSON.stringify(payload)` as text content, escaped as text, while still exposing the payload as scope data.
- [ ] Error handling:
  - Plain element: keep the placeholder content, set `data-r-error` with the message, and `console.error`.
  - `<r-view>`: use the existing error element path.
  - A failed remote load never aborts sibling views or the render pass.
- [ ] Remote content participates in circular reference detection using its absolute URL, so a remote document that includes itself fails predictably.
- [ ] Tests: HTML into a plain element, HTML into a view, JSON on a plain element merged over `r-data`, JSON on a view with `html`, JSON on a view without `html`, failure fallbacks, dedupe, and relative URL resolution inside remote content.

## 5. Shadow DOM views

Status: Not started.

- [ ] Add `shadowAttribute: "r-shadow"` to settings. Attribute presence, with any value, enables shadow rendering for that view.
- [ ] Load and render the view content before attaching it, so all directives work unchanged inside the shadow root.
- [ ] Attach an open shadow root and place the rendered content there.
- [ ] Discard placeholder children. No slot forwarding in v1.
- [ ] View `<style>` elements remain inside the shadow root, so styles are scoped to that view.
- [ ] Nested views inside a shadow root load relative to the view URL, as today.
- [ ] Lifecycle `rendered` events for shadow views include the nodes placed in the shadow root, and events remain observable on `document`.
- [ ] Document that `document.querySelectorAll` cannot see inside the shadow root, and that `onViewRendered` is the intended integration point.
- [ ] Tests: `shadowRoot` exists, host styles do not leak in or out, directives render inside, nested view loads, lifecycle nodes are usable, `r-shadow` combined with `r-if` and `r-remote`.

## 6. Demos and fixtures

Status: Not started.

One page per feature, each linked from the root `index.html`:

- [ ] `demo/if.html` with fixture views for element, template, and `r-else` cases.
- [ ] `demo/loop-index.html` with a list using `$index`, `$first`, `$last`, `$length`, and an indexed nested view.
- [ ] `demo/remote.html` with an HTML endpoint fixture and a JSON endpoint fixture. JSON is served as a static file with an `application/json` extension so `Content-Type` detection works.
- [ ] `demo/shadow.html` with a styled shadow view and a nested view inside it.
- [ ] Keep root `index.html` as a short overview linking the demo pages.
- [ ] Note in the demo README that remote demos need a local HTTP server, because `file://` fetch fails.

## 7. Docs and release

Status: Not started.

- [ ] Update `package.json` version using semantic versioning once the features land.
- [ ] Rebuild `dist/` with `npm run build` after behavior is verified.
- [ ] Document every directive with an example: `r-if`, `r-else`, `r-for` metadata, `r-remote` HTML and JSON rules, and `r-shadow` and its limits.
- [ ] Document that rendering is one-shot and that data changes after `run()` require a fresh render or manual DOM updates.
- [ ] Document the two failure state attributes: `data-view-error` on the element that replaces a failed view, and `data-r-error` on a plain element whose directive failed in place.
- [ ] Document the trust model for remote HTML, CORS behavior, and the fact that no sanitizer is applied.
- [ ] Keep JSDoc coverage for every new module, class, function, and method, excluding `*.test.js` files per `AGENTS.md`, and keep feature-owned types in sibling `*.types.js` files where types are needed.

## Implementation order

1. Test foundation and regression tests for current behavior.
2. Expression evaluator with tests.
3. `r-if` and `r-else`.
4. `$index` and loop metadata.
5. `r-remote`.
6. Shadow DOM views.
7. Demos, docs, version bump, and rebuild.

## Out of scope

- `r-show`.
- Closed shadow roots, declarative shadow DOM passthrough, slot forwarding.
- Sanitizing remote HTML, POST or custom headers in `r-remote`.
- Reactivity, data proxies, automatic re-rendering, fine-grained DOM diffing, and a `Roolith#update()` API. Reactive rebuilds and update passes are both deferred indefinitely.
- Arithmetic and loose equality in expressions.
