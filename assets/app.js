/* Madi & Christian's Photo Bird Log — public, read-only site. No frameworks, no tracking. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const key = (s) => (s || "").trim().toLowerCase();
  const PAGE = 48;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const S = { all: [], list: [], limit: PAGE, sig: "", place: null, vlist: [], vi: 0, lastFocus: null };
  const fmt = (s) => { const d = new Date(s + "T12:00:00"); return isNaN(d) ? s : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); };
  const name = (p) => p.sp || "Unidentified animal";
  const img = (p, size) => "photos/" + size + "/" + p.id + ".jpg";
  const alt = (p) => name(p) + ", photographed by " + (p.by || "us") + " on " + fmt(p.date) + (p.place ? " at " + p.place : "");
  const placeKey = (p) => p.place + "|" + p.region;

  // ---------- load ----------
  Promise.all([fetch("data/photos.json").then((r) => r.json()), fetch("data/map.json").then((r) => r.json())])
    .then(([data, shapes]) => { S.all = data.photos; S.shapes = shapes; $("updated").textContent = "Updated " + fmt(data.updated); start(); })
    .catch(() => { $("statline").textContent = "The photos couldn't be loaded. Please refresh the page."; });

  function start() {
    const birds = S.all.filter((p) => p.cat === "bird"), critters = S.all.filter((p) => p.cat === "critter");
    const kinds = (a) => new Set(a.map((p) => key(p.sp)).filter(Boolean)).size;
    const st = $("statline"); st.textContent = "";
    for (const [n, l] of [[S.all.length, "photos"], [kinds(birds), "bird species"], [kinds(critters), "animals & insects"]]) {
      const s = el("span"); s.append(el("b", "", n), l); st.append(s);
    }
    $("nAll").textContent = S.all.length; $("nBird").textContent = birds.length; $("nCritter").textContent = critters.length;
    const sp = new Map();
    for (const p of S.all) if (p.sp) { const k = key(p.sp); const e = sp.get(k) || { label: p.sp, n: 0 }; e.n++; sp.set(k, e); }
    for (const [k, e] of [...sp].sort((a, b) => a[1].label.localeCompare(b[1].label))) {
      const o = el("option", "", e.label + " (" + e.n + ")"); o.value = k; $("species").append(o);
    }
    slideshow(); onThisDay();
    $("filters").addEventListener("input", () => { S.place = null; render(); });
    $("filters").addEventListener("change", () => render());
    $("reset").onclick = () => { $("filters").reset(); S.place = null; render(); $("q").focus(); };
    document.querySelectorAll('input[name="view"]').forEach((r) => r.addEventListener("change", () => setView(r.value, true)));
    $("more").onclick = () => { const first = S.limit; S.limit += PAGE; render(); const c = $("grid").children[first]; if (c) c.querySelector("button").focus(); };
    window.addEventListener("hashchange", fromHash);
    fromHash(true);
    render();
  }

  // ---------- filters ----------
  const val = (n) => (document.querySelector('input[name="' + n + '"]:checked') || {}).value;
  function filtered(ignorePlace) {
    const q = key($("q").value), cat = val("cat"), who = val("who"), sp = $("species").value;
    return S.all.filter((p) => {
      if (cat !== "all" && p.cat !== cat) return false;
      if (who !== "all" && p.by !== who) return false;
      if (sp && key(p.sp) !== sp) return false;
      if (!ignorePlace && S.place && placeKey(p) !== S.place) return false;
      if (q && !(key(p.sp) + " " + key(p.sci) + " " + key(p.place) + " " + key(p.region) + " " + key(p.note)).includes(q)) return false;
      return true;
    });
  }
  function sorted(list) {
    const s = $("sort").value, byDate = (a, b) => b.date.localeCompare(a.date);
    const l = list.slice();
    if (s === "old") l.sort((a, b) => -byDate(a, b));
    else if (s === "az") l.sort((a, b) => (key(a.sp) || "~").localeCompare(key(b.sp) || "~") || byDate(a, b));
    else if (s === "best") l.sort((a, b) => (b.ai || 0) - (a.ai || 0) || (b.q || 0) - (a.q || 0));
    else l.sort(byDate);
    return l;
  }

  function render() {
    const list = sorted(filtered());
    S.list = list;
    const sig = [$("q").value, val("cat"), val("who"), $("species").value, $("sort").value, S.place].join("|");
    if (sig !== S.sig) { S.sig = sig; S.limit = PAGE; }
    const active = $("q").value || val("cat") !== "all" || val("who") !== "all" || $("species").value || S.place;
    $("reset").hidden = !active;
    const spSel = $("species");
    $("galleryTitle").textContent = S.place ? "At " + S.place.split("|")[0] : spSel.value ? spSel.options[spSel.selectedIndex].text.replace(/ \(\d+\)$/, "") : "All sightings";
    $("count").textContent = list.length === S.all.length ? list.length + " photos" : list.length + " of " + S.all.length + " photos match";
    const view = val("view");
    if (view === "grid") renderGrid(list);
    if (view === "map") map.refresh();
    if (view === "life") renderLife();
  }

  function card(p, i, list) {
    const li = el("li");
    const b = el("button", "card"); b.type = "button";
    const ph = el("div", "ph"); const im = el("img"); im.loading = "lazy"; im.decoding = "async"; im.src = img(p, "s"); im.alt = ""; ph.append(im);
    const meta = el("div", "meta");
    const sub = el("div", "sub"); sub.append(el("span", "d", fmt(p.date))); if (p.place) sub.append(el("span", "pl", p.place));
    const who = el("div", "who"); const dot = el("span", "dot" + (p.by === "Christian" ? " c" : "")); dot.setAttribute("aria-hidden", "true"); who.append(dot, p.by || "");
    meta.append(el("strong", "", name(p)), sub, who);
    b.append(ph, meta);
    b.setAttribute("aria-label", alt(p) + ". Open photo.");
    b.onclick = () => openViewer(i, list, b);
    li.append(b); return li;
  }
  function renderGrid(list) {
    const g = $("grid"); g.textContent = "";
    const shown = list.slice(0, S.limit);
    shown.forEach((p, i) => g.append(card(p, i, list)));
    const left = list.length - shown.length;
    $("more").hidden = left <= 0;
    $("more").textContent = "Show " + Math.min(PAGE, left) + " more photos (" + left + " left)";
  }

  // ---------- life list ----------
  function renderLife() {
    const m = new Map();
    for (const p of filtered(true)) {
      if (!p.sp) continue;
      const k = key(p.sp);
      const e = m.get(k) || { sp: p.sp, sci: p.sci, n: 0, first: p.date, by: new Set() };
      e.n++; if (p.date < e.first) e.first = p.date; if (p.by) e.by.add(p.by); m.set(k, e);
    }
    const rows = [...m.entries()].sort((a, b) => a[1].sp.localeCompare(b[1].sp));
    const tb = $("lifeBody"); tb.textContent = "";
    for (const [k, e] of rows) {
      const tr = el("tr");
      const th = el("th"); th.scope = "row";
      const b = el("button", "spbtn", e.sp); b.type = "button";
      b.setAttribute("aria-label", "Show photos of " + e.sp);
      b.onclick = () => { $("species").value = k; setView("grid", true); render(); $("galleryTitle").focus && $("gallery").focus(); };
      th.append(b); if (e.sci) th.append(el("em", "", e.sci));
      tr.append(th, el("td", "num", String(e.n)), el("td", "", fmt(e.first)), el("td", "", [...e.by].sort().join(" & ")));
      tb.append(tr);
    }
    $("count").textContent = rows.length + " species";
  }

  // ---------- views + links ----------
  function setView(v, push) {
    const r = document.querySelector('input[name="view"][value="' + v + '"]'); if (r) r.checked = true;
    $("gridView").hidden = v !== "grid"; $("mapView").hidden = v !== "map"; $("lifeView").hidden = v !== "life";
    if (push) history.replaceState(null, "", v === "grid" ? location.pathname : "#" + v);
    render();
  }
  function fromHash(first) {
    const h = location.hash.slice(1);
    if (h === "map" || h === "life") setView(h, false);
    else if (h.startsWith("p-")) {
      const i = S.all.findIndex((p) => p.id === h.slice(2));
      if (i >= 0 && !$("viewer").open) openViewer(i, S.all, null, true);
    } else if (!first) setView("grid", false);
  }

  // ---------- viewer ----------
  function openViewer(i, list, from, noHash) {
    S.vlist = list; S.vi = i; S.lastFocus = from || document.activeElement;
    showPhoto();
    if (!$("viewer").open) $("viewer").showModal();
    if (!noHash) history.replaceState(null, "", "#p-" + list[i].id);
    hero.pause(true);
  }
  function showPhoto() {
    const p = S.vlist[S.vi];
    $("vImg").src = img(p, "l"); $("vImg").alt = alt(p);
    $("vTitle").textContent = name(p);
    $("vSci").textContent = p.sci || ""; $("vSci").hidden = !p.sci;
    $("vMeta").textContent = [fmt(p.date), [p.place, p.region].filter(Boolean).join(", "), p.by ? "Photo: " + p.by : ""].filter(Boolean).join(" · ");
    $("vNote").textContent = p.note || ""; $("vNote").hidden = !p.note;
    $("vLink").hidden = !p.ml; if (p.ml) $("vLink").href = "https://macaulaylibrary.org/asset/" + p.ml;
    $("vPos").textContent = "Photo " + (S.vi + 1) + " of " + S.vlist.length;
    const nb = S.vlist[S.vi + 1]; if (nb) { const pre = new Image(); pre.src = img(nb, "l"); }
  }
  const step = (d) => { S.vi = (S.vi + d + S.vlist.length) % S.vlist.length; showPhoto(); history.replaceState(null, "", "#p-" + S.vlist[S.vi].id); };
  $("vPrev").onclick = () => step(-1);
  $("vNext").onclick = () => step(1);
  $("vClose").onclick = () => $("viewer").close();
  $("viewer").addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); });
  $("viewer").addEventListener("close", () => {
    const v = val("view"); history.replaceState(null, "", v === "grid" ? location.pathname : "#" + v);
    if (S.lastFocus && document.contains(S.lastFocus)) S.lastFocus.focus();
  });

  // ---------- slideshow (Claude's picks, else the sharpest third) ----------
  let hero = { pause() {} };
  function slideshow() {
    let pool = S.all.filter((p) => p.sp);
    const rated = pool.filter((p) => typeof p.ai === "number").sort((a, b) => b.ai - a.ai);
    if (rated.length >= 12) { const top = rated.filter((p) => p.ai >= 7); pool = top.length >= 12 ? top : rated.slice(0, Math.max(12, Math.ceil(rated.length / 3))); }
    else { const q = pool.filter((p) => typeof p.q === "number").sort((a, b) => b.q - a.q); if (q.length >= 6) pool = q.slice(0, Math.ceil(q.length / 3)); }
    if (!pool.length) return;
    for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
    $("show").hidden = false;
    const DUR = 12000; let i = -1, timer = null, playing = !reduce, held = false, front = "heroA";
    const sched = () => {
      clearTimeout(timer); const bar = $("heroProg"); bar.classList.remove("run"); void bar.offsetWidth;
      if (playing && !held && !document.hidden && pool.length > 1) { bar.style.setProperty("--dur", DUR + "ms"); bar.classList.add("run"); timer = setTimeout(() => go(i + 1), DUR); }
    };
    function go(n) {
      i = (n + pool.length) % pool.length; const p = pool[i];
      const back = front === "heroA" ? "heroB" : "heroA", im = $(back);
      im.onload = () => {
        $(front).classList.remove("on"); $(front).setAttribute("aria-hidden", "true"); $(front).alt = "";
        im.classList.add("on"); im.removeAttribute("aria-hidden"); im.alt = alt(p); front = back;
        $("heroBack").src = im.src; $("heroBack").classList.add("on");
      };
      im.src = img(p, "l");
      $("heroSpecies").textContent = name(p);
      $("heroMeta").textContent = [fmt(p.date), p.place, p.by].filter(Boolean).join(" · ");
      const nx = pool[(i + 1) % pool.length]; if (nx) { const pre = new Image(); pre.src = img(nx, "l"); }
      sched();
    }
    function setPlay(v) {
      playing = v; $("heroPlayIcon").textContent = v ? "❚❚" : "▶";
      $("heroPlay").setAttribute("aria-label", v ? "Pause slideshow" : "Play slideshow");
      $("hero").setAttribute("aria-live", v ? "off" : "polite"); sched();
    }
    $("heroPlay").onclick = () => setPlay(!playing);
    $("heroNext").onclick = () => go(i + 1);
    $("heroPrev").onclick = () => go(i - 1);
    $("heroCap").onclick = () => openViewer(i, pool, $("heroCap"), false);
    // pause while the visitor is pointing at or keyboard-focused inside the slideshow
    const show = $("show");
    show.addEventListener("mouseenter", () => { held = true; sched(); });
    show.addEventListener("mouseleave", () => { held = false; sched(); });
    show.addEventListener("focusin", () => { held = true; sched(); });
    show.addEventListener("focusout", (e) => { if (!show.contains(e.relatedTarget)) { held = false; sched(); } });
    document.addEventListener("visibilitychange", sched);
    hero = { pause: (v) => { if (v && playing) setPlay(false); } };
    setPlay(playing); go(0);
  }

  // ---------- on this day ----------
  function onThisDay() {
    const now = new Date(), yr = now.getFullYear(), iso = now.toISOString();
    const ord = (s) => { const [m, d] = s.slice(5, 10).split("-").map(Number); return m * 31 + d; }, t = ord(iso);
    const past = S.all.filter((p) => p.sp && /^\d{4}-\d\d-\d\d/.test(p.date) && +p.date.slice(0, 4) < yr);
    let label = "On this day", pick = past.filter((p) => ord(p.date) === t);
    if (!pick.length) { label = "This week in past years"; pick = past.filter((p) => Math.abs(ord(p.date) - t) <= 7); }
    if (!pick.length) { label = "This month in past years"; pick = past.filter((p) => p.date.slice(5, 7) === iso.slice(5, 7)); }
    if (!pick.length) return;
    pick.sort((a, b) => b.date.localeCompare(a.date) || (b.ai || 0) - (a.ai || 0) || (b.q || 0) - (a.q || 0));
    const seen = new Set(), list = [];
    for (const p of pick) { const k = key(p.sp); if (!seen.has(k)) { seen.add(k); list.push(p); } if (list.length >= 12) break; }
    $("otdTitle").textContent = label;
    $("otdSub").textContent = pick.length + " photos · " + seen.size + " species";
    const row = $("otdRow");
    list.forEach((p, i) => {
      const li = el("li"), b = el("button"); b.type = "button";
      const im = el("img"); im.loading = "lazy"; im.src = img(p, "s"); im.alt = "";
      const ago = yr - +p.date.slice(0, 4);
      b.append(im, el("strong", "", name(p)), el("small", "", fmt(p.date) + " · " + (ago === 1 ? "1 year ago" : ago + " years ago")));
      b.setAttribute("aria-label", alt(p) + ", " + (ago === 1 ? "1 year ago" : ago + " years ago") + ". Open photo.");
      b.onclick = () => openViewer(i, list, b);
      li.append(b); row.append(li);
    });
    $("otd").hidden = false;
  }

  // ---------- map ----------
  const map = (() => {
    const NS = "http://www.w3.org/2000/svg";
    const svgEl = (t, a) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; };
    const box = $("mapBox"), svg = $("mapSvg"), gS = $("mapShapes"), gL = $("mapLabels"), gP = $("mapPins");
    const CITIES = [["Dallas", -96.797, 32.777], ["Fort Worth", -97.331, 32.755], ["Houston", -95.369, 29.76], ["Austin", -97.743, 30.267], ["San Antonio", -98.494, 29.424], ["Galveston", -94.797, 29.301], ["Denver", -104.99, 39.739]];
    const LABELS = [["Texas", -99.6, 31.2], ["Colorado", -105.55, 39.1], ["Oklahoma", -97.4, 35.6], ["New Mexico", -106.1, 34.3], ["Kansas", -98.4, 38.5], ["Louisiana", -92.4, 31.0]];
    let k = 1, tx = 0, ty = 0, W = 0, H = 0, places = [], built = false, fitted = false, gC = null;
    const proj = (lng, lat) => { const K = Math.cos(S.shapes.lat0 * Math.PI / 180); return [lng * K * S.shapes.scale, -lat * S.shapes.scale]; };
    const scr = (lng, lat) => { const [x, y] = proj(lng, lat); return [x * k + tx, y * k + ty]; };
    function build() {
      if (built) return; built = true;
      const g = svgEl("g", {}); gC = svgEl("g", {});
      for (const s of S.shapes.states) g.append(svgEl("path", { d: s.d, class: "st" + (s.name === "Texas" || s.name === "Colorado" ? " home" : "") }));
      for (const c of S.shapes.counties) gC.append(svgEl("path", { d: c.d, class: "co" }));
      gS.append(g, gC);
    }
    function collect() {
      const m = new Map();
      for (const p of filtered(true)) {
        if (typeof p.lat !== "number") continue;
        const kk = placeKey(p); let e = m.get(kk);
        if (!e) { e = { key: kk, name: p.place || "Unnamed spot", region: p.region, lat: 0, lng: 0, n: 0, c: 0, m: 0, sp: new Set() }; m.set(kk, e); }
        e.n++; e.lat += p.lat; e.lng += p.lng; if (p.by === "Christian") e.c++; else e.m++; if (p.sp) e.sp.add(key(p.sp));
      }
      places = [...m.values()].map((e) => ({ ...e, lat: e.lat / e.n, lng: e.lng / e.n })).sort((a, b) => b.n - a.n);
    }
    function fit() {
      if (!places.length) return;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of places) { const [x, y] = proj(p.lng, p.lat); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const bw = Math.max(x1 - x0, 8), bh = Math.max(y1 - y0, 8);
      k = Math.max(2, Math.min(60, Math.min((W - 80) / bw, (H - 80) / bh)));
      tx = W / 2 - (x0 + x1) / 2 * k; ty = H / 2 - (y0 + y1) / 2 * k; fitted = true;
    }
    function draw() {
      gS.setAttribute("transform", "matrix(" + k + ",0,0," + k + "," + tx + "," + ty + ")");
      gC.style.display = k > 25 ? "" : "none";
      gL.textContent = "";
      for (const [n, lng, lat] of LABELS) { const [x, y] = scr(lng, lat); if (x > -60 && x < W + 60 && y > -20 && y < H + 20) { const t = svgEl("text", { x, y, class: "stlabel", "text-anchor": "middle" }); t.textContent = n; gL.append(t); } }
      if (k > 12) for (const [n, lng, lat] of CITIES) { const [x, y] = scr(lng, lat); if (x > 0 && x < W && y > 0 && y < H) { const g = svgEl("g", { class: "city" }); g.append(svgEl("circle", { cx: x, cy: y, r: 2.5 })); const t = svgEl("text", { x: x + 6, y: y - 5 }); t.textContent = n; g.append(t); gL.append(g); } }
      const rad = (n) => Math.min(24, 7 + Math.sqrt(n) * 1.7), cl = [];
      for (const p of places) {
        const [x, y] = scr(p.lng, p.lat);
        const c = cl.find((c) => Math.hypot(c.x - x, c.y - y) < rad(c.n) + rad(p.n) + 4);
        if (c) { const n = c.n + p.n; c.x = (c.x * c.n + x * p.n) / n; c.y = (c.y * c.n + y * p.n) / n; c.n = n; c.places.push(p); c.c += p.c; c.m += p.m; }
        else cl.push({ x, y, n: p.n, places: [p], c: p.c, m: p.m });
      }
      gP.textContent = "";
      for (const c of cl) {
        const who = c.c && c.m ? "b" : c.c ? "c" : "m", r = rad(c.n);
        const lab = (c.places.length === 1 ? c.places[0].name : c.places.length + " places nearby") + ", " + c.n + " photos";
        const g = svgEl("g", { class: "pin " + who, tabindex: "0", role: "button", "aria-label": lab });
        g.append(svgEl("circle", { class: "main", cx: c.x, cy: c.y, r }));
        if (who === "b") g.append(svgEl("circle", { class: "ring", cx: c.x, cy: c.y, r: r + 2.5 }));
        if (c.n > 1) { const t = svgEl("text", { x: c.x, y: c.y }); t.textContent = c.n; g.append(t); }
        const act = () => { if (c.places.length === 1) choose(c.places[0].key); else zoom(c.x, c.y, 3); };
        g.addEventListener("click", (e) => { e.stopPropagation(); if (!moved) act(); });
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
        gP.append(g);
      }
    }
    function choose(pk) { S.place = pk; setView("grid", true); $("gallery").focus(); }
    function list() {
      const ul = $("placeList"); ul.textContent = "";
      for (const p of places) {
        const li = el("li"), b = el("button"); b.type = "button";
        const t = el("span"); t.append(el("span", "", p.name), el("small", "", [p.region, p.sp.size + " species"].filter(Boolean).join(" · ")));
        b.append(t, el("i", "", p.n + (p.n === 1 ? " photo" : " photos")));
        b.setAttribute("aria-pressed", String(S.place === p.key));
        b.onclick = () => choose(p.key);
        li.append(b); ul.append(li);
      }
      $("count").textContent = places.length + " places · " + places.reduce((s, p) => s + p.n, 0) + " photos with a location";
    }
    function zoom(mx, my, f) { const k2 = Math.max(2, Math.min(400, k * f)); tx = mx - (mx - tx) * k2 / k; ty = my - (my - ty) * k2 / k; k = k2; draw(); }
    const at = (e) => { const r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const ptrs = new Map(); let moved = false, last = null, pinch = null;
    box.addEventListener("pointerdown", (e) => { if (e.target.closest(".mapctl")) return; ptrs.set(e.pointerId, at(e)); moved = false; last = at(e); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
    box.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) return; const [x, y] = at(e); ptrs.set(e.pointerId, [x, y]);
      if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch); pinch = d; moved = true; return; }
      const dx = x - last[0], dy = y - last[1];
      if (!moved && Math.abs(dx) + Math.abs(dy) > 3) { moved = true; try { box.setPointerCapture(e.pointerId); } catch (err) {} }
      if (moved) { tx += dx; ty += dy; draw(); } last = [x, y];
    });
    const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; setTimeout(() => (moved = false), 0); };
    box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
    box.addEventListener("wheel", (e) => { e.preventDefault(); const [x, y] = at(e); zoom(x, y, e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
    $("mapIn").onclick = () => zoom(W / 2, H / 2, 1.5);
    $("mapOut").onclick = () => zoom(W / 2, H / 2, 1 / 1.5);
    $("mapFit").onclick = () => { fit(); draw(); };
    new ResizeObserver(() => { if (!$("mapView").hidden) refresh(); }).observe(box);
    function refresh() {
      if ($("mapView").hidden || !S.shapes) return;
      build(); const r = box.getBoundingClientRect(); W = r.width; H = r.height;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      collect(); if (!fitted) fit(); draw(); list();
    }
    return { refresh };
  })();
})();
