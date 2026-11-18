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
- Each directive feature gets its own demo HTML page and its own fixture views. The expression evaluator has no directive of its own and is exercised through `demo/if.html`.

## Feature status

Status values: Not started, In progress, Blocked, Done.

| Phase | Feature | Status | Depends on |
| --- | --- | --- | --- |
| 0 | Test foundation | Done | - |
| 1 | Expression evaluator | Done | - |
| 2 | `r-if` and `r-else` | Done | Expression evaluator |
| 3 | Loop metadata | Done | - |
| 4 | `r-remote` | Not started | - |
| 5 | Shadow DOM views | Not started | - |
| 6 | Demos and fixtures | Not started | 0 to 5 |
| 7 | Docs and release | Not started | 0 to 6 |

## Shared principles

- Directives stay declarative and safe: no `eval`, no `new Function`, no code execution.
- Data resolution order stays consistent: element `r-data` overlaid on ancestor scopes and root `data`.
- Every new directive gets a configurable attribute name in `RoolithSettings` with an `r-` default, matching `loopAttribute` and `dataAttribute`.
- Directive attributes are consumed, with no carve-out, so they do not leak into rendered DOM, matching `resolveElementData`. An attribute that is not honored is still consumed, and consuming an attribute never means evaluating it.
- Directive failure policy:
  - On a plain element, a condition failure keeps the element in place, adds a `data-r-error` attribute with the message, and `console.error`. A loop-expression or declared-data failure escalates to the view error element instead, because it decides which elements exist rather than whether one element is kept. Content is never silently removed.
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
- Resolved in Phase 3: interpolation placeholders matched `[\w.]+`, so `{ $index }` was not recognized. The pattern now allows `$` in a path, and `readDataPath` already read such a key. Tests never encoded the limitation as desired behavior.
- Left unchanged: `readDataPath` treats function values as missing and `resolveDataAttribute` never follows inherited members. Tests lock both in as prototype safety rather than change them.
- Left unchanged: a failed view still replaces its placeholder, so fallback children are dropped, and `console.error` plus the `error` lifecycle event remain the reporting channels. A plain-element condition failure uses `data-r-error` from Phase 2 onward, while a loop-expression or declared-data failure escalates to the view error element and view placeholders keep using the error element path.
- Left unchanged: the error element still assigns the message with `innerHTML`. Messages are built by the library from URLs, status codes, and error text, and can embed attribute text taken from trusted view markup, which Phase 2 now feeds: a condition or loop expression written on a view placeholder is quoted into `data-view-error` and into the element's `innerHTML`, so markup characters inside an `r-if` or `r-for` value can render as elements in the error text. The exposure is unchanged in kind because the text comes from authored markup, and no untrusted fetched data value reaches `innerHTML`. Revisit this when `r-remote` starts reporting remote-content failures; the root-cause fix is `textContent` instead of `innerHTML`, because the message is already machine readable on `data-view-error`.

## 1. Expression evaluator

Status: Done.

New modules: `app/template/expression.js` (evaluator and public entry point), `app/template/expression-parser.js` (grammar and AST types), `app/template/expression-tokenizer.js` (lexer and the shared syntax error format), and `app/template/string-literal.js` (string literal pattern, escapes, unquoting, and the error-message quoting both grammars use).

Grammar:

```text
expression := or
or         := and ("||" and)*
and        := comparison ("&&" comparison)*
comparison := unary (("===" | "!==" | ">" | "<" | ">=" | "<=") unary)?
unary      := "!" unary | primary
primary    := "(" expression ")" | number | literal | path
literal    := quoted string | true | false | null
number     := "-"? digit+ ("." digit+)?
path       := identifier ("." segment)*
identifier := [A-Za-z_$][\w$]*
segment    := [\w$]+
```

- [x] Implement a tokenizer and a recursive-descent parser that produces an AST. No `eval`, no `new Function`.
- [x] Implement evaluation with JS short-circuit semantics for `&&` and `||`.
- [x] Reject function calls, assignment, arithmetic, object and array literals, index access, and loose equality (`==`, `!=`) with a message that names the construct in every position, including inside parentheses and where a primary is expected, so `(* 2)`, `+1`, and `a === === b` all name the operator; the one deliberate exception is a genuine closer in the wrong place, where `(a]` and `(a}` report the missing `)` instead of a construct name.
- [x] Reuse `readDataPath` for path lookup so inherited members stay unreachable.
- [x] Export a single `evaluateExpression(source, scope)` entry point returning `{ value, paths }`.
- [x] Tests: precedence, parentheses, negation, short-circuit with a missing path, string and number literals, comparison operators, every rejected syntax, and a malformed expression.

Notes:

- Layout follows the existing language module style: `expression-tokenizer.js` holds the character-level rules and the shared error format, `expression-parser.js` holds the grammar and the AST typedefs it produces, and `expression.js` holds evaluation and the public entry point. String literal rules live in `string-literal.js`, which `data-object.js` uses too, so the quote and escape grammar exists once and both grammars quote text in error messages the same way. AST and token shapes stay as JSDoc typedefs beside their owner instead of in a sibling `*.types.js` file, because the project is JavaScript with no type-only modules and every existing module documents its contracts inline. The grammar module stays above the size review trigger because its rejection diagnostics are keyed by grammar position and are written and read beside the productions they describe, so splitting them out would force matching edits without isolating any volatile boundary: adding or renaming a construct is one reason to touch the file, and a message-only edit is an accepted second one. `data-object.js` stays above it as one cohesive grammar for the same reason. Lexing and evaluation live in separate modules because they change for different reasons and the lexer is shared with the parser.
- `!` binds tighter than comparison, matching JavaScript, so `!a === b` evaluates as `(!a) === b` and negating a comparison needs parentheses: `!(a === b)`. A comparison's right side is a unary too, so `x === !y` is `x === (!y)`.
- Comparisons cannot be chained, so `a < b < c` is rejected instead of being read as `(a < b) < c`.
- A `-` that starts a primary is a negative number literal, so `count > -1` works. A number is digits with an optional fraction and an optional leading `-`, so `3.5` and `-1` are numbers while `1e3`, `.5`, and `5.` are not accepted. The sign is its own token, so `- 1` is accepted as `-1`; that is not the grammar `r-data` accepts, because `data-object.js` lexes `-?\d+` as one token and rejects `- 1`. Subtraction and the other arithmetic operators stay rejected with an arithmetic message.
- Bracketed index access such as `items[0]` is rejected with an index access message, while a numeric path segment such as `items.0.name` is a path read, matching `readDataPath`.
- A reserved word is a literal and cannot be the first segment of a dotted path, so `true.foo` is rejected with `"true" is a literal, not a path` instead of being read as data. The literal wins over a key of the same name, so an `r-data` key literally named `true`, `false`, or `null` is readable as `object.true` but not as a bare path.
- Loose equality `==` and `!=` is diagnosed at token level by design, so its message can preempt an outer construct diagnosis: `foo(a == b)` reports the loose equality rather than the function call. The operator is invalid in every position, so that tradeoff is deliberate.
- `&&` and `||` return an operand rather than a boolean, matching JavaScript, and `paths` lists reads in order without deduplication, so `a && a` gives `["a", "a"]`.
- A path may start with `$`, so `$index` tokenizes as a path and resolves from scope; Phase 3 builds the loop metadata on that.
- A `__proto__` data key is now rejected by `parseDataObject` with a named error instead of being silently dropped, because assigning it would replace the prototype instead of creating the key, while ordinary keys that shadow inherited members such as `constructor` and `toString` still work.

Known limitations:

- Numeric path segments such as `items.0.name` are supported; bracketed index access such as `items[0]` is not.
- Characters outside the token set are rejected with an `unexpected character` message rather than ignored, including non-ASCII identifier characters, which end the identifier token at their ASCII prefix and are then reported as the unexpected character. This matches the existing `r-data` and interpolation patterns, which accept the same ASCII-only identifier characters.
- `paths` has no consumer yet and is retained because this phase's contract requires it.
- Deeply nested expressions can exhaust the call stack and surface as a `RangeError`. No depth cap is applied because expressions come from trusted view markup.
- No demo exists for the evaluator yet, and `dist/` has not been rebuilt. In Phase 1 no application module imported `expression.js`; since Phase 2 `app/template/condition.js` imports it, so the evaluator now runs inside the application modules.

## 2. `r-if` with `r-else`

Status: Done.

- [x] Add `ifAttribute: "r-if"` and `elseAttribute: "r-else"` to settings.
- [x] Evaluate `r-if` after the element's own `r-data` is resolved, so `r-data="{ open: false }" r-if="open"` works on one element.
- [x] Truthy: render the element normally and remove the directive attribute.
- [x] Falsy: remove the element and its subtree. Nested `r-view` elements inside a false branch must never be fetched.
- [x] `<template r-if="...">`: render or remove the template content, not the template element.
- [x] `r-else`: a bare attribute on the element immediately following an `r-if` element. It renders only when the `r-if` was falsy, and its own expression stays optional and bare in the common case. An `r-else` without a preceding `r-if` is a directive error.
- [x] `r-else` with its own `r-if` is a supported else-if branch: `<p r-if="a">A</p><p r-else r-if="b">B</p><p r-else>C</p>` renders exactly one of the three branches for every combination of `a` and `b`, and a duplicate bare `r-else` renders only the first alternative.
- [x] Invalid expressions follow the directive failure policy and do not remove content. On an element whose tag is the configured view tag, the failure uses the existing view error element path instead of an in-place attribute.
- [x] Catch expression evaluation errors in the plain-element directive failure path, including a `RangeError` from pathological nesting, so a directive failure is contained by the failure policy.
- [x] Raw-text elements support conditions only: `r-if` and `r-else` are consumed and evaluated in the surrounding scope, while `r-for` and `r-data` are consumed without being resolved. Their script or style text is never interpolated and their content is never walked.
- [x] A `<template r-for>` resolves its own `r-data` once and evaluates `r-if` in that scope, so a loop template can gate its group with its own declared data.
- [x] Tests: true and false on element and template, view inside a false branch is not fetched, `r-else` both ways, `r-else` orphan error on an element and on a template, `r-data` on the same element, expression using `&&`, nested conditionals, truthiness of `0`, `""`, `[]`, `"false"`, and `null`, else-if chains, duplicate `r-else`, `r-else` after a failed condition, `r-else` inside a repeated template per item, conditions on raw-text elements, raw-text loop and data consumption, view placeholders failing the condition and the pair, a falsy placeholder with an `r-else` fallback, a nested view inside a selected else template, custom `ifAttribute` and `elseAttribute` names, interpolated whitespace keeping a pair, an empty and whitespace-only condition, consecutive orphan elses, `r-else` with `r-for` in all three outcomes, a loop template with its own data, an orphan else loop element with unusable declared data, an orphan else loop element with a condition, an invalid condition on an orphan else loop element without evaluating it, an invalid condition on a repeated loop template, an invalid `r-if` on an `r-else` branch, an orphan else whose own condition is falsy, a selected and a deselected else placeholder, a chain inside an element form loop clone, and custom `loopAttribute` and `dataAttribute` names.

Notes:

- New module `app/template/condition.js` owns the condition directive mechanics: it consumes the attributes, evaluates them through the Phase 1 evaluator, removes the element when the result is falsy, resolves an else element against the preceding sibling outcome, and reports failures through the failure policy. `app/template/renderer.js` keeps DOM traversal and the sibling pairing state, and template expansion. Both condition functions take an options object and return the shared `ConditionOutcome` shape, so a caller can always tell "rendered" from "removed" from "failed" and the failure policy has one source of truth. The split is by reason to change: the evaluator contract and the failure surface move with the condition module, while markup walking stays in the renderer.
- Size and extraction: the renderer reached 328 lines after the pairing fixes, over the 250 to 300 review trigger, so loop expansion moved to `app/template/loop-expander.js` as `LoopExpander`. That is a real boundary rather than a line-count wrapper: repeating markup is a separate reason to change from walking siblings, Phase 3 extends exactly that module with loop metadata, and repeated content still renders through the renderer, so every directive keeps working inside clones. After the extraction the expander was about 130 lines with one method; Phase 3 added `createItemScope`, bringing it to about 180 lines with one public method and one module-private function, still under the 250-line trigger, and `condition.js` is about 170. The renderer keeps one responsibility (traversal, sibling pairing, element rendering) and sits at about 320 lines, slightly over the top of the review band: this round split the loop dispatch out of `renderChild` into `renderLoopedChild`, which owns the failed-pairing stop, so the growth is one named decision plus its contract documentation instead of another branch in place. Its methods stay short, with `renderChild` the longest at about 48 lines of distinct branches and the pairing contract in its docblock. Sibling pairing state stays in the renderer because it is traversal, not condition semantics, and the next growth (Phase 3 loop metadata) belongs in `loop-expander.js`. The next substantive change to `renderElement` or `renderChild` should extract the element step (`renderElement` plus `resolveElementData`) into an element renderer collaborator, leaving `TemplateRenderer` as traversal and dispatch, rather than adding branches in place.
- Attribute consumption: `r-if` is removed before evaluation, `r-else` is removed when it is applied, and `r-for` is removed before a loop expands, so no directive reaches rendered DOM. The same rule holds on failure: the attribute is still consumed, and a condition failure stays visible through `data-r-error`, so debugging does not depend on the attribute surviving. An orphan `r-else` on a loop element consumes that element's `r-for`, `r-data`, and `r-if` too before the loop stops, so the error path leaks nothing either, because nothing in that element renders and none of the three is evaluated. Consuming an attribute never means evaluating it: declared data on a loop element that is never expanded is removed with `removeAttribute` alone, and the failed-pairing check lives in the renderer dispatch rather than in `LoopExpander`, because the element will never use that data and validating it would turn a local directive error into a whole-view failure. Conditions are the only directives a raw-text element honors, so `<script r-if>` and `<style r-else>` consume their condition when they render, while `r-for` and `r-data` there are consumed without being resolved, and such an element renders once with its directives consumed, its text not interpolated, its content not walked, and its group not repeated. That keeps a repeated `<script>` from executing once per item and keeps an invalid `r-data` literal on a `<script>` from failing the view.
- Evaluation order on one element is `r-data` first, then `r-if`, so `r-data="{ open: false }" r-if="open"` reads the element's own key. A falsy result removes the element before any child is touched, so nothing inside a hidden branch is interpolated, looped, recorded as a view, or fetched. The false-branch test asserts the fetch call list contains only the parent view.
- `<template>` form: a template selected by a condition renders its content and is replaced by that content, mirroring the repeated template form. Selection is either a truthy `r-if` of its own or an `r-else` that paired it with a falsy condition element, so an else template renders its group the same way. A failed condition keeps the template wrapper in place instead of expanding it, because a template that is replaced cannot carry `data-r-error`; the wrapper stays inert, the error attribute stays observable, and the content stays in `template.content` rather than being silently rendered or dropped. That rule covers an invalid `r-if` and an orphan `r-else` alike, because the else pairing reports failure as an outcome instead of as a render decision.
- `r-else` pairing rule: it pairs with the element immediately before it in the same sibling run. Whitespace-only text nodes and comments between the pair are tolerated because they are invisible and are unavoidable in formatted markup; any other element, visible text, a loop element (which produces several siblings instead of one outcome), or any other node type breaks the pair. Text is interpolated before it is measured, so a placeholder that resolves to whitespace, such as `{spacer}` with `spacer: " "`, keeps the pair intact, while one that resolves to visible text breaks it. An unpaired `r-else` is a directive error that keeps the element in place, records `data-r-error`, and logs, matching the plain-element failure policy. Element order is taken from a snapshot of the parent children taken before rendering, so pairing follows the authored order even when the condition element is a template that was replaced by its content.
- Sibling pairing contract: the run keeps one value, `previousCondition`, which is returned by the method that renders one child and assigned in exactly one place, the loop in `renderChildren`. After any element with a condition it is that element's own outcome, or `SATISFIED_CONDITION` when the element is an else that was removed by an earlier branch or that rendered without a condition of its own. That is what makes an else-if chain and a duplicate `r-else` mutually exclusive: a skipped else still reports the chain as satisfied, so the next else is removed instead of orphaning. It is `null` when the element carries no condition of its own and when its else pairing failed, and a failed condition counts as rendered so the branches are never shown next to the recorded error. A failed pairing hands on `null` instead of a satisfied chain, because an orphan else is a directive error rather than a rendered branch: an `r-else` that follows it therefore reports its own orphan error and keeps its element, so a run of consecutive orphan elses is logged and observable in full instead of losing every branch after the first.
- `r-else` with `r-if`: the else pairing runs first, and the element's own `r-if` is then evaluated in its own data scope when the else selected it, so `<p r-else r-if="b">` is an else-if branch. The else attribute itself still carries no expression and a value on it stays ignored.
- `r-for` and `r-if` on one element: the loop keeps precedence in the dispatch, so the element is repeated first and every clone is then evaluated by `r-if` against its item scope, because the attribute is cloned with the element and the clone is rendered through the same element path. This is the minimal correct behavior and needed no separate evaluation pass. On a repeated `<template>` the template attributes are not cloned into content, so the template resolves its own `r-data` once and evaluates its `r-if` in that scope, which gates the whole group instead of each item. Use the element form to filter per item and the template form to gate a group with data the template declares itself. An `r-else` on the same element selects the group as a whole before it repeats, so a selected else template repeats its group, a deselected one is removed with its group, and an orphan one is kept and never repeated. A clone is attached to the output before it is rendered, so a falsy `r-if` on the clone can remove it from the output instead of leaving it behind.
- Failure policy: a failed condition on a plain element keeps its place with `data-r-error` and `console.error`, and it never reaches the `try`/`catch` in `app/view/view.js`. A failure on an element whose tag is the configured view tag is thrown out of `TemplateRenderer` instead, so the same `try`/`catch` that handles `r-data` and `r-for` failures replaces that view with its error element. The placeholder is never marked with `data-r-error`, because `view.js` replaces it afterwards and the attribute would not survive, and the child view is never fetched. A single `catch (error)` covers both `Error` and `RangeError`, so a pathological nesting failure follows the same policy. The failure path on an orphan loop element stops before rendering, so that element keeps its authored body unrendered, while a plain orphan element still renders its children through the normal element path; the difference is deliberate, because loop body is content to be repeated rather than a rendered subtree. An orphan `r-else` that also carries a falsy `r-if` records the orphan error first and is then removed by its own condition, so only the `console.error` line survives and no `data-r-error` remains in the DOM: the author's own condition still decides whether the element stays, and the recorded error lives on the element rather than on a separate node.
- The `data-r-error` attribute name is not configurable, matching the shared policy: it reports library failures rather than a template directive, so host tooling can rely on one name while directive attribute names stay configurable.
- Empty condition: `r-if=""` and a whitespace-only value are a directive error rather than a falsy condition, because an empty condition is a mistake instead of a decision. The element keeps its place, records `data-r-error` with `Invalid expression: expression is empty`, and logs, exactly like any other invalid expression.
- Shared DOM vocabulary: `app/template/dom-nodes.js` holds the node kind constants, `TEMPLATE_TAG`, the module-private raw-text tag list, and the exported `isRawTextElement` predicate, because the renderer dispatches on node kind and tag name and is the only consumer of the raw-text test. Single-sourcing these values keeps a rename to one edit. The tag list stays private because the predicate is its only consumer, so the module exports only what is used. The predicate describes the kind of element and nothing more; the rule that a raw-text element honors conditions only lives in the renderer and in this document. A shared module was judged better than the previous duplication here, and it stays limited to DOM vocabulary so it does not become a dumping ground for directive policy.
- Test layout: the condition suite is split by scope instead of growing one file. `app/tests/if-directives.test.js` keeps the `r-if` and `r-else` cases plus the custom attribute names, while `app/tests/directive-interactions.test.js` covers conditions on raw-text elements, conditions with nested views and placeholders, and `r-for` with conditions. Both stay flat in `app/tests`, and every helper stays in `app/tests/helpers.js`. The next group of `r-for` interaction tests should move to their own file, `app/tests/loop-directives.test.js`, because a loop crossed with conditions is a distinct interaction from conditions on raw text or on placeholders.

Findings:

- Fixed during review follow-up: an orphan `r-else` on a `<template>` used to report failure with the same bare `true` that meant "render this alternative", so the template was expanded and the `data-r-error` attribute went away with the wrapper. Else resolution now reports a `ConditionOutcome` like the condition directive, `failed` is carried into the element render step, and a failed pairing never expands a template, so the wrapper stays with its error and its content stays in `template.content`.
- Fixed during review follow-up: an else-if chain rendered two branches, because the sibling-run state was cleared before the else was resolved and a skipped else left nothing behind. The state is now the element's own outcome, or a satisfied chain when an else was removed or rendered without its own condition, and the run resets in one place. `<p r-if="a">A</p><p r-else r-if="b">B</p><p r-else>C</p>` renders exactly one branch for every combination, and a duplicate bare `r-else` renders only the first.
- Fixed during review follow-up: a condition failure on a view placeholder recorded `data-r-error` on an element that `view.js` then replaced, so no channel reported the failure. The failure now propagates out of `TemplateRenderer` and takes the view error element path, consistent with `r-data` and `r-for`.
- Fixed during review follow-up: a repeated `<template>` evaluated `r-if` in the outer scope and ignored its own `r-data`. The template now resolves its declared data once and uses it for its condition, its loop expression, and the base of every item scope.
- Fixed during review follow-up: raw-text elements were skipped before the condition checks, so `r-if` and `r-else` leaked into the rendered DOM on `<script>` and `<style>`. They now consume and evaluate a condition in the surrounding scope, while a loop and a declared data attribute on them are consumed without being resolved, so a repeated `<script>` no longer becomes several executed scripts and an invalid `r-data` literal there no longer fails the view.
- Fixed during review follow-up: raw-text elements consumed a condition but left `r-for` and `r-data` in the rendered DOM, contradicting the shared attribute-consumption principle, and a test then pinned the leak. The element step now removes both attributes without resolving them, so such an element renders once with its directives consumed.
- Fixed during review follow-up: a second `r-else` after an orphaned `r-else` was removed silently, because the orphan reported itself as a rendered branch. A failed pairing now ends the sibling run instead, so every orphan in a run reports its own error and keeps its element.
- Fixed during review follow-up: a text node was measured for visibility before interpolation, so `{spacer}` resolving to a space orphaned an else that should have paired. Text is now interpolated first and measured afterwards.
- Fixed during review follow-up: an orphan `r-else` on a loop element stopped the loop before its declared data was resolved, so `r-data` survived in the rendered DOM. The failure path now consumes it like every other directive attribute, and it does so with `removeAttribute` alone: resolving data that is never used would escalate a local directive error into a whole-view failure, so the failed-pairing check moved out of `LoopExpander` and into the renderer's loop dispatch.
- Kept: an empty or whitespace-only condition is a directive error rather than a falsy condition, because an empty condition is a mistake and not a decision. The element stays in place with `data-r-error` and the failure is logged, like any other invalid expression.
- Design consequence: placeholders inside a false branch are never recorded or fetched, because the branch is removed during traversal and `view.js` collects nested views from the rendered tree afterwards. The regression test asserts this through the fetch call list rather than through DOM inspection alone, so a placeholder that stayed recorded would fail even if its element were hidden later.
- Kept: whitespace left behind by a removed branch stays in the DOM as formatting whitespace. Removing it would mean rewriting text nodes the renderer does not own, and the whitespace between a condition and its else has to survive anyway for pairing to work.
- Limitation: an `r-else` that follows an element carrying `r-for` is treated as orphaned, because a loop replaces one element with many and there is no single outcome to pair with. Pairing with the whole loop was not implemented because the pairing rule defines the pair as an element immediately following an `r-if` element.
- Kept: an element carrying both `r-else` and `r-for` resolves the else pairing first, and the clones carry no else attribute, so the else selects the repeated group as a whole rather than each copy. A bare `r-if` on the same element filters per clone, so use that form when the condition is per item.
- Limitation: no dedicated test drives the `RangeError` path, because exhausting the call stack depends on the host stack size and would make the suite environment dependent. The single `catch` covers it, and syntax errors exercise the same reporting path.
- Limitation: an `r-if` written on a view placeholder in the host document is not evaluated, because host markup is never rendered as a template: the renderer only walks fetched view content. Directives belong to view content, and a placeholder in the host page is loaded directly.
- Limitation: a condition failure on a placeholder replaces the whole containing view with its error element, not just the placeholder, because that is the existing view error boundary. The child view is never fetched and the failure is observable as `data-view-error` on the error element.

## 3. `r-for` index and metadata

Status: Done.

- [x] Widen the interpolation placeholder pattern to allow `$` in paths so `{ $index }` works. `readDataPath` and the data object tokenizer already accept `$`.
- [x] Accept `$` in the loop data path too, so `r-for="row in $rows"` reads a key that interpolation, `readDataPath`, the `r-data` tokenizer, and the expression tokenizer already accept. The error messages and the `item in dataPath` shape stay unchanged.
- [x] In `LoopExpander.expand`, build the item scope through `createItemScope` as `{ ...scope, [name]: item, $index, $first, $last, $length }`, where `scope` is the template's own declared data or the outer data. `$index` is 0-based.
- [x] Nested loops shadow outer loop metadata inside their own body.
- [x] Metadata is usable in `r-data` on a nested view, for example `r-data="{ position: $index, name: product.name }"`.
- [x] Metadata is usable in a per-clone `r-if`, and it describes the resolved list before that filtering.
- [x] Metadata must never leak through the loop's outer scope.
- [x] Tests: interpolation with every metadata key, `r-view` inside a loop receiving `$index` through `r-data`, nested loops shadowing all four keys, a `$`-prefixed loop path, metadata in a per-clone `r-if`, per-clone filtering measured against the resolved list, an empty array (no output, no metadata leak, and no failure logged or recorded), a single item marked first and last, a loop variable named `$index` overwritten by the metadata, metadata declared on a loop template failing as a view error, and the two sides of the loop-path boundary, a trailing dot reported as unresolved and a bracketed path reported as an invalid expression.

Notes:

- Interpolation: the placeholder pattern changed from `[\w.]+` to `[\w.$]+`, so `{ $index }` matches and resolves through the existing `readDataPath`. `readDataPath`, the `r-data` object tokenizer, and the expression tokenizer already accepted `$`, but the loop path pattern accepted only `[\w.]+`, so `r-for` rejected a path such as `$rows` while interpolation already read such a key. The loop path now accepts `$` too, with the same `item in dataPath` shape and the same error messages, and a test covers a `$` path that loops correctly and reports no error. Missing metadata still keeps the placeholder, so a sibling after a loop renders `{$index}` unchanged, while a host data key that starts with `$` is interpolatable outside a loop, which the interpolation suite asserts directly, and is shadowed by the loop metadata inside one. The pattern keeps its previous permissiveness about the first character instead of adopting the stricter identifier rule, because narrowing it would change which placeholders match for no behavior gain. The loop path pattern is loose in the same way, so parity with the other grammars covers `$` acceptance and not the stricter first-character rule: only the shape and the character set are checked when the expression is parsed, and a path built from word, dot, and `$` characters such as `items.` matches, resolves to nothing, and reports the existing unresolved-array error instead of a syntax error, while any other character, as in `items[0]`, is still an `Invalid loop expression`. The `parseLoopExpression` docblock states that boundary.
- Item scope: `createItemScope` in `loop-expander.js` builds `{ ...scope, [name]: item, $index, $first, $last, $length }` for each item. It is a named module-private helper rather than an inline literal because the metadata meaning, the shadowing rule, and the no-leak guarantee need one documented place, and `expand` stays readable. It takes the resolved list instead of its length, so `$last` and `$length` derive from one value and the call site never passes two adjacent numbers that a transposed argument would swap silently. `$index` is the zero-based iteration position, `$first` and `$last` mark the ends of the resolved list, and `$length` is the number of resolved items. The base `scope` is the template's own declared data for the template form and the outer data for the element form, exactly as before, so declared data on a loop template still gates and scopes the group.
- Shadowing: metadata is written after the spread and after the loop variable, so it wins over a base key of the same name. That also means a loop variable deliberately named `$index`, `$first`, `$last`, or `$length` is overwritten by the metadata rather than shadowing it, which is a deliberate limitation now pinned by a test on `r-for="$index in items"` that renders `0` and `1` instead of the items: `$` names are reserved for loop metadata by the confirmed decision, and no name validation was added to reject such a loop variable. The test covers `$index` only because all four keys are written by the same object literal, so a key that stopped being overwritten would be a change to that one expression. A nested loop spreads the outer item scope, which already contains the outer metadata, and then writes its own metadata last, so inside the inner body `$index`, `$first`, `$last`, and `$length` describe the inner loop; the test asserts all four keys for the inner item, for the outer body after it, and for an outer value captured with `r-data="{ outerIndex: $index }"` on the outer element and read inside the inner body. After the inner loop, the outer item scope is untouched, so the surrounding body still reads the outer metadata. Reading the outer index directly inside an inner body is not possible for the same reason, and the captured outer value is the documented pattern. `LoopExpander` and `createItemScope` document that rule.
- No leak: the item scope is a fresh object per item. Neither the base scope nor the data object the caller passed in is mutated, and nothing is written back after expansion, so siblings after the loop and the host data object keep no loop keys. Tests assert that through a following `{$index}` placeholder and through the caller's data object.
- Directive reach: metadata is only a scope overlay applied before existing rendering, so it needed no renderer or condition change. Interpolation reads it directly, a per-clone `r-if` reads it through the item scope, which a test covers with `r-if="$index > 0"`, and `r-data` on a repeated view resolves against it, so `r-data="{ position: $index, name: product.name }"` flows into the nested view content. A repeated view is recorded with its item scope, so its own content can read the metadata as well. Because the item scope is also the base of a nested loop inside that element's subtree, the inner loop shadows the outer metadata there, matching the shadowing rule.
- Filtering: metadata describes the resolved list, before per-clone `r-if` filtering. `$index`, `$first`, `$last`, and `$length` are computed once from the list `resolveLoop` returned, and the clone's condition is then evaluated against that item scope, so a filtered loop can render the item at `$index` 2 with `$length` 3 and finish on an item carrying `$last: false`. That combination is a real author trap, so the rule is stated here and a test pins `$length` and `$last` against the unfiltered list instead of leaving the behavior accidental.
- Empty array: no item scope exists, so `$length` 0 is not observable through rendered output. The test asserts the `<ul>` wrapper survives with no children, the following sibling keeps its `{$index}` and `{$length}` placeholders, and no directive failure is logged (`console.error`) or recorded (`data-view-error`); the test also asserts no `data-r-error`, which holds although conditions are its only writer today.
- Test layout: loop metadata behavior lives in `app/tests/loop-metadata.test.js`, covering every metadata key through interpolation, the element and template forms, the empty array, a single item, nested shadowing of all four keys, a loop variable named `$index` overwritten by the metadata, the no-leak guarantee, metadata in a per-clone `r-if`, per-clone filtering measured against the resolved list, and the template-form declared-data failure. Loop paths, loop errors, and nested loops without metadata stay in `app/tests/loops.test.js`. The loop crossed with views was first copied into `app/tests/loop-directives.test.js`, which is the file the Phase 2 note reserved for the next group of `r-for` interaction tests, and it covers `r-data` on a repeated view, metadata inside a repeated view's content, and a view inside a nested loop. The repeated-view case was also copied into `loops.test.js`, so it was duplicated rather than moved; the review follow-up deleted that copy and kept the interaction file as the single owner. Splitting the metadata tests into their own file follows the Phase 2 split precedent and keeps every file under the 250 line review trigger instead of leaving `loops.test.js` over it. All three files stay flat in `app/tests` and reuse `app/tests/helpers.js`.
- Left out: the template form's own condition still runs once in its declared or outer scope before expansion, so it cannot read loop metadata, and `r-data` declared on a loop template resolves in the same pre-item scope, so `r-data="{ position: $index }"` there fails with `Data value "$index" did not resolve to a value` and escalates to the view error element like any other render failure. Both are deliberate boundaries rather than omissions: metadata only exists per item, so the template form gates its group once while the element form filters and declares data per item, and the failure is pinned by a test instead of surprising an author. No new setting, metadata reset API, or `$`-prefix escaping rule was added.

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

One page per directive feature, each linked from the root `index.html`. The expression evaluator is covered by `demo/if.html`, which is its first consumer:

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
- [ ] Document the two failure state attributes: `data-view-error` on the element that replaces a failed view, and `data-r-error` on a plain element whose condition failed in place.
- [ ] Document the trust model for remote HTML, CORS behavior, and the fact that no sanitizer is applied.
- [ ] Keep JSDoc coverage for every new module, class, function, and method, excluding `*.test.js` files per `AGENTS.md`. In this JavaScript codebase feature types stay as JSDoc typedefs beside the declaration they describe; there are no sibling `*.types.js` files because the project has no type-only modules.

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
