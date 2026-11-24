/* Runs before the page paints: marks JavaScript as available so content
   can fade in. If the main script fails to start within 3 seconds, the
   class is removed again so nothing stays hidden. */
(function (d) {
  d.documentElement.classList.add("js");
  setTimeout(function () {
    if (!window.__monaReady) d.documentElement.classList.remove("js");
  }, 3000);
})(document);
