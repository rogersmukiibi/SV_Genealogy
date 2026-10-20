/*
 * UI wiring: hash routing, search, the details panel (with the trace back to
 * Shockley), sector/link filters and the timeline player.
 */
(function () {
  "use strict";

  var g = Graph.build(window.GENEALOGY);
  var L = Graph.LAYOUT;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    year: L.lastYear - 1,
    sectors: {},
    links: {},
    selected: null
  };
  Object.keys(Graph.SECTORS).forEach(function (k) { state.sectors[k] = true; });
  Object.keys(Graph.LINK_TYPES).forEach(function (k) { state.links[k] = true; });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function companyLink(id) {
    var c = g.byId[id];
    return '<a href="#/company/' + c.id + '">' + esc(c.name) + "</a>";
  }

  function years(c) {
    return c.founded + (c.ended ? "–" + c.ended : "");
  }

  // ---- filters and timeline ----

  function applyFilter() {
    MapView.setFilter({ year: state.year, sectors: state.sectors, links: state.links });
    $("year").value = state.year;
    $("year-out").textContent = state.year;
    var total = 0, active = 0;
    g.companies.forEach(function (c) {
      if (c.founded < L.firstYear || c.founded > state.year || !state.sectors[c.sector]) return;
      total++;
      if (!c.ended || c.ended > state.year) active++;
    });
    $("count").textContent = total + " companies · " + active + " still independent";
  }

  function buildLegend() {
    var sectorBox = $("sector-filters");
    Object.keys(Graph.SECTORS).forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip sector-" + k;
      b.setAttribute("aria-pressed", "true");
      b.innerHTML = '<span class="swatch" aria-hidden="true"></span>' + esc(Graph.SECTORS[k].label);
      b.addEventListener("click", function () {
        state.sectors[k] = !state.sectors[k];
        b.setAttribute("aria-pressed", String(state.sectors[k]));
        applyFilter();
      });
      sectorBox.appendChild(b);
    });

    var linkBox = $("link-filters");
    Object.keys(Graph.LINK_TYPES).forEach(function (k) {
      var t = Graph.LINK_TYPES[k];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "link-toggle";
      b.setAttribute("aria-pressed", "true");
      b.title = t.desc;
      b.innerHTML = '<svg width="34" height="10" aria-hidden="true"><path class="edge link-' + k +
        '" d="M2,5 L32,5"/></svg><span>' + esc(t.label) + "</span>";
      b.addEventListener("click", function () {
        state.links[k] = !state.links[k];
        b.setAttribute("aria-pressed", String(state.links[k]));
        applyFilter();
      });
      linkBox.appendChild(b);
    });

    var toggle = document.querySelector(".legend-toggle");
    var legend = document.querySelector(".legend");
    function setOpen(open) {
      legend.classList.toggle("collapsed", !open);
      toggle.setAttribute("aria-expanded", String(open));
    }
    toggle.addEventListener("click", function () { setOpen(legend.classList.contains("collapsed")); });
    setOpen(window.innerWidth > 760);

    var ticks = $("ticks");
    for (var y = 1955; y <= 1975; y += 5) {
      var s = document.createElement("span");
      s.textContent = y;
      s.style.left = ((y - 1955) / 20 * 100) + "%";
      ticks.appendChild(s);
    }
  }

  var playTimer = null;

  function stopPlay() {
    if (!playTimer) return;
    clearInterval(playTimer);
    playTimer = null;
    $("play").textContent = "▶";
    $("play").setAttribute("aria-label", "Play timeline");
    MapView.showYearBadge(state.year, false);
  }

  function startPlay() {
    if (state.year >= 1975) state.year = 1955;
    $("play").textContent = "❚❚";
    $("play").setAttribute("aria-label", "Pause timeline");
    var tick = function () {
      applyFilter();
      MapView.showYearBadge(state.year, true);
      MapView.ensureXVisible(Graph.xForYear(state.year) + L.nodeWidth);
    };
    tick();
    playTimer = setInterval(function () {
      if (state.year >= 1975) { stopPlay(); return; }
      state.year++;
      tick();
    }, 900);
  }

  function bindTimeline() {
    $("year").addEventListener("input", function (e) {
      stopPlay();
      state.year = +e.target.value;
      applyFilter();
    });
    $("play").addEventListener("click", function () { playTimer ? stopPlay() : startPlay(); });
  }

  // ---- details panel ----

  function traceHtml(c) {
    if (c.id === Graph.ROOT_ID) {
      return '<p class="muted">This is the starting point. Every line on the map that leads back to the Valley\'s silicon industry ends here.</p>';
    }
    var steps = Graph.pathToRoot(g, c.id);
    if (!steps) {
      if (Graph.descendants(g, c.id)[Graph.ROOT_ID]) {
        return '<p class="muted">Upstream of Shockley: this company fed into the lab rather than descending from it.</p>';
      }
      return '<p class="muted">No documented link back to Shockley on this map yet. ' +
        "Its founders came from outside the Fairchild family tree.</p>";
    }
    var html = '<ol class="trace"><li class="trace-node current"><strong>' + esc(c.name) +
      "</strong><span>" + c.founded + "</span></li>";
    steps.forEach(function (l) {
      var p = g.byId[l.from];
      html += '<li class="trace-link link-' + l.type + '"><span class="badge link-' + l.type + '">' +
        esc(Graph.LINK_TYPES[l.type].label) + " · " + l.year + "</span>" + esc(l.note) + "</li>";
      html += '<li class="trace-node">' + companyLink(p.id) + "<span>" + p.founded + "</span></li>";
    });
    return html + "</ol>";
  }

  function linkListHtml(list, dir) {
    if (!list.length) return '<p class="muted">None on this map.</p>';
    return '<ul class="rel">' + list.slice().sort(function (a, b) { return a.year - b.year; }).map(function (l) {
      var other = dir === "in" ? l.from : l.to;
      return '<li><span class="badge link-' + l.type + '">' + esc(Graph.LINK_TYPES[l.type].label) +
        "</span> " + companyLink(other) + ' <span class="muted">' + l.year + "</span><br><small>" +
        esc(l.note) + "</small></li>";
    }).join("") + "</ul>";
  }

  function sourcesHtml(c) {
    return '<ul class="sources">' + (c.sources || []).map(function (s) {
      if (g.sources[s]) return "<li>" + esc(g.sources[s].title) + "</li>";
      var label = s.replace(/^https?:\/\/(www\.)?/, "").replace(/_/g, " ");
      return '<li><a href="' + esc(s) + '" target="_blank" rel="noopener">' + esc(decodeURIComponent(label)) + "</a></li>";
    }).join("") + "</ul>";
  }

  function panelHtml(c) {
    var founders = c.founders.length ? '<ul class="people">' + c.founders.map(function (f) {
      var from = !f.f ? "" : g.byId[f.f] ? " <span class=\"muted\">from</span> " + companyLink(f.f)
        : ' <span class="muted">from ' + esc(f.f) + "</span>";
      return "<li>" + esc(f.n) + from + "</li>";
    }).join("") + "</ul>" : '<p class="muted">Not listed.</p>';

    return '<header class="panel-head">' +
      '<p class="eyebrow"><span class="dot sector-' + c.sector + '"></span>' +
      esc(Graph.SECTORS[c.sector].label) + " · " + years(c) + "</p>" +
      '<h2 id="panel-title">' + esc(c.name) + "</h2>" +
      (c.fate ? '<p class="fate">' + esc(c.fate) + "</p>" : "") +
      "</header>" +
      (c.note ? '<p class="note">' + esc(c.note) + "</p>" : "") +
      "<section><h3>Path to Shockley</h3>" + traceHtml(c) + "</section>" +
      "<section><h3>Founders</h3>" + founders + "</section>" +
      "<section><h3>Came from</h3>" + linkListHtml(c.in, "in") + "</section>" +
      "<section><h3>Led to</h3>" + linkListHtml(c.out, "out") + "</section>" +
      "<section><h3>Sources</h3>" + sourcesHtml(c) + "</section>";
  }

  function updateInset() {
    var panel = $("panel");
    if (panel.hidden) return MapView.setInset({ right: 0, bottom: 0 });
    if (window.innerWidth > 760) MapView.setInset({ right: panel.offsetWidth + 16, bottom: 0 });
    else MapView.setInset({ right: 0, bottom: panel.offsetHeight });
  }

  function select(id, opts) {
    var c = g.byId[id];
    if (!c) return close();
    state.selected = id;
    // Make sure the company is visible under the current year and filters.
    if (c.founded > state.year) { stopPlay(); state.year = Math.max(c.founded, L.firstYear); }
    if (!state.sectors[c.sector]) {
      state.sectors[c.sector] = true;
      var chip = document.querySelector(".chip.sector-" + c.sector);
      if (chip) chip.setAttribute("aria-pressed", "true");
    }
    applyFilter();

    var panel = $("panel");
    $("panel-body").innerHTML = panelHtml(c);
    panel.hidden = false;
    panel.scrollTop = 0;
    updateInset();
    MapView.setFocus(id, Graph.pathToRoot(g, id) || []);
    if (!opts || opts.glide !== false) MapView.glideTo(id);
    document.title = c.name + " · Silicon Valley Genealogy";
  }

  function close() {
    state.selected = null;
    $("panel").hidden = true;
    updateInset();
    MapView.setFocus(null);
    document.title = "Silicon Valley Genealogy";
  }

  // ---- routing ----

  var glideNext = true;

  function route() {
    var m = location.hash.match(/^#\/company\/([\w-]+)/);
    if (m) select(m[1], { glide: glideNext });
    else close();
    glideNext = true;
  }

  function go(id, glide) {
    glideNext = glide !== false;
    var hash = id ? "#/company/" + id : "#/";
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  // ---- search ----

  function buildIndex() {
    var items = [];
    g.companies.forEach(function (c) {
      items.push({ id: c.id, kind: "company", text: c.name, sub: c.founded + " · " + Graph.SECTORS[c.sector].label });
      c.founders.forEach(function (f) {
        if (f.n.indexOf("/") !== -1) return;
        items.push({ id: c.id, kind: "person", text: f.n.replace(/ \(\d{4}\)$/, ""), sub: "Founder, " + c.name + " (" + c.founded + ")" });
      });
    });
    return items;
  }

  function bindSearch() {
    var index = buildIndex();
    var input = $("search"), list = $("search-results");
    var results = [], active = -1;

    function score(item, q) {
      var t = item.text.toLowerCase();
      if (t === q) return 0;
      if (t.indexOf(q) === 0) return 1;
      if (t.indexOf(" " + q) !== -1 || t.indexOf("(" + q) !== -1) return 2;
      if (t.indexOf(q) !== -1) return 3;
      return -1;
    }

    function render() {
      list.innerHTML = results.map(function (r, i) {
        return '<li role="option" id="sr-' + i + '" data-i="' + i + '"' + (i === active ? ' aria-selected="true"' : "") + ">" +
          '<span class="sr-kind">' + (r.kind === "person" ? "Person" : "Company") + "</span>" +
          '<span class="sr-text">' + esc(r.text) + '</span><span class="sr-sub">' + esc(r.sub) + "</span></li>";
      }).join("") || (input.value.trim() ? '<li class="sr-empty">No matches</li>' : "");
      var open = !!input.value.trim();
      list.hidden = !open;
      input.setAttribute("aria-expanded", String(open));
      if (active >= 0) input.setAttribute("aria-activedescendant", "sr-" + active);
      else input.removeAttribute("aria-activedescendant");
    }

    function choose(r) {
      if (!r) return;
      input.value = "";
      results = []; active = -1;
      render();
      input.blur();
      go(r.id);
    }

    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      active = -1;
      if (!q) { results = []; render(); return; }
      var seen = {};
      results = index
        .map(function (it) { return { it: it, s: score(it, q) }; })
        .filter(function (x) { return x.s >= 0; })
        .sort(function (a, b) { return a.s - b.s || (a.it.kind === "company" ? -1 : 1) || a.it.text.localeCompare(b.it.text); })
        .map(function (x) { return x.it; })
        .filter(function (it) {
          var key = it.kind + it.id + it.text;
          if (seen[key]) return false;
          return (seen[key] = true);
        })
        .slice(0, 8);
      render();
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(results.length - 1, active + 1); render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(-1, active - 1); render(); }
      else if (e.key === "Enter") { e.preventDefault(); choose(results[active >= 0 ? active : 0]); }
      else if (e.key === "Escape") { input.value = ""; results = []; render(); input.blur(); }
    });

    list.addEventListener("mousedown", function (e) {
      var li = e.target.closest("li[data-i]");
      if (li) { e.preventDefault(); choose(results[+li.getAttribute("data-i")]); }
    });
    input.addEventListener("blur", function () { setTimeout(function () { list.hidden = true; }, 100); });
    input.addEventListener("focus", function () { if (input.value.trim()) list.hidden = false; });

    document.addEventListener("keydown", function (e) {
      var typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
      if (e.key === "/" && !typing) { e.preventDefault(); input.focus(); }
      else if (e.key === "Escape" && !typing && state.selected) go(null);
    });
  }

  // ---- boot ----

  MapView.init(g, {
    onSelect: function (id) {
      if (id) go(id, false);
      else if (state.selected) go(null);
    }
  });
  buildLegend();
  bindTimeline();
  bindSearch();
  applyFilter();

  $("panel-close").addEventListener("click", function () { go(null); });
  document.querySelectorAll("[data-zoom]").forEach(function (b) {
    b.addEventListener("click", function () {
      var z = b.getAttribute("data-zoom");
      if (z === "fit") MapView.fit();
      else MapView.zoomBy(z === "in" ? 1.3 : 1 / 1.3);
    });
  });
  $("about-btn").addEventListener("click", function () { $("about").showModal(); });
  window.addEventListener("resize", updateInset);
  window.addEventListener("hashchange", route);
  route();
})();
