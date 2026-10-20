# Silicon Valley Genealogy

An interactive map of how Silicon Valley companies descend from **Shockley Semiconductor Laboratory** (1956). It's plain HTML, CSS and JavaScript, with no framework and no build step.

This first chapter covers **1956–1975**: 78 companies and 86 links.

## Using it

- **Map:** drag to pan; scroll, pinch or use + / − to zoom; ⤢ fits the whole map. The minimap (bottom left) jumps to any area.
- **Click a company** to fade everything outside its family tree. A panel shows its **path back to Shockley**, founders, parents, children and sources.
- **Search** (press `/`) finds companies and people, e.g. "Hoerni" or "Noyce".
- **Timeline:** drag the slider or press ▶ to watch the Valley grow year by year. Companies that were acquired or closed by the chosen year get a dashed outline.
- **Legend & filters:** click a sector or link type to hide or show it.
- **Deep links:** `#/company/intel` opens a company directly.

## Running locally

Open `index.html` in a browser. It works straight from the file system, with no server needed.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, go to **Settings → Pages → Build and deployment**, set **Source** to *Deploy from a branch*, and choose `main` / `(root)`.

`.nojekyll` stops GitHub from running Jekyll over the files.

## Adding companies

All data lives in [`data/genealogy.js`](data/genealogy.js):

```js
{ id: "intel", name: "Intel", founded: 1968, ended: null, sector: "chips",
  fate: "Still operating", note: "One or two sentences.",
  founders: [{ n: "Robert Noyce", f: "fairchild" }],   // f: a company id, or plain text
  sources: ["semi1984", "https://en.wikipedia.org/wiki/Intel"] }

{ from: "fairchild", to: "intel", year: 1968, type: "spinout", note: "What happened" }
```

- **Sectors:** `chips`, `computers`, `games`, `vc`, `corporate`
- **Link types:** `spinout` (founders left the parent to start it), `alumni` (a founder or key leader came from the parent), `funding` (the parent financed it), `acquisition` (formed from the parent's bought assets)

The layout is computed automatically. Each company sits in its founding year's column, on a row near its parents. To extend the timeline past 1975, raise `lastYear` in `js/graph.js` and the slider's `max` in `index.html`.

## Files

```
index.html          page shell
css/style.css       styles (light and dark)
data/genealogy.js   companies and links
js/graph.js         indexing, layout, path-to-Shockley search
js/map.js           SVG map, pan/zoom, axis, minimap, timeline visibility, focus
js/ui.js            search, details panel, filters, timeline player, routing
```

## Sources

The semiconductor backbone follows SEMI's 1984 "Silicon Valley Genealogy" poster, developed by Don C. Hoefler from a concept by Jack Yelverton. The poster inspired the map; its image is not included here. Venture firms and companies outside chips add the sources listed on each entry.
