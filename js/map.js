/*
 * The map: an SVG world (eras, links, companies) under a pan/zoom transform,
 * a sticky year axis, a minimap, timeline visibility and focus highlighting.
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var L = Graph.LAYOUT;
  var W = L.nodeWidth, H = L.nodeHeight;
  var MIN_K = 0.15, MAX_K = 2.5;

  var g, mapEl, svg, world, axis, minimap, yearBadge;
  var view = { k: 1, tx: 0, ty: 0 };
  var inset = { right: 0, bottom: 0 };
  var nodeEls = {}, edgeEls = [];
  var visibleNode = {};
  var onSelect = function () {};
  var onEra = function () {};
  var anim = null;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function wrap(text, max) {
    var words = text.split(" "), lines = [""];
    words.forEach(function (w) {
      var cur = lines[lines.length - 1];
      if (!cur) lines[lines.length - 1] = w;
      else if ((cur + " " + w).length <= max) lines[lines.length - 1] = cur + " " + w;
      else lines.push(w);
    });
    if (lines.length > 2) {
      lines = lines.slice(0, 2);
      lines[1] = lines[1].slice(0, max - 1) + "…";
    }
    return lines;
  }

  function edgePath(p, c) {
    if (c.x >= p.x + W + 8) {
      var x1 = p.x + W, y1 = p.y + H / 2, x2 = c.x, y2 = c.y + H / 2;
      var dx = Math.max(40, (x2 - x1) * 0.5);
      return "M" + x1 + "," + y1 + " C" + (x1 + dx) + "," + y1 + " " + (x2 - dx) + "," + y2 + " " + x2 + "," + y2;
    }
    // Same column: connect bottom to top (or top to bottom).
    var down = c.y > p.y;
    var sx = p.x + W / 2, sy = down ? p.y + H : p.y;
    var ex = c.x + W / 2, ey = down ? c.y : c.y + H;
    var dy = (ey - sy) * 0.5;
    return "M" + sx + "," + sy + " C" + sx + "," + (sy + dy) + " " + ex + "," + (ey - dy) + " " + ex + "," + ey;
  }

  function render() {
    world = el("g", { "class": "world" }, svg);
    var eras = el("g", { "class": "eras" }, world);
    var edges = el("g", { "class": "edges" }, world);
    var nodes = el("g", { "class": "nodes" }, world);

    // Eras and year grid
    g.eras.forEach(function (era, i) {
      var x0 = era.from === null ? -24 : Graph.xForYear(era.from) - 16;
      var x1 = era.from === null ? L.rootsWidth - 16 : Graph.xForYear(era.to + 1) - 16;
      el("rect", { x: x0, y: 0, width: x1 - x0, height: g.height, "class": "era " + (i % 2 ? "era-b" : "era-a") }, eras);
      var t = el("text", { x: x0 + 14, y: 72, "class": "era-label", "data-era": era.id, role: "link" }, eras);
      t.textContent = era.label;
      var tip = el("title", {}, t);
      tip.textContent = "Show findings for " + era.label;
    });
    for (var y = L.firstYear; y <= L.lastYear; y++) {
      var gx = Graph.xForYear(y) - 16;
      el("line", { x1: gx, y1: 88, x2: gx, y2: g.height, "class": "gridline" }, eras);
      if (Graph.yearHasQuarters(y)) {
        for (var q = 1; q < 4; q++) {
          var qx = gx + q * L.quarterWidth;
          el("line", { x1: qx, y1: 88, x2: qx, y2: g.height, "class": "gridline gridline-q" }, eras);
        }
      }
    }

    g.links.forEach(function (l) {
      var p = g.byId[l.from], c = g.byId[l.to];
      var path = el("path", { d: edgePath(p, c), "class": "edge link-" + l.type }, edges);
      var title = el("title", {}, path);
      title.textContent = p.name + " → " + c.name + " (" + l.year + "): " + l.note;
      edgeEls.push({ link: l, el: path });
    });

    g.companies.forEach(function (c) {
      var n = el("g", {
        "class": "node sector-" + c.sector, transform: "translate(" + c.x + "," + c.y + ")",
        "data-id": c.id, tabindex: "-1", role: "button", "aria-label": c.name + ", founded " + c.founded
      }, nodes);
      var title = el("title", {}, n);
      title.textContent = c.name + " (" + c.founded + (c.ended ? "–" + c.ended : "") + ")" + (g.isRoot[c.id] ? " · root" : "");
      var person = c.sector === "people";
      el("rect", { "class": "node-bg", width: W, height: H, rx: person ? H / 2 : 8 }, n);
      el("rect", { "class": "node-stripe", width: 5, height: H, rx: 2 }, n);
      var lines = wrap(c.name, 22);
      var t = el("text", { "class": "node-label", x: 14, y: H / 2 }, n);
      lines.forEach(function (line, i) {
        var ts = el("tspan", { x: 14, dy: i === 0 ? (lines.length === 1 ? "0.35em" : "-0.25em") : "1.2em" }, t);
        ts.textContent = line;
      });
      if (c.out.length >= 3 || g.isRoot[c.id]) n.classList.add("major");
      if (g.isRoot[c.id]) n.classList.add("root");
      if (person) n.classList.add("person");
      nodeEls[c.id] = n;
    });
  }

  // ---- view transform ----

  function size() {
    return { w: mapEl.clientWidth - inset.right, h: mapEl.clientHeight - inset.bottom };
  }

  function apply() {
    world.setAttribute("transform", "translate(" + view.tx + "," + view.ty + ") scale(" + view.k + ")");
    svg.classList.toggle("far", view.k < 0.42);
    drawAxis();
    drawMinimap();
  }

  function clampView() {
    var s = size(), m = 120;
    view.k = Math.max(MIN_K, Math.min(MAX_K, view.k));
    view.tx = Math.min(s.w - m, Math.max(m - g.width * view.k, view.tx));
    view.ty = Math.min(s.h - m, Math.max(m - g.height * view.k, view.ty));
  }

  function zoomAt(sx, sy, factor) {
    stopAnim();
    var k = Math.max(MIN_K, Math.min(MAX_K, view.k * factor));
    view.tx = sx - (sx - view.tx) * (k / view.k);
    view.ty = sy - (sy - view.ty) * (k / view.k);
    view.k = k;
    clampView();
    apply();
  }

  function stopAnim() { if (anim) { cancelAnimationFrame(anim); anim = null; } }

  function animateTo(target, ms) {
    stopAnim();
    var from = { k: view.k, tx: view.tx, ty: view.ty }, t0 = performance.now();
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) ms = 0;
    (function step(now) {
      var t = ms ? Math.min(1, (now - t0) / ms) : 1;
      var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      view.k = from.k + (target.k - from.k) * e;
      view.tx = from.tx + (target.tx - from.tx) * e;
      view.ty = from.ty + (target.ty - from.ty) * e;
      apply();
      anim = t < 1 ? requestAnimationFrame(step) : null;
    })(performance.now());
  }

  function centerOn(wx, wy, k) {
    var s = size();
    return { k: k, tx: s.w / 2 - wx * k, ty: s.h / 2 - wy * k };
  }

  function glideTo(id) {
    var c = g.byId[id];
    if (!c) return;
    var k = Math.max(view.k, 0.9);
    animateTo(centerOn(c.x + W / 2, c.y + H / 2, k), 650);
  }

  // Show a span of years, e.g. an era, as large as fits.
  function showRange(x0, x1) {
    var s = size();
    var fitK = s.w / (x1 - x0 + 120);
    var k = Math.max(0.45, Math.min(1, fitK));
    // Wide eras: start at the era's left edge, clear of the legend, at a readable zoom.
    var left = window.innerWidth > 760 ? 280 : 16;
    var tx = fitK >= 0.45 ? s.w / 2 - (x0 + x1) / 2 * k : left - x0 * k;
    animateTo({ k: k, tx: tx, ty: s.h / 2 - g.height / 2 * k }, 650);
  }

  function fit() {
    var s = size();
    var k = Math.min(s.w / g.width, s.h / g.height) * 0.96;
    animateTo({ k: k, tx: (s.w - g.width * k) / 2, ty: (s.h - g.height * k) / 2 }, 450);
  }

  function initialView() {
    var s = size();
    view.k = Math.max(0.45, Math.min(0.85, s.h / g.height));
    // Start just right of the legend so the roots column is visible.
    view.tx = window.innerWidth > 760 ? 280 : 16;
    view.ty = Math.max(0, (s.h - g.height * view.k) / 2);
    clampView();
    apply();
  }

  // Keep a world x position on screen, e.g. the current year while playing.
  function ensureXVisible(x) {
    var s = size(), sx = view.tx + x * view.k;
    if (sx > s.w - 80 || sx < 0) {
      animateTo({ k: view.k, tx: s.w * 0.7 - x * view.k, ty: view.ty }, 500);
    }
  }

  // ---- axis ----

  function drawAxis() {
    var s = mapEl.clientWidth;
    var out = "";
    var rootX = view.tx + (L.rootsWidth / 2 - 30) * view.k;
    var lastX = -Infinity;
    if (rootX > -40 && rootX < s && L.rootsWidth * view.k > 70) {
      out += '<text x="' + rootX + '" y="22" class="axis-label">Roots</text>';
      lastX = rootX;
    }
    for (var y = L.firstYear; y <= L.lastYear - 1; y++) {
      // Label each column at its centre, skipping labels that would collide.
      var mid = (Graph.xForYear(y) + Graph.xForYear(y + 1) - 16) / 2;
      var x = view.tx + mid * view.k;
      if (x - lastX < 44 && y !== currentYear) continue;
      if (x < -40 || x > s + 40) continue;
      lastX = x;
      out += '<text x="' + x + '" y="22" class="axis-label' + (y === currentYear ? " current" : "") + '">' + y + "</text>";
    }
    axis.innerHTML = out;
  }

  // ---- minimap ----

  var mm = { s: 1, ox: 0, oy: 0 };
  var colors = {};

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    Object.keys(Graph.SECTORS).forEach(function (k) {
      colors[k] = cs.getPropertyValue("--sector-" + k).trim();
    });
    colors.view = cs.getPropertyValue("--accent").trim();
    colors.bg = cs.getPropertyValue("--surface").trim();
  }

  function drawMinimap() {
    if (!minimap || minimap.offsetParent === null) return;
    var ctx = minimap.getContext("2d");
    var cw = minimap.width, ch = minimap.height;
    mm.s = Math.min(cw / g.width, ch / g.height);
    mm.ox = (cw - g.width * mm.s) / 2;
    mm.oy = (ch - g.height * mm.s) / 2;
    ctx.clearRect(0, 0, cw, ch);
    g.companies.forEach(function (c) {
      if (!visibleNode[c.id]) return;
      ctx.fillStyle = colors[c.sector] || "#888";
      ctx.globalAlpha = focusSet && !focusSet[c.id] ? 0.2 : 0.9;
      ctx.fillRect(mm.ox + c.x * mm.s, mm.oy + c.y * mm.s, Math.max(2, W * mm.s), Math.max(1.5, H * mm.s));
    });
    ctx.globalAlpha = 1;
    var s = size();
    ctx.strokeStyle = colors.view;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      mm.ox + (-view.tx / view.k) * mm.s, mm.oy + (-view.ty / view.k) * mm.s,
      (s.w / view.k) * mm.s, (s.h / view.k) * mm.s);
  }

  function minimapJump(e) {
    var r = minimap.getBoundingClientRect();
    var px = (e.clientX - r.left) * (minimap.width / r.width);
    var py = (e.clientY - r.top) * (minimap.height / r.height);
    var wx = (px - mm.ox) / mm.s, wy = (py - mm.oy) / mm.s;
    stopAnim();
    var t = centerOn(wx, wy, view.k);
    view.tx = t.tx; view.ty = t.ty;
    clampView();
    apply();
  }

  // ---- interaction ----

  function bindInteraction() {
    mapEl.addEventListener("wheel", function (e) {
      e.preventDefault();
      var r = mapEl.getBoundingClientRect();
      var delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-delta * 0.0015));
    }, { passive: false });

    var pointers = {}, downTarget = null, moved = false, last = null, pinch = null;

    mapEl.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      stopAnim();
      mapEl.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 1) {
        downTarget = e.target; moved = false; last = { x: e.clientX, y: e.clientY };
      } else if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        moved = true;
      }
    });

    mapEl.addEventListener("pointermove", function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2 && pinch) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        var r = mapEl.getBoundingClientRect();
        zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, d / pinch.d);
        pinch.d = d;
        return;
      }
      if (ids.length === 1 && last) {
        var dx = e.clientX - last.x, dy = e.clientY - last.y;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true;
        mapEl.classList.add("dragging");
        view.tx += dx; view.ty += dy;
        last = { x: e.clientX, y: e.clientY };
        clampView();
        apply();
      }
    });

    function end(e) {
      if (!pointers[e.pointerId]) return;
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinch = null;
      if (Object.keys(pointers).length === 0) {
        mapEl.classList.remove("dragging");
        if (!moved && e.type === "pointerup" && downTarget) {
          var node = downTarget.closest && downTarget.closest(".node");
          var era = !node && downTarget.closest && downTarget.closest("[data-era]");
          if (era) onEra(era.getAttribute("data-era"));
          else onSelect(node ? node.getAttribute("data-id") : null);
        }
        last = null; downTarget = null;
      }
    }
    mapEl.addEventListener("pointerup", end);
    mapEl.addEventListener("pointercancel", end);

    mapEl.addEventListener("keydown", function (e) {
      var step = 80, s = size();
      var keys = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (keys[e.key]) {
        e.preventDefault();
        stopAnim();
        view.tx += keys[e.key][0]; view.ty += keys[e.key][1];
        clampView(); apply();
      } else if (e.key === "+" || e.key === "=") {
        zoomAt(s.w / 2, s.h / 2, 1.25);
      } else if (e.key === "-") {
        zoomAt(s.w / 2, s.h / 2, 0.8);
      }
    });

    var mmDown = false;
    minimap.addEventListener("pointerdown", function (e) { mmDown = true; minimap.setPointerCapture(e.pointerId); minimapJump(e); });
    minimap.addEventListener("pointermove", function (e) { if (mmDown) minimapJump(e); });
    minimap.addEventListener("pointerup", function () { mmDown = false; });

    window.addEventListener("resize", function () { clampView(); apply(); });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readColors(); drawMinimap(); });
  }

  // ---- visibility and focus ----

  var currentYear = L.lastYear - 1;
  var focusSet = null;

  function setFilter(f) {
    currentYear = f.year;
    visibleNode = {};
    g.companies.forEach(function (c) {
      var vis = (c.founded < L.firstYear || c.founded <= f.year) && f.sectors[c.sector];
      visibleNode[c.id] = vis;
      var n = nodeEls[c.id];
      n.classList.toggle("hidden", !vis);
      n.classList.toggle("gone", !!(c.ended && c.ended <= f.year));
    });
    edgeEls.forEach(function (e) {
      var l = e.link;
      var vis = f.links[l.type] && l.year <= f.year && visibleNode[l.from] && visibleNode[l.to];
      e.el.classList.toggle("hidden", !vis);
    });
    drawAxis();
    drawMinimap();
  }

  function setFocus(id, pathLinks) {
    focusSet = null;
    var pathIds = {};
    (pathLinks || []).forEach(function (l) { pathIds[l.id] = true; });
    if (id) {
      var anc = Graph.ancestors(g, id), desc = Graph.descendants(g, id);
      focusSet = {};
      focusSet[id] = true;
      Object.keys(anc).forEach(function (k) { focusSet[k] = true; });
      Object.keys(desc).forEach(function (k) { focusSet[k] = true; });
    }
    svg.classList.toggle("focused", !!id);
    g.companies.forEach(function (c) {
      var n = nodeEls[c.id];
      n.classList.toggle("selected", c.id === id);
      n.classList.toggle("lineage", !!focusSet && !!focusSet[c.id]);
    });
    edgeEls.forEach(function (e) {
      var l = e.link;
      var inLineage = !!id && !!(
        ((l.to === id || anc[l.to]) && anc[l.from]) ||
        ((l.from === id || desc[l.from]) && desc[l.to]));
      e.el.classList.toggle("lineage", inLineage);
      e.el.classList.toggle("path", !!pathIds[l.id]);
    });
    drawMinimap();
  }

  function showYearBadge(year, on) {
    yearBadge.textContent = year;
    yearBadge.classList.toggle("on", on);
  }

  function init(graph, opts) {
    g = graph;
    onSelect = opts.onSelect;
    onEra = opts.onEra || onEra;
    mapEl = document.getElementById("map");
    svg = document.getElementById("canvas");
    axis = document.getElementById("axis");
    minimap = document.getElementById("minimap");
    yearBadge = document.getElementById("year-badge");
    readColors();
    render();
    bindInteraction();
    initialView();
  }

  window.MapView = {
    init: init,
    setFilter: setFilter,
    setFocus: setFocus,
    glideTo: glideTo,
    showRange: showRange,
    fit: fit,
    ensureXVisible: ensureXVisible,
    showYearBadge: showYearBadge,
    setInset: function (i) { inset = i; clampView(); apply(); },
    zoomBy: function (f) { var s = size(); zoomAt(s.w / 2, s.h / 2, f); },
    isVisible: function (id) { return !!visibleNode[id]; }
  };
})();
