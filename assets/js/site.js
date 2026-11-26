/* MonaMusic — interface behaviour.
   Everything here animates transform/opacity only and batches work into
   requestAnimationFrame, so motion stays smooth on 60–120 Hz screens.
   All motion respects the visitor's "reduce motion" setting. */
(function () {
  "use strict";
  window.__monaReady = true;

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- fade-in on scroll ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  if (!("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- scroll-linked: header border, background drift, mobile bar ---------- */
  var header = document.querySelector("[data-header]");
  var bg = document.querySelector(".bg");
  var bar = document.querySelector("[data-mobile-bar]");
  var heroEnd = (function () {
    var hero = document.querySelector(".hero, .page-head");
    return hero ? hero.offsetTop + hero.offsetHeight * 0.6 : 400;
  })();
  var tile = window.matchMedia("(max-width: 599px)").matches ? 380 : 480;
  var ticking = false;
  function onScrollFrame() {
    ticking = false;
    var y = window.scrollY || 0;
    if (header) header.toggleAttribute("data-scrolled", y > 8);
    // Gentle parallax; wraps every tile so the pattern never runs out.
    if (bg && !reduceMotion) bg.style.setProperty("--py", (-((y * 0.08) % tile)).toFixed(1) + "px");
    if (bar) {
      var nearEnd = window.innerHeight + y > document.body.scrollHeight - 420;
      var show = y > heroEnd && !nearEnd;
      bar.classList.toggle("is-shown", show);
      bar.setAttribute("aria-hidden", String(!show));
      var link = bar.querySelector("a");
      if (link) link.tabIndex = show ? 0 : -1;
      // Lets the WhatsApp button sit above the bar instead of covering it.
      doc.style.setProperty("--bar-h", show ? bar.offsetHeight + "px" : "0px");
    }
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
  }, { passive: true });
  onScrollFrame();

  /* ---------- mobile menu ---------- */
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-nav]");
  function isOpen() { return toggle && toggle.getAttribute("aria-expanded") === "true"; }
  function setMenu(open) {
    if (!header || !toggle) return;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) {
      header.style.setProperty("--menu-top", header.getBoundingClientRect().bottom + "px");
      header.setAttribute("data-open", "");
      document.body.setAttribute("data-menu-open", "");
      var first = nav && nav.querySelector("a");
      if (first) first.focus({ preventScroll: true });
    } else {
      header.removeAttribute("data-open");
      document.body.removeAttribute("data-menu-open");
    }
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () { setMenu(!isOpen()); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) { setMenu(false); toggle.focus(); }
    });
    nav.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || !isOpen()) return;
      var items = Array.prototype.slice.call(nav.querySelectorAll("a"));
      var i = items.indexOf(document.activeElement);
      if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); toggle.focus(); }
      if (e.shiftKey && i === 0) { e.preventDefault(); toggle.focus(); }
    });
    var mq = window.matchMedia("(min-width: 960px)");
    var onMq = function () { if (mq.matches) setMenu(false); };
    if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  /* ---------- buttons: light follows the pointer ---------- */
  if (finePointer) {
    document.addEventListener("pointermove", function (e) {
      var b = e.target.closest && e.target.closest(".btn");
      if (!b) return;
      var r = b.getBoundingClientRect();
      b.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      b.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    }, { passive: true });
  }

  /* ---------- 3D tilt on tiles and cards ---------- */
  if (finePointer && !reduceMotion) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-tilt]"), function (el) {
      var frame = null, px = 0.5, py = 0.5;
      var max = el.classList.contains("tile") ? 3.5 : 6; // degrees
      function apply() {
        frame = null;
        el.style.setProperty("--ry", ((px - 0.5) * max * 2).toFixed(2) + "deg");
        el.style.setProperty("--rx", ((0.5 - py) * max * 2).toFixed(2) + "deg");
        el.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
      }
      el.addEventListener("pointerenter", function () { el.classList.add("is-tilting"); el.style.willChange = "transform"; });
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        px = (e.clientX - r.left) / r.width;
        py = (e.clientY - r.top) / r.height;
        if (!frame) frame = requestAnimationFrame(apply);
      }, { passive: true });
      el.addEventListener("pointerleave", function () {
        if (frame) cancelAnimationFrame(frame);
        frame = null;
        el.classList.remove("is-tilting");
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
        setTimeout(function () { el.style.willChange = ""; }, 600);
      });
    });
  }

  /* ---------- card rail controls ---------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-rail]"), function (rail) {
    var controls = document.querySelector('[data-rail-controls="' + rail.id + '"]');
    if (!controls) return;
    var prev = controls.querySelector("[data-rail-prev]");
    var next = controls.querySelector("[data-rail-next]");
    function step() {
      var item = rail.querySelector(".rail__item");
      var gap = parseFloat(getComputedStyle(rail.querySelector(".rail__track")).columnGap) || 20;
      return item ? item.getBoundingClientRect().width + gap : rail.clientWidth * 0.8;
    }
    function update() {
      var maxScroll = rail.scrollWidth - rail.clientWidth - 2;
      prev.disabled = rail.scrollLeft <= 2;
      next.disabled = rail.scrollLeft >= maxScroll;
      controls.hidden = maxScroll <= 0;
    }
    var behavior = reduceMotion ? "auto" : "smooth";
    prev.addEventListener("click", function () { rail.scrollBy({ left: -step(), behavior: behavior }); });
    next.addEventListener("click", function () { rail.scrollBy({ left: step(), behavior: behavior }); });
    var raf = null;
    rail.addEventListener("scroll", function () {
      if (!raf) raf = requestAnimationFrame(function () { raf = null; update(); });
    }, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  });

  /* ---------- hero: slides cross-fade in place behind fixed text ----------
     Photos show for 6 s; a video slide plays its silent loop (landscape or
     upright crop to suit the screen) for its own length. Arrows, dots,
     arrow keys and sideways swipes change the slide. */
  var gallery = document.querySelector("[data-gallery]");
  if (gallery) (function () {
    var frames = Array.prototype.slice.call(gallery.querySelectorAll("[data-frame]"));
    var dots = Array.prototype.slice.call(gallery.querySelectorAll("[data-dot]"));
    if (frames.length < 2) return;
    var INTERVAL = 6000, current = 0, timer = null, inView = true;
    var saveData = navigator.connection && navigator.connection.saveData;
    var tall = window.matchMedia ? window.matchMedia("(orientation: portrait)") : null;

    frames.forEach(function (f) {
      var v = f.querySelector("video");
      if (v) v.addEventListener("playing", function () { f.classList.add("is-playing"); });
    });

    // Plays the current slide's video (from the start when `fresh`); pauses the rest.
    function syncVideos(fresh) {
      frames.forEach(function (f, k) {
        var v = f.querySelector("video");
        if (!v) return;
        if (k === current && !reduceMotion && !saveData && inView && !document.hidden) {
          var want = tall && tall.matches ? v.getAttribute("data-portrait") : v.getAttribute("data-landscape");
          if (v.getAttribute("src") !== want) { f.classList.remove("is-playing"); v.setAttribute("src", want); }
          else if (fresh) { try { v.currentTime = 0; } catch (e) {} }
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }

    function show(i) {
      current = (i + frames.length) % frames.length;
      frames.forEach(function (f, k) {
        f.classList.toggle("is-current", k === current);
        if (k === current) f.removeAttribute("aria-hidden"); else f.setAttribute("aria-hidden", "true");
      });
      dots.forEach(function (d, k) {
        d.classList.toggle("is-current", k === current);
        if (k === current) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
      });
      restart(true);
    }
    // Switches automatically; holds while off-screen or in a background tab,
    // and stays put for visitors who prefer reduced motion.
    function restart(fresh) {
      clearTimeout(timer);
      gallery.removeAttribute("data-playing");
      syncVideos(fresh === true);
      if (reduceMotion || !inView || document.hidden) return;
      var wait = +frames[current].getAttribute("data-duration") || INTERVAL;
      gallery.style.setProperty("--interval", wait + "ms");
      void gallery.offsetWidth; // restart the dot's progress fill
      gallery.setAttribute("data-playing", "");
      timer = setTimeout(function () { show(current + 1); }, wait);
    }

    dots.forEach(function (d, k) { d.addEventListener("click", function () { show(k); }); });
    var prev = gallery.querySelector("[data-prev]"), next = gallery.querySelector("[data-next]");
    if (prev) prev.addEventListener("click", function () { show(current - 1); });
    if (next) next.addEventListener("click", function () { show(current + 1); });
    gallery.addEventListener("keydown", function (e) {
      if (!e.target.closest || !e.target.closest(".showcase__pill")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); show(current - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); show(current + 1); }
    });
    // Sideways swipe on touch screens (vertical drags still scroll the page).
    var sx = null, sy = 0;
    gallery.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") { sx = e.clientX; sy = e.clientY; } });
    gallery.addEventListener("pointerup", function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
    });
    gallery.addEventListener("pointercancel", function () { sx = null; });

    document.addEventListener("visibilitychange", function () { restart(); });
    if (tall) {
      var onTurn = function () { syncVideos(true); };
      if (tall.addEventListener) tall.addEventListener("change", onTurn); else if (tall.addListener) tall.addListener(onTurn);
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; restart(); }, { threshold: 0.3 }).observe(gallery);
    }
    restart(true);
  })();

  /* ---------- full-size photo viewer for galleries ---------- */
  var galleries = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox-group]"));
  if (galleries.length) (function () {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Photo viewer");
    box.hidden = true;
    box.innerHTML =
      '<figure class="lightbox__figure"><img class="lightbox__img" alt=""><figcaption class="lightbox__caption"></figcaption></figure>' +
      '<p class="lightbox__count" aria-live="polite"></p>' +
      '<button class="lightbox__btn lightbox__close" type="button" aria-label="Close photo viewer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<button class="lightbox__btn lightbox__prev" type="button" aria-label="Previous photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6"/></svg></button>' +
      '<button class="lightbox__btn lightbox__next" type="button" aria-label="Next photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6l6 6-6 6"/></svg></button>';
    document.body.appendChild(box);
    var img = box.querySelector(".lightbox__img");
    var cap = box.querySelector(".lightbox__caption");
    var count = box.querySelector(".lightbox__count");
    var btnClose = box.querySelector(".lightbox__close");
    var btnPrev = box.querySelector(".lightbox__prev");
    var btnNext = box.querySelector(".lightbox__next");
    var items = [], index = 0, opener = null, hideTimer = null, inerted = [];

    // The biggest file listed for a photo (WebP when available).
    function largest(pic) {
      var source = pic.querySelector("source"), im = pic.querySelector("img");
      var set = (source && source.getAttribute("srcset")) || im.getAttribute("srcset") || "";
      var best = im.getAttribute("src"), bestW = 0;
      set.split(",").forEach(function (part) {
        var bits = part.trim().split(/\s+/), w = parseInt(bits[1], 10) || 0;
        if (bits[0] && w > bestW) { bestW = w; best = bits[0]; }
      });
      return best;
    }
    function collect(group) {
      return Array.prototype.slice.call(group.querySelectorAll(".pgallery__item")).map(function (fig) {
        var im = fig.querySelector("img"), fc = fig.querySelector("figcaption");
        return { src: largest(fig.querySelector("picture")), alt: im.getAttribute("alt") || "", caption: fc ? fc.textContent.trim() : "" };
      });
    }
    function show(i) {
      index = (i + items.length) % items.length;
      var it = items[index];
      box.classList.add("is-switching");
      var loader = new Image();
      loader.onload = loader.onerror = function () {
        img.src = it.src;
        img.alt = it.alt;
        cap.textContent = it.caption;
        cap.hidden = !it.caption;
        count.textContent = items.length > 1 ? (index + 1) + " / " + items.length : "";
        requestAnimationFrame(function () { box.classList.remove("is-switching"); });
      };
      loader.src = it.src;
      [index + 1, index - 1].forEach(function (k) { (new Image()).src = items[(k + items.length) % items.length].src; });
      btnPrev.hidden = btnNext.hidden = items.length < 2;
    }
    function open(group, i, trigger) {
      items = collect(group);
      opener = trigger;
      clearTimeout(hideTimer);
      box.hidden = false;
      // Everything behind the viewer is made inert while it is open.
      inerted = Array.prototype.filter.call(document.body.children, function (el) { return el !== box && !el.inert; });
      inerted.forEach(function (el) { el.inert = true; });
      document.body.setAttribute("data-lightbox-open", "");
      void box.offsetWidth;
      box.classList.add("is-open");
      show(i);
      btnClose.focus({ preventScroll: true });
    }
    function close() {
      box.classList.remove("is-open");
      document.body.removeAttribute("data-lightbox-open");
      inerted.forEach(function (el) { el.inert = false; });
      inerted = [];
      hideTimer = setTimeout(function () { box.hidden = true; img.removeAttribute("src"); }, reduceMotion ? 0 : 300);
      if (opener) opener.focus({ preventScroll: true });
    }

    galleries.forEach(function (group) {
      Array.prototype.forEach.call(group.querySelectorAll("[data-lightbox-open]"), function (button, i) {
        button.addEventListener("click", function () { open(group, i, button); });
      });
    });
    btnClose.addEventListener("click", close);
    btnPrev.addEventListener("click", function () { show(index - 1); });
    btnNext.addEventListener("click", function () { show(index + 1); });
    // Clicking the dark backdrop closes the viewer.
    box.addEventListener("click", function (e) { if (e.target === box || e.target.classList.contains("lightbox__figure")) close(); });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowRight" && items.length > 1) show(index + 1);
      else if (e.key === "ArrowLeft" && items.length > 1) show(index - 1);
      else if (e.key === "Tab") {
        var focusables = [btnClose, btnPrev, btnNext].filter(function (b) { return !b.hidden; });
        var k = focusables.indexOf(document.activeElement);
        e.preventDefault();
        focusables[(k + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length].focus();
      }
    });
    // Swipe left or right on touch screens.
    var sx = null, sy = null;
    box.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") { sx = e.clientX; sy = e.clientY; } });
    box.addEventListener("pointerup", function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = sy = null;
      if (items.length > 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) show(index + (dx < 0 ? 1 : -1));
    });
  })();

  /* ---------- video: silent loop while on screen, full clip on request ----------
     The loop pauses off screen, in background tabs and with the pause toggle.
     It never starts for visitors who prefer reduced motion or save data;
     they see the cover frame and the "Watch with sound" button. */
  Array.prototype.forEach.call(document.querySelectorAll("[data-video]"), function (box) {
    var video = box.querySelector("video");
    var playBtn = box.querySelector("[data-video-play]");
    var toggle = box.querySelector("[data-video-toggle]");
    if (!video || !playBtn) return;
    var saveData = navigator.connection && navigator.connection.saveData;
    var mode = "cover"; // cover | preview | full
    var inView = false, userPaused = false;

    video.controls = false;
    playBtn.hidden = false;

    var tryPlay = function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); };
    var syncPreview = function () {
      if (mode !== "preview") return;
      if (inView && !document.hidden && !userPaused) tryPlay(); else video.pause();
    };

    if (box.dataset.preview && !reduceMotion && !saveData && "IntersectionObserver" in window) {
      mode = "preview";
      video.muted = true;
      video.loop = true;
      video.src = box.dataset.preview;
      if (toggle) toggle.hidden = false;
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        syncPreview();
      }, { threshold: 0.3 }).observe(box);
      document.addEventListener("visibilitychange", syncPreview);
    }

    if (toggle) toggle.addEventListener("click", function () {
      userPaused = !userPaused;
      box.classList.toggle("is-paused", userPaused);
      toggle.setAttribute("aria-label", userPaused ? "Play the silent preview" : "Pause the silent preview");
      syncPreview();
    });

    playBtn.addEventListener("click", function () {
      mode = "full";
      video.pause();
      video.loop = false;
      video.muted = false;
      video.src = box.dataset.src;
      video.controls = true;
      playBtn.hidden = true;
      if (toggle) toggle.hidden = true;
      box.classList.add("is-full");
      tryPlay();
      video.focus();
    });
  });

  /* ---------- WhatsApp button + chat pop-up ---------- */
  var wa = document.querySelector("[data-wa]");
  if (wa) (function () {
    var fab = wa.querySelector("[data-wa-fab]");
    var panel = wa.querySelector("#wa-panel");
    var closeBtn = wa.querySelector("[data-wa-close]");
    var cta = wa.querySelector("[data-wa-cta]");
    var preview = wa.querySelector("[data-wa-preview]");
    var chips = Array.prototype.slice.call(wa.querySelectorAll("[data-wa-msg]"));
    var number = wa.getAttribute("data-wa-number");
    var hideTimer = null;

    function isOpen() { return wa.classList.contains("is-open"); }
    function open() {
      clearTimeout(hideTimer);
      panel.hidden = false;
      void panel.offsetWidth; // let the pop-up animate in from its closed state
      wa.classList.add("is-open");
      wa.classList.remove("is-hinting");
      fab.setAttribute("aria-expanded", "true");
      var chosen = wa.querySelector('[data-wa-msg][aria-pressed="true"]') || chips[0];
      if (chosen) chosen.focus({ preventScroll: true });
    }
    function close(returnFocus) {
      wa.classList.remove("is-open");
      fab.setAttribute("aria-expanded", "false");
      hideTimer = setTimeout(function () { if (!isOpen()) panel.hidden = true; }, reduceMotion ? 0 : 320);
      if (returnFocus) fab.focus({ preventScroll: true });
    }

    // With a number the button is a WhatsApp link; with JavaScript it opens the pop-up first.
    fab.addEventListener("click", function (e) {
      e.preventDefault();
      if (isOpen()) close(false); else open();
    });
    closeBtn.addEventListener("click", function () { close(true); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen()) close(true); });
    document.addEventListener("click", function (e) { if (isOpen() && !wa.contains(e.target)) close(false); });

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        var message = chip.getAttribute("data-wa-msg");
        preview.textContent = message;
        if (number && cta) cta.href = "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
      });
    });
    if (cta) cta.addEventListener("click", function () { setTimeout(function () { close(false); }, 300); });

    // On larger screens, show the "Chat on WhatsApp" label once per visit.
    if (finePointer && !reduceMotion) {
      var seen = false;
      try { seen = sessionStorage.getItem("mm-wa-hint") === "1"; sessionStorage.setItem("mm-wa-hint", "1"); } catch (err) { /* storage unavailable */ }
      if (!seen) {
        setTimeout(function () { if (!isOpen()) wa.classList.add("is-hinting"); }, 2500);
        setTimeout(function () { wa.classList.remove("is-hinting"); }, 7500);
      }
    }
  })();

  /* ---------- enquiry form ---------- */
  var form = document.querySelector("[data-enquiry]");
  if (!form) return;
  var isPreview = form.hasAttribute("data-preview");
  var typeSelect = form.querySelector("#f-type");
  var levelField = form.querySelector("[data-level-field]");
  var msg = form.querySelector("[data-form-msg]");
  var submit = form.querySelector("[data-submit]");

  try {
    var wanted = new URLSearchParams(window.location.search).get("type");
    if (wanted && typeSelect) {
      var value = { lessons: "lessons-self", concerts: "concerts" }[wanted] || wanted;
      if (typeSelect.querySelector('option[value="' + value + '"]')) typeSelect.value = value;
    }
  } catch (err) { /* ignore */ }

  function syncLevel() {
    if (!levelField || !typeSelect) return;
    var opt = typeSelect.options[typeSelect.selectedIndex];
    var show = !!(opt && opt.hasAttribute("data-lessons"));
    levelField.hidden = !show;
    if (!show) { var s = levelField.querySelector("select"); if (s) s.value = ""; }
  }
  if (typeSelect) { typeSelect.addEventListener("change", syncLevel); syncLevel(); }

  function validate(input) {
    var err = form.querySelector("#" + input.id + "-err");
    var valid = input.checkValidity() && !(input.type !== "checkbox" && input.required && !input.value.trim());
    if (err) err.hidden = valid;
    if (valid) input.removeAttribute("aria-invalid"); else input.setAttribute("aria-invalid", "true");
    return valid;
  }
  var required = Array.prototype.slice.call(form.querySelectorAll("[required]"));
  required.forEach(function (input) {
    var evt = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "blur";
    input.addEventListener(evt, function () { if (input.hasAttribute("aria-invalid") || input.value) validate(input); });
    input.addEventListener("input", function () { if (input.hasAttribute("aria-invalid")) validate(input); });
  });

  function show(kind, name) {
    var tpl = form.querySelector("template[data-" + name + "]");
    msg.innerHTML = "";
    if (tpl) msg.appendChild(tpl.content.cloneNode(true));
    msg.setAttribute("data-kind", kind);
    msg.hidden = false;
    msg.focus();
  }

  form.addEventListener("submit", function (e) {
    var firstInvalid = null;
    required.forEach(function (input) { if (!validate(input) && !firstInvalid) firstInvalid = input; });
    e.preventDefault();
    if (firstInvalid) { firstInvalid.focus(); return; }
    if (isPreview) { show("preview", "preview-msg"); return; }

    var data = new FormData(form);
    if (!data.get("form-name")) data.append("form-name", form.getAttribute("name"));
    submit.disabled = true;
    submit.textContent = "Sending…";
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data).toString()
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      var tpl = form.querySelector("template[data-success]");
      var done = document.createElement("div");
      done.className = "form-msg";
      done.setAttribute("data-kind", "success");
      done.setAttribute("role", "status");
      done.setAttribute("tabindex", "-1");
      if (tpl) done.appendChild(tpl.content.cloneNode(true));
      form.replaceWith(done);
      done.focus();
    }).catch(function () {
      submit.disabled = false;
      submit.textContent = "Send enquiry";
      show("error", "error");
    });
  });
})();
