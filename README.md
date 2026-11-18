# Roolith JS

Roolith JS is a small client-side view renderer for HTML fragments. It finds `<r-view>` placeholders in a document, loads their markup with `fetch`, renders the directives declared in that markup, places the result, and repeats for every view the content declares.

The library is an ES module with no runtime dependencies and no build step for consumers. It needs a browser-like environment with `document` and `fetch`, and a page that uses it must be served over HTTP, because `fetch` does not work from `file://`. The demo pages record that in [demo/README.md](demo/README.md).

What it does:

- Nested views: `<r-view src="./views/partial.html"></r-view>` loads a fragment, and a fragment can declare more views.
- Interpolation: `{ user.name }` in text nodes, resolved from the data scope.
- Scoped data with `r-data`, in object-literal or dotted-path form.
- Loops with `r-for` on an element or a `<template>`, with `$index`, `$first`, `$last`, and `$length` metadata.
- Conditions with `r-if` and `r-else`, including else-if chains, evaluated without `eval` and without `new Function`.
- Remote content with `r-remote`, for HTML responses and for JSON payloads.
- Shadow DOM views with `r-shadow`, so a view's content and styles stay behind an open shadow root.
- Lifecycle events on `document` plus an `onViewRendered` subscription for the views a page cares about.

Rendering is one-shot: `run()` evaluates every directive once, later data changes are not observed, and there is no reactivity layer and no `update()` API. See [docs/render-contract.md](docs/render-contract.md#rendering-is-one-shot).

## Contents

- [Install and usage](#install-and-usage)
- [Quick start](#quick-start)
- [Directives at a glance](#directives-at-a-glance)
- [Settings](#settings)
- [State attributes](#state-attributes)
- [Lifecycle events](#lifecycle-events)
- [Remote trust model](#remote-trust-model)
- [Demos](#demos)
- [Build and release](#build-and-release)
- [Documentation map](#documentation-map)

## Install and usage

The repository is not published to a registry, so consume it from a checkout. `package.json` declares `"type": "module"`, so every file here is an ES module and the import specifiers below include the file extension.

Two entry points are available:

- The source entry point `app/roolith.js`. It imports the individual modules and is what the tests and the demo pages use.
- The built bundle `dist/roolith-<version>.min.js`, produced by `npm run build`. It is a single minified ES module with the version in its file name and in a banner comment. `dist/` is gitignored, so the bundle exists only after a local build.

```js
// From source, as the demo pages do.
import { Roolith } from "./app/roolith.js";

// Or from the built bundle, using the version it was built for.
import { Roolith } from "./dist/roolith-1.1.0.min.js";
```

`Roolith` is the only export.

### API

- `new Roolith(settings)` creates an instance. `settings` is optional and is merged over the defaults listed in [Settings](#settings). The merged object is readable as `roolith.settings`.
- `await roolith.run()` renders every view declared in the document, including nested views, and resolves when the pass finished. It returns nothing.
- `roolith.onViewRendered(src, callback)` subscribes to the render event of one or more views and returns a function that removes the subscription. It is the integration point for content that a document query cannot reach, such as a shadow view. See [Lifecycle events](#lifecycle-events).

## Quick start

A page declares a placeholder and renders it once. View markup holds the directives, because host page markup is never rendered as a template.

`page.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Roolith JS quick start</title>
</head>
<body>
    <r-view src="./views/greeting.html">Loading</r-view>

    <script type="module">
        import { Roolith } from "./app/roolith.js";

        const roolith = new Roolith({
            data: {
                user: { name: "Ada" },
                isAdmin: true,
                roles: ["editor", "reviewer"],
            },
        });

        await roolith.run();
    </script>
</body>
</html>
```

`views/greeting.html`:

```html
<section r-data="{ greeting: 'Hello' }">
    <p>{ greeting }, { user.name }.</p>

    <p r-if="isAdmin">You can see the admin panel.</p>
    <p r-else>You cannot see the admin panel.</p>

    <ul>
        <template r-for="role in roles">
            <li>{ role } (index { $index } of { $length })</li>
        </template>
    </ul>
</section>
```

Fresh data after the pass needs a fresh render or manual DOM updates, as described in the one-shot contract. The next sections summarize the directives and the render contract; the full reference is in [docs/directives.md](docs/directives.md) and [docs/render-contract.md](docs/render-contract.md).

## Directives at a glance

| Syntax | Where it applies | Example |
| --- | --- | --- |
| `r-data` | any element the renderer walks, and an `<r-view>` placeholder in the host page | `r-data="{ plan: 'pro' }"` |
| `r-if` | any element or `<template>` the renderer walks | `r-if="isOpen && isAdmin"` |
| `r-else` | the element immediately after an `r-if` element | `<p r-else>Fallback</p>` |
| `r-for` | any element or `<template>` the renderer walks | `r-for="product in products"` |
| `r-remote` | any element the renderer walks, and an `<r-view>` placeholder | `<div r-remote="./card.html">` |
| `r-shadow` | an `<r-view>` placeholder | `<r-view src="./card.html" r-shadow>` |
| `{ path }` | text nodes of rendered content, not attribute values | `{ user.name }` |

The summary per directive:

- `r-data` declares scoped data for an element and everything below it. It accepts an object literal or a dotted data path, is resolved before the element's own condition, and is merged over the parent scope.
- `r-if` keeps or removes an element, and on a `<template>` it keeps or removes the content, based on an expression of paths, `!`, `&&`, `||`, comparisons, parentheses, and literals.
- `r-else` is a bare attribute that pairs with the condition element before it. With its own `r-if` it becomes an else-if branch.
- `r-for` repeats an element or a template once per array item, with `$index`, `$first`, `$last`, and `$length` in each item scope.
- `r-remote` loads content with GET and renders it by media type: HTML replaces the target content, JSON feeds the target scope.
- `r-shadow` renders a view's content into an open shadow root on the placeholder, which stays in the document as the host.
- `{ path }` interpolates own-property data into text, and an unresolved path keeps its placeholder text.

Each directive's rules, limits, and examples live in [docs/directives.md](docs/directives.md), which also points at the demo page and fixture for that feature.

## Settings

`new Roolith(settings)` merges the given settings over these defaults:

| Setting | Default | Purpose |
| --- | --- | --- |
| `viewTag` | `r-view` | Tag name of a view placeholder. |
| `dataAttribute` | `r-data` | Declares scoped data on an element. |
| `ifAttribute` | `r-if` | Condition directive attribute. |
| `elseAttribute` | `r-else` | Else branch directive attribute. |
| `loopAttribute` | `r-for` | Loop directive attribute. |
| `remoteAttribute` | `r-remote` | Remote content directive attribute. |
| `shadowAttribute` | `r-shadow` | Opts a view placeholder into shadow rendering. |
| `data` | `{}` | Root data scope every view inherits. |
| `viewCache` | `false` | When false, every request is sent with `cache: "no-cache"`. When true, the `fetch` cache option is left unset. |
| `viewErrorClassName` | `r-view-error` | Class name of the element that replaces a failed view. |
| `enableEvents` | `true` | When false, no lifecycle events are dispatched and `onViewRendered` throws. |
| `eventNamePrefix` | `r-view` | Event name prefix, so the events are `<prefix>:rendered`, `<prefix>:error`, and `<prefix>:ready`. |

All directive attribute names are configurable. The library state attributes below are not, because they report library state rather than a template directive.

## State attributes

Rendering exposes these attributes, and a page can rely on their exact names:

- `data-view-error` sits on the element that replaces a failed view, together with the configured `viewErrorClassName`. Its value and the element's text are the failure message.
- `data-r-error` sits on a plain element whose directive failed in place. Its value is the failure message. A failed condition, a failed condition on a `<script>` or `<style>` element, a failed `r-else` pairing, and a failed remote load on a plain element are the cases.
- `data-r-remote="loading"` is present while a remote request for that element is pending, and it is removed when the request finishes, on success and on failure.
- `data-r-shadow-host` marks the placeholder that this library retained as a shadow host. The marker and the shadow root together are what a later pass uses to recognize a host it already rendered.

The failure rules behind `data-view-error` and `data-r-error` are in [docs/render-contract.md](docs/render-contract.md#directive-failure-policy).

## Lifecycle events

All three events are dispatched on `document`:

| Event | Detail | When |
| --- | --- | --- |
| `r-view:rendered` | `{ src, url, nodes }` | After a view's content was placed, either in place of the placeholder or in its shadow root. `src` is the declared source value, `url` is the resolved `URL`, and `nodes` are the nodes that were placed. |
| `r-view:error` | `{ src, error }` | When a view was replaced by its error element. `src` is the declared source value, and `error` is the `Error` whose message replaced the view. |
| `r-view:ready` | none | Once per `run()` pass, after every view of the pass finished. |

```js
import { Roolith } from "./app/roolith.js";

const roolith = new Roolith({ data: { user: { name: "Ada" } } });
const unsubscribe = roolith.onViewRendered("views/greeting.html", ({ url, nodes }) => {
    console.log(url.href, nodes.length);
});

await roolith.run();
unsubscribe();
```

`onViewRendered` accepts a source or an array of sources and matches the render events of those views. An absolute source is compared exactly against the rendered URL; a relative source matches any URL whose path ends with that source path, so write `./views/partial.html` or `views/partial.html` rather than `../views/partial.html`. Subscribing while `enableEvents` is false throws `RoolithJS: Event is disabled`, because no event can arrive. Set the prefix with `eventNamePrefix` if `r-view:*` collides with something else on the page.

## Remote trust model

Remote HTML is trusted exactly as much as view content loaded with `src`. The library fetches a URL and renders the response with the same renderer, so remote markup can use every directive, declare views, and declare further remotes. Nothing is filtered, sanitized, or rewritten for safety: `<script>`, `<style>`, and `<iframe>` elements are left in place, the library does not execute them itself, and what the browser does with the nodes it receives is outside the library's control. Its own changes are the ones its directives describe: attributes it reads are removed, placeholder text is rewritten by interpolation, and conditional and loop directives insert, remove, or repeat elements, per [the directive reference](docs/directives.md#directive-reference).

The request is a plain GET issued as `fetch(url)`, with `cache: "no-cache"` added when `viewCache` is false, and with no custom headers, no body, and no `credentials` option, so cross-origin behavior follows `fetch` defaults. A cross-origin response renders only when CORS allows the request; a request the browser blocks fails like any other network failure and is reported on the element or through the view error element, depending on where `r-remote` was declared. Only a `Content-Type` of exactly `application/json` is treated as data; everything else, including `application/ld+json`, is rendered as markup.

The full statement, including the JSON rules and the failure paths, is in [docs/render-contract.md](docs/render-contract.md#remote-trust-model).

## Demos

The demo pages are static HTML plus an unbundled ES module, so they need a local HTTP server. Run `npx serve .` or `python3 -m http.server 8000` in the repository root and open the printed URL, then:

- `/` for the overview, which links every page.
- `/demo/if.html` for `r-if`, `r-else`, else-if chains, and the expression evaluator.
- `/demo/loop-index.html` for `$index`, `$first`, `$last`, `$length`, and an indexed nested view.
- `/demo/remote.html` for `r-remote` with HTML and JSON responses and the failure fallback.
- `/demo/shadow.html` for `r-shadow`, view style scoping, and a nested view inside a shadow root.

[demo/README.md](demo/README.md) describes the page layout, the fixture views under `views/demo/`, and the two JSON fixtures. The pages link to each other, so the overview is the only entry point a reader needs.

## Build and release

- `npm test` runs the Vitest suite in `happy-dom`. Tests live in `app/tests` and are not part of the bundle, because the build only follows `app/roolith.js`.
- `npm run build` bundles `app/roolith.js` with esbuild into `dist/roolith-<version>.min.js`: one minified ES module, no import statements left, a version banner, and no legal comments. The version comes from `package.json` and appears both in the file name and in the banner (`/*! roolith-js v1.1.0 */`).
- The build deletes every other `*.min.js` file in `dist/`, so the directory holds exactly one bundle.
- `dist/` is gitignored. The artifact is produced locally and is not committed.
- The bundle targets ES2020. The source uses ES2022 class private fields, for example `RemoteTargetCollector` keeps its targets in `#targets`, and esbuild lowers them for that target, so the published bundle never depends on ES2022 private field support.
- The current version is `1.1.0`, a minor bump from `1.0.0`. The release adds `r-if`, `r-else`, loop metadata, `r-remote`, and `r-shadow`, and it also ships four `1.0.0` defect fixes: request dedupe now applies per pass instead of per batch, `data-view-error` now reaches the DOM, interpolation accepts `$`-prefixed paths, and view error text is assigned with `textContent` instead of `innerHTML`. No public API is removed or renamed. `package.json` is `"private": true` and the package is not published, so the version names the bundle file rather than a registry release.

## Documentation map

- [README.md](README.md) - this overview: usage, quick start, settings, state attributes, lifecycle summary.
- [docs/directives.md](docs/directives.md) - every directive with its grammar, examples, interactions, and limits.
- [docs/render-contract.md](docs/render-contract.md) - the one-shot render pass, the failure policy, lifecycle payloads, and the remote trust model.
- [demo/README.md](demo/README.md) - how to run the demo pages and how the fixtures are laid out.
- [TODO.md](TODO.md) - the feature TODO and the decision log behind this release.
