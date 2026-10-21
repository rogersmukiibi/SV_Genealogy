/*
 * Insights: per-era statistics and the "known gaps" notes, computed from the
 * data at load time so they stay correct as eras and companies are added.
 */
(function () {
  "use strict";

  function eraOf(g, year) {
    for (var i = 0; i < g.eras.length; i++) {
      var e = g.eras[i];
      if ((e.from === null || year >= e.from) && year <= e.to) return e;
    }
    return null;
  }

  function count(list, key) {
    var m = {};
    list.forEach(function (x) { var k = key(x); m[k] = (m[k] || 0) + 1; });
    return m;
  }

  function sorted(m) {
    return Object.keys(m).map(function (k) { return { id: k, n: m[k] }; })
      .sort(function (a, b) { return b.n - a.n; });
  }

  function sourceKind(s) {
    if (s === "semi1984" || s === "hoefler1971") return "poster";
    return /wikipedia\.org/.test(s) ? "wikipedia" : "other";
  }

  // Entries and links whose only support is the 1984 poster (or its author's other writing).
  function posterOnly(g, item) {
    if (item.unconfirmed) return true;
    var src = [].concat(item.sources || item.source || []);
    return src.length > 0 && src.every(function (s) { return g.sources[s] && g.sources[s].posterFamily; });
  }

  function nearestRoot(g, c) {
    if (g.isRoot[c.id]) return c.id;
    var all = Graph.pathsToRoots(g, c.id);
    return all.length ? all[0].root : null;
  }

  function stats(g, era) {
    var companies = g.companies.filter(function (c) { return eraOf(g, c.founded) === era; });
    var links = g.links.filter(function (l) { return eraOf(g, g.byId[l.to].founded) === era; });
    var cites = [];
    links.forEach(function (l) { cites = cites.concat(l.source); });
    var rootOf = {};
    companies.forEach(function (c) { rootOf[c.id] = nearestRoot(g, c); });
    var traced = companies.filter(function (c) { return rootOf[c.id] && !g.isRoot[c.id]; });
    return {
      era: era,
      companies: companies,
      links: links,
      byType: count(links, function (l) { return l.type; }),
      bySector: count(companies, function (c) { return c.sector; }),
      byRoot: sorted(count(traced, function (c) { return rootOf[c.id]; })),
      parents: sorted(count(links, function (l) { return l.from; })),
      noRoot: companies.filter(function (c) { return !rootOf[c.id]; }),
      unknownFate: companies.filter(function (c) { return !c.fate && c.sector !== "people"; }),
      cites: count(cites, sourceKind)
    };
  }

  function pct(n, total) { return total ? Math.round(n / total * 100) : 0; }

  function findings(g, s, prev) {
    var out = [], m = s.links.length;
    out.push(s.companies.length + " companies and people, with " + m + " links into them.");
    var types = sorted(s.byType);
    if (types.length) {
      out.push("Most common tie: " + Graph.LINK_TYPES[types[0].id].label.toLowerCase() + " (" +
        types[0].n + " of " + m + ", " + pct(types[0].n, m) + "%).");
    }
    if (prev && prev.links.length && m) {
      var now = pct(s.byType.funding || 0, m), before = pct(prev.byType.funding || 0, prev.links.length);
      out.push("Funding makes up " + now + "% of ties, " +
        (now === before ? "the same as" : now > before ? "up from " + before + "% in" : "down from " + before + "% in") +
        " the previous era.");
    }
    if (s.parents.length) {
      var p = s.parents[0];
      out.push("Biggest parent: " + g.byId[p.id].name + ", with " + p.n + " link" + (p.n === 1 ? "" : "s") + " into this era.");
    }
    var single = s.companies.filter(function (c) { return posterOnly(g, c); }).length;
    if (single) {
      out.push(single + " of " + s.companies.length + " rest on the 1984 poster alone, with no independent source yet.");
    }
    if (s.byRoot.length) {
      out.push("Nearest root: " + s.byRoot.map(function (r) { return g.byId[r.id].name + " " + r.n; }).join(", ") + ".");
    }
    return out;
  }

  function bar(label, n, total, cls) {
    return '<div class="bar-row"><span class="bar-label">' + label + '</span>' +
      '<span class="bar"><span class="bar-fill ' + cls + '" style="width:' + pct(n, total) + '%"></span></span>' +
      '<span class="bar-n">' + n + "</span></div>";
  }

  function eraHtml(g, eraId, h) {
    var idx = -1;
    g.eras.forEach(function (e, i) { if (e.id === eraId) idx = i; });
    if (idx < 0) return null;
    var era = g.eras[idx];
    var s = stats(g, era);
    var prev = idx > 0 ? stats(g, g.eras[idx - 1]) : null;
    var range = era.from === null ? "Before " + (era.to + 1) : era.from + "–" + era.to;

    var typeBars = Object.keys(Graph.LINK_TYPES).filter(function (k) { return s.byType[k]; }).map(function (k) {
      return bar(h.esc(Graph.LINK_TYPES[k].label), s.byType[k], s.links.length, "link-" + k);
    }).join("");
    var sectorBars = Object.keys(Graph.SECTORS).filter(function (k) { return s.bySector[k]; }).map(function (k) {
      return bar(h.esc(Graph.SECTORS[k].label), s.bySector[k], s.companies.length, "sector-" + k);
    }).join("");
    var tracedTotal = s.byRoot.reduce(function (t, r) { return t + r.n; }, 0);
    var rootBars = s.byRoot.map(function (r) {
      return bar(h.companyLink(r.id), r.n, tracedTotal, "root-bar");
    }).join("");
    var parents = s.parents.slice(0, 5).map(function (p) {
      return "<li>" + h.companyLink(p.id) + ' <span class="muted">' + p.n + "</span></li>";
    }).join("");
    var list = function (cs) {
      return cs.length ? '<p class="company-list">' + cs.map(function (c) { return h.companyLink(c.id); }).join(", ") + "</p>"
        : '<p class="muted">None.</p>';
    };
    var nav = '<nav class="era-nav">' +
      (idx > 0 ? '<a class="btn" href="#/era/' + g.eras[idx - 1].id + '">← ' + h.esc(g.eras[idx - 1].label) + "</a>" : "<span></span>") +
      (idx < g.eras.length - 1 ? '<a class="btn" href="#/era/' + g.eras[idx + 1].id + '">' + h.esc(g.eras[idx + 1].label) + " →</a>" : "") +
      "</nav>";

    return '<header class="panel-head"><p class="eyebrow">Era · ' + range + "</p>" +
      '<h2 id="panel-title">' + h.esc(era.label) + "</h2></header>" +
      (era.summary ? '<p class="note">' + h.esc(era.summary) + "</p>" : "") +
      '<section><h3>Findings</h3><ul class="findings">' +
      findings(g, s, prev).map(function (f) { return "<li>" + h.esc(f) + "</li>"; }).join("") + "</ul></section>" +
      (typeBars ? "<section><h3>How they connected</h3>" + typeBars + "</section>" : "") +
      (rootBars ? "<section><h3>Nearest root</h3>" + rootBars + "</section>" : "") +
      (sectorBars ? "<section><h3>Sectors</h3>" + sectorBars + "</section>" : "") +
      (parents ? '<section><h3>Biggest parents</h3><ul class="rel-plain">' + parents + "</ul></section>" : "") +
      "<section><h3>Founded in this era</h3>" + list(s.companies) + "</section>" +
      "<section><h3>No documented path to a root</h3>" + list(s.noRoot) + "</section>" +
      (s.unknownFate.length ? "<section><h3>Fate not recorded</h3>" + list(s.unknownFate) + "</section>" : "") +
      "<section><h3>Where the citations come from</h3><p class=\"muted\">" +
      (s.cites.poster || 0) + " from the 1984 SEMI poster or its author, " + (s.cites.wikipedia || 0) + " from Wikipedia, " +
      (s.cites.other || 0) + " from other sources (museum archives, company histories, filings and press).</p></section>" +
      nav;
  }

  // Notes on what the map does not (yet) capture, with live counts.
  function gapsHtml(g, h) {
    var unknown = g.companies.filter(function (c) { return !c.fate && c.sector !== "people"; });
    var noRoot = g.companies.filter(function (c) { return !g.isRoot[c.id] && !Graph.pathToRoot(g, c.id); });
    var disputed = g.companies.filter(function (c) { return /disagree/i.test(c.note || ""); });
    var withMonth = g.companies.filter(function (c) { return c.month; }).length;
    var lastPoster = 0;
    g.companies.forEach(function (c) {
      if (c.sources.length === 1 && c.sources[0] === "semi1984") lastPoster = Math.max(lastPoster, c.founded);
    });
    var singleC = g.companies.filter(function (c) { return posterOnly(g, c); }).length;
    var singleL = g.links.filter(function (l) { return posterOnly(g, l); }).length;
    var singleF = 0;
    g.companies.forEach(function (c) {
      if (c.sources.some(function (s) { return g.sources[s] && g.sources[s].posterFamily; })) {
        singleF += c.founders.filter(function (f) { return !f.s; }).length;
      }
    });
    var items = [
      "<strong>Coverage.</strong> Up to " + lastPoster + " the chip companies come from the 1984 SEMI poster, which aimed to be complete. " +
        "After that the map is a curated selection of companies with documented ties, not a census.",
      "<strong>The poster is not ground truth.</strong> Poster claims are being checked against independent sources; where they disagree, notes cite both. " +
        singleC + " companies, " + singleL + " links and " + singleF + " founder origins still rest on the poster alone, and their panels say so.",
      "<strong>Roots.</strong> Traces stop at " + g.roots.length + " roots: " +
        g.roots.map(function (r) { return h.companyLink(r.id); }).join(", ") + ". " + noRoot.length +
        " companies have no documented path to any of them; their panels say so rather than guess.",
      "<strong>Fates.</strong> " + unknown.length + " companies, mostly from the poster, have no recorded fate, so the map cannot say whether they were acquired, closed or are still operating.",
      "<strong>People.</strong> Founders are listed on their companies. A person becomes a node only when they act on their own, for example with a personal angel investment.",
      "<strong>Placement within a year.</strong> Busy years are split into quarters. " + withMonth +
        " companies have a sourced founding month and sit in that quarter; the rest are placed in whichever quarter has room, so their position within the year means nothing.",
      "<strong>How traces choose.</strong> The trace prefers spin-outs, founders and alumni, and falls back to funding only when nothing stronger exists. Funding links grow over time: that reflects how the Valley changed, not a gap in the data.",
      "<strong>Founding dates.</strong> Some companies have both an incorporation date and a start-of-operations date; where they differ, the company's note says which the map uses.",
      "<strong>Disagreements.</strong> " + disputed.length + " companies have sources that disagree, and their notes record both versions: " +
        disputed.map(function (c) { return h.companyLink(c.id); }).join(", ") + "."
    ];
    return "<ul>" + items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>";
  }

  // ---- exits: acquisitions and closures ----

  var EXIT_KINDS = {
    acquired: { label: "Acquired or merged", re: /\b(acqui|bought|sold|merg|absorb|folded into|taken private|purchas|went to|passed to|donated|transferred)/ },
    closed: { label: "Closed", re: /\b(dissolved|bankrupt|chapter 11|ceased|shut|liquidat|defunct)|(?<!deal )\bclosed\b/ },
    renamed: { label: "Renamed or restructured", re: /\b(renamed|spun off|split)/ }
  };

  // Classify how a company stopped being independent: find the part of its
  // fate text that mentions the end year, then prefer acquisition wording
  // over closure, and closure over renaming.
  function exitKind(c) {
    // Roots (founded before the timeline starts) are not counted, matching the year counter.
    if (!c.ended || c.sector === "people" || c.founded < Graph.LAYOUT.firstYear) return null;
    var text = (c.fate || "").toLowerCase();
    var clauses = text.split(/;|\.\s/);
    var clause = clauses.filter(function (x) { return x.indexOf(String(c.ended)) !== -1; })[0] || text;
    var kinds = ["acquired", "closed", "renamed"];
    for (var i = 0; i < kinds.length; i++) if (EXIT_KINDS[kinds[i]].re.test(clause)) return kinds[i];
    for (i = 0; i < kinds.length; i++) if (EXIT_KINDS[kinds[i]].re.test(text)) return kinds[i];
    return "other";
  }

  function exitsByYear(g) {
    var out = {};
    g.companies.forEach(function (c) {
      var k = exitKind(c);
      if (!k) return;
      (out[c.ended] = out[c.ended] || []).push({ c: c, kind: k });
    });
    return out;
  }

  function exitsHtml(g, year, h) {
    var by = exitsByYear(g), all = [];
    Object.keys(by).forEach(function (y) { if (+y <= year) all = all.concat(by[y]); });
    var founded = g.companies.filter(function (c) {
      return c.sector !== "people" && c.founded <= year && c.founded >= Graph.LAYOUT.firstYear;
    });
    var noFate = founded.filter(function (c) { return !c.fate; }).length;
    var counts = count(all, function (e) { return e.kind; });
    var busiest = Object.keys(by).filter(function (y) { return +y <= year; })
      .sort(function (a, b) { return by[b].length - by[a].length || a - b; })[0];
    var row = function (e) {
      return "<li>" + h.companyLink(e.c.id) + ' <span class="badge exit-' + e.kind + '">' +
        h.esc((EXIT_KINDS[e.kind] || { label: "Other" }).label) + '</span><br><small class="muted">' + h.esc(e.c.fate) + "</small></li>";
    };
    var thisYear = by[year] || [];
    var years = Object.keys(by).filter(function (y) { return +y <= year; }).sort(function (a, b) { return b - a; });
    var findings = [
      all.length + " of " + founded.length + " companies founded by " + year + " had been acquired, merged, closed or restructured.",
      Object.keys(EXIT_KINDS).filter(function (k) { return counts[k]; }).map(function (k) {
        return EXIT_KINDS[k].label + ": " + counts[k];
      }).join(" · ") + (counts.other ? " · Other: " + counts.other : "") + ".",
      busiest ? "Busiest year: " + busiest + ", with " + by[busiest].length + " exits." : ""
    ].filter(Boolean);
    return '<header class="panel-head"><p class="eyebrow">Exits · up to ' + year + "</p>" +
      '<h2 id="panel-title">Acquired or closed</h2></header>' +
      '<p class="note">Companies that stopped being independent, up to the year on the timeline. Drag the slider to change the year.</p>' +
      '<section><h3>Findings</h3><ul class="findings">' + findings.map(function (f) { return "<li>" + h.esc(f) + "</li>"; }).join("") + "</ul></section>" +
      "<section><h3>In " + year + "</h3>" + (thisYear.length ? '<ul class="rel exits">' + thisYear.map(row).join("") + "</ul>" : '<p class="muted">No exits recorded this year.</p>') + "</section>" +
      "<section><h3>Every exit up to " + year + "</h3>" + years.map(function (y) {
        return '<p class="exit-year">' + y + '</p><ul class="rel exits">' + by[y].map(row).join("") + "</ul>";
      }).join("") + "</section>" +
      '<p class="muted small">Classified from each company\'s fate text. ' + noFate +
      " companies founded by " + year + " have no recorded fate, so they may be missing here.</p>";
  }

  window.Insights = {
    exitKind: exitKind,
    exitsByYear: exitsByYear,
    exitsHtml: exitsHtml,
    EXIT_KINDS: EXIT_KINDS, eraOf: eraOf, stats: stats, eraHtml: eraHtml, gapsHtml: gapsHtml, posterOnly: posterOnly };
})();
