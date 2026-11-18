# Roolith JS demos

Static demo pages for each directive feature. Every page is plain HTML plus an unbundled ES module that imports `../app/roolith.js` directly, so there is no build step and no network beyond same-origin static files.

## Run the demos

Every page loads its views with `fetch`, and `fetch` does not work from `file://`. Serve the repository root over a local HTTP server and open the printed URL instead of opening the HTML files directly.

```sh
npx serve .
```

or

```sh
python3 -m http.server 8000
```

Then open:

- `http://localhost:3000/` with `npx serve .`, or `http://localhost:8000/` with `python3 -m http.server 8000`, for the overview.
- `/demo/if.html` for `r-if`, `r-else`, else-if chains, and the expression evaluator.
- `/demo/loop-index.html` for `$index`, `$first`, `$last`, `$length`, and an indexed nested view.
- `/demo/remote.html` for `r-remote` with HTML and JSON responses and the failure fallback.
- `/demo/shadow.html` for `r-shadow`, view style scoping, and a nested view inside a shadow root.

## Layout

- `demo/demo.js` is the single bootstrap: it creates one `Roolith` instance, lets the page subscribe to lifecycle events before rendering, runs the render pass, and exposes the instance as `window.Roolith`.
- `demo/demo.css` holds the shared demo styles, organized by SMACSS category with BEM class names.
- `demo/shadow-report.js` writes the shadow comparison report from the nodes delivered by `Roolith#onViewRendered`.
- `views/demo/<feature>/` holds the fixture views. Directive attributes are declared inside these views, because a plain element in the host page is never rendered as a template.

## Notes

- `views/demo/remote/data.json` and `views/demo/remote/view-payload.json` are static `.json` files, so a normal static server sends `Content-Type: application/json`. Remote JSON detection relies on that media type; if a server sends another type, the response renders as markup instead.
- The last remote case requests `missing-remote.html` on purpose, so the console and the network panel show the failure while the page keeps its fallback content and the `data-r-error` attribute.
- Rendering is one-shot. The first `run()` pass evaluates every directive once, and later data changes are not observed.
