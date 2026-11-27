# BitsyJS documentation site

The documentation is a static site in this directory. It uses BitsyJS at runtime for its own shell and
for every feature example.

```bash
npm run dev
```

Then open `/docs/index.html`. A server is required: the pages import an ES module, `b-view` fetches the
shared partials, and the remote examples fetch fragment and JSON files.

## The site uses BitsyJS

The shared chrome is not duplicated into every page. Each page contains `b-view` tags:

```html
<b-view src="../partials/header.html"></b-view>
<b-view src="../partials/sidebar.html"></b-view>
<b-view src="../partials/page-meta.html"></b-view>
<b-view src="../partials/footer.html"></b-view>
```

The partials use BitsyJS to render themselves:

- `b-data` scopes the header, sidebar and footer.
- `b-for` renders the navigation and the page metadata badges from `assets/docs-data.js`.
- `b-if` hides empty search groups and shows the no-results message.
- `b-on:input` writes the sidebar query into a signal.
- `signal` and `computed` filter the nav in real time.
- Attribute bindings mark the active page and group.
- Placeholders render the version in the footer and sidebar.

`assets/docs-app.js` provides that shared data through `docsData()`. Every page script spreads it into
its own `BitsyJS` instance, so the shell and the examples share one render pass.

## Structure

| Path                  | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `index.html`          | Landing page. Loads the same header and footer partials.                |
| `getting-started/`    | Introduction, installation and quick start.                             |
| `features/`           | One page for each directive or feature.                                 |
| `reference/`          | Lifecycle, API reference and security.                                  |
| `partials/`           | Header, sidebar, page metadata and footer fetched with `b-view`.        |
| `assets/docs-data.js` | Release version and sizes, navigation groups, metadata badges, search keywords and the CDN URL. |
| `assets/docs-app.js`  | Shared data for the shell and the active page.                          |
| `assets/docs.js`      | Theme, code frames, copy buttons, mobile menu, TOC and search shortcut. |
| `assets/bitsy.min.js` | Browser bundle used by the site and all examples.                       |
| `assets/demo/`        | Fragments and JSON responses used by offline examples.                  |

## Editing

There is no build step. Edit a page directly, or edit a partial to change the shell on every page. After
changing the library, copy the new bundle over `assets/bitsy.min.js`:

```bash
npm run build
cp dist/bitsy.min.js docs/assets/bitsy.min.js
```

Feature pages should keep using the shared demo classes in `assets/docs.css` and run real BitsyJS
examples. Keep example responses in `assets/demo/` so the site works without a backend.
