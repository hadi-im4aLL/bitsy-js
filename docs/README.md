# BitsyJS docs template

A static preview of the future documentation site: one landing page and one guide page, built on
[roolith css](https://roolith-css.habibhadi.com/) with one override stylesheet.

## Preview

Serve the repository root, so the demo links and the live counter example resolve:

```bash
python3 -m http.server 8000
```

Then open:

- http://127.0.0.1:8000/docs/index.html
- http://127.0.0.1:8000/docs/getting-started/introduction.html

A static server is needed because the live demo imports an ES module. The rest of the pages render
from `file://` as well.

## Files

```
docs/
  index.html                              landing page
  getting-started/introduction.html       guide page
  assets/
    docs.css                              the only stylesheet after roolith
    docs.js                               theme, menu, copy, search, on-page nav
    bitsy.min.js                          a copy of dist/bitsy.min.js for the live demo
    mark.svg                              favicon and wordmark
```

## Stack

- roolith-css 4.1.0 from jsDelivr
- Inter for text, JetBrains Mono for code (Google Fonts)
- highlight.js 11.11.1 with the GitHub light and GitHub dark themes
- No build step, no framework, one CSS override file

`docs.css` maps the roolith tokens (`--r-*`) to the docs palette and then styles the docs components
(`docs-*`). The framework files are loaded unmodified from the CDN.

## Theme

The theme follows the operating system on the first visit. The toggle stores the choice in
`localStorage` under `bitsy-docs-theme`. The same switch enables the matching highlight.js theme, so
code blocks stay readable in both themes.

## Content status

The copy is taken from the repository README. Before this becomes the real documentation site:

- The npm install command and package links assume `@im4all/bitsy-js` is published. The registry has
  no such package yet, so `npm i @im4all/bitsy-js` and the npm footer link will not resolve today.
- The live counter in the landing hero imports `assets/bitsy.min.js`, a copy of the built library in
  this repository. Point it at the published build when the package ships.
- The guide page points at the existing `demo/` pages. The sidebar currently uses in-page anchors;
  split it into one page per topic when the full docs structure is known.
- No client logo or photographs are used, so no credit line is needed.

## Adding a guide page

Copy `getting-started/introduction.html` and keep the header, footer, sidebar, and on-page nav. The
paths assume the page sits one folder below `docs/`:

- assets: `../assets/...`
- landing: `../index.html`
- demos: `../../demo/...`

Add the new page to the sidebar and the footer, then run the link check by opening every entry.
