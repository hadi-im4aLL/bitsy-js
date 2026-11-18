# Directive reference

Every directive here works inside content the renderer walks: view markup loaded through `src` or `r-remote`, including markup that a nested view loads. Host page markup is never rendered as a template, so a directive on an element in the host page is inert. An `<r-view>` placeholder is the exception, because the view pipeline reads that element itself: `src` and `r-remote` declare its content source, `r-data` scopes the content it loads, and `r-shadow` asks for a shadow root.

Two rules hold for all directives:

- An attribute the renderer reads is removed, so a directive does not leak into rendered DOM. The exception is a retained shadow host, which stays in the document and keeps the `r-if`, `r-else`, and `r-for` it was authored with, because those were never evaluated.
- A directive failure never removes content silently. A failed plain-element condition or remote load keeps the element and records `data-r-error`; a failing loop expression, a rejected data declaration, and any failure on a view placeholder take the view error element path. The exact rules are in [the render contract](render-contract.md#directive-failure-policy).

## Placeholder children

An `<r-view>` placeholder can carry authored children, such as a loading message or a fallback view. For a placeholder inside rendered content, the enclosing walk renders those children, so interpolation and directives in them run and a nested view is discovered and loaded. A host page placeholder has no such walk, because host markup is not a template, so its children are not rendered as template content and interpolation or directives written directly on them never run. A nested `<r-view>` is a placeholder of the pass either way: inside rendered content the enclosing walk discovers it, and inside a host page placeholder the document query in `View#getNodes` finds it, so it loads, renders, and fires `r-view:rendered` like any other placeholder. The children do not survive either way: when the placeholder is replaced by its content, when it stays as a shadow host and its children are emptied, or when it is replaced by its view error element, which drops a fallback view inside them even after it already loaded.

Nothing saves that work. A fallback view inside those children still issues its request, still renders, and still fires `r-view:rendered`, even though the nodes it reports may already be out of the document by then, and a directive failure inside a loaded fallback view is reported exactly as it would be anywhere else. Treat placeholder children as a cheap fallback rather than as content whose side effects you rely on.

## `{ path }` interpolation

An interpolation placeholder is a dotted path inside braces in a text node. Whitespace inside the braces is allowed, so `{user.name}` and `{ user.name }` are the same placeholder.

```html
<p>Signed in as { user.name } with { user.roles.0 }.</p>
```

Rules:

- Only text nodes are interpolated. Attribute values are left exactly as authored.
- Only own properties are read, so a path cannot reach `toString` or `constructor`.
- A missing path, a `null` value, and a function value keep the placeholder text as written, so unresolved data stays visible in the output.
- A numeric segment reads an array index, because it is an ordinary property read: `items.0.name` works. Bracketed index access such as `items[0]` is not interpolation syntax.
- The placeholder pattern accepts letters, digits, `_`, `$`, and dots, matching the characters the other grammars accept.

Demo: [demo/if.html](../demo/if.html) renders `{ user.name }` from data declared in the page, and fixture [views/demo/if/element.html](../views/demo/if/element.html) shows it next to `r-if`.

## `r-data`

`r-data` declares data for one element and everything below it. It has two forms.

Object literal form, which resolves each value against the parent scope:

```html
<div r-data="{ plan: 'pro', seats: 12, isOpen: true }">
    <p r-if="plan === 'pro'">The pro plan includes { seats } seats.</p>
</div>
```

Dotted path form, which reads an object from the parent scope:

```html
<section r-data="account">
    <p>{ account.owner }</p>
</section>
```

Rules:

- Values inside an object literal are a quoted string, a number, `true`, `false`, `null`, or a dotted data path. A path value that does not resolve is an error; nested objects and arrays are not supported.
- Keys are an identifier or a quoted string, and a `__proto__` key is rejected by name because assigning it would replace the prototype instead of creating the key.
- The path form accepts any non-null, non-array object, which is spread into the child scope. A missing path, `null`, and an array are errors. An object that carries no enumerable own keys, such as a `Date` or a `Map`, passes that check and contributes no keys.
- Declared data is merged over the parent scope, so the element's own keys shadow inherited ones.
- An empty or whitespace-only `r-data` keeps the parent scope.
- `r-data` is resolved before the element's own `r-if`, so a condition on the element reads the element's own keys. Loop metadata is readable inside `r-data` on a repeated element, while a loop template's own `r-data` scopes and gates its whole group.

On a host `<r-view>` placeholder, `r-data` is honored: it scopes the loaded content and is consumed. On any other host element it is inert, because host markup is not rendered.

Demo: fixture [views/demo/if/element.html](../views/demo/if/element.html) uses `r-data` on the same element as `r-if`, and [views/demo/remote/remote-cases.html](../views/demo/remote/remote-cases.html) merges remote JSON over a declared `r-data`.

## `r-if`

`r-if` keeps or removes an element based on an expression.

```html
<p r-if="isOpen">This paragraph renders when isOpen is truthy.</p>
<p r-if="!isOpen">This one renders when it is not.</p>
<p r-if="isOpen && user.role === 'admin'">Both sides must be truthy.</p>
```

The expression grammar is deliberately narrow. It accepts:

- dotted data paths, such as `user.role` or `$index`
- `!`, `&&`, and `||`
- the comparisons `===`, `!==`, `>`, `>=`, `<`, and `<=`
- parentheses
- literals: a quoted string, a number such as `12` or `-1`, `true`, `false`, and `null`

It rejects arithmetic, loose equality (`==` and `!=`), function calls, assignment, array and object literals, and bracketed index access, and the error message names the rejected construct. There is no `eval` and no `new Function`, so a condition can read data and compare it, and nothing more.

Rules:

- The element's own `r-data` is resolved before its condition, so `r-data="{ open: false }" r-if="open"` reads the key the element declares. On a repeated element both run per copy, after the loop expanded it.
- A truthy result keeps the element and removes the attribute. The element renders normally.
- A falsy result removes the element with its subtree. Nothing inside a removed branch is interpolated, looped, fetched, or recorded as a view, so a nested `<r-view>` in a false branch never issues a request.
- Truthiness follows JavaScript: `0`, `""`, `null`, and an unresolved path are falsy, while `[]` and `"false"` are truthy. An unresolved path is falsy rather than an error.
- `!` binds tighter than a comparison, matching JavaScript, so `!a === b` means `(!a) === b` and negating a comparison needs parentheses: `!(a === b)`.
- Comparisons cannot be chained, so `a < b < c` is rejected.
- An empty or whitespace-only condition is an error rather than a falsy condition, because it is a mistake and not a decision. The element keeps its place, records `data-r-error`, and logs.
- A syntax error and any other evaluation failure keep the element in place, record `data-r-error`, and log. On a view placeholder the failure takes the view error element path instead.

`<template r-if="...">` is the grouping form. A selected template is replaced by its rendered content, and a falsy one is removed with its content. A template whose condition failed keeps its inert wrapper, so the recorded error stays observable and the content stays in `template.content`.

`<script>` and `<style>` support conditions only. Their condition is consumed and evaluated in the surrounding scope, while `r-for` and `r-data` on them are consumed without being resolved. Their text is never interpolated and their content is never walked.

Demo: [demo/if.html](../demo/if.html) with fixtures [views/demo/if/element.html](../views/demo/if/element.html) for the element form and [views/demo/if/template.html](../views/demo/if/template.html) for the template form. The expression evaluator has no page of its own; this is the page that exercises it.

## `r-else`

`r-else` is a bare attribute on the element that immediately follows an `r-if` element. It renders only when the condition before it was falsy.

```html
<p r-if="isOpen">Open</p>
<p r-else>Closed</p>
```

Rules:

- The attribute carries no expression. A value written on it is ignored, and the attribute is removed when it is applied.
- Pairing follows the authored order of siblings. Whitespace-only text and comments between the pair are tolerated, because they are invisible and unavoidable in formatted markup. Any other element, visible text, a loop element, or any other node type breaks the pair.
- Text is interpolated before it is measured, so a placeholder that resolves to whitespace keeps the pair intact while one that resolves to visible text breaks it.
- `r-else` with its own `r-if` is an else-if branch: the else pairing runs first, and the element's own condition is evaluated in its own data scope when the else selected it. Such a chain renders exactly one branch for every combination of conditions, and a duplicate bare `r-else` renders only the first alternative.
- An `r-else` with no preceding condition element is a directive error. The element keeps its place, records `data-r-error`, logs, and consecutive orphan elses each report their own error.
- An `r-else` that follows an element carrying `r-for` counts as orphaned, because a loop produces several siblings rather than one outcome.
- On a `<template>`, an unpaired `r-else` keeps the wrapper and never expands its content.
- On a view placeholder, any `r-else` failure takes the view error element path.

An else-if chain:

```html
<p r-if="plan === 'free'">Free</p>
<p r-else r-if="plan === 'pro'">Pro</p>
<p r-else>Everything else</p>
```

Demo: [demo/if.html](../demo/if.html) and fixture [views/demo/if/else.html](../views/demo/if/else.html), which also shows that a nested view inside the selected else-if branch loads while one in a discarded branch does not ([views/demo/if/else-branch.html](../views/demo/if/else-branch.html)).

## `r-for`

`r-for` repeats an element or a template once per item of an array. The expression is always `item in dataPath`.

```html
<ul>
    <li r-for="product in products">{ product.name }</li>
</ul>

<ul>
    <template r-for="product in products">
        <li>{ product.name }</li>
        <li>{ product.description }</li>
    </template>
</ul>
```

Rules:

- The path must resolve to an array, read as an own property. A missing path, `null`, or any other type is an error, and the message says what was found.
- The element form repeats the element itself, and each copy renders in its own item scope.
- The template form repeats the template content and replaces the wrapper with the rendered copies. The template's own `r-data` is resolved once and scopes and gates the whole group.
- A falsy `r-if` on a repeated element filters that one copy, because the attribute is cloned with the element and each copy renders through the element path. Use the element form to filter per item and the template form to gate the whole group.
- An `r-else` on the same element selects the repeated group as a whole before it repeats.
- On `<script>` and `<style>`, `r-for` is consumed without being resolved, so a repeated script never becomes several scripts.
- On `<template r-remote>`, `r-remote` is consumed without a request.

### Loop metadata

Each item scope also carries four `$`-prefixed keys:

| Key | Value |
| --- | --- |
| `$index` | zero-based position in the resolved list |
| `$first` | `true` for the first item of the resolved list |
| `$last` | `true` for the last item of the resolved list |
| `$length` | number of items in the resolved list |

```html
<ul>
    <template r-for="product in products">
        <li>
            { $index }: { product.name }
            <span r-if="$first">first</span>
            <span r-if="$last">last</span>
            of { $length }
        </li>
    </template>
</ul>
```

Metadata can be read anywhere the item scope is readable: interpolation, a per-copy `r-if`, and `r-data` on a repeated nested view.

```html
<r-view
    src="./indexed-card.html"
    r-for="product in products"
    r-data="{ product: product, position: $index, total: $length, isLast: $last }"
>Loading indexed card</r-view>
```

Metadata notes:

- `$index` is 0-based.
- Metadata describes the resolved list before any per-copy `r-if` filtering, so a filtered loop can render an item with `$index` 2 and `$length` 3, and can finish on an item carrying `$last` false. That is deliberate: the metadata describes the list, and the condition decides which copies survive.
- A nested loop shadows all four keys inside its own body. To read an outer index inside an inner body, capture it with `r-data="{ outerIndex: $index }"` on the outer element.
- Metadata never leaks outward. Each item scope is a fresh object, and siblings after the loop see the original scope.
- `$` names are reserved for metadata. A loop variable deliberately named `$index`, `$first`, `$last`, or `$length` is overwritten by the metadata rather than shadowing it.
- On a template, the metadata exists only per item, so the template's own `r-if` and its own `r-data` run before any item exists. `r-data="{ position: $index }"` on a loop template therefore fails and takes the view error element path, while the same declaration on a repeated element works per copy.

Demo: [demo/loop-index.html](../demo/loop-index.html) with fixtures [views/demo/loop-index/list.html](../views/demo/loop-index/list.html) for the four keys and [views/demo/loop-index/indexed.html](../views/demo/loop-index/indexed.html) for a repeated `r-view` that passes metadata into [views/demo/loop-index/indexed-card.html](../views/demo/loop-index/indexed-card.html).

## `r-remote`

`r-remote` loads content over HTTP and renders it into the element that declared it. It is a GET with no body and no custom headers, it is deduplicated by absolute URL within one render pass, and the `viewCache` setting decides the `fetch` cache option.

It applies to any element the renderer walks and, as an alternative to `src`, to an `<r-view>` placeholder in any document, including the host page. A plain element in the host page is inert, because host markup is never rendered as a template.

```html
<div r-remote="./html-element.html">
    <p>These placeholder children stay visible until the response arrives.</p>
</div>

<r-view r-remote="./html-view.html">Loading HTML-backed view</r-view>
```

### Media type rules

The response is data only when its `Content-Type` is exactly `application/json` after parameters are dropped and the value is lower cased. So `application/json; charset=utf-8` and `Application/JSON` are JSON, while `application/ld+json` and any other type are rendered as markup.

### HTML responses

On a plain element, the response markup becomes the element's children, replacing the placeholder children. It renders in the element's resolved scope, so `r-data` on the element and the data of its ancestors apply, and it runs every directive, including nested views and further remotes.

On an `<r-view>` placeholder, the response markup is rendered exactly like view content, and the placeholder is replaced by it. The `rendered` lifecycle event reports the remote source just as it does for a `src` view.

Relative URLs inside a response resolve against the remote URL, not against the document that declared the directive, so a view or a remote in remote markup resolves next to the response.

### JSON responses

On a plain element, the payload is merged into the element scope with the payload winning over `r-data`, and the element's children then render in that scope.

```html
<!-- a JSON response such as { "role": "from data.json", "plan": "pro" } -->
<div r-data="{ owner: 'r-data', role: 'from r-data' }" r-remote="./data.json">
    <p>owner = { owner }</p>
    <p>role = { role }</p>
    <p>plan = { plan }</p>
</div>
```

`owner` keeps the `r-data` value, `role` takes the payload value, and `plan` exists only from the payload. A payload that is not a non-array object, such as a JSON array or a primitive, contributes no keys, because a scope is an object.

On an `<r-view>` placeholder, an object payload with an `html` string uses that string as the view content, and an object `data` key supplies its scope. Any other payload is shown as its escaped `JSON.stringify` text, and it exposes no scope data, because the text node is the only node that renders.

```json
{
    "html": "<article><h3>{ title }</h3></article>",
    "data": { "title": "JSON-backed view" }
}
```

### Sources, state, and failures

- `r-remote` on a placeholder is the content source when `src` is absent. When both are present, `r-remote` wins as the content source, and the `src` URL is still requested without being awaited or rendered, so its response cannot fail the view.
- A blank or whitespace-only remote value is a directive error even when `src` declares a source, and the declared `src` is then never requested. A blank `src` beside a remote source counts as absent.
- `data-r-remote="loading"` is set before the request and removed when it finishes, on success and on failure. On a host placeholder it is visible in the page for the length of the request; on an element inside a view it is observable on that element, which is still detached while the pass runs.
- A failed plain-element remote keeps its placeholder children as authored, records `data-r-error` with the message, and logs. A nested `<r-view>` inside those kept children still loads in the enclosing scope, as it would with no remote attribute at all.
- A failed remote view takes the view error element path: the placeholder is replaced by the error element with `data-view-error` and the `error` event fires.
- A failed remote never aborts the pass or a sibling. Both media types commit atomically, so a response that fails part-way leaves the authored children untouched.
- A response that includes its own URL fails predictably instead of loading forever. A self-including remote element reports `Circular remote reference`, and a self-including remote view reports `Circular view reference`.
- A `<template r-remote>` consumes the attribute without a request, because a template has no element of its own for a response to land in.

Remote markup is trusted markup; see [the trust model](render-contract.md#remote-trust-model).

Demo: [demo/remote.html](../demo/remote.html) with all six cases declared in [views/demo/remote/remote-cases.html](../views/demo/remote/remote-cases.html), which uses [views/demo/remote/html-element.html](../views/demo/remote/html-element.html), [views/demo/remote/html-view.html](../views/demo/remote/html-view.html), the JSON fixtures [views/demo/remote/data.json](../views/demo/remote/data.json) and [views/demo/remote/view-payload.json](../views/demo/remote/view-payload.json), and an intentional request for a missing file as the failure case.

## `r-shadow`

`r-shadow` renders a view's content into an open shadow root. The attribute is a boolean opt-in: its presence, with any value, enables shadow rendering for that view.

```html
<r-view src="./views/card.html" r-shadow>Loading card</r-view>
```

```html
<style>
    .card {
        border: 2px solid rgb(88, 166, 255);
        padding: 1rem;
    }
</style>

<section>
    <h3 class="card">Card styled inside the shadow view</h3>
    <r-view src="./card-details.html">Loading details</r-view>
</section>
```

Rules:

- The content loads and renders first, through the ordinary pipeline, and only then is the shadow root attached. Every directive therefore works unchanged inside the shadow root: `r-data`, `r-for`, `r-if`, `r-else`, interpolation, nested views, and `r-remote`.
- The placeholder is never replaced. It stays in the document as the host, marked with `data-r-shadow-host`, and the rendered nodes are appended to its open shadow root.
- Placeholder children are discarded when the content arrives. Nothing is forwarded, because v1 has no slot support; the children were the fallback for a view that had not loaded yet.
- A `<style>` element in the view renders into the shadow root with everything else, so the view's styles apply only there. Host page styles do not reach shadow content, and view styles do not reach the page.
- `src`, `r-shadow`, `r-data`, and `r-remote` are consumed before the host is retained, so a surviving host carries no directive the pipeline already read.
- A nested view inside the shadow root resolves relative to the view URL, exactly as it does in a plain view.
- The `rendered` event is emitted after placement, and its `nodes` are the nodes now inside the shadow root.
- A shadow view that cannot load, cannot resolve, is circular, or fails a directive inside its content takes the ordinary view error element path. The placeholder is replaced by the error element, so no broken host is left behind. A placeholder that already carries a shadow tree makes `attachShadow` throw, and that failure lands on the same path.

The limits:

- Only open roots are supported. Closed roots, declarative shadow DOM, `:host` rules, and adopted stylesheets are out of scope for this release.
- No slot forwarding, so placeholder children cannot be projected into the view.
- `document.querySelectorAll` cannot see inside a shadow root. The intended ways to reach the rendered content are the nodes delivered by `onViewRendered` and `element.shadowRoot` on the host. The host itself stays queryable, because it stays in the document.
- `r-if` written on a host `<r-view>` placeholder is inert, like any other directive on host markup, so the view loads regardless of the condition. A retained host also keeps that attribute.
- A view already inside a shadow root cannot be re-rendered by a later pass, because placeholder discovery queries the document and that query does not pierce a shadow root.

Demo: [demo/shadow.html](../demo/shadow.html) places [views/demo/shadow/shadow-view.html](../views/demo/shadow/shadow-view.html) with `r-shadow` beside the plain [views/demo/shadow/no-shadow-view.html](../views/demo/shadow/no-shadow-view.html), and the shadow view loads [views/demo/shadow/shadow-nested.html](../views/demo/shadow/shadow-nested.html) inside its root.

## Directive order on one element

One element is processed in this order:

1. `r-else` pairing, if the element carries `r-else`. It is a sibling relationship, so the traversal resolves it before it touches the element.
2. Loop dispatch, if the element carries `r-for`. The loop attribute is checked before the element step runs, so the loop expander handles the element first. A raw-text element is excluded here, because its loop attribute is consumed by its own step instead. In the element form the element repeats, and each copy then goes through steps 3 to 5. In the template form the template's own `r-data` is resolved and its own `r-if` evaluated once as a group gate, and the content then renders per item.
3. `r-data` is resolved in the scope the element renders in, so its own data is readable by everything below.
4. `r-if` is evaluated in that data scope.
5. The kind of element decides the rest: a raw-text element consumes its remaining attributes, a template renders and expands its content, a view placeholder records its scope and renders its children, an element with `r-remote` records a remote target, and a plain element renders its children.

So an element carrying both `r-for` and `r-if` repeats first and then filters each copy in its own item scope, while a repeated `<template>` gates its whole group once. A raw-text element is the exception: its kind skips steps 2 to 4, so it consumes its own `r-for`, `r-data`, and `r-remote` in step 5 without resolving them and evaluates only its condition, in the surrounding scope.

## Where directives do not apply

- Host page markup. The pipeline renders fetched view content, not the document, so a directive on a host element is inert. An `<r-view>` placeholder is the one element the pipeline reads itself, which is why its `src`, `r-remote`, `r-data`, and `r-shadow` are honored there.
- Attribute values. `{ path }` interpolation is text-only.
- `<script>` and `<style>` content. Conditions are supported, loops and declared data are consumed without being resolved, and the text is never interpolated.
- A `<template r-remote>`. The attribute is consumed and no request is made.
