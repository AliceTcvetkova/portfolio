(function () {
  function buildOverlay(src) {
    return (
      '<div class="locus-castle-fx" data-locus-castle-fx aria-hidden="true">' +
      '<div class="locus-castle__dark"></div>' +
      '<div class="locus-castle__door-scene">' +
      '<div class="locus-castle__light-behind"></div>' +
      '<div class="locus-castle__door-gap" aria-hidden="true"></div>' +
      '<div class="locus-castle__door-shadow"></div>' +
      '<div class="locus-castle__door-leaf">' +
      '<img class="locus-castle__door-img" src="' + src + '" alt="" decoding="async">' +
      "</div></div>" +
      '<div class="locus-castle__slit-bloom"></div>' +
      '<div class="locus-castle__wash"></div>' +
      '<div class="locus-castle__full-flash"></div>' +
      "</div>"
    );
  }

  window.LOCUS_CASTLE = {
    mount: function (imageEl, slideFrame) {
      if (!imageEl || !slideFrame) return;

      this.reset(slideFrame);

      var src = imageEl.currentSrc || imageEl.src;
      if (!src) return;

      slideFrame.classList.add("locus-slide-frame--castle");
      slideFrame.insertAdjacentHTML("beforeend", buildOverlay(src));

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          slideFrame.classList.add("locus-slide-frame--castle-ready");
        });
      });
    },

    reset: function (slideFrame, imageWrap) {
      if (slideFrame) {
        slideFrame.classList.remove(
          "locus-slide-frame--castle",
          "locus-slide-frame--castle-ready",
          "locus-slide-frame--door-open",
          "locus-slide-frame--door-fading"
        );
        slideFrame.querySelectorAll("[data-locus-castle-fx]").forEach(function (el) {
          el.remove();
        });
      }
      if (imageWrap) {
        imageWrap.classList.remove(
          "locus-stage__media--castle",
          "locus-stage__media--door-open",
          "locus-stage__media--door-crossfade"
        );
      }
    },

    playDoorOpen: function (slideFrame, imageWrap) {
      if (slideFrame) slideFrame.classList.add("locus-slide-frame--door-open");
      if (imageWrap) imageWrap.classList.add("locus-stage__media--door-open");
    }
  };
})();
