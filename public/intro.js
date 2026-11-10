// Intro gate: a short animated intro shown every time the site is opened, before the main page.
// It is drawn live in the page (no video file), so it plays on every phone, tablet and desktop,
// including wallet in-app browsers and phones in low-power mode, and stays sharp at any size.
// Loaded synchronously in <head> so the main page never flashes before the intro.
(function () {
  var root = document.documentElement;
  // Deep links (e.g. inscribetick.com/#mint) go straight to the page.
  if (location.hash.length > 1) return;
  root.classList.add("intro-on");

  var DURATION = 5.2; // seconds until the Enter button appears
  var TAPE = " TICK ▲ 1,000,000,000 SUPPLY  /  80% PUBLIC MINT  /  20% LOCKED LP  /  0% TEAM  /  100,000 PER INSCRIBE  /  MAX 10 PER WALLET  /  ELYSIUM  / ";
  var BANDS = [[314, 370], [384, 442], [456, 514], [528, 586], [600, 654], [670, 726], [742, 794]];
  var RATIO = 784 / 1168;

  // Layouts in stage units. The stage is scaled to fit the screen; the ticker tape and buttons live outside it.
  var LAYOUTS = {
    portrait: {
      W: 1080, H: 1900, center: true,
      cardA: { h: 1080, top: 330 }, cardB: { h: 830, top: 30 },
      title: { size: 310, top: 930 }, lines: { size: 100, tops: [1225, 1331, 1437] },
      sub: { size: 38, top: 1590 }, enter: { x: 540, y: 1790 },
    },
    landscape: {
      W: 1920, H: 1080, center: false,
      cardA: { h: 820, top: 110 }, cardB: { h: 760, top: 120, left: 210 },
      title: { size: 330, top: 175 }, lines: { size: 80, tops: [520, 606, 692] },
      sub: { size: 26, top: 822 }, enter: { x: 840, y: 930 },
    },
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  var clamp = function (x, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a || 0, x)); };
  var prog = function (t, a, b) { return clamp((t - a) / (b - a)); };
  var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };
  var easeInOut = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  var backOut = function (x) { var c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  var lerp = function (a, b, x) { return a + (b - a) * x; };

  document.addEventListener("DOMContentLoaded", function () {
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- DOM
    var box = el("div");
    box.id = "intro";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "$TICK intro");

    var stage = el("div", "intro-stage");
    stage.setAttribute("aria-hidden", "true");
    var card = el("div", "intro-card");
    var art = el("img");
    art.alt = "";
    art.decoding = "async";
    art.src = "assets/counter.webp";
    card.appendChild(art);
    var strips = BANDS.map(function (b, i) {
      var d = el("div", "intro-drum" + (i === BANDS.length - 1 ? " last" : ""));
      d.style.top = (b[0] / 1168) * 100 + "%";
      d.style.height = ((b[1] - b[0]) / 1168) * 100 + "%";
      var s = el("div", "intro-strip");
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach(function (n) { s.appendChild(el("span", "", String(n))); });
      d.appendChild(s);
      card.appendChild(d);
      return s;
    });
    var title = el("div", "intro-t intro-title", "$TICK");
    var l1 = el("div", "intro-t intro-line", "One price.");
    var l2 = el("div", "intro-t intro-line", "One pool.");
    var l3 = el("div", "intro-t intro-line");
    var hl = el("div", "intro-hl");
    var l3text = el("span", "", "Zero team.");
    l3.appendChild(hl);
    l3.appendChild(l3text);
    var sub = el("div", "intro-t intro-sub", "Fair-launch inscription on Elysium");
    [card, title, l1, l2, l3, sub].forEach(function (e) { stage.appendChild(e); });

    var tape = el("div", "intro-tape");
    tape.setAttribute("aria-hidden", "true");
    var tapeText = el("div", "intro-tape-text", TAPE + TAPE + TAPE + TAPE);
    tape.appendChild(tapeText);

    var skip = el("button", "b3d small intro-skip", "Skip intro");
    skip.type = "button";
    var enter = el("button", "b3d dark intro-enter", "Enter $TICK →");
    enter.type = "button";
    enter.hidden = true;

    box.appendChild(stage);
    box.appendChild(tape);
    box.appendChild(skip);
    box.appendChild(enter);
    document.body.insertBefore(box, document.body.firstChild);

    // ---- layout
    var L, scale, ox, oy;
    function layout() {
      var w = window.innerWidth, h = window.innerHeight;
      L = h > w * 1.05 ? LAYOUTS.portrait : LAYOUTS.landscape;
      var tapeH = tape.offsetHeight || 44;
      var availH = h - tapeH - 8;
      scale = Math.min(w / L.W, availH / L.H);
      ox = (w - L.W * scale) / 2;
      oy = Math.max(0, (availH - L.H * scale) / 2);
      stage.style.width = L.W + "px";
      stage.style.height = L.H + "px";
      stage.style.transform = "translate(" + ox + "px," + oy + "px) scale(" + scale + ")";
      var textLeft = L.center ? 0 : L.cardB.left + L.cardB.h * RATIO + 120;
      [title, l1, l2, l3, sub].forEach(function (e) {
        if (L.center) { e.style.left = "0"; e.style.width = L.W + "px"; e.style.textAlign = "center"; }
        else { e.style.left = textLeft + "px"; e.style.width = ""; e.style.textAlign = ""; }
      });
      l3.style.display = L.center ? "flex" : "block";
      l3.style.justifyContent = L.center ? "center" : "";
      title.style.fontSize = L.title.size + "px";
      title.style.transformOrigin = L.center ? "50% 60%" : "0% 60%";
      [l1, l2, l3].forEach(function (e) { e.style.fontSize = L.lines.size + "px"; });
      sub.style.fontSize = L.sub.size + "px";
      placeEnter();
    }
    function placeEnter() {
      var x = ox + L.enter.x * scale, y = oy + L.enter.y * scale;
      enter.style.top = Math.min(y, window.innerHeight - (tape.offsetHeight || 44) - 40) + "px";
      if (L.center || window.innerWidth < 700) { enter.style.left = "50%"; enter.classList.remove("left"); }
      else { enter.style.left = x + "px"; enter.classList.add("left"); }
    }

    // ---- one frame of the animation at time t (seconds)
    function render(t) {
      var intro = easeOut(prog(t, 0, 0.5));
      var m = easeInOut(prog(t, 2.7, 3.35));
      var ch = lerp(L.cardA.h, L.cardB.h, m), cw = ch * RATIO;
      var leftA = (L.W - L.cardA.h * RATIO) / 2;
      var leftB = L.center ? (L.W - L.cardB.h * RATIO) / 2 : L.cardB.left;
      card.style.width = cw + "px";
      card.style.height = ch + "px";
      card.style.left = lerp(leftA, leftB, m) + "px";
      card.style.top = lerp(L.cardA.top, L.cardB.top, m) + (1 - intro) * 50 + "px";
      card.style.opacity = intro;

      // odometer: 0 -> 8000
      var x = prog(t, 0.35, 2.5);
      var v = 8000 * easeOut(x);
      var speed = x < 1 ? (8000 * 3 * Math.pow(1 - x, 2)) / 2.15 : 0;
      var fs = cw * 0.082;
      strips.forEach(function (s, i) {
        var p = Math.pow(10, 6 - i);
        var base = Math.floor(v / p) % 10;
        var f = p === 1 ? v % 1 : clamp((v % p) - (p - 1), 0, 1);
        s.style.fontSize = fs + "px";
        s.style.transform = "translateY(-" + ((base + f) * 100) / 11 + "%)";
        var blur = Math.min(5, (speed / p) * 0.012);
        s.style.filter = blur > 0.3 ? "blur(" + blur + "px)" : "none";
      });

      var tp = prog(t, 3.0, 3.4);
      var shake = t > 3.4 && t < 3.7 ? Math.sin((t - 3.4) * 90) * 6 * (1 - prog(t, 3.4, 3.7)) : 0;
      title.style.top = L.title.top + "px";
      title.style.opacity = clamp(tp * 3);
      title.style.transform = "translateX(" + shake + "px) scale(" + lerp(1.35, 1, backOut(tp)) + ")";

      [[l1, 3.6], [l2, 3.85], [l3, 4.1]].forEach(function (a, i) {
        var q = easeOut(prog(t, a[1], a[1] + 0.3));
        a[0].style.top = L.lines.tops[i] + (1 - q) * 40 + "px";
        a[0].style.opacity = q;
      });
      hl.style.width = (l3text.offsetWidth + 20) * easeOut(prog(t, 4.35, 4.65)) + "px";
      hl.style.left = L.center ? (l3.offsetWidth - l3text.offsetWidth) / 2 - 10 + "px" : "-10px";

      var sq = easeOut(prog(t, 4.7, 5.0));
      sub.style.top = L.sub.top + (1 - sq) * 20 + "px";
      sub.style.opacity = sq;

      var tq = easeOut(prog(t, 4.4, 4.85));
      tape.style.transform = "translateY(" + (1 - tq) * 110 + "%)";
      tapeText.style.transform = "translateX(" + -t * 70 + "px)";
    }

    // ---- control
    var closed = false, raf = 0, startAt = 0;
    function close() {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(raf);
      box.classList.add("leaving");
      root.classList.remove("intro-on");
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      setTimeout(function () { box.remove(); }, 450);
    }
    function showEnter() {
      if (closed || !enter.hidden) return;
      skip.hidden = true;
      placeEnter();
      enter.hidden = false;
      enter.focus({ preventScroll: true });
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    function onResize() { layout(); if (!startAt) render(reduced ? 99 : 0); }
    skip.addEventListener("click", close);
    enter.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    layout();
    render(0);
    skip.focus({ preventScroll: true });

    function frame(now) {
      if (closed) return;
      var t = (now - startAt) / 1000;
      render(t);
      if (t >= DURATION) showEnter();
      // keep the ticker tape moving after the intro finishes
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (closed || startAt) return;
      layout();
      if (reduced) { render(99); showEnter(); return; }
      startAt = performance.now();
      raf = requestAnimationFrame(frame);
    }

    // Wait briefly for the artwork and fonts so the first frames look right; never wait long.
    var ready = [new Promise(function (r) { if (art.complete) r(); else { art.onload = r; art.onerror = r; } })];
    if (document.fonts && document.fonts.load) {
      ready.push(document.fonts.load('400 100px "Anton"').catch(function () {}));
      ready.push(document.fonts.load('600 20px "IBM Plex Mono"').catch(function () {}));
    }
    Promise.race([Promise.all(ready), new Promise(function (r) { setTimeout(r, 2500); })]).then(start);
  });
})();
