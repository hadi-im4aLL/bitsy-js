# BitsyJS

A tiny, dependency-free, HTML-first view library for adding declarative data binding, loops, conditions, fragments, and event helpers to markup you already render.

> **Development status:** BitsyJS is actively in development and purely handcrafted. Features and APIs may change as the library grows. A dedicated documentation site is planned.

## What is BitsyJS?

BitsyJS is a small JavaScript library that enhances existing HTML after the page loads. Instead of asking you to move your templates into a component framework, it reads special attributes and tags directly from the DOM and fills in data, repeats blocks, shows or hides elements, loads fragments, and wires simple events. There is no virtual DOM, no component compiler, no build step required, and no runtime dependency.

It is designed for pages whose HTML is produced by a server-side application, a static site generator, or hand-written markup. BitsyJS treats that HTML as the source of truth and adds just enough client-side behavior on top.

```html
<div b-data="{ greeting: 'Hello' }">
    <h1>{greeting}, {user.name}</h1>
    <p b-if="user.online">Currently online</p>
    <ul>
        <li b-for="project of projects">{project.name}</li>
    </ul>
</div>
```

```js
import { BitsyJS } from "@im4all/bitsy-js";

const bitsy = new BitsyJS({
    data: {
        user: { name: "Ada", online: true },
        projects: [{ name: "BitsyJS" }, { name: "Rolith" }],
    },
});

bitsy.run();
```

## Why BitsyJS?

Most web applications already have a server that can render HTML. Adding a small amount of interactivity to those pages often means either accepting a full single-page framework, duplicating templates on the client, or pulling in a library that is larger and more opinionated than the problem requires. BitsyJS was created to fill that gap.

- **Keep the HTML you already have.** BitsyJS works with server-rendered markup from Laravel, Rails, Django, Go templates, PHP, or a static site. There is no second template language to maintain.
- **Avoid a build step.** The library is plain ES modules. You can import it from npm or a CDN and call `run()`. Nothing needs to be compiled.
- **Stay declarative and readable.** Directives are ordinary HTML attributes like `b-data`, `b-for`, and `b-if`. Designers and backend developers can read the template without learning a component runtime.
- **Render once, predictably.** BitsyJS runs a single pass over the DOM, resolves its directives in place, and leaves the remaining HTML intact. There is no hidden reactivity graph, no hydration mismatch, and no re-render loop.
- **Reuse server partials as fragments.** `b-view` fetches HTML fragments and inlines them, including nested fragments, so existing partials can be shared between server and client rendering.
- **Progressive by default.** If JavaScript fails or is disabled, the original markup is still present. BitsyJS improves the page rather than replacing it.

BitsyJS is not intended to replace React, Vue, Svelte, or other frameworks for highly interactive applications. It is a focused view layer for pages that need modest, declarative behavior without adopting an application framework.

## Features

- `b-data` for local data scopes and `{path}` placeholders.
- `b-for` for repeating markup over arrays, including arrays of objects and primitive values.
- `b-if` for conditional display using JavaScript expressions.
- `b-view` for loading HTML fragments, including nested fragments.
- `b-container` for grouping markup that is unwrapped after rendering.
- `b-js` for rendering the result of a JavaScript expression.
- `b-event` for small declarative event behaviors such as changing text, updating HTML, and toggling classes.
- Custom directive tag names.
- Render lifecycle events through `bitsy.on()` and `bitsy.ready()`.
- No dependencies and no build tooling required at runtime.
- About 9.7 kB minified and 3.3 kB gzipped.

## Installation

### npm

```bash
npm install @im4all/bitsy-js
```

```js
import { BitsyJS } from "@im4all/bitsy-js";
```

### CDN

BitsyJS is also distributed as an ES module for direct browser use:

```html
<script type="module">
    import { BitsyJS } from "https://unpkg.com/@im4all/bitsy-js/dist/bitsy.min.js";

    const bitsy = new BitsyJS();
    bitsy.run();
</script>
```

The same bundle is available from jsDelivr:

```html
<script type="module">
    import { BitsyJS } from "https://cdn.jsdelivr.net/npm/@im4all/bitsy-js/dist/bitsy.min.js";

    const bitsy = new BitsyJS();
    bitsy.run();
</script>
```

## Quick start

Create a normal HTML page, add directives to the markup, and start BitsyJS after the DOM is available.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>BitsyJS demo</title>
</head>
<body>
    <main>
        <h1>{title}</h1>

        <p b-if="isLoggedIn">Welcome back, {user.name}</p>
        <p b-if="!isLoggedIn">Please sign in.</p>

        <ul>
            <li b-for="player of players">
                {_index}: {player.name} - {player.score}
            </li>
        </ul>

        <button data-b-event="click" data-b-event-toggle-class="active">
            Toggle active
        </button>
    </main>

    <script type="module">
        import { BitsyJS } from "@im4all/bitsy-js";

        const bitsy = new BitsyJS({
            data: {
                title: "Scoreboard",
                isLoggedIn: true,
                user: { name: "Ada" },
                players: [
                    { name: "Alpha", score: 10 },
                    { name: "Beta", score: 7 },
                ],
            },
        });

        bitsy.ready(() => {
            console.log("BitsyJS rendered the page");
        });

        bitsy.run();
    </script>
</body>
</html>
```

## Directives

### `b-data`

`b-data` creates a local scope for the element and its descendants. The attribute value is a JavaScript object literal, not strict JSON, so keys can be unquoted and values can be expressions.

```html
<div b-data="{ user: { name: 'Ada' }, score: 42, online: true }">
    <p>{user.name}</p>
    <p>{score}</p>
    <p>{online}</p>
</div>
```

Placeholders use dot paths:

```html
<div b-data="{ colors: ['red', 'green', 'blue'], matrix: [[1, 2], [3, 4]] }">
    <p>First color: {colors.0}</p>
    <p>Second row, second cell: {matrix.1.1}</p>
</div>
```

Values are inserted as HTML. Missing and `null` values leave the placeholder unchanged.

### `b-for`

`b-for` repeats an element for every item in an array. The array is read from the global data passed to the `BitsyJS` constructor.

```html
<li b-for="player of players">
    {player.name} - {player.score}
</li>
```

Each iteration provides loop metadata:

- `_index`: zero-based position.
- `_isFirst`: true for the first item.
- `_isLast`: true for the last item.

```html
<li b-for="player of players">
    <span>{_index}</span>
    <span b-if="_isFirst">First</span>
    <span b-if="_isLast">Last</span>
</li>
```

### `b-if`

`b-if` shows or hides an element based on a JavaScript expression. Hidden elements remain in the DOM with `display: none`.

```html
<p b-if="role === 'admin' && score > 80">Admin with a high score</p>
<p b-if="Math.abs(score - 90) < 10">Within 10 points of 90</p>
```

Conditions run after loops, so they can use loop metadata and read the global collection through `_index`:

```html
<li b-for="entry of menu">
    {entry.name}
    <span b-if="_isFirst">[first]</span>
    <span b-if="menu[_index].enabled">[enabled]</span>
</li>
```

### `b-view`

`b-view` fetches an HTML fragment and replaces itself with the fragment content. Nested `b-view` sources are resolved relative to the fragment file that contains them.

```html
<b-view src="./fragments/header.html"></b-view>
```

Fragments are inlined before data binding and directives run, so fragment markup can use `b-data`, `b-for`, `b-if`, and the other directives exactly like inline markup. A fragment can include its own `<style>` tag, and each `b-view` instance fetches its own copy.

### `b-container`

`b-container` is a layout wrapper. It is removed after rendering, leaving only its children.

```html
<b-container>
    <p>First paragraph</p>
    <p>Second paragraph</p>
</b-container>
```

The wrapper is not an element of its own. Its attributes are discarded when it is unwrapped, so put classes, styles, and behavior on the children. Containers can be nested, used inside loops, and combined with `b-data` and `b-if`.

### `b-js`

`b-js` evaluates a JavaScript expression and writes the result as the element's HTML.

```html
<div b-js="new Date().toLocaleString()"></div>
<div b-js="numberOne * numberTwo"></div>
```

The expression uses the same scope as conditions and can read local `b-data` values.

### `b-event`

`b-event` binds a DOM event through a `data-b-event` attribute. Modifier attributes describe what should happen when the event fires.

```html
<button data-b-event="click" data-b-event-text="Clicked">Submit</button>

<button
    data-b-event="click"
    data-b-event-html="<strong>Bold data</strong>"
></button>

<button
    class="is-highlight"
    data-b-event="click"
    data-b-event-remove-class="is-highlight"
></button>

<button data-b-event="click" data-b-event-toggle-class="is-highlight"></button>
```

Supported modifiers:

- `data-b-event-html`: replace the element's HTML.
- `data-b-event-text`: replace the element's text.
- `data-b-event-add-class`: add a class.
- `data-b-event-remove-class`: remove a class.
- `data-b-event-toggle-class`: toggle a class.
- `data-b-event-revert`: restore the element after a number of seconds.

```html
<button
    data-b-event="click"
    data-b-event-text="Saved"
    data-b-event-revert="3"
>
    Save
</button>
```

## Scoping rules

BitsyJS uses a simple, explicit scope model.

- Global data passed to the `BitsyJS` constructor is the base for every scope.
- `b-data` merges its local keys over the global data using a shallow merge.
- A local key replaces a global key as a whole value. Nested objects are not deep-merged.
- Sibling `b-data` scopes do not share data.
- `b-for` reads collection names from global data only.
- `b-if` and `b-js` combine global data, the nearest `b-data` scope, and loop metadata, with the nearest scope taking precedence and loop metadata overriding both.
- Loop metadata is available to conditions inside a loop.

```html
<div b-data="{ theme: 'local-light' }">
    <p>{theme}</p>
</div>

<div b-data>
    <p>{theme}</p>
</div>
```

## Rendering lifecycle

`run()` performs one ordered pass:

1. Fetch and inline `b-view` fragments, including nested fragments.
2. Apply `b-data` scopes and replace `{path}` placeholders.
3. Run `b-for`, `b-if`, and `b-js` directives.
4. Unwrap `b-container` elements.
5. Remove `b-data` attributes.
6. Bind `b-event` listeners.
7. Dispatch the `bitsy.rendered` event.

`run()` returns a promise. You can listen for the render event with `on()` or its `ready()` alias:

```js
const bitsy = new BitsyJS({ data: { appName: "BitsyJS" } });

bitsy.on("rendered", () => {
    console.log("rendered");
});

bitsy.ready(() => {
    console.log("also rendered");
});

await bitsy.run();
```

Listeners run in registration order. A listener registered after `run()` has rendered stays idle until the next render.

## Custom tags

You can replace the default directive tag names through the `tags` setting. The `tags` object replaces the default object as a whole, so include every key you want to keep active.

```js
const bitsy = new BitsyJS({
    tags: {
        dataBind: "x-data",
        forLoop: "x-for",
        view: "x-view",
        container: "x-container",
        conditionIf: "x-if",
        rawJs: "x-js",
        event: "x-event",
    },
    data: {
        enabled: true,
    },
});
```

Default tags:

| Setting | Default | Purpose |
| --- | --- | --- |
| `dataBind` | `b-data` | Local data scope |
| `forLoop` | `b-for` | Loop directive |
| `view` | `b-view` | Fragment loader |
| `container` | `b-container` | Layout wrapper |
| `conditionIf` | `b-if` | Conditional display |
| `rawJs` | `b-js` | Expression output |
| `event` | `b-event` | Event helper |

When overriding tags, the defaults that are left out of the object are not activated.

## Data parsing

`b-data` values are evaluated as JavaScript object literals. This allows unquoted keys and expressions:

```html
<div b-data="{ pi: Math.PI, doubled: 21 * 2 }">
    <p>{pi}</p>
    <p>{doubled}</p>
</div>
```

Nested objects and arrays can be written directly:

```html
<div b-data="{ meta: { theme: 'dark' }, flags: ['a', 'b'] }">
    <p>{meta.theme}</p>
    <p>{flags.1}</p>
</div>
```

Strings that start with `{` or `[` are parsed recursively, which is useful when values arrive as strings:

```html
<div b-data="{ meta: '{ compact: true }', flags: '[1, 2]' }">
    <p>{meta.compact}</p>
    <p>{flags.1}</p>
</div>
```

If a nested string looks like a collection but fails to parse, it stays a plain string instead of throwing. A malformed `b-data` attribute itself throws a `SyntaxError`.

## Security

BitsyJS evaluates JavaScript expressions found in `b-data`, `b-if`, and `b-js` attributes using `new Function`. Only use it with template markup you control. Never pass untrusted user input into a directive expression, and do not let users author `b-data`, `b-if`, or `b-js` values.

## Browser support

BitsyJS targets modern browsers with ES modules, `Proxy`, `fetch`, `DOMParser`, and async functions. It does not support Internet Explorer.

## Development

Install dependencies and start the demo server:

```bash
npm install
npm run dev
```

The demo index is `index.html`. Each page under `demo/` is a self-contained example of a feature.

Build the minified distribution bundle:

```bash
npm run build
```

The bundle is written to `dist/bitsy.min.js`.

## Status

BitsyJS is actively in development and purely handcrafted. More directives and capabilities are planned, and a dedicated documentation site will be added later.

## License

MIT. See [LICENSE](./LICENSE).
