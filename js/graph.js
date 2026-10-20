/*
 * Graph model: indexes the data, lays companies out on a timeline grid,
 * and finds the strongest path from any company back to Shockley.
 */
(function () {
  "use strict";

  var ROOT_ID = "shockley";

  var LINK_TYPES = {
    spinout:     { label: "Spin-out",    desc: "Founders left the parent to start it", cost: 1 },
    alumni:      { label: "Alumni",      desc: "A founder or key leader came from the parent", cost: 1.5 },
    acquisition: { label: "Acquisition", desc: "Formed from the parent's bought assets", cost: 1.5 },
    funding:     { label: "Funding",     desc: "The parent financed or backed it", cost: 2.5 }
  };

  var SECTORS = {
    chips:     { label: "Chips" },
    computers: { label: "Computers" },
    games:     { label: "Games" },
    vc:        { label: "Venture capital" },
    corporate: { label: "Corporate & labs" }
  };

  // Layout constants, in map units.
  var LAYOUT = {
    firstYear: 1955,        // anything founded earlier sits in the "roots" column
    lastYear: 1976,
    yearWidth: 200,
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

    var g = { companies: raw.companies, links: links, byId: byId, sources: raw.sources || {} };
    layout(g);
    return g;
  }

  function xForYear(year) {
    if (year < LAYOUT.firstYear) return 0;
    return LAYOUT.rootsWidth + (year - LAYOUT.firstYear) * LAYOUT.yearWidth;
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

    order.forEach(function (c) {
      var x = xForYear(c.founded);
      var parentRows = c.in
        .map(function (l) { return g.byId[l.from]; })
        .filter(function (p) { return p.row !== undefined; })
        .map(function (p) { return p.row; });
      var pref = parentRows.length
        ? Math.round(parentRows.reduce(function (s, r) { return s + r; }, 0) / parentRows.length)
        : 0;
      c.row = nearestFree(pref, x);
      c.x = x;
      take(c.row, x);
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

  // Dijkstra backwards over incoming links, preferring strong ties.
  function pathToRoot(g, id) {
    if (id === ROOT_ID) return [];
    var dist = {}, prev = {}, done = {};
    dist[id] = 0;
    while (true) {
      var cur = null;
      for (var k in dist) if (!done[k] && (cur === null || dist[k] < dist[cur])) cur = k;
      if (cur === null) return null;
      if (cur === ROOT_ID) break;
      done[cur] = true;
      g.byId[cur].in.forEach(function (l) {
        var d = dist[cur] + LINK_TYPES[l.type].cost;
        if (dist[l.from] === undefined || d < dist[l.from]) {
          dist[l.from] = d;
          prev[l.from] = l;
        }
      });
    }
    // Walk from the root back down to the company.
    var steps = [], node = ROOT_ID;
    while (node !== id) {
      var l = prev[node];
      steps.push(l);
      node = l.to;
    }
    return steps.reverse(); // company first, Shockley last
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
    pathToRoot: pathToRoot,
    ancestors: function (g, id) { return walk(g, id, "in"); },
    descendants: function (g, id) { return walk(g, id, "out"); }
  };
})();
