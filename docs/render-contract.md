# Render contract

This file describes how one render pass runs, what it guarantees, and what it leaves behind in the DOM. The directive grammar and examples are in [directives.md](directives.md), and the settings table is in [the README](../README.md#settings).

## What one pass does

`await roolith.run()` performs one pass:

1. It collects every `<r-view>` placeholder in the document, in document order. A placeholder this library already retained as a shadow host is skipped, because it carries `data-r-shadow-host` together with a shadow root.
2. It loads each placeholder's content, from `src` or from `r-remote`. One absolute URL is requested once per pass, and views and remotes share that request map, so a URL declared at the root and again inside a nested view loads once.
3. It renders each loaded content into nodes. Rendered markup is parsed into a detached `<template>` first, so directives render before anything touches the document. Remote targets discovered by that walk load next, and then the views declared by the rendered content load, with their relative URLs resolved against the content's own URL.
4. It places each result: in place of the placeholder, or in an open shadow root on it when the placeholder carries the shadow attribute.
5. It dispatches `r-view:ready` on `document`, once, after every view of the pass finished.

Content renders before it is placed, so nested views dispatch their `rendered` events before their parent view does. A failure never rejects the pass: a failed remote load is reported on its element, and a failed view is replaced by its error element, while sibling views keep rendering.

Request outcomes are shared within a pass. A URL that fails once reports the same failure everywhere it is used in that pass; there is no per-consumer retry.

## Rendering is one-shot

The first `run()` pass evaluates every directive exactly once. After that:

- There is no reactivity layer: no proxies, no observers, no dependency tracking, and no `update()` API.
- Data changes after the pass are not observed. Changing an object you passed as `data`, or `roolith.settings.data`, changes nothing in the DOM.
- Remote responses are not re-fetched and view content is not re-rendered.
- A second `run()` finds only placeholders that are still in the document, which after a pass means none, because each placeholder was either replaced by its content or retained as a shadow host that is skipped. It dispatches `r-view:ready` again, and does nothing else.

To show new data you have three options, and the library picks none of them for you: reload the page, insert fresh placeholders and run a new pass, or update the DOM yourself.

## Directive failure policy

Failures are visible rather than silent, and no failure removes content without leaving a report.

| Where the failure happens | Outcome |
| --- | --- |
| A condition, an `r-else` pairing, or a remote load on a plain element the renderer walks | The element stays in place, gets `data-r-error` with the message, and `console.error` receives the error once. The exception is an orphan `r-else` that also carries a falsy `r-if`: the error is recorded first and the element is then removed by its own condition, so only the console line survives. |
| A loop expression, or a rejected `r-data` declaration, anywhere the renderer walks | The error leaves the template walk and takes the view error element path, because it decides which elements exist rather than whether one element is kept. |
| Any failure on a `<r-view>` placeholder, including a failed condition written on it | The placeholder is replaced by the view error element: a `<div>` with the configured `viewErrorClassName` and `data-view-error`, whose text and attribute value are the message. The `r-view:error` event fires. The child view is never fetched. |
| A condition on a raw-text element | Treated like the plain-element case: `data-r-error` on the element plus a console error. A loop or data attribute there is consumed without being resolved, so it cannot fail. |

Two consequences are worth knowing:

- Because a directive failure is reported rather than thrown away, an element can carry `data-r-error` and still render. A plain element whose own `r-if` failed, for example, still issues its remote request and still replaces its children while keeping the recorded error.
- A failed remote keeps its placeholder children exactly as authored, because the response that would have decided their scope never arrived. Directives inside those children were not evaluated by the remote step, though a nested `<r-view>` inside them still loads through the view pass that follows.

## State attributes

These attributes are written by the library and are not configurable, because they report library state rather than a template directive.

| Attribute | Written on | Value | Meaning |
| --- | --- | --- | --- |
| `data-view-error` | the element that replaces a failed view | the failure message | The view at that position failed. The element also carries the configured `viewErrorClassName`. |
| `data-r-error` | the element that failed in place | the failure message | A directive failed on a plain element and the element was kept. |
| `data-r-remote` | the element whose remote request is in flight | `loading` | A remote request is pending. It is removed when the request finishes, on success and on failure. |
| `data-r-shadow-host` | the retained shadow host | empty string | This placeholder was placed as a shadow host by this library, and its rendered content is in its shadow root. |

`data-r-error` and `data-r-remote` keep their names even when `remoteAttribute`, `ifAttribute`, and the other directive attributes are customized. `data-view-error` keeps its name too, and the class name beside it is the one configurable part, through `viewErrorClassName`.

## Lifecycle events

All events are dispatched on `document` with `CustomEvent`, and every name starts with `eventNamePrefix`, whose default is `r-view`.

| Event | `detail` | When it fires |
| --- | --- | --- |
| `r-view:rendered` | `{ src, url, nodes }` | After a view's content was placed. `src` is the declared source value, `url` is the resolved `URL` object, and `nodes` are the rendered nodes that were placed, which for a shadow view are the nodes now inside its shadow root. |
| `r-view:error` | `{ src, error }` | When a view is replaced by its error element, for every failure reason: a failed request, an unparseable source, a blank source, a circular reference, invalid data, an invalid loop, or a failed condition on the placeholder. `src` is the declared source value and `error` is the `Error` that replaced the view. |
| `r-view:ready` | none | Once per `run()` pass, after every view of the pass rendered or failed. |

```js
import { Roolith } from "./app/roolith.js";

const roolith = new Roolith({ data: { user: { name: "Ada" } } });

const unsubscribe = roolith.onViewRendered(
    ["views/header.html", "views/body.html"],
    ({ url, nodes }) => {
        console.log("rendered", url.pathname, nodes.length);
    },
);

document.addEventListener("r-view:error", (event) => {
    console.warn("view failed", event.detail.error);
});

await roolith.run();
unsubscribe();
```

`src` on a rendered event is the declared value trimmed, not the resolved URL, so compare with `url.pathname` or `url.href` when a page needs an absolute address. On an error event, `src` is `null` when the placeholder declared no source at all.

### `onViewRendered`

`roolith.onViewRendered(src, callback)` subscribes to the rendered events of one view source or of an array of them, and returns a function that removes the subscription. The callback receives `{ url, nodes }`.

- An absolute source is compared exactly against the rendered URL.
- A relative source matches any URL whose path ends with that source path, so `./views/partial.html` and `views/partial.html` both match `/views/partial.html`. A `../views/...` source does not match, because the leading `..` is kept in the suffix.
- A source containing `://` is matched by that exact comparison, and the matcher builds `new URL(src)` when the subscription is created, so an invalid absolute value such as `http://[` throws a `TypeError` from the `onViewRendered` call itself instead of returning a library error.
- Subscribe before `run()`, because the pass dispatches the events.
- Subscribing while `enableEvents` is false throws `RoolithJS: Event is disabled`, because no event can arrive.
- `onViewRendered` listens on the configured prefix already, so a customized `eventNamePrefix` needs no change in the subscription. It matters only when a page listens on `document` itself.

The callback is the integration point for content a document query cannot reach. Shadow view nodes are the main case: `document.querySelectorAll` does not pierce a shadow root, while `nodes` from the event are the rendered nodes inside it, and `nodes[0].getRootNode()` is that shadow root.

## API surface

- `new Roolith(settings)` merges the settings over the defaults in [the README](../README.md#settings) and exposes the merged object as `roolith.settings`.
- `await roolith.run()` performs one render pass over the document and resolves when it finished. It returns nothing.
- `roolith.onViewRendered(src, callback)` returns an unsubscribe function, as described above.

## Remote trust model

Remote content is trusted exactly as much as view content loaded with `src`, because it renders through the same pipeline with the same renderer.

- No sanitizer is applied. Nothing in a response is filtered, sanitized, or rewritten for safety: `<script>`, `<style>`, and `<iframe>` elements are left in place, the library does not execute them itself, and what the browser does with the nodes it receives is outside its control. The only attributes removed are ones the library reads or sets itself, namely the directive attributes it consumes, the view `src` it has already read, and the `data-r-remote` marker it clears. Interpolation rewrites text nodes that contain placeholders, and conditional and loop directives insert, remove, or repeat elements, per [the directive reference](directives.md#directive-reference).
- A rendered response can use every directive, declare views, and declare further remotes, which means a remote document can pull in more remote documents.
- The request is `fetch(url)`, with `cache: "no-cache"` added when `viewCache` is false: a GET, no body, no custom headers, and no `credentials` option, so cross-origin requests follow `fetch` defaults and do not send credentials cross-origin.
- A cross-origin response renders only when the server allows the request through CORS. A request the browser blocks never produces a response, so it fails like a network failure: `data-r-error` on a plain element, or the view error element and an `r-view:error` event for a view.
- A response is data only when `Content-Type` is exactly `application/json` after parameters are dropped and the value is lower cased. Everything else, including `application/ld+json`, is rendered as markup. JSON payloads are parsed with `JSON.parse`, so a body that is not valid JSON is a failure rather than markup.
- Circular references are detected by absolute URL, so a remote document that includes itself fails predictably instead of loading forever.
- POST, custom headers, request bodies, and a sanitizer are all out of scope for this release.

## Known limits

These are deliberate boundaries of the current release. The directive-level details are in [directives.md](directives.md).

- Rendering is one-shot, with no reactivity and no update API.
- Host page markup is never rendered as a template, so directives on host elements are inert. An `<r-view>` placeholder is the exception, because the pipeline reads its `src`, `r-remote`, `r-data`, and `r-shadow` itself.
- Placeholder children inside rendered content are rendered and walked before they are discarded, so a fallback view still loads and still fires its event. [The directive reference](directives.md#placeholder-children) states exactly what happens to them.
- `r-remote` is GET only, with no headers and no body, and a template consumes the attribute without a request.
- Expressions support paths, `!`, `&&`, `||`, comparisons, parentheses, and literals. There is no arithmetic, no loose equality, and no index access.
- Only open shadow roots are supported, with no slot forwarding and no declarative shadow DOM.
- The error class name defaults to `r-view-error` and can be changed with `viewErrorClassName`; the state attribute names are fixed.
