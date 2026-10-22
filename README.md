# Silicon Valley Genealogy

An interactive map of how Silicon Valley companies descend from one another, traced back to a handful of roots: **Shockley Semiconductor Laboratory** (1956), Stanford, UC Berkeley, HP, Xerox PARC and Ampex. It's plain HTML, CSS and JavaScript, with no framework and no build step.

It covers **1956–2014**, from the transistor to the mobile and cloud era: 190 companies, 7 people and 359 links. Every company and every link carries a source.

## Using it

- **Map:** drag to pan; scroll, pinch or use + / − to zoom; ⤢ fits the whole map. The minimap (bottom left) jumps to any area.
- **Click a company** to fade everything outside its family tree. A panel shows its **nearest root** and the path to it, every other root it descends from, founders, parents, children and sources.
- **Eras:** click an era's name on the map, or the **Eras** button, for findings computed from the data: how companies connected, nearest roots, biggest parents, sectors and where the citations come from. The About dialog lists the map's known gaps.
- **Search** (press `/`) finds companies and people, e.g. "Hoerni" or "Noyce".
- **Timeline:** drag the slider or press ▶ to watch the Valley grow year by year. Companies that were acquired or closed by the chosen year get a dashed outline. Busy years are split into quarters: companies with a sourced founding month sit in that quarter; the rest are placed wherever there is room.
- **People** appear as rounded pills, only when they acted on their own, for example a personal angel investment.
- **Arrange by** (in the legend): left to right is time; top to bottom is either **Sector** (a lane per sector) or **Root** (a lane per family: Shockley, Stanford, UC Berkeley, HP, Xerox PARC, Ampex). Lane names stay pinned to the left edge. Within a lane, each year's companies are spread evenly over the lane's height, as on the 1984 poster. Lines run through the gaps between rows, so a box never sits on a line it isn't part of.
- **Lines:** hover a line to highlight its two companies; click it to see that link, its source and both ends.
- **Exits:** the chart above the slider shows companies founded (above the line) and acquired or closed (below) each year. Click the "acquired or closed" count for the full list up to the chosen year.
- **Legend & filters:** click a sector or link type to hide or show it.
- **Deep links:** `#/company/intel` opens a company directly.

## Running locally

Open `index.html` in a browser. It works straight from the file system, with no server needed.

## Adding companies

Data is organised by era. [`data/core.js`](data/core.js) defines the eras, the shared citation registry and the format. Each era has one file in [`data/eras/`](data/eras/), named `<from>-<to>-<era>.js`. It holds the companies founded in that era and every link into them:

```js
GENEALOGY.add({ companies: [ … ], links: [ … ] });

{ id: "intel", name: "Intel", founded: 1968, month: 7, ended: null, sector: "chips",
  fate: "Still operating", note: "One or two sentences.",
  founders: [{ n: "Robert Noyce", f: "fairchild" }],   // f: a company id, or plain text
  sources: ["semi1984", "https://en.wikipedia.org/wiki/Intel"] }

{ from: "fairchild", to: "intel", year: 1968, type: "spinout", note: "What happened",
  source: "https://…" }                                 // or "semi1984", or an array of both
```

- **Sectors:** `chips`, `computers`, `networking`, `software`, `internet`, `games`, `cleantech`, `vc`, `corporate`, `people`
- **Link types:** `spinout` (founders left the parent to start it), `alumni` (a founder or key leader came from the parent), `funding` (the parent financed it), `acquisition` (formed from the parent's bought assets), `founder` (a person founded it)
- **`month`** is optional and must be sourced; it places the company in its quarter.
- **Roots** are listed in `data/core.js`; traces stop at the nearest one.

The layout is computed automatically. Each company sits in its founding year's column, on a row near its parents.

**To add an era:** add it to `eras` in `data/core.js`, create its file in `data/eras/`, add a `<script>` tag for it in `index.html`, and raise `lastYear` in `js/graph.js` (the slider follows it).

## Files

```
index.html          page shell
css/style.css       styles (light and dark)
data/core.js        eras, citation registry, data format
data/eras/          one file per era: companies founded in it + links into them
js/graph.js         indexing, layout, path-to-Shockley search
js/map.js           SVG map, pan/zoom, axis, minimap, timeline visibility, focus
js/insights.js      era findings and known gaps, computed from the data
js/ui.js            search, details panel, filters, timeline player, routing
```

## Sources

The semiconductor backbone up to 1981 follows SEMI's 1984 "Silicon Valley Genealogy" poster, developed by Don C. Hoefler from a concept by Jack Yelverton. The poster inspired the map; its image is not included here. The poster is not treated as ground truth: its claims have been checked against independent sources (museum archives and oral histories, trade press, company filings and histories). Corroborated claims carry their own citation; where sources disagree, the company's note records both versions; claims backed only by the poster, or by its author's other writing, are flagged "poster only" on the site. Everything else is checked against the sources on each company and link.
