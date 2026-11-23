# BitsyJS

A tiny, dependency-free, HTML-first view library for adding declarative data binding, loops, conditions, fragments, and event helpers to markup you already render. About 9.7 kB minified and 3.3 kB gzipped.

> **Development status:** BitsyJS is actively in development and purely handcrafted. Features and APIs may change. A dedicated documentation site is planned.

## What it is

BitsyJS enhances existing HTML after the page loads. It reads attributes and tags directly from the DOM and fills in data, repeats blocks, shows or hides elements, loads fragments, and wires simple events. There is no virtual DOM, component compiler, runtime dependency, or required build step for consumers.

It is built for HTML produced by server-side apps, static site generators, or hand-written pages.

## Why BitsyJS

- Keep the HTML you already have. No second template language or client-side re-render layer.
- Avoid a build step. Import from npm or a CDN and call `run()`.
- Stay declarative. Directives are ordinary HTML attributes.
- Render once. BitsyJS makes a single pass and leaves clean, readable markup.
- Reuse server partials with `b-view` fragments.
- Improve pages progressively. If JavaScript fails, the original markup remains.

BitsyJS is not a replacement for React, Vue, or Svelte in highly interactive applications.

## Install

### npm

```bash
npm install @im4all/bitsy-js
```

```js
import { BitsyJS } from "@im4all/bitsy-js";
```

### CDN

```html
<script type="module">
    import { BitsyJS } from "https://unpkg.com/@im4all/bitsy-js/dist/bitsy.min.js";

    const bitsy = new BitsyJS();
    bitsy.run();
</script>
```

The same build is available from jsDelivr: `https://cdn.jsdelivr.net/npm/@im4all/bitsy-js/dist/bitsy.min.js`.

## Quick start

```html
<div b-data>
    <h1>{title}</h1>
    <p b-if="isLoggedIn">Welcome back, {user.name}</p>
    <p b-if="!isLoggedIn">Please sign in.</p>

    <ul>
        <li b-for="player of players">{_index}: {player.name} - {player.score}</li>
    </ul>

    <button data-b-event="click" data-b-event-toggle-class="active">Toggle</button>
</div>
```

```js
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

bitsy.ready(() => console.log("rendered"));
bitsy.run();
```

## Directives

| Directive | Purpose |
| --- | --- |
| `b-data="{ key: value }"` | Creates a local data scope. Placeholders use `{path.to.value}`. |
| `b-for="item of items"` | Repeats an element for each array item. Provides `_index`, `_isFirst`, and `_isLast`. |
| `b-if="expression"` | Shows or hides an element with `display: none`. |
| `b-view src="./partial.html"` | Fetches and inlines an HTML fragment. Nested fragments are relative to their parent. |
| `b-container` | Groups markup and removes the wrapper after rendering. |
| `b-js="expression"` | Evaluates an expression and writes the result as HTML. |
| `data-b-event="click"` | Binds an event. Modifiers include `-html`, `-text`, `-add-class`, `-remove-class`, `-toggle-class`, and `-revert`. |

`b-data` values are JavaScript object literals, not strict JSON. Nested objects and arrays work, and strings starting with `{` or `[` are parsed recursively. Values are rendered as HTML.

## Scope and lifecycle

- Global data from the constructor is the base for every scope.
- `b-data` shallow-merges local keys over global data.
- `b-for` reads arrays from global data only.
- `b-if` uses global data, the nearest `b-data` scope, and loop metadata. Loop metadata takes precedence.
- `b-js` uses global data and the nearest `b-data` scope.
- `run()` loads fragments, applies `b-data`, runs `b-for`, `b-if`, and `b-js`, unwraps containers, cleans up, and binds events.
- `bitsy.on("rendered", callback)` and `bitsy.ready(callback)` run after rendering.

## Custom tags

Override the default tags with the `tags` setting. The object replaces the defaults, so include every tag you want active.

```js
new BitsyJS({
    tags: {
        dataBind: "x-data",
        forLoop: "x-for",
        view: "x-view",
        container: "x-container",
        conditionIf: "x-if",
        rawJs: "x-js",
        event: "x-event",
    },
});
```

## Security

BitsyJS evaluates JavaScript expressions in `b-data`, `b-if`, and `b-js` with `new Function`. Only use it with template markup you control. Never pass untrusted user input into directive expressions.

## Development

```bash
npm install
npm run dev
npm run build
```

Runnable feature demos are in `demo/` and linked from `index.html`. The build output is `dist/bitsy.min.js`.

## License

MIT. See [LICENSE](./LICENSE).
