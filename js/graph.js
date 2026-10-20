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
    rowHeight: 60,
    padTop: 110
  };

  function build(raw) {
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
    layout(g);
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
  function layout(g) {
    var rows = {};   // row -> array of [x0, x1] occupied intervals
    var W = LAYOUT.nodeWidth, GAP = 16;

    function free(row, x) {
      var spans = rows[row] || [];
      for (var i = 0; i < spans.length; i++) {
        if (x < spans[i][1] + GAP && x + W + GAP > spans[i][0]) return false;
      }
      return true;
    }
    function take(row, x) {
      (rows[row] = rows[row] || []).push([x, x + W]);
    }
    function nearestFree(pref, x) {
      for (var d = 0; d < 200; d++) {
        if (free(pref + d, x)) return pref + d;
        if (d && free(pref - d, x)) return pref - d;
      }
      return pref;
    }

    var descendants = {};
    function countDesc(c, seen) {
      c.out.forEach(function (l) {
        if (!seen[l.to]) { seen[l.to] = 1; countDesc(g.byId[l.to], seen); }
      });
      return Object.keys(seen).length;
    }
    g.companies.forEach(function (c) { descendants[c.id] = countDesc(c, {}); });

    var isRoot = function (c) { return c.founded < LAYOUT.firstYear; };
    var order = g.companies.filter(function (c) { return !isRoot(c); }).sort(function (a, b) {
      return a.founded - b.founded || descendants[b.id] - descendants[a.id];
    });

    // Within a year, companies with a sourced month take their quarter first;
    // the rest take whichever quarter keeps them closest to their parents.
    order.sort(function (a, b) {
      return a.founded - b.founded || (b.month ? 1 : 0) - (a.month ? 1 : 0) || descendants[b.id] - descendants[a.id];
    });
    order.forEach(function (c) {
      var parentRows = c.in
        .map(function (l) { return g.byId[l.from]; })
        .filter(function (p) { return p.row !== undefined; })
        .map(function (p) { return p.row; });
      var pref = parentRows.length
        ? Math.round(parentRows.reduce(function (s, r) { return s + r; }, 0) / parentRows.length)
        : 0;
      var quarters = c.month ? [Math.floor((c.month - 1) / 3)] : [0, 1, 2, 3];
      var best = null;
      quarters.forEach(function (q) {
        var x = xForQuarter(c.founded, q), row = nearestFree(pref, x);
        if (!best || Math.abs(row - pref) < Math.abs(best.row - pref)) best = { x: x, row: row };
      });
      c.row = best.row;
      c.x = best.x;
      take(c.row, c.x);
    });

    // Roots sit in their own column, next to the children they feed.
    g.companies.filter(isRoot).forEach(function (c) {
      var kids = c.out.map(function (l) { return g.byId[l.to].row; }).filter(function (r) { return r !== undefined; });
      var pref = kids.length ? Math.round(Math.min.apply(null, kids)) : 0;
      c.x = xForYear(c.founded);
      c.row = nearestFree(pref, c.x);
      take(c.row, c.x);
    });

    var minRow = Math.min.apply(null, g.companies.map(function (c) { return c.row; }));
    var maxRow = Math.max.apply(null, g.companies.map(function (c) { return c.row; }));
    g.companies.forEach(function (c) {
      c.y = LAYOUT.padTop + (c.row - minRow) * LAYOUT.rowHeight;
    });
    g.width = xForYear(LAYOUT.lastYear) + 40;
    g.height = LAYOUT.padTop + (maxRow - minRow + 1) * LAYOUT.rowHeight + 40;
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
    xForYear: xForYear,
    yearHasQuarters: function (y) { return !!yearQuarters[y]; },
    pathToRoot: pathToRoot,
    pathsToRoots: pathsToRoots,
    ancestors: function (g, id) { return walk(g, id, "in"); },
    descendants: function (g, id) { return walk(g, id, "out"); }
  };
})();
