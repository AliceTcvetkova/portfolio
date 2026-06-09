(function () {
  function ensureStack(imageEl) {
    var existing = imageEl.closest(".locus-reveal-stack");
    if (existing) return existing;

    var stack = document.createElement("div");
    stack.className = "locus-reveal-stack";

    var sharp = imageEl.cloneNode(true);
    sharp.className = "locus-stage__image locus-reveal-image locus-reveal-image--sharp";
    sharp.removeAttribute("data-locus-image");
    sharp.removeAttribute("width");
    sharp.removeAttribute("height");

    imageEl.classList.add("locus-reveal-image--blur");

    var parent = imageEl.parentNode;
    parent.insertBefore(stack, imageEl);
    stack.appendChild(imageEl);
    stack.appendChild(sharp);

    return stack;
  }

  function unwrapStack(imageEl) {
    var stack = imageEl.closest(".locus-reveal-stack");
    if (!stack) return imageEl;

    var blur = stack.querySelector(".locus-reveal-image--blur");
    if (!blur) return imageEl;

    stack.parentNode.insertBefore(blur, stack);
    stack.querySelectorAll(".locus-reveal-image--sharp").forEach(function (sharp) {
      sharp.style.clipPath = "";
    });
    stack.remove();
    blur.classList.remove(
      "locus-reveal-image",
      "locus-reveal-image--play",
      "locus-reveal-image--blur"
    );
    blur.style.visibility = "";

    return blur;
  }

  window.LOCUS_REVEAL = {
    start: function (imageEl, overlaysEl, imageWrap) {
      if (!imageEl || !overlaysEl || !imageWrap || !window.LOCUS_THREAD) return;

      ensureStack(imageEl);

      var stack = imageEl.closest(".locus-reveal-stack");
      var sharp = stack && stack.querySelector(".locus-reveal-image--sharp");

      if (stack) stack.classList.remove("locus-reveal-stack--play");
      imageEl.classList.remove("locus-reveal-image--play");
      if (sharp) {
        sharp.src = imageEl.currentSrc || imageEl.src;
        sharp.classList.remove("locus-reveal-sharp--play");
      }

      overlaysEl.innerHTML = window.LOCUS_THREAD.buildRevealOverlay();
      imageWrap.classList.add("locus-stage__media--reveal");

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (stack) stack.classList.add("locus-reveal-stack--play");
          if (sharp) sharp.classList.add("locus-reveal-sharp--play");
          window.LOCUS_THREAD.playReveal(overlaysEl);
        });
      });
    },

    prepareExit: function (imageEl, overlaysEl) {
      var stack = imageEl && imageEl.closest(".locus-reveal-stack");
      if (stack) {
        stack.classList.remove("locus-reveal-stack--play");
        stack.classList.add("locus-reveal-stack--exit");
        stack.style.clipPath = "inset(0 0 0 0)";

        var sharp = stack.querySelector(".locus-reveal-image--sharp");
        var blur = stack.querySelector(".locus-reveal-image--blur");

        if (sharp) {
          sharp.classList.remove("locus-reveal-sharp--play");
          sharp.style.clipPath = "inset(0 0 0 0)";
        }
        if (blur) {
          blur.style.visibility = "hidden";
        }
      }

      if (overlaysEl) {
        overlaysEl.querySelectorAll(".locus-thread-overlay").forEach(function (svg) {
          svg.classList.remove("locus-thread-overlay--play");
          svg.style.opacity = "0";
        });
      }
    },

    reset: function (imageEl, overlaysEl, imageWrap) {
      if (imageEl) {
        imageEl = unwrapStack(imageEl);
        imageEl.classList.remove("locus-reveal-image", "locus-reveal-image--play", "locus-reveal-image--blur");
      }
      if (imageWrap) {
        imageWrap.classList.remove("locus-stage__media--reveal");
      }
      if (overlaysEl && !overlaysEl.querySelector("[data-locus-hotspot]")) {
        overlaysEl.innerHTML = "";
      }
    }
  };
})();
