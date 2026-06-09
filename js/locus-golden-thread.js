window.LOCUS_THREAD = {
  buildRevealOverlay: function () {
    var path =
      "M 14 40 C 26 38.5, 34 42, 42 43 C 50 44, 58 44.2, 66 44 C 72 44, 78 44, 88 44";

    return (
      '<svg class="locus-thread-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      "<defs>" +
      '<linearGradient id="locusThreadGrad" gradientUnits="userSpaceOnUse" x1="14" y1="40" x2="88" y2="44">' +
      '<stop offset="0%" stop-color="rgba(255,175,70,0.15)"/>' +
      '<stop offset="45%" stop-color="rgba(255,210,120,0.75)"/>' +
      '<stop offset="100%" stop-color="rgba(255,235,185,1)"/>' +
      "</linearGradient>" +
      '<filter id="locusThreadGlow" x="-30%" y="-30%" width="160%" height="160%">' +
      '<feGaussianBlur stdDeviation="0.55" result="blur"/>' +
      "<feMerge><feMergeNode in=\"blur\"/><feMergeNode in=\"SourceGraphic\"/></feMerge>" +
      "</filter>" +
      "</defs>" +
      '<g class="locus-thread-strands">' +
      '<path class="locus-thread-path locus-thread-path--wisp2" pathLength="100" d="M 14 40.5 C 26 39, 34 42.5, 42 43.5 C 50 44.5, 58 44.8, 66 44.5 C 72 44.5, 78 44.5, 88 44.5"/>' +
      '<path class="locus-thread-path locus-thread-path--wisp" pathLength="100" d="M 14 41.5 C 26 40, 34 43.5, 42 44.5 C 50 45.5, 58 45.8, 66 45.5 C 72 45.5, 78 45.5, 88 45.5"/>' +
      '<path id="locusRevealPath" class="locus-thread-path locus-thread-path--main" pathLength="100" d="' + path + '"/>' +
      "</g>" +
      '<g class="locus-thread-tip">' +
      '<path class="locus-thread-tip__head" d="M -1.5 -0.85 L 1.1 0 L -1.5 0.85" />' +
      '<animateMotion class="locus-thread-tip__motion" dur="4.55s" begin="0.45s" fill="freeze" rotate="auto" calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.2 1">' +
      '<mpath href="#locusRevealPath"/>' +
      "</animateMotion>" +
      "</g>" +
      "</svg>"
    );
  },

  buildExitOverlay: function () {
    return (
      '<div class="locus-thread-exit-wrap" aria-hidden="true">' +
      '<svg class="locus-thread-exit-svg" viewBox="0 0 400 80" preserveAspectRatio="none">' +
      "<defs>" +
      '<linearGradient id="locusExitGrad" gradientUnits="userSpaceOnUse" x1="30" y1="45" x2="370" y2="35">' +
      '<stop offset="0%" stop-color="rgba(255,165,50,0.25)"/>' +
      '<stop offset="100%" stop-color="rgba(255,235,180,1)"/>' +
      "</linearGradient>" +
      '<marker id="locusExitHead" viewBox="0 0 12 12" refX="9.5" refY="6" markerWidth="5" markerHeight="5" orient="auto">' +
      '<path d="M1.5 1.5 L10.5 6 L1.5 10.5" fill="none" stroke="rgba(255,228,170,0.98)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</marker>" +
      "</defs>" +
      '<path class="locus-thread-path locus-thread-path--exit-wisp" pathLength="100" d="M 25 52 C 95 12, 175 62, 365 42"/>' +
      '<path class="locus-thread-path locus-thread-path--exit-main" pathLength="100" d="M 25 48 C 100 8, 170 58, 365 38" marker-end="url(#locusExitHead)"/>' +
      "</svg></div>"
    );
  },

  playReveal: function (overlaysEl) {
    var svg = overlaysEl && overlaysEl.querySelector(".locus-thread-overlay");
    if (!svg) return;
    svg.classList.remove("locus-thread-overlay--play");
    void svg.offsetWidth;
    svg.classList.add("locus-thread-overlay--play");

    var motion = svg.querySelector(".locus-thread-tip__motion");
    if (motion && motion.beginElement) {
      try {
        motion.beginElement();
      } catch (e) {
        /* SMIL optional */
      }
    }
  },

  playExit: function (composeEl) {
    var wrap = composeEl && composeEl.querySelector(".locus-thread-exit-wrap");
    if (!wrap) return;
    wrap.classList.add("locus-thread-exit-wrap--exit");
  }
};
