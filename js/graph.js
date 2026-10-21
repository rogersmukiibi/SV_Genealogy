/*
 * Graph model: indexes the data, lays companies out on a timeline grid,
 * and finds the strongest path from any company back to Shockley.
 */
(function () {
  "use strict";

  var ROOT_ID = "shockley";   // the original root; others are listed in data/core.js

  var LINK_TYPES = {
    spinout:     { label: "Spin-out",    desc: "Founders left the parent to start it", cost: 1 },
    alumni:      { label: "Alumni",      desc: "A founder or key leader came from the parent", cost: 1.5 },
    acquisition: { label: "Acquisition", desc: "Formed from the parent's bought assets", cost: 1.5 },
    funding:     { label: "Funding",     desc: "The parent financed or backed it", cost: 2.5 },
    founder:     { label: "Founder",     desc: "This person founded or co-founded it", cost: 1 }
  };

  var SECTORS = {
    chips:      { label: "Chips" },
    computers:  { label: "Computers" },
    networking: { label: "Networking" },
    software:   { label: "Software" },
    internet:   { label: "Internet" },
    games:      { label: "Games" },
    cleantech:  { label: "Cleantech & cars" },
    vc:         { label: "Venture capital" },
    corporate:  { label: "Corporate & research" },
    people:     { label: "People" }
  };

  // Layout constants, in map units.
  var LAYOUT = {
    firstYear: 1955,        // anything founded earlier sits in the "roots" column
    lastYear: 2008,         // exclusive: the map runs through 2007
    quarterWidth: 92,       // busy years are split into four quarter slots
    singleYearWidth: 200,   // a year with one new company needs no quarters
    quietYearWidth: 72,     // years with no new companies get a narrow column
    rootsWidth: 240,
    nodeWidth: 168,
    nodeHeight: 44,
    rowHeight: 84,          // minimum; build() stretches rows to fill the screen
    maxRowHeight: 140,
    stripWidth: 4200,       // wrapped mode: eras are grouped into lines at most this wide
    stripGap: 150,
    padTop: 110
  };

  // opts.viewHeight: on-screen height available for the map, used to spread
  // rows so the map fills the screen at the starting zoom (opts.zoom).
  function build(raw, opts) {
    opts = opts || {};
    var byId = {};
    raw.companies.forEach(function (c) {
      c.ended = c.ended || null;
      c.in = [];
      c.out = [];
      byId[c.id] = c;
    });

    var links = raw.links.filter(function (l) {
      if (!byId[l.from] || !byId[l.to]) {
        console.warn("Link references unknown company", l);
        return false;
      }
      return true;
    });
    links.forEach(function (l, i) {
      l.id = i;
      byId[l.from].out.push(l);
      byId[l.to].in.push(l);
    });

    var g = { companies: raw.companies, links: links, byId: byId, sources: raw.sources || {}, eras: raw.eras || [] };
    g.roots = (raw.roots || [{ id: ROOT_ID }]).filter(function (r) { return byId[r.id]; });
    g.isRoot = {};
    g.roots.forEach(function (r) { g.isRoot[r.id] = r; });
    computeYearColumns(g.companies);
    layout(g, opts);
    return g;
  }

  var yearStart = {}, yearQuarters = {};

  function computeYearColumns(companies) {
    var n = {};
    companies.forEach(function (c) { n[c.founded] = (n[c.founded] || 0) + 1; });
    var x = LAYOUT.rootsWidth;
    for (var y = LAYOUT.firstYear; y <= LAYOUT.lastYear; y++) {
      yearStart[y] = x;
      yearQuarters[y] = n[y] > 1;
      x += n[y] > 1 ? 4 * LAYOUT.quarterWidth : n[y] ? LAYOUT.singleYearWidth : LAYOUT.quietYearWidth;
    }
  }

  // x for a quarter slot (0–3) of a year; years without quarters ignore it.
  function xForQuarter(year, q) {
    return xForYear(year) + (yearQuarters[year] ? q * LAYOUT.quarterWidth : 0);
  }

  function xForYear(year) {
    if (year < LAYOUT.firstYear) return 0;
    if (yearStart[year] !== undefined) return yearStart[year];
    return LAYOUT.rootsWidth + (year - LAYOUT.firstYear) * LAYOUT.singleYearWidth;
  }

  // Greedy lane assignment: each company takes the free row closest to the
  // average row of its already-placed parents, so families stay together.
  // Lanes split the map into horizontal bands: one per sector, one per
  // nearest root, or a single band ("lineage") that packs families tightly.
  var SECTOR_LANES = ["corporate", "chips", "computers", "networking", "vc", "people",
    "software", "internet", "games", "cleantech"];

  function lanesFor(g, arrange) {
    if (arrange === "sector") {
      return SECTOR_LANES.map(function (k) {
        return { id: k, label: SECTORS[k].label, members: g.companies.filter(function (c) { return c.sector === k; }) };
      }).filter(function (l) { return l.members.length; });
    }
    if (arrange === "root") {
      var by = {};
      g.companies.forEach(function (c) {
        var r = g.isRoot[c.id] ? c.id : (pathsToRoots(g, c.id)[0] || { root: "none" }).root;
        (by[r] = by[r] || []).push(c);
      });
      return g.roots.map(function (r) { return { id: r.id, label: r.label + " family", members: by[r.id] || [] }; })
        .concat([{ id: "none", label: "No documented root", members: by.none || [] }])
        .filter(function (l) { return l.members.length; });
    }
    return [{ id: "all", label: "", members: g.companies.slice() }];
  }

  // Wrapped mode groups consecutive eras into strips ("lines") that stack
  // vertically; otherwise the whole timeline is one strip.
  function stripsFor(g, wrap) {
    var strips = [], cur = null;
    g.eras.forEach(function (e) {
      var x0 = e.from === null ? 0 : xForYear(e.from), x1 = xForYear(e.to + 1);
      if (!cur || (wrap && x1 - cur.x0 > LAYOUT.stripWidth)) {
        cur = { eras: [], x0: x0, from: e.from === null ? -Infinity : e.from };
        strips.push(cur);
      }
      cur.eras.push(e);
      cur.x1 = x1;
      cur.to = e.to;
    });
    strips.forEach(function (st) {
      // Every strip starts at the same left edge as the first one (after the roots column).
      st.shift = st.from === -Infinity ? 0 : st.x0 - LAYOUT.rootsWidth;
    });
    return strips;
  }

  function stripOf(g, year) {
    for (var i = 0; i < g.strips.length; i++) {
      if (year <= g.strips[i].to) return g.strips[i];
    }
    return g.strips[g.strips.length - 1];
  }

  function layout(g, opts) {
    var W = LAYOUT.nodeWidth, GAP = 16;

    var descendants = {};
    function countDesc(c, seen) {
      c.out.forEach(function (l) {
        if (!seen[l.to]) { seen[l.to] = 1; countDesc(g.byId[l.to], seen); }
      });
      return Object.keys(seen).length;
    }
    g.companies.forEach(function (c) { descendants[c.id] = countDesc(c, {}); delete c.localRow; });

    var isRoot = function (c) { return c.founded < LAYOUT.firstYear; };

    // Row assignment within one lane. Without `spread`, each company takes the
    // free row closest to its already-placed parents (packing the lane). With
    // `spread` (the lane's row range from a packing pass), each year's
    // companies are spaced evenly across the lane's full height, ordered by
    // their parents' rows, like the boxes on the 1984 poster.
    function placeLane(lane, shift, spread) {
      var rows = {};   // row -> array of [x0, x1] occupied intervals
      var inLane = {};
      lane.members.forEach(function (c) { inLane[c.id] = true; });
      function free(row, x) {
        var spans = rows[row] || [];
        for (var i = 0; i < spans.length; i++) {
          if (x < spans[i][1] + GAP && x + W + GAP > spans[i][0]) return false;
        }
        return true;
      }
      function take(row, x) { (rows[row] = rows[row] || []).push([x, x + W]); }
      function nearestFree(pref, x) {
        for (var d = 0; d < 400; d++) {
          if (free(pref + d, x)) return pref + d;
          if (d && free(pref - d, x)) return pref - d;
        }
        return pref;
      }
      function placedRows(ids) {
        return ids.filter(function (id) { return inLane[id] && g.byId[id].localRow !== undefined; })
          .map(function (id) { return g.byId[id].localRow; });
      }

      function preferredRow(c) {
        var parentRows = placedRows(c.in.map(function (l) { return l.from; }));
        if (parentRows.length) return Math.round(parentRows.reduce(function (s, r) { return s + r; }, 0) / parentRows.length);
        return spread ? Math.round((spread.lo + spread.hi) / 2) : 0;
      }

      var byYear = {};
      lane.members.filter(function (c) { return !isRoot(c); }).forEach(function (c) {
        (byYear[c.founded] = byYear[c.founded] || []).push(c);
      });
      var order = [];
      Object.keys(byYear).sort(function (a, b) { return a - b; }).forEach(function (y) {
        var list = byYear[y];
        list.forEach(function (c) { c.pref = preferredRow(c); });
        if (spread) {
          // Even slots across the lane, handed out in order of preferred row.
          var span = spread.hi - spread.lo + 1;
          list.sort(function (a, b) { return a.pref - b.pref || descendants[b.id] - descendants[a.id]; });
          list.forEach(function (c, i) { c.pref = spread.lo + Math.floor((i + 0.5) * span / list.length); });
        }
        // Companies with a sourced month take their quarter first; the rest
        // take whichever quarter keeps them closest to their preferred row.
        list.sort(function (a, b) { return (b.month ? 1 : 0) - (a.month ? 1 : 0) || descendants[b.id] - descendants[a.id]; });
        order = order.concat(list);
      });
      order.forEach(function (c) {
        var pref = c.pref;
        var quarters = c.month ? [Math.floor((c.month - 1) / 3)] : [0, 1, 2, 3];
        var best = null;
        quarters.forEach(function (q) {
          var x = xForQuarter(c.founded, q) - shift, row = nearestFree(pref, x);
          if (!best || Math.abs(row - pref) < Math.abs(best.row - pref)) best = { x: x, row: row };
        });
        c.localRow = best.row;
        c.x = best.x;
        take(c.localRow, c.x);
      });

      // Roots sit in their own column, next to the children they feed.
      lane.members.filter(isRoot).forEach(function (c) {
        var kids = placedRows(c.out.map(function (l) { return l.to; }));
        var pref = kids.length ? Math.min.apply(null, kids) : 0;
        c.x = xForYear(c.founded) - shift;
        c.localRow = nearestFree(pref, c.x);
        take(c.localRow, c.x);
      });

      var lo = Math.min.apply(null, lane.members.map(function (c) { return c.localRow; }));
      var hi = Math.max.apply(null, lane.members.map(function (c) { return c.localRow; }));
      return { lo: lo, rows: hi - lo + 1 };
    }

    var laneDefs = lanesFor(g, opts.arrange);
    var laneGap = laneDefs.length > 1 ? 1 : 0;
    g.strips = stripsFor(g, opts.wrap);
    g.lanes = [];
    var rowCount = 0, stripRows = [];
    g.strips.forEach(function (st, si) {
      var inStrip = function (c) { return stripOf(g, c.founded) === st; };
      var start = rowCount;
      laneDefs.forEach(function (def) {
        var members = def.members.filter(inStrip);
        if (!members.length) return;
        var lane = { id: def.id, members: members };
        // First pass packs the lane to find its height; the second spreads each year across it.
        var packed = placeLane(lane, st.shift);
        members.forEach(function (c) { delete c.localRow; });
        var r = placeLane(lane, st.shift, { lo: packed.lo, hi: packed.lo + packed.rows - 1 });
        members.forEach(function (c) { c.row = rowCount + c.localRow - r.lo; c.lane = def.id; c.strip = si; });
        g.lanes.push({ id: def.id, label: def.label, strip: si, row0: rowCount, rows: r.rows });
        rowCount += r.rows + laneGap;
      });
      rowCount -= laneGap;
      stripRows.push({ row0: start, rows: rowCount - start });
    });

    // Row spacing stretches to fill the screen, up to a limit.
    var rowH = LAYOUT.rowHeight;
    if (opts.viewHeight) {
      var visibleRows = opts.wrap ? Math.max.apply(null, stripRows.map(function (r) { return r.rows; })) : rowCount;
      var fill = (opts.viewHeight / (opts.zoom || 0.85) - LAYOUT.padTop - 40) / visibleRows;
      rowH = Math.max(LAYOUT.rowHeight, Math.min(LAYOUT.maxRowHeight, Math.floor(fill)));
    }
    g.rowHeight = rowH;

    // Stack strips: each gets room on top for its era and year labels.
    var y = 0;
    g.strips.forEach(function (st, si) {
      st.y0 = y;
      st.rowY = y + LAYOUT.padTop - stripRows[si].row0 * rowH;
      st.y1 = st.rowY + (stripRows[si].row0 + stripRows[si].rows - 1) * rowH + LAYOUT.nodeHeight + 40;
      y = st.y1 + (si < g.strips.length - 1 ? LAYOUT.stripGap : 0);
    });
    g.companies.forEach(function (c) { c.y = g.strips[c.strip].rowY + c.row * rowH; });
    g.lanes.forEach(function (l) {
      var st = g.strips[l.strip];
      l.y0 = st.rowY + l.row0 * rowH;
      l.y1 = l.y0 + (l.rows - 1) * rowH + LAYOUT.nodeHeight;
    });
    g.width = Math.max.apply(null, g.strips.map(function (st) { return st.x1 - st.shift; })) + 40;
    g.height = y;
  }

  // Where a year sits on the map: its column's x and the strip's vertical span.
  function yearBox(g, year) {
    var st = stripOf(g, year);
    var x = (year < LAYOUT.firstYear ? 0 : xForYear(year)) - st.shift;
    return { x: x, y0: st.y0, y1: st.y1, strip: st };
  }

  // Dijkstra backwards over incoming links, preferring strong ties. Returns
  // one entry per root the company descends from, nearest first:
  // [{ root, cost, steps }] where steps run from the company up to the root.
  function pathsToRoots(g, id) {
    var dist = {}, prev = {}, done = {};
    dist[id] = 0;
    while (true) {
      var cur = null;
      for (var k in dist) if (!done[k] && (cur === null || dist[k] < dist[cur])) cur = k;
      if (cur === null) break;
      done[cur] = true;
      g.byId[cur].in.forEach(function (l) {
        var d = dist[cur] + LINK_TYPES[l.type].cost;
        if (dist[l.from] === undefined || d < dist[l.from]) {
          dist[l.from] = d;
          prev[l.from] = l;
        }
      });
    }
    return g.roots
      .filter(function (r) { return r.id !== id && dist[r.id] !== undefined; })
      .map(function (r) {
        var steps = [], node = r.id;
        while (node !== id) {
          var l = prev[node];
          steps.push(l);
          node = l.to;
        }
        return { root: r.id, cost: dist[r.id], steps: steps.reverse() };
      })
      .sort(function (a, b) { return a.cost - b.cost; });
  }

  // The nearest root's path, [] for a root itself, or null when none exists.
  function pathToRoot(g, id) {
    if (g.isRoot[id]) return [];
    var all = pathsToRoots(g, id);
    return all.length ? all[0].steps : null;
  }

  function walk(g, id, dir) {
    var seen = {}, stack = [id];
    while (stack.length) {
      var c = g.byId[stack.pop()];
      c[dir].forEach(function (l) {
        var next = dir === "in" ? l.from : l.to;
        if (!seen[next]) { seen[next] = true; stack.push(next); }
      });
    }
    return seen;
  }

  window.Graph = {
    ROOT_ID: ROOT_ID,
    LINK_TYPES: LINK_TYPES,
    SECTORS: SECTORS,
    LAYOUT: LAYOUT,
    build: build,
    ARRANGEMENTS: { sector: "Sector", root: "Root" },
    xForYear: xForYear,
    yearBox: yearBox,
    yearHasQuarters: function (y) { return !!yearQuarters[y]; },
    pathToRoot: pathToRoot,
    pathsToRoots: pathsToRoots,
    ancestors: function (g, id) { return walk(g, id, "in"); },
    descendants: function (g, id) { return walk(g, id, "out"); }
  };
})();
