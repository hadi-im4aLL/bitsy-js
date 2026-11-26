# BitsyJS

A tiny, dependency-free, HTML-first view library for adding declarative data binding, loops, conditions, fragments, events, remote data, and form validation to markup you already render. About 22 kB minified and 6.8 kB gzipped.

> **Development status:** BitsyJS is actively in development and purely handcrafted. Features and APIs may change. A dedicated documentation site is planned.

## What it is

BitsyJS enhances existing HTML after the page loads. It reads attributes and tags directly from the DOM and fills in data, repeats blocks, shows or hides elements, loads fragments, wires events, fetches remote data, and validates forms. There is no virtual DOM, component compiler, runtime dependency, or required build step for consumers.

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
    await bitsy.run();
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
await bitsy.run();
```

## Directives

| Directive | Purpose |
| --- | --- |
| `b-data="{ key: value }"` | Creates a local data scope. Placeholders use `{path.to.value}`. |
| `b-for="item of items"` | Repeats an element for each item in a global array. Provides `_index`, `_isFirst`, and `_isLast`. |
| `b-if="expression"` | Shows or hides an element with `display: none`. |
| `b-view src="./partial.html"` | Fetches and inlines an HTML fragment. Nested fragments are relative to their parent. |
| `b-container` | Groups markup and removes the wrapper after rendering. |
| `b-js="expression"` | Evaluates an expression and writes the result as HTML. |

`b-data` values are JavaScript object literals, not strict JSON. Nested objects and arrays work, and strings starting with `{` or `[` are parsed recursively. Values are rendered as HTML, and missing or `null` values leave the placeholder untouched.

## Events

| Attribute | Purpose |
| --- | --- |
| `data-b-event="click"` | Binds any DOM event. |
| `data-b-event-html`, `-text`, `-add-class`, `-remove-class`, `-toggle-class` | Applies an effect on the event. |
| `data-b-event-revert="3s"` | Reverts supported effects after a delay. |
| `data-b-event-remote="url"` | Fetches a URL and renders the response. |
| `data-b-event-target="#id"` | Target element for rendered output. |
| `data-b-event-remote-method="POST"`, `-remote-payload="{...}"` | Request method and JSON body for non-GET requests. |
| `data-b-event-indicator="is--loading"` | Class added to the target while a remote request runs. |

Remote responses are parsed by content type (JSON, text/HTML, or blob). Without a template, JSON objects are rendered as pretty-printed text.

## Templates

Render remote or AJAX responses through a `<template>`:

```html
<div id="users" data-b-use-template="#users-tpl" data-b-keep-existing></div>

<template id="users-tpl" data-b-remote-data="users">
    <ul>
        <li b-for="user of users">{_index}. {user.name}</li>
    </ul>
</template>
```

| Attribute | Purpose |
| --- | --- |
| `data-b-use-template="#id"` | Renders the response using the referenced template. |
| `data-b-remote-data="users"` | Names the response variable inside the template. |
| `data-b-keep-existing` | Appends instead of replacing existing content. |

`b-for` and `b-if` work inside templates, and `{users.0.name}` style paths are supported.

## Forms

Validate and submit forms without extra JavaScript:

```html
<form action="/signup" method="post" data-b-validate-form="true" data-b-form-ajax="true" data-b-form-ajax-target="#result">
    <input name="email" data-b-validate="required|email" />
    <small data-b-validate-message="email"></small>
    <button type="submit">Sign up</button>
</form>
```

| Attribute | Purpose |
| --- | --- |
| `data-b-validate-form="true"` | Validates the form on submit. |
| `data-b-validate="required\|email\|min:5"` | Rules for a field, separated by `\|`. |
| `data-b-validate-message="email"` | Element that receives the field error text. |
| `data-b-validate-error-message="..."` | Overrides the message for one field. |
| `data-b-form-ajax="true"` | Submits with `fetch` instead of a page reload. |
| `data-b-form-ajax-target="#id"` | Target element for the AJAX response. |
| `data-b-form-remove-on-submit="true"` | Removes the form after a successful submit. |

Available rules: `required`, `email`, `min:n`, `max:n`, `length:n`, `number`, `int`, `float`, `bool`, `same:field`, `pattern:regex`, `date`, `date:Y-m-d`, `jsDate`, and `time`. Invalid fields (and their parents) get the `error` class, valid ones get `success`. Customize classes and messages:

```js
new BitsyJS({
    validatorConfig: {
        classNames: { error: "is-invalid", success: "is-valid" },
        messages: { required: "This field is required" },
    },
});
```

AJAX forms support `get`, `post`, `put`, `patch`, and `delete`. GET parameters are appended to the URL; other methods send form data as the body.

## Scope and lifecycle

- Global data from the constructor is the base for every scope.
- `b-data` shallow-merges local keys over global data.
- `b-for` reads arrays from global data only.
- `b-if` and `b-js` use global data and the nearest `b-data` scope. `b-if` also sees loop metadata, which takes precedence.
- `run()` is async: it loads fragments, applies `b-data`, runs `b-for`, `b-if`, and `b-js`, unwraps containers, removes directive attributes, binds events, wires forms, then dispatches `bitsy.rendered`.
- `bitsy.on("rendered", callback)` and `bitsy.ready(callback)` run after rendering. Listeners added later run on the next render.

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
        remoteData: "data-x-remote-data",
        useTemplate: "data-x-use-template",
        keepExisting: "data-x-keep-existing",
        validateForm: "data-x-validate-form",
        validateRule: "data-x-validate",
        validateMessage: "data-x-validate-message",
        validateErrorMessage: "data-x-validate-error-message",
        formAjax: "data-x-form-ajax",
        formAjaxRender: "data-x-form-ajax-target",
        formRemoveOnSubmit: "data-x-form-remove-on-submit",
    },
});
```

Renaming `event` also renames its attributes, for example `data-x-event` and `data-x-event-toggle-class`.

## Security

BitsyJS evaluates JavaScript expressions in `b-data`, `b-if`, and `b-js` with `new Function`, and expressions can reach browser globals. HTML values, fragments, and remote responses are inserted into the DOM as markup. Only use directive expressions and remote endpoints you trust, and never pass untrusted user input into them.

## Development

```bash
npm install
npm run dev
npm run build
```

Runnable feature demos are in `demo/` and linked from `index.html`. The build output is `dist/bitsy.min.js`.

## License

MIT. See [LICENSE](./LICENSE).
