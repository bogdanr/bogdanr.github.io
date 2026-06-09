/*
 * Animations for the post "Making local LLM dictation fast".
 * Vanilla JS, no dependencies. Each widget is self-contained, replayable,
 * and respects prefers-reduced-motion (renders the final frame, no motion).
 *
 * Widgets (mount by id):
 *   #fll-pipeline          F7 / F8 pipelines and where caching sits
 *   #fll-prefill-restore   prefill (token-by-token) vs restore (instant snap)
 *   #fll-bandwidth         why prefill is compute-bound and decode is RAM-bound
 *   #fll-prompt-layout     system-prompt-last (bug) vs system-prompt-first (fix)
 *   #fll-lru               how the checkpoint cache stays bounded (prune + LRU)
 *   #fll-race              per-turn time-to-first-token: cached vs uncached vs ollama
 */
(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var raceData = {
    turns: [1, 2, 3, 4, 5, 6],
    series: {
      fono_cached_ms: [341, 641, 383, 509, 491, 375],
      fono_uncached_ms: [786, 1917, 2468, 3321, 4367, 4892],
      ollama_ms: [2649, 1397, 1322, 1352, 1317, 1521]
    }
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /* ============ Animation 0: the two cache shapes ============ */
  // Both paths cache only the prompt *prefix* as a snapshot (pinned base +
  // reusable layers); the words you just said are always decoded fresh in a
  // separate scratch area. The difference: F7 throws that scratch away (it
  // caches a fan of app-context prefixes), while F8 folds it into a new
  // checkpoint that extends the chain.
  function buildPipeline(root) {
    var busy = false;
    function wait(ms, cb) { setTimeout(cb, reduceMotion ? 0 : ms); }

    var wrap = el("div", "fll-pipe");
    wrap.appendChild(el("p", "fll-cap",
      "What Fono caches is the prompt prefix (the unchanging instructions) as " +
      "a ready-to-run snapshot. The dark-green base is pinned: built once at " +
      "startup, never evicted. The words you dictate are never cached. They are " +
      "decoded fresh each time in the purple scratch box on the right. Press a " +
      "button and watch what happens to that scratch box afterwards. That is the " +
      "whole difference between the two paths."));

    var legend = el("div", "fll-pipe-legend");
    [["base", "pinned base · never evicted"],
     ["warm", "cached prefix · restored from a snapshot"],
     ["fresh", "decoded fresh this turn (scratch)"]].forEach(function (p) {
      var s = el("span", "fll-pipe-key " + p[0]);
      s.appendChild(el("i")); s.appendChild(el("b", null, p[1]));
      legend.appendChild(s);
    });
    wrap.appendChild(legend);

    function pinNode(title, sub) {
      var n = el("div", "fll-pipe-pin");
      n.appendChild(el("span", "fll-pipe-pinico", "\uD83D\uDCCC"));
      var t = el("div", "fll-pipe-ntext");
      t.appendChild(el("b", null, title));
      t.appendChild(el("small", null, sub));
      n.appendChild(t);
      return n;
    }
    function layerNode(title, sub) {
      var n = el("div", "fll-pipe-node");
      var t = el("div", "fll-pipe-ntext");
      t.appendChild(el("b", null, title));
      t.appendChild(el("small", null, sub));
      n.appendChild(t);
      return n;
    }
    function arrowNode() {
      var n = el("div", "fll-pipe-arrowcol");
      var m = el("span", "fll-pipe-arrowmark", "\u203A");
      n.appendChild(m);
      return { node: n, mark: m };
    }
    function pointArrow(arrow, target, live) {
      if (!arrow || !target) return;
      function update() {
        var ar = arrow.node.getBoundingClientRect();
        var tr = target.getBoundingClientRect();
        if (ar.height && tr.height) {
          var y = tr.top + tr.height / 2 - ar.top;
          arrow.mark.style.top = Math.max(12, Math.min(ar.height - 12, y)) + "px";
        }
        arrow.node.classList.toggle("live", !!live);
      }
      if (window.requestAnimationFrame) requestAnimationFrame(update);
      else update();
    }
    function flash(node, ms, cb) {
      node.classList.add("restoring");
      wait(ms, function () { node.classList.remove("restoring"); if (cb) cb(); });
    }
    // A scratch box of token pips that fill left-to-right (the fresh decode).
    function scratchBox() {
      var b = el("div", "fll-pipe-scratch");
      b.appendChild(el("div", "fll-pipe-scratch-hd", "scratch · decoded fresh"));
      var pips = el("div", "fll-pipe-pips");
      for (var i = 0; i < 12; i++) pips.appendChild(el("i"));
      b.appendChild(pips);
      b.appendChild(el("div", "fll-pipe-scratch-note", "idle"));
      return { node: b, pips: pips, note: b.lastChild };
    }
    function fillScratch(box, label, ms, cb) {
      box.note.textContent = label;
      box.node.classList.add("live");
      var pips = box.pips.children, n = pips.length, i;
      for (i = 0; i < n; i++) pips[i].className = "";
      if (reduceMotion) { for (i = 0; i < n; i++) pips[i].className = "on"; return cb && cb(); }
      var k = 0;
      (function step() {
        if (k >= n) return cb && cb();
        pips[k].className = "on"; k++;
        setTimeout(step, ms / n);
      })();
    }
    function clearScratch(box, note, discarded) {
      box.node.classList.remove("live");
      box.node.classList.toggle("discarded", !!discarded);
      var pips = box.pips.children;
      wait(420, function () {
        for (var i = 0; i < pips.length; i++) pips[i].className = "";
        box.node.classList.remove("discarded");
        box.note.textContent = note || "idle";
      });
    }

    var panels = el("div", "fll-pipe-panels");

    /* ---------- F7: fan of app prefixes; scratch discarded ---------- */
    var f7 = el("div", "fll-pipe-panel");
    f7.appendChild(el("div", "fll-pipe-ptitle", "F7 — dictation: a fan of cached prefixes"));
    var f7cols = el("div", "fll-pipe-cols");
    var f7cache = el("div", "fll-pipe-cache");
    f7cache.appendChild(el("div", "fll-pipe-cache-hd", "Cache · persists"));
    var f7tree = el("div", "fll-pipe-tree fan");
    var f7base = pinNode("Cleanup base", "main + advanced + dictionary");
    f7base.classList.add("warm");
    f7tree.appendChild(f7base);
    var f7branches = el("div", "fll-pipe-branches");
    var apps = [
      { key: "cli", short: "CLI", label: "CLI context" },
      { key: "editor", short: "Editor", label: "Editor context" },
      { key: "browser", short: "Browser", label: "Browser context" }
    ];
    var f7nodes = {};
    apps.forEach(function (a) {
      var n = layerNode(a.label, "base + app rules");
      n.dataset.cached = "0";
      f7nodes[a.key] = n;
      f7branches.appendChild(n);
    });
    f7tree.appendChild(f7branches);
    f7cache.appendChild(f7tree);
    f7cols.appendChild(f7cache);
    var f7arrow = arrowNode();
    f7cols.appendChild(f7arrow.node);
    var f7box = scratchBox();
    f7cols.appendChild(f7box.node);
    f7.appendChild(f7cols);
    var f7ctrl = el("div", "fll-pipe-controls fll-pipe-dictate-controls");
    apps.forEach(function (a) {
      var b = el("button", "fll-btn fll-btn-ghost", a.short);
      b.addEventListener("click", function () { f7run(a); });
      f7ctrl.appendChild(b);
    });
    f7.appendChild(f7ctrl);
    var f7status = el("div", "fll-pipe-status",
      "Dictate into the same app twice. The second time the prefix is already cached, so only your words are decoded.");
    f7.appendChild(f7status);
    panels.appendChild(f7);

    /* ---------- F8: a chain; scratch folded into the cache ---------- */
    var f8 = el("div", "fll-pipe-panel");
    f8.appendChild(el("div", "fll-pipe-ptitle", "F8 — assistant: a chain that grows"));
    var f8cols = el("div", "fll-pipe-cols");
    var f8cache = el("div", "fll-pipe-cache");
    f8cache.appendChild(el("div", "fll-pipe-cache-hd", "Cache · persists"));
    var f8tree = el("div", "fll-pipe-tree chain");
    var f8base = pinNode("system + tools", "the assistant's instructions");
    f8base.classList.add("warm");
    f8tree.appendChild(f8base);
    var f8chain = el("div", "fll-pipe-chain");
    f8tree.appendChild(f8chain);
    f8cache.appendChild(f8tree);
    f8cols.appendChild(f8cache);
    var f8arrow = arrowNode();
    f8cols.appendChild(f8arrow.node);
    var f8box = scratchBox();
    f8cols.appendChild(f8box.node);
    f8.appendChild(f8cols);
    var f8ctrl = el("div", "fll-pipe-controls fll-pipe-f8-controls");
    var sayBtn = el("button", "fll-btn fll-btn-ghost", "Say something");
    f8ctrl.appendChild(sayBtn);
    f8.appendChild(f8ctrl);
    var f8status = el("div", "fll-pipe-status",
      "Each turn restores the previous checkpoint, decodes your new exchange, then folds it into a fresh checkpoint.");
    f8.appendChild(f8status);
    panels.appendChild(f8);

    wrap.appendChild(panels);
    var sharedCtrl = el("div", "fll-pipe-shared");
    var resetBtn = el("button", "fll-btn fll-btn-ghost", "Reset both paths");
    sharedCtrl.appendChild(resetBtn);
    wrap.appendChild(sharedCtrl);
    root.appendChild(wrap);

    /* ---------- F7 behaviour: prefix restored/built, transcript discarded ---------- */
    pointArrow(f7arrow, f7base, false);
    pointArrow(f8arrow, f8base, false);

    function f7run(a) {
      if (busy) return; busy = true;
      var n = f7nodes[a.key];
      var warmAlready = n.dataset.cached === "1";
      Object.keys(f7nodes).forEach(function (k) { f7nodes[k].classList.remove("active"); });
      f7status.textContent = "Restoring the pinned base from its snapshot\u2026";
      pointArrow(f7arrow, f7base, true);
      flash(f7base, 360, function () {
        n.classList.add("active");
        pointArrow(f7arrow, n, true);
        function decodeTranscript() {
          pointArrow(f7arrow, n, true);
          fillScratch(f7box, "your words \u2192 cleaned text", 1000, function () {
            f7status.textContent =
              "Decoded your transcript in scratch, then threw it away. The cache only " +
              "keeps the " + a.label + " prefix, ready for next time.";
            clearScratch(f7box, "discarded", true);
            pointArrow(f7arrow, n, false);
            busy = false;
          });
        }
        if (warmAlready) {
          f7status.textContent =
            "Warm: base + " + a.label + " restored as one snapshot (about 20 ms). Now decoding only your words\u2026";
          flash(n, 360, decodeTranscript);
        } else {
          f7status.textContent =
            "First time in " + a.short + ": building the " + a.label + " prefix on top of the base, once, and caching it\u2026";
          pointArrow(f7arrow, n, true);
          wait(900, function () {
            n.dataset.cached = "1"; n.classList.add("warm");
            decodeTranscript();
          });
        }
      });
    }

    /* ---------- F8 behaviour: exchange folded into a new checkpoint ---------- */
    var turns = 0, MAX_TURNS = 3;
    function updateF8Button() {
      sayBtn.textContent = turns >= MAX_TURNS ? "Reset" : "Say something";
      sayBtn.title = turns >= MAX_TURNS ? "Reset the assistant chain and replay it" : "Add another assistant turn";
    }
    function resetF8() {
      turns = 0;
      f8chain.innerHTML = "";
      clearScratch(f8box, "idle", false);
      pointArrow(f8arrow, f8base, false);
      f8status.textContent = "Fresh conversation. The base stays pinned and warm.";
      updateF8Button();
    }
    function f8run() {
      if (busy || turns >= MAX_TURNS) return; busy = true;
      var prevLabel = turns === 0 ? "pinned system + tools base" : "turn " + turns + " checkpoint";
      var prev = turns === 0 ? f8base : f8chain.lastChild;
      f8status.textContent = "Restoring the " + prevLabel + " (about 20 ms)\u2026";
      pointArrow(f8arrow, prev, true);
      flash(prev, 360, function () {
        fillScratch(f8box, "your request + the reply", 1000, function () {
          turns++;
          var node = layerNode("Turn " + turns, turns === 1 ? "extends base" : "extends turn " + (turns - 1));
          node.classList.add("active");
          f8chain.appendChild(node);
          pointArrow(f8arrow, node, true);
          f8status.textContent =
            "Turn " + turns + ": decoded your exchange in scratch, then folded it into a new " +
            "checkpoint that extends the chain. Nothing earlier was re-read." +
            (turns >= MAX_TURNS ? " (After about 5 idle minutes the chain expires back to the pinned base.)" : "");
          clearScratch(f8box, "folded into turn " + turns, false);
          wait(360, function () {
            node.classList.remove("active");
            node.classList.add("warm");
            pointArrow(f8arrow, node, false);
            busy = false;
            updateF8Button();
          });
        });
      });
    }
    sayBtn.addEventListener("click", function () {
      if (busy) return;
      if (turns >= MAX_TURNS) resetF8();
      else f8run();
    });
    resetBtn.addEventListener("click", function () {
      if (busy) return;
      Object.keys(f7nodes).forEach(function (k) {
        f7nodes[k].classList.remove("active", "warm");
        f7nodes[k].dataset.cached = "0";
      });
      clearScratch(f7box, "idle", false);
      f7status.textContent =
        "Dictate into the same app twice. The second time the prefix is already cached, so only your words are decoded.";
      resetF8();
    });

    function autoplay() {
      if (reduceMotion) return;
      var steps = [
        function () { f7run(apps[0]); },
        function () { f7run(apps[0]); },
        f8run,
        f8run,
        f8run
      ];
      var i = 0;
      function next() {
        if (i >= steps.length) return;
        if (busy) return setTimeout(next, 180);
        steps[i++]();
        setTimeout(next, 220);
      }
      setTimeout(next, 450);
    }
    autoplay();
  }

  /* ============ Animation 1: prefill/restore, then decode (same track) ============ */
  function buildPrefillVsRestore(root) {
    var TOKENS = 24, DECODE = 16;
    var COLD_PRE = 2240, WARM_PRE = 320, DEC_PER = 110;       // animation timings (ms)
    var COLD_PRE_MS = 2500, WARM_PRE_MS = 20, DEC_MS = 30;    // labelled (real-ish) timings
    var COLD_TOTAL = COLD_PRE_MS + DECODE * DEC_MS, WARM_TOTAL = WARM_PRE_MS + DECODE * DEC_MS;
    var wrap = el("div", "fll-pvr");
    wrap.appendChild(el("p", "fll-cap",
      "A cold prefill reads the whole prompt first, while a restore loads the " +
      "saved state in milliseconds so the cached lane reaches that first purple token far sooner."));
    function lane(label, sub, prefixKind) {
      var l = el("div", "fll-lane");
      var head = el("div", "fll-lane-head");
      head.appendChild(el("span", "fll-lane-label", label));
      var timer = el("span", "fll-lane-timer", "0 ms");
      head.appendChild(timer);
      l.appendChild(head);
      var track = el("div", "fll-track");
      var pre = [], dec = [];
      for (var i = 0; i < TOKENS; i++) { var c = el("div", "fll-cell" + (prefixKind ? " " + prefixKind : "")); track.appendChild(c); pre.push(c); }
      track.appendChild(el("div", "fll-cell-gap"));
      for (var j = 0; j < DECODE; j++) { var d = el("div", "fll-cell dec"); track.appendChild(d); dec.push(d); }
      l.appendChild(track);
      l.appendChild(el("div", "fll-lane-sub", sub));
      return { node: l, pre: pre, dec: dec, timer: timer };
    }
    var cold = lane("Cold — prefill, then decode", "reads every prompt token before the first answer token appears", "");
    var warm = lane("Cached — restore, then decode", "loads the saved state in about 20 ms, then decodes the very same answer", "warm");
    wrap.appendChild(cold.node); wrap.appendChild(warm.node);
    var btn = el("button", "fll-btn", "Replay");
    wrap.appendChild(btn);
    root.appendChild(wrap);
    var busy = false;

    function setAll(lane, on) { lane.pre.concat(lane.dec).forEach(function (c) { c.classList.toggle("on", on); }); }
    function reset() { setAll(cold, false); setAll(warm, false); cold.timer.textContent = "0 ms"; warm.timer.textContent = "0 ms"; }
    function fillTo(cells, n) { for (var i = 0; i < n; i++) cells[i].classList.add("on"); }

    function run() {
      if (busy) return;
      reset();
      if (reduceMotion) {
        setAll(cold, true); setAll(warm, true);
        cold.timer.textContent = "≈ " + COLD_TOTAL + " ms"; warm.timer.textContent = "≈ " + WARM_TOTAL + " ms";
        return;
      }
      busy = true; btn.disabled = true;
      var start = performance.now();
      function frame(now) {
        var t = now - start;
        var cPre = Math.min(TOKENS, Math.floor(t / (COLD_PRE / TOKENS)));
        var wPre = Math.min(TOKENS, Math.floor(t / (WARM_PRE / TOKENS)));
        fillTo(cold.pre, cPre); fillTo(warm.pre, wPre);
        var cDec = t > COLD_PRE ? Math.min(DECODE, Math.floor((t - COLD_PRE) / DEC_PER)) : 0;
        var wDec = t > WARM_PRE ? Math.min(DECODE, Math.floor((t - WARM_PRE) / DEC_PER)) : 0;
        fillTo(cold.dec, cDec); fillTo(warm.dec, wDec);
        cold.timer.textContent = Math.round(cPre < TOKENS ? (cPre / TOKENS) * COLD_PRE_MS : COLD_PRE_MS + cDec * DEC_MS) + " ms";
        warm.timer.textContent = Math.round(wPre < TOKENS ? (wPre / TOKENS) * WARM_PRE_MS : WARM_PRE_MS + wDec * DEC_MS) + " ms";
        if (cDec < DECODE || wDec < DECODE) requestAnimationFrame(frame);
        else {
          setAll(cold, true); setAll(warm, true);
          cold.timer.textContent = COLD_TOTAL + " ms"; warm.timer.textContent = WARM_TOTAL + " ms";
          busy = false; btn.disabled = false;
        }
      }
      requestAnimationFrame(frame);
    }
    btn.addEventListener("click", run);
    run();
  }

  /* ============ Animation 2: compute vs memory bandwidth ============ */
  function buildBandwidth(root) {
    var PREFILL = 24, DECODE = 12;
    var wrap = el("div", "fll-bw");
    wrap.appendChild(el("p", "fll-cap",
      "Same model, different workloads. Press play and watch which resource is the bottleneck in each phase."));

    var stage = el("div", "fll-bw-stage");
    var legend = el("div", "fll-bw-legend");
    [["pre", "prefill · tokens ingested"],
     ["dec", "decode · tokens produced"]].forEach(function (p) {
      var s = el("span", "fll-bw-key " + p[0]);
      s.appendChild(el("i")); s.appendChild(el("b", null, p[1]));
      legend.appendChild(s);
    });
    stage.appendChild(legend);

    var track = el("div", "fll-track fll-bw-track");
    var preCells = [], decCells = [];
    for (var i = 0; i < PREFILL; i++) {
      var c = el("div", "fll-cell"); track.appendChild(c); preCells.push(c);
    }
    track.appendChild(el("div", "fll-cell-gap"));
    for (var j = 0; j < DECODE; j++) {
      var d = el("div", "fll-cell dec"); track.appendChild(d); decCells.push(d);
    }
    stage.appendChild(track);
    var note = el("div", "fll-bw-note",
      "Prompt tokens are ingested first; answer tokens appear after the gap, one by one.");
    stage.appendChild(note);

    var live = el("div", "fll-bw-live");
    var meters = el("div", "fll-bw-meters");
    function meter(name) {
      var m = el("div", "fll-bw-meter");
      m.appendChild(el("span", "fll-bw-meter-name", name));
      var bar = el("div", "fll-bw-meter-bar");
      var fill = el("div", "fll-bw-meter-fill");
      bar.appendChild(fill); m.appendChild(bar); meters.appendChild(m);
      return fill;
    }
    var compute = meter("compute");
    var mem = meter("memory bandwidth");
    live.appendChild(meters);
    var status = el("div", "fll-bw-status", "Ready.");
    live.appendChild(status);
    stage.appendChild(live);
    wrap.appendChild(stage);

    var btn = el("button", "fll-btn", "Play");
    wrap.appendChild(btn);
    root.appendChild(wrap);

    var playing = false;
    function done() { playing = false; btn.disabled = false; }
    function fillTo(cells, n) { for (var i = 0; i < n; i++) cells[i].classList.add("on"); }
    function setMeters(phase, computePct, memPct) {
      [compute, mem].forEach(function (f) {
        f.classList.remove("prefill", "decode");
        if (phase) f.classList.add(phase);
      });
      compute.style.width = computePct + "%";
      mem.style.width = memPct + "%";
    }
    function reset() {
      preCells.concat(decCells).forEach(function (c) { c.classList.remove("on"); });
      setMeters("", 0, 0);
      note.textContent = "Prompt tokens are ingested first; answer tokens appear after the gap, one by one.";
      status.textContent = "Ready.";
    }
    function finalFrame() {
      fillTo(preCells, PREFILL); fillTo(decCells, DECODE);
      setMeters("", 0, 0);
      note.textContent = "Prefill tokens and decode tokens share one aligned track.";
      status.textContent = "Done: prefill is compute-bound, decode is memory-bandwidth-bound, and both meters are idle after completion.";
    }
    function run() {
      if (playing) return;
      playing = true; btn.disabled = true;
      reset();
      if (reduceMotion) { finalFrame(); done(); return; }
      var t0 = performance.now();
      function prefillFrame(now) {
        var p = Math.min(1, (now - t0) / 950), eased = easeOutCubic(p);
        fillTo(preCells, Math.floor(p * preCells.length));
        setMeters("prefill", 95 * eased, 35 * eased);
        note.textContent = "Prefill: prompt tokens are ingested in parallel.";
        status.textContent = "Compute-bound prefill: high compute, modest memory bandwidth.";
        if (p < 1) requestAnimationFrame(prefillFrame);
        else { fillTo(preCells, PREFILL); stopPrefill(); }
      }
      function stopPrefill() {
        var s = performance.now();
        function stopFrame(now) {
          var p = Math.min(1, (now - s) / 260), remain = 1 - easeOutCubic(p);
          setMeters("prefill", 95 * remain, 35 * remain);
          status.textContent = "Prefill complete: compute and memory bandwidth return to idle before decode starts.";
          if (p < 1) requestAnimationFrame(stopFrame);
          else {
            setMeters("", 0, 0);
            setTimeout(startDecode, 160);
          }
        }
        requestAnimationFrame(stopFrame);
      }
      function startDecode() {
        note.textContent = "Decode: produced tokens continue on the same line, one after another.";
        status.textContent = "Decode is memory-bandwidth-bound for each output token.";
        var n = 0;
        function emit() {
          if (n >= DECODE) {
            setMeters("", 0, 0);
            status.textContent = "Done: resource use has stopped after prefill and after the final decode token.";
            done();
            return;
          }
          var s = performance.now();
          function tokFrame(now) {
            var p = Math.min(1, (now - s) / 280), eased = easeOutCubic(p);
            setMeters("decode", 30 * eased, 92 * eased);
            if (p < 1) return requestAnimationFrame(tokFrame);
            decCells[n].classList.add("on");
            stopToken();
          }
          function stopToken() {
            var s2 = performance.now();
            function stopTokFrame(now) {
              var p = Math.min(1, (now - s2) / 120), remain = 1 - easeOutCubic(p);
              setMeters("decode", 30 * remain, 92 * remain);
              if (p < 1) requestAnimationFrame(stopTokFrame);
              else {
                setMeters("", 0, 0);
                n++; setTimeout(emit, 60);
              }
            }
            requestAnimationFrame(stopTokFrame);
          }
          requestAnimationFrame(tokFrame);
        }
        emit();
      }
      requestAnimationFrame(prefillFrame);
    }
    btn.addEventListener("click", run);
    run();
  }

  /* ============ Animation 3: where the system prompt goes ============ */
  function buildPromptLayout(root) {
    var wrap = el("div", "fll-layout");
    wrap.appendChild(el("p", "fll-cap",
      "Three turns of a conversation. Green = already cached (free to reuse). " +
      "Amber = has to be read again this turn."));
    function column(title) {
      var col = el("div", "fll-col");
      col.appendChild(el("div", "fll-col-title", title));
      var stack = el("div", "fll-stack"); col.appendChild(stack);
      var verdict = el("div", "fll-verdict", ""); col.appendChild(verdict);
      return { node: col, stack: stack, verdict: verdict };
    }
    var bad = column("System prompt last (the bug)");
    var good = column("System prompt first (the fix)");
    var cols = el("div", "fll-cols"); cols.appendChild(bad.node); cols.appendChild(good.node);
    wrap.appendChild(cols);
    var btn = el("button", "fll-btn", "Step through turns");
    wrap.appendChild(btn);
    root.appendChild(wrap);

    function blocksForTurn(turn, systemFirst) {
      var sys = { label: "SYSTEM + tools", kind: "system", w: "w-lg" };
      var blocks = [];
      if (systemFirst) blocks.push(sys);
      for (var t = 1; t < turn; t++) {
        blocks.push({ label: "user " + t, kind: "user", w: "w-sm" });
        blocks.push({ label: "reply " + t, kind: "model", w: "w-md" });
      }
      if (!systemFirst) blocks.push(sys);
      blocks.push({ label: "user " + turn, kind: "user", w: "w-sm" });
      return blocks;
    }
    function render(colObj, turn, systemFirst) {
      colObj.stack.innerHTML = "";
      var blocks = blocksForTurn(turn, systemFirst);
      var cachedCount = (turn === 1) ? 0 : (systemFirst ? blocks.length - 1 : 0);
      blocks.forEach(function (b, i) {
        var row = el("div", "fll-block " + b.w + " " + b.kind);
        row.appendChild(el("span", null, b.label));
        row.classList.add(i < cachedCount ? "cached" : "fresh");
        colObj.stack.appendChild(row);
      });
      var reused = Math.round((cachedCount / blocks.length) * 100);
      if (turn === 1) { colObj.verdict.textContent = "Turn 1: everything is new (cold start)."; colObj.verdict.className = "fll-verdict"; }
      else if (systemFirst) { colObj.verdict.textContent = "Turn " + turn + ": " + reused + "% reused — only the new line is read."; colObj.verdict.className = "fll-verdict good"; }
      else { colObj.verdict.textContent = "Turn " + turn + ": 0% reused — the whole prompt is read again."; colObj.verdict.className = "fll-verdict bad"; }
    }
    var turn = 1;
    function step() { render(bad, turn, false); render(good, turn, true); turn = turn >= 3 ? 1 : turn + 1; }
    btn.addEventListener("click", step);
    step();
    function autoplay() {
      if (reduceMotion) return;
      setTimeout(step, 700);
      setTimeout(step, 1400);
    }
    autoplay();
  }

  /* ============ Animation 4: how the cache stays bounded ============ */
  // Three regimes shape what actually lives in the cache, and they're easy to
  // conflate. (1) GROWTH — while a conversation is short, each turn's
  // checkpoint is a strict prefix-superset of the previous one, so the older
  // copy is *pruned* the instant the new one lands; the count stays flat at one
  // live checkpoint. (2) SLIDING WINDOW — assistant memory is capped at 12
  // turns within a 5-minute window; both drop the OLDEST turn off the front,
  // and since a KV snapshot is positional, a front-drop means the previous
  // checkpoint is no longer a prefix. The turn falls back to the pinned base +
  // a bounded re-prefill, pruning can no longer collapse the checkpoints, and
  // they accumulate. (3) THE HARD BOUND — independent prefixes (other apps,
  // other conversations, orphaned sliding-window checkpoints) are what the
  // 8-checkpoint / 256 MB LRU cap exists to cap. Idle > 5 min wipes the chat
  // entirely, so the next turn restores just the base.
  function buildLru(root) {
    var MAX_ENTRIES = 8, MAX_MB = 256, CAP_TURNS = 12;
    var ctxPool = [
      { label: "editor", mb: 3 }, { label: "browser", mb: 9 },
      { label: "docs", mb: 9 }, { label: "email", mb: 2 },
      { label: "window", mb: 30 }
    ];
    var ctxIdx = 0, seq = 0, histTurns = 0, sliding = false, items = [];
    var seenLruIds = {};

    function seedPins() {
      items = [
        { id: "p1", label: "F7 base", mb: 6, pinned: true },
        { id: "p2", label: "tools", mb: 8, pinned: true }
      ];
    }

    // A chat checkpoint stores the pinned base plus the rolling history. The
    // measured assistant table is ~0.55 MB per retained turn: history 10 lands
    // around 6 MB, and a capped 12-turn window around 7 MB.
    function checkpointMb() { return Math.max(1, Math.round(0.6 + histTurns * 0.55)); }

    var wrap = el("div", "fll-lru");
    wrap.appendChild(el("p", "fll-cap",
      "The two dark-green cards are the pinned bases. They are built once at " +
      "startup and never evicted. \u201CAdd a turn\u201D continues one chat, " +
      "\u201COpen a context\u201D adds an independent prefix and \u201CGo idle\u201D " +
      "expires the 5-minute window. The least-recently-used card is amber and " +
      "goes first when the cache is full. Click a non-pinned card to \u201Ctouch\u201D " +
      "it, and watch the status line below to see what happens at every step."));

    var shelf = el("div", "fll-lru-shelf");
    wrap.appendChild(shelf);

    var meter = el("div", "fll-lru-meter");
    var mlabel = el("div", "fll-lru-meta");
    meter.appendChild(mlabel);
    var mbar = el("div", "fll-lru-meter-bar");
    var mfill = el("div", "fll-lru-meter-fill");
    mbar.appendChild(mfill); meter.appendChild(mbar);
    wrap.appendChild(meter);

    var stat = el("div", "fll-lru-stat", "");
    wrap.appendChild(stat);

    var controls = el("div", "fll-pipe-controls");
    var turnBtn = el("button", "fll-btn", "Add a turn (same chat)");
    var ctxBtn = el("button", "fll-btn fll-btn-ghost", "Open a context");
    var idleBtn = el("button", "fll-btn fll-btn-ghost", "Go idle (5 min)");
    var resetBtn = el("button", "fll-btn fll-btn-ghost", "Reset");
    controls.appendChild(turnBtn); controls.appendChild(ctxBtn);
    controls.appendChild(idleBtn); controls.appendChild(resetBtn);
    wrap.appendChild(controls);
    root.appendChild(wrap);

    function totalMb() { return items.reduce(function (s, it) { return s + it.mb; }, 0); }
    function firstEvictableIdx() {
      for (var i = 0; i < items.length; i++) { if (!items[i].pinned) return i; }
      return -1;
    }
    function lastEvictableIdx() {
      for (var i = items.length - 1; i >= 0; i--) { if (!items[i].pinned) return i; }
      return -1;
    }

    function evict() {
      var removed = [];
      while (items.length > MAX_ENTRIES || totalMb() > MAX_MB) {
        var idx = firstEvictableIdx();
        if (idx < 0) break; // only pins left — never evicted
        removed.push(items.splice(idx, 1)[0]);
      }
      return removed;
    }

    function names(list) {
      return list.map(function (r) { return "\u201C" + r.label + "\u201D"; }).join(", ");
    }

    function render(note) {
      shelf.innerHTML = "";
      var nextSeen = {};
      var lru = lastEvictableIdx() >= 0 ? firstEvictableIdx() : -1;
      var mru = lastEvictableIdx();
      items.forEach(function (it, i) {
        var card = el("div", "fll-lru-card");
        nextSeen[it.id] = true;
        if (!seenLruIds[it.id]) card.classList.add("enter");
        card.style.height = Math.max(48, Math.min(82, Math.round(44 + it.mb * 0.65))) + "px";
        if (it.pinned) card.classList.add("pinned");
        else {
          if (i === lru) card.classList.add("lru");
          if (i === mru) card.classList.add("mru");
        }
        card.appendChild(el("span", "nm", it.label));
        card.appendChild(el("span", "sz", it.mb + " MB"));
        var pos = it.pinned ? "PIN" : (i === lru ? "LRU" : (i === mru ? "MRU" : ""));
        if (pos) card.appendChild(el("span", "fll-lru-pos", pos));
        if (!it.pinned) card.addEventListener("click", function () { touch(it.id); });
        shelf.appendChild(card);
      });
      seenLruIds = nextSeen;
      var mb = totalMb(), pct = Math.min(100, (mb / MAX_MB) * 100);
      mfill.style.width = pct + "%";
      mfill.classList.toggle("over", mb > MAX_MB);
      mlabel.textContent = mb + " / " + MAX_MB + " MB   \u00B7   " +
        items.length + " / " + MAX_ENTRIES + " checkpoints   \u00B7   history " +
        histTurns + " / " + CAP_TURNS + " turns" + (sliding ? "  (sliding)" : "");
      if (note) { stat.textContent = note; stat.title = note; }
    }

    function addTurn() {
      var freshStart = histTurns === 0;
      var newHist = histTurns + 2;          // one user + one assistant turn
      var dropped = newHist > CAP_TURNS;    // window must slide to stay capped
      histTurns = dropped ? CAP_TURNS : newHist;
      seq++;
      var card = { id: "s" + seq, label: "chat " + histTurns + "t", mb: checkpointMb(), chain: "chat", seq: seq };
      var msg;
      if (!sliding && !dropped) {
        // GROWTH: the new checkpoint is a strict prefix-superset of the prior
        // one, so prune every older chat checkpoint on the spot.
        var pruned = [];
        for (var i = items.length - 1; i >= 0; i--) {
          if (!items[i].pinned && items[i].chain === "chat") pruned.push(items.splice(i, 1)[0]);
        }
        items.push(card);
        var evicted = evict();
        if (freshStart) {
          msg = "Fresh chat: restored base; one short checkpoint added.";
        } else {
          msg = "Growth (" + histTurns + "/12): pruned old chat; restored prior checkpoint; count stays flat.";
        }
        if (evicted.length) msg += " LRU evicted " + names(evicted) + ".";
        render(msg);
      } else {
        // SLIDING WINDOW: the oldest turn just dropped off the front, so the
        // previous checkpoint is no longer a prefix. No pruning is possible;
        // the turn falls back to the pinned base and re-prefills the window,
        // and the orphaned checkpoints accumulate until LRU fires.
        sliding = true;
        items.forEach(function (it) {
          if (!it.pinned && it.chain === "chat") it.label = "chat stale";
        });
        items.push(card);
        var evicted = evict();
        msg = "Sliding window: restored base, re-prefilled 12 turns; old chat checkpoints now use LRU.";
        if (evicted.length) msg += " Evicted " + names(evicted) + ".";
        render(msg);
      }
    }

    function addCtx() {
      var c = ctxPool[ctxIdx % ctxPool.length]; ctxIdx++;
      seq++;
      items.push({ id: "s" + seq, label: c.label, mb: c.mb, chain: "ctx" + seq, seq: 0 });
      var evicted = evict();
      var msg = "Opened \u201C" + c.label + "\u201D: independent prefix; LRU caps independent/orphaned checkpoints.";
      if (evicted.length) {
        msg += " Evicted " + names(evicted) + ".";
      } else {
        msg += " Within budget.";
      }
      render(msg);
    }

    function goIdle() {
      // Idle past the 5-minute window: the whole conversation history expires
      // and is wiped. Pinned bases and independent contexts are untouched.
      var removed = items.filter(function (it) { return it.chain === "chat"; });
      items = items.filter(function (it) { return it.chain !== "chat"; });
      histTurns = 0; sliding = false;
      var msg = "Idle > 5 min: chat history expired";
      msg += removed.length ? " (dropped " + removed.length + " chat checkpoint" + (removed.length > 1 ? "s" : "") + ")." : ".";
      msg += " Pins and app contexts stay; next turn restores the base.";
      render(msg);
    }

    function touch(id) {
      var idx = items.findIndex(function (it) { return it.id === id; });
      if (idx < 0 || items[idx].pinned) return;
      var it = items.splice(idx, 1)[0];
      items.push(it); // move to most-recently-used
      render("Touched \u201C" + it.label + "\u201D: now MRU; survives eviction longest.");
    }

    turnBtn.addEventListener("click", addTurn);
    ctxBtn.addEventListener("click", addCtx);
    idleBtn.addEventListener("click", goIdle);
    resetBtn.addEventListener("click", function () {
      seedPins(); seq = 0; histTurns = 0; sliding = false; ctxIdx = 0;
      render("Reset: two pinned bases, no snapshots yet.");
    });

    seedPins();
    if (!reduceMotion) {
      // A realistic warm cache mid-growth: one live conversation checkpoint
      // (4 turns in) plus a couple of independent app contexts. Small —
      // pruning keeps the chat at one checkpoint until the window slides.
      histTurns = 4; seq = 3;
      items.push({ id: "s1", label: "editor", mb: 9, chain: "ctx1", seq: 0 });
      items.push({ id: "s2", label: "browser", mb: 9, chain: "ctx2", seq: 0 });
      items.push({ id: "s3", label: "chat 4t", mb: checkpointMb(), chain: "chat", seq: 3 });
      ctxIdx = 2;
    }
    render(reduceMotion ? "Two pinned bases plus a few snapshots." :
      "Warm cache: 2 pins, 2 app contexts, 1 live chat checkpoint. Add turns to see prune, slide, then LRU.");

    function autoplay() {
      if (reduceMotion) return;
      var steps = [addTurn, addTurn, addTurn, addTurn, addTurn, addCtx, addCtx, addCtx];
      var i = 0;
      function next() {
        if (i >= steps.length) return;
        steps[i++]();
        setTimeout(next, 850);
      }
      setTimeout(next, 500);
    }
    autoplay();
  }

  /* ============ Animation 5: the race ============ */
  function buildRace(root, data) {
    var series = data.series, turns = data.turns;
    var maxMs = 5000, instantMs = 700;
    var defs = [
      { key: "fono_cached_ms", label: "Fono now", short: "Fono", cls: "s-cached" },
      { key: "ollama_ms", label: "ollama warm", short: "ollama", cls: "s-ollama" },
      { key: "fono_uncached_ms", label: "Fono unoptimized", short: "Unoptimized", cls: "s-uncached" }
    ];
    function avg(arr) {
      return arr.reduce(function (sum, v) { return sum + v; }, 0) / arr.length;
    }
    function fmtMs(ms) { return Math.round(ms) + "ms"; }
    function fmtSec(ms) {
      var s = ms / 1000;
      return (s >= 1 ? s.toFixed(1) : s.toFixed(2)).replace(/\.0$/, "") + "s";
    }
    function fmtSpeed(n) { return n.toFixed(n >= 10 ? 0 : 1).replace(/\.0$/, "") + "x"; }
    var cachedAvg = avg(series.fono_cached_ms);
    var uncachedAvg = avg(series.fono_uncached_ms);
    var ollamaAvg = avg(series.ollama_ms);
    var last = turns.length - 1;
    var t6Speed = series.fono_uncached_ms[last] / series.fono_cached_ms[last];

    var wrap = el("div", "fll-race");
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label",
      "Time to first word by turn. Fono now averages " + fmtMs(cachedAvg) +
      ", which is " + fmtSpeed(uncachedAvg / cachedAvg) + " faster than unoptimized Fono and " +
      fmtSpeed(ollamaAvg / cachedAvg) + " faster than warm ollama.");
    var intro = el("div", "fll-race-intro");
    intro.appendChild(el("h3", "fll-race-title",
      "Cached Fono keeps first word under 650ms"));
    intro.appendChild(el("p", "fll-cap",
      "Same model, same machine, same conversation. Lower is better; the green line stays in the conversational zone while uncached prompting gets slower every turn."));
    wrap.appendChild(intro);

    var cards = el("div", "fll-race-kpis");
    [
      { value: fmtMs(cachedAvg), label: "average first word", note: "Fono now" },
      { value: fmtSpeed(uncachedAvg / cachedAvg), label: "faster on average", note: "vs unoptimized" },
      { value: fmtSpeed(ollamaAvg / cachedAvg), label: "faster on average", note: "vs ollama warm" },
      { value: fmtSpeed(t6Speed), label: "faster by turn 6", note: fmtMs(series.fono_cached_ms[last]) + " vs " + fmtSec(series.fono_uncached_ms[last]) }
    ].forEach(function (c) {
      var card = el("div", "fll-race-kpi");
      card.appendChild(el("b", null, c.value));
      card.appendChild(el("span", null, c.label));
      card.appendChild(el("small", null, c.note));
      cards.appendChild(card);
    });
    wrap.appendChild(cards);

    var legend = el("div", "fll-race-legend");
    defs.forEach(function (d) {
      var item = el("span", "fll-race-key " + d.cls);
      item.appendChild(el("i"));
      item.appendChild(el("span", null, d.label));
      legend.appendChild(item);
    });
    wrap.appendChild(legend);

    var chart = el("div", "fll-race-chart");
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "fll-race-svg");
    svg.setAttribute("viewBox", "0 0 720 360");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("aria-hidden", "true");
    chart.appendChild(svg);
    wrap.appendChild(chart);

    function svgEl(tag, attrs) {
      var n = document.createElementNS(svgNS, tag);
      Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      return n;
    }
    function txt(x, y, cls, text, anchor) {
      var n = svgEl("text", { x: x, y: y, "class": cls });
      if (anchor) n.setAttribute("text-anchor", anchor);
      n.textContent = text;
      svg.appendChild(n);
      return n;
    }
    var left = 62, right = 76, top = 24, bottom = 54;
    var width = 720 - left - right, height = 360 - top - bottom;
    function xPos(i) { return left + (i / (turns.length - 1)) * width; }
    function yPos(ms) { return top + (1 - (ms / maxMs)) * height; }
    function pathFor(values, progress) {
      var p = "";
      values.forEach(function (v, i) {
        var x = xPos(i), y = yPos(v * progress);
        p += (i ? " L " : "M ") + x.toFixed(1) + " " + y.toFixed(1);
      });
      return p;
    }

    svg.appendChild(svgEl("rect", {
      x: left, y: yPos(instantMs), width: width, height: yPos(0) - yPos(instantMs),
      "class": "fll-race-instant"
    }));
    for (var tick = 0; tick <= 5000; tick += 1000) {
      var y = yPos(tick);
      svg.appendChild(svgEl("line", { x1: left, y1: y, x2: left + width, y2: y, "class": "fll-race-grid" }));
      txt(left - 12, y + 4, "fll-race-axis", (tick / 1000) + "s", "end");
    }
    svg.appendChild(svgEl("line", { x1: left, y1: top, x2: left, y2: top + height, "class": "fll-race-axis-line" }));
    svg.appendChild(svgEl("line", { x1: left, y1: top + height, x2: left + width, y2: top + height, "class": "fll-race-axis-line" }));
    turns.forEach(function (t, i) {
      var x = xPos(i);
      svg.appendChild(svgEl("line", { x1: x, y1: top, x2: x, y2: top + height, "class": "fll-race-grid vertical" }));
      txt(x, top + height + 31, "fll-race-axis", "T" + t, "middle");
    });
    txt(left + 10, yPos(instantMs) - 8, "fll-race-band-label", "feels instant", "start");

    var paths = [], dots = [];
    defs.forEach(function (d) {
      var values = series[d.key];
      var p = svgEl("path", { d: pathFor(values, reduceMotion ? 1 : 0), "class": "fll-race-line " + d.cls });
      svg.appendChild(p); paths.push({ node: p, def: d, values: values });
      values.forEach(function (v, i) {
        var dot = svgEl("circle", {
          cx: xPos(i), cy: yPos(reduceMotion ? v : 0), r: d.key === "fono_cached_ms" ? 5 : 4,
          "class": "fll-race-dot " + d.cls
        });
        svg.appendChild(dot); dots.push({ node: dot, value: v, index: i, def: d });
      });
    });

    var fonoLabel = txt(xPos(4) - 8, yPos(series.fono_cached_ms[4]) - 18,
      "fll-race-callout s-cached", "always under 650ms", "end");
    var uncachedLabel = txt(xPos(4) - 6, yPos(series.fono_uncached_ms[4]) - 18,
      "fll-race-callout s-uncached", "uncached grows every turn", "end");
    var t6Label = txt(xPos(last) - 8, yPos(series.fono_uncached_ms[last]) + 28,
      "fll-race-callout s-uncached strong", fmtSpeed(t6Speed) + " faster by T6", "end");
    [fonoLabel, uncachedLabel, t6Label].forEach(function (n) {
      n.style.opacity = reduceMotion ? 1 : 0;
    });

    defs.forEach(function (d) {
      var lastMs = series[d.key][last];
      txt(xPos(last) + 10, yPos(lastMs) + (d.key === "fono_cached_ms" ? 4 : -7),
        "fll-race-end-label " + d.cls, fmtSec(lastMs), "start");
    });

    root.appendChild(wrap);
    function showLatestTurns() {
      // On narrow screens the chart scrolls horizontally; start at the end
      // where the lines diverge, which is the interesting part.
      if (chart.scrollWidth > chart.clientWidth + 4) chart.scrollLeft = chart.scrollWidth;
    }
    if (window.requestAnimationFrame) requestAnimationFrame(showLatestTurns);
    else showLatestTurns();
    function render(progress) {
      paths.forEach(function (p) { p.node.setAttribute("d", pathFor(p.values, progress)); });
      dots.forEach(function (d) { d.node.setAttribute("cy", yPos(d.value * progress)); });
      if (progress > 0.92) {
        fonoLabel.style.opacity = 1;
        uncachedLabel.style.opacity = 1;
        t6Label.style.opacity = 1;
      }
    }
    function run() {
      if (reduceMotion) { render(1); return; }
      var dur = 1200, start = performance.now();
      function frame(now) {
        var t = Math.min(1, (now - start) / dur), e = easeOutCubic(t);
        render(e);
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    run();
  }

  /* ============ boot ============ */
  function whenVisible(node, cb) {
    if (!("IntersectionObserver" in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { cb(); io.disconnect(); } });
    }, { threshold: 0.2 });
    io.observe(node);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var mounts = [
      ["fll-pipeline", buildPipeline],
      ["fll-prefill-restore", buildPrefillVsRestore],
      ["fll-bandwidth", buildBandwidth],
      ["fll-prompt-layout", buildPromptLayout],
      ["fll-lru", buildLru]
    ];
    mounts.forEach(function (m) {
      var n = document.getElementById(m[0]);
      if (n) whenVisible(n, function () { m[1](n); });
    });
    var a = document.getElementById("fll-race");
    if (a) whenVisible(a, function () { buildRace(a, raceData); });
  });
})();
