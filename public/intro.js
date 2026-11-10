// Intro gate: plays a short preview video every time the site is opened, before the main page.
// Loaded synchronously in <head> so the main page never flashes before the intro.
(function () {
  var root = document.documentElement;
  // Deep links (e.g. inscribetick.com/#mint) go straight to the page.
  if (location.hash.length > 1) return;
  root.classList.add("intro-on");

  document.addEventListener("DOMContentLoaded", function () {
    var portrait = window.innerHeight > window.innerWidth;
    var name = portrait ? "portrait" : "landscape";
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var box = document.createElement("div");
    box.id = "intro";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "$TICK intro");

    var video = document.createElement("video");
    video.className = "intro-video";
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.preload = "auto";
    video.poster = "assets/intro-" + name + "-poster.jpg";
    video.setAttribute("aria-hidden", "true");

    // Fill the screen when its shape is close to the video's; otherwise fit it whole.
    var ratio = window.innerWidth / window.innerHeight;
    var fill = portrait ? ratio > 0.42 && ratio < 0.66 : ratio > 1.45 && ratio < 1.95;
    if (fill) video.classList.add("fill");
    // Where the Enter button sits inside the video frame (empty space under the text).
    var VW = portrait ? 1080 : 1920, VH = portrait ? 1920 : 1080;
    var ANCHOR = portrait ? { x: 540, y: 1676, align: "center" } : { x: 840, y: 930, align: "left" };

    var skip = document.createElement("button");
    skip.type = "button";
    skip.className = "b3d small intro-skip";
    skip.textContent = "Skip intro";

    var enter = document.createElement("button");
    enter.type = "button";
    enter.className = "b3d dark intro-enter";
    enter.textContent = "Enter $TICK →";
    enter.hidden = true;

    box.appendChild(video);
    box.appendChild(skip);
    box.appendChild(enter);
    document.body.insertBefore(box, document.body.firstChild);

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      box.classList.add("leaving");
      root.classList.remove("intro-on");
      document.removeEventListener("keydown", onKey);
      setTimeout(function () { video.pause(); box.remove(); }, 450);
    }
    function placeEnter() {
      var w = window.innerWidth, h = window.innerHeight;
      var scale = (fill ? Math.max : Math.min)(w / VW, h / VH);
      var ox = (w - VW * scale) / 2, oy = (h - VH * scale) / 2;
      var x = ox + ANCHOR.x * scale, y = oy + ANCHOR.y * scale;
      enter.style.top = Math.min(y, h - 56) + "px";
      if (ANCHOR.align === "center" || x < 24 || w < 700) { enter.style.left = "50%"; enter.classList.remove("left"); }
      else { enter.style.left = x + "px"; enter.classList.add("left"); }
    }
    function showEnter() {
      if (closed || !enter.hidden) return;
      skip.hidden = true;
      placeEnter();
      window.addEventListener("resize", placeEnter);
      enter.hidden = false;
      enter.focus({ preventScroll: true });
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    skip.addEventListener("click", close);
    enter.addEventListener("click", close);
    document.addEventListener("keydown", onKey);

    if (reduced) { showEnter(); return; }

    video.src = "assets/intro-" + name + ".mp4";
    video.addEventListener("ended", showEnter);
    video.addEventListener("error", showEnter);
    var p = video.play();
    if (p && p.catch) p.catch(showEnter);
    // Never trap a visitor behind a stalled video.
    setTimeout(showEnter, 10000);
    skip.focus({ preventScroll: true });
  });
})();
