(function () {
  var config = window.LOCUS_CHAMBER;
  if (!config || !config.scenes) return;

  var root = document.querySelector("[data-locus-experience]");
  if (!root) return;

  var titleEl = root.querySelector("[data-locus-title]");
  var captionEl = root.querySelector("[data-locus-caption]");
  var imageEl = root.querySelector("[data-locus-image]");
  var imageWrap = root.querySelector("[data-locus-image-wrap]");
  var overlaysEl = root.querySelector("[data-locus-overlays]");
  var composeEl = root.querySelector("[data-locus-compose]");
  var slideFrame = root.querySelector("[data-locus-frame]");
  var bodyEl = root.querySelector("[data-locus-body]");
  var choicesEl = root.querySelector("[data-locus-choices]");
  var backEl = root.querySelector("[data-locus-back]");

  var history = [];
  var currentId = config.start;
  var autoTimer = null;
  var exitTimer = null;

  function getScene(id) {
    return config.scenes[id] || null;
  }

  function clearAuto() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    if (exitTimer) {
      clearTimeout(exitTimer);
      exitTimer = null;
    }
  }

  function forceResetStage() {
    if (composeEl) {
      composeEl.classList.remove(
        "locus-compose--dissolving",
        "locus-compose--arrow-exit",
        "locus-compose--slide-left",
        "locus-compose--door-open",
        "locus-enter-from-right",
        "locus-enter-through-door",
        "locus-compose-exit-layer",
        "locus-compose--enter"
      );
      delete composeEl.dataset.locusOutgoing;
      composeEl.querySelectorAll(".locus-thread-exit-wrap--exit").forEach(function (el) {
        el.classList.remove("locus-thread-exit-wrap--exit");
      });
    }
    if (imageWrap) {
      imageWrap.classList.remove(
        "locus-stage__media--exit-left",
        "locus-enter-from-right",
        "locus-enter-from-dark",
        "locus-stage__media--castle",
        "locus-stage__media--door-open",
        "locus-stage__media--door-crossfade"
      );
    }
    if (slideFrame) {
      slideFrame.hidden = false;
      slideFrame.classList.remove(
        "locus-slide-exit-left",
        "locus-slide-exit-layer",
        "locus-slide-frame--door-open",
        "locus-slide-frame--door-fading"
      );
      delete slideFrame.dataset.locusOutgoing;
    }
    if (window.LOCUS_CASTLE) {
      window.LOCUS_CASTLE.reset(slideFrame, imageWrap);
    }
    if (window.LOCUS_REVEAL) {
      window.LOCUS_REVEAL.reset(imageEl, overlaysEl, imageWrap);
    }
    if (typeof setupLivingRoomDemo !== "undefined" && setupLivingRoomDemo._timer) {
      clearTimeout(setupLivingRoomDemo._timer);
      setupLivingRoomDemo._timer = null;
    }
  }

  function clearExitState(forScene) {
    var frameOutgoing = slideFrame && slideFrame.dataset.locusOutgoing === "1";

    if (composeEl) {
      composeEl.classList.remove(
        "locus-compose--dissolving",
        "locus-compose--arrow-exit",
        "locus-compose--slide-left",
        "locus-compose--door-open",
        "locus-enter-from-right",
        "locus-enter-through-door",
        "locus-compose-exit-layer"
      );
      delete composeEl.dataset.locusOutgoing;
      composeEl.querySelectorAll(".locus-thread-exit-wrap--exit").forEach(function (el) {
        el.classList.remove("locus-thread-exit-wrap--exit");
      });
    }
    if (imageWrap && !frameOutgoing) {
      imageWrap.classList.remove(
        "locus-stage__media--exit-left",
        "locus-enter-from-right",
        "locus-enter-from-dark",
        "locus-stage__media--castle",
        "locus-stage__media--door-open"
      );
    }
    if (slideFrame && !frameOutgoing) {
      slideFrame.classList.remove("locus-slide-exit-left", "locus-slide-exit-layer", "locus-slide-frame--door-open");
      delete slideFrame.dataset.locusOutgoing;
    }
    if (window.LOCUS_CASTLE && !frameOutgoing && (!forScene || !forScene.castleDoor)) {
      window.LOCUS_CASTLE.reset(slideFrame, imageWrap);
    }
  }

  function applyEnter(scene) {
    var el = scene.compose ? composeEl : imageWrap;
    if (!el || !scene.enter) return;

    if (scene.enter === "from-right") {
      el.classList.add("locus-enter-from-right");
      setTimeout(function () {
        el.classList.remove("locus-enter-from-right");
      }, 900);
    }

    if (scene.enter === "from-dark") {
      el.classList.add("locus-enter-from-dark");
      setTimeout(function () {
        el.classList.remove("locus-enter-from-dark");
      }, 2400);
    }

    if (scene.enter === "through-door") {
      el.classList.add("locus-enter-through-door");
      setTimeout(function () {
        el.classList.remove("locus-enter-through-door");
      }, 580);
    }
  }

  function runExit(scene, nextId) {
    var exit = scene.autoNext.exit;
    var exitMs = scene.autoNext.exitMs || 1500;

    if (exit === "dissolve" && composeEl && !composeEl.hidden) {
      composeEl.classList.add("locus-compose--dissolving");
      exitTimer = setTimeout(function () {
        goTo(nextId, true);
      }, exitMs);
      return;
    }

    if (exit === "arrow-exit" && composeEl && !composeEl.hidden) {
      if (window.LOCUS_THREAD) window.LOCUS_THREAD.playExit(composeEl);
      composeEl.classList.add("locus-compose--arrow-exit");

      var nextFromArrow = getScene(nextId);
      if (nextFromArrow && nextFromArrow.image) {
        var preloadArrow = new Image();
        preloadArrow.src = nextFromArrow.image;
      }

      exitTimer = setTimeout(function () {
        goTo(nextId, true);
      }, exitMs);
      return;
    }

    if (exit === "slide-left") {
      if (composeEl && !composeEl.hidden) {
        composeEl.classList.add("locus-compose--slide-left");
        exitTimer = setTimeout(function () {
          goTo(nextId, true);
        }, exitMs);
      } else if (slideFrame) {
        if (scene.reveal && window.LOCUS_REVEAL) {
          window.LOCUS_REVEAL.prepareExit(imageEl, overlaysEl);
        }
        imageWrap.classList.add("locus-stage__media--exit-left");
        slideFrame.dataset.locusOutgoing = "1";
        slideFrame.classList.add("locus-slide-exit-left", "locus-slide-exit-layer");
        exitTimer = setTimeout(function () {
          goTo(nextId, true);
        }, 380);
        setTimeout(function () {
          if (slideFrame.dataset.locusOutgoing === "1") {
            slideFrame.classList.remove("locus-slide-exit-left", "locus-slide-exit-layer");
            delete slideFrame.dataset.locusOutgoing;
            slideFrame.hidden = true;
            if (window.LOCUS_REVEAL) {
              window.LOCUS_REVEAL.reset(imageEl, overlaysEl, imageWrap);
            }
          }
          imageWrap.classList.remove("locus-stage__media--exit-left");
        }, exitMs);
      } else {
        exitTimer = setTimeout(function () {
          goTo(nextId, true);
        }, exitMs);
      }
      return;
    }

    if (exit === "door-open") {
      if (scene.castleDoor && slideFrame && window.LOCUS_CASTLE) {
        window.LOCUS_CASTLE.playDoorOpen(slideFrame, imageWrap);
        var crossfadeAt = scene.autoNext.crossfadeAt || 1680;
        var doorExitMs = scene.autoNext.exitMs || 2040;

        setTimeout(function () {
          if (slideFrame) {
            slideFrame.dataset.locusOutgoing = "1";
            slideFrame.classList.add("locus-slide-frame--door-fading");
          }
          if (imageWrap) {
            imageWrap.classList.add("locus-stage__media--door-crossfade");
          }
          goTo(nextId, true);
        }, crossfadeAt);

        exitTimer = setTimeout(function () {
          if (slideFrame) {
            slideFrame.hidden = true;
            delete slideFrame.dataset.locusOutgoing;
            slideFrame.classList.remove(
              "locus-slide-exit-layer",
              "locus-slide-frame--door-open",
              "locus-slide-frame--door-fading"
            );
          }
          if (imageWrap) {
            imageWrap.classList.remove(
              "locus-stage__media--door-crossfade",
              "locus-stage__media--door-open",
              "locus-stage__media--castle"
            );
          }
          if (window.LOCUS_CASTLE) {
            window.LOCUS_CASTLE.reset(slideFrame, imageWrap);
          }
        }, doorExitMs);
        return;
      }
      if (composeEl && !composeEl.hidden) {
        composeEl.classList.add("locus-compose--door-open");
        exitTimer = setTimeout(function () {
          goTo(nextId, true);
        }, exitMs);
        return;
      }
    }

    goTo(nextId, true);
  }

  function renderEffects(scene) {
    if (!overlaysEl) return;
    if (scene.reveal) return;

    overlaysEl.innerHTML = "";
    overlaysEl.classList.remove("locus-slide-overlays--interactive");

    if (!scene.effects || !scene.image) return;

    var hasClick = false;

    scene.effects.forEach(function (fx) {
      if (fx.type !== "pulse") return;

      var star = document.createElement(fx.click ? "button" : "span");
      star.className = "locus-star-pulse" + (fx.click ? " locus-star-pulse--clickable" : "");
      star.style.left = fx.x + "%";
      star.style.top = fx.y + "%";
      star.style.setProperty("--pulse-size", (fx.size || 2.5) + "%");
      if (fx.delay) star.style.animationDelay = fx.delay + "ms";

      if (fx.click) {
        hasClick = true;
        star.type = "button";
        star.setAttribute("aria-label", fx.label || "Continue");
        star.addEventListener("click", function () {
          goTo(fx.click, true);
        });
      }

      overlaysEl.appendChild(star);
    });

    if (hasClick) overlaysEl.classList.add("locus-slide-overlays--interactive");
  }

  function renderCompose(scene) {
    if (!composeEl) return;

    if (!scene.compose || !window.LOCUS_COMPOSE || !window.LOCUS_COMPOSE[scene.compose]) {
      composeEl.hidden = true;
      composeEl.innerHTML = "";
      return;
    }

    composeEl.innerHTML = window.LOCUS_COMPOSE[scene.compose]();
    composeEl.hidden = false;
    composeEl.classList.remove("locus-compose--dissolving", "locus-compose--arrow-exit");
    composeEl.querySelectorAll(".locus-thread-exit-wrap--exit").forEach(function (el) {
      el.classList.remove("locus-thread-exit-wrap--exit");
    });
    composeEl.classList.add("locus-compose--enter");
    requestAnimationFrame(function () {
      composeEl.classList.remove("locus-compose--enter");
    });

    if (scene.compose === "memory-chain") {
      var chain = composeEl.querySelector(".locus-memory-chain");
      if (chain) {
        chain.classList.remove("locus-memory-chain--play");
        setTimeout(function () {
          chain.classList.add("locus-memory-chain--play");
        }, scene.enter === "from-right" ? 850 : 80);
      }
    }

    if (scene.compose === "app-living-room") {
      var room = composeEl.querySelector(".locus-app-room");
      var roomArt = composeEl.querySelector(".locus-app-room__art");
      if (roomArt && window.LOCUS_ROOM_IMAGE) {
        var runClean = function () {
          window.LOCUS_ROOM_IMAGE.cleanGoldLines(roomArt);
        };
        if (roomArt.complete) runClean();
        else roomArt.addEventListener("load", runClean, { once: true });
      }
      if (room) {
        room.classList.remove("locus-app-room--play");
        setTimeout(function () {
          room.classList.add("locus-app-room--play");
        }, 120);
      }
      setupLivingRoomDemo(composeEl);
    }
  }

  function setupLivingRoomDemo(composeEl) {
    if (setupLivingRoomDemo._timer) {
      clearTimeout(setupLivingRoomDemo._timer);
      setupLivingRoomDemo._timer = null;
    }

    var catSpot = composeEl.querySelector("[data-locus-cat-spot]");
    var folder = composeEl.querySelector("[data-locus-cat-folder]");
    var cursor = composeEl.querySelector("[data-locus-demo-cursor]");
    var viewport = composeEl.querySelector(".locus-app-shell__viewport");
    if (!catSpot || !folder || !cursor || !viewport) return;

    var opened = false;

    function openCatFolder() {
      if (opened) return;
      opened = true;
      if (setupLivingRoomDemo._timer) {
        clearTimeout(setupLivingRoomDemo._timer);
        setupLivingRoomDemo._timer = null;
      }

      catSpot.classList.remove("locus-room-spot--hover");
      catSpot.classList.add("locus-room-spot--pressed");
      folder.hidden = false;
      folder.setAttribute("aria-hidden", "false");
      requestAnimationFrame(function () {
        folder.classList.add("locus-cat-folder--open");
      });
      setTimeout(function () {
        cursor.classList.remove("locus-demo-cursor--visible");
      }, 350);
    }

    function runCursorDemo() {
      var vpRect = viewport.getBoundingClientRect();
      var spotRect = catSpot.getBoundingClientRect();
      var targetX = spotRect.left + spotRect.width / 2 - vpRect.left;
      var targetY = spotRect.top + spotRect.height / 2 - vpRect.top;
      var startX = vpRect.width * 0.74;
      var startY = vpRect.height * 0.84;

      cursor.hidden = false;
      cursor.style.left = startX + "px";
      cursor.style.top = startY + "px";
      cursor.classList.add("locus-demo-cursor--visible");

      var move = cursor.animate(
        [
          { left: startX + "px", top: startY + "px", opacity: 0 },
          { left: startX + "px", top: startY + "px", opacity: 1, offset: 0.12 },
          { left: targetX + "px", top: targetY + "px", opacity: 1 }
        ],
        { duration: 1300, fill: "forwards", easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
      );

      move.finished
        .then(function () {
          catSpot.classList.add("locus-room-spot--hover");
          return new Promise(function (resolve) {
            setTimeout(resolve, 420);
          });
        })
        .then(function () {
          cursor.classList.add("locus-demo-cursor--click");
          return new Promise(function (resolve) {
            setTimeout(resolve, 180);
          });
        })
        .then(function () {
          openCatFolder();
          cursor.classList.remove("locus-demo-cursor--click");
        })
        .catch(function () {});
    }

    catSpot.addEventListener("click", openCatFolder);

    setupLivingRoomDemo._timer = setTimeout(function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(runCursorDemo);
      });
    }, 2200);
  }

  function renderHotspots(scene) {
    imageWrap.querySelectorAll("[data-locus-hotspot]").forEach(function (el) {
      el.remove();
    });

    if (!scene.hotspots || !scene.image) return;

    scene.hotspots.forEach(function (spot) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "locus-hotspot";
      btn.setAttribute("data-locus-hotspot", "");
      btn.setAttribute("aria-label", spot.label || "Continue");
      btn.style.left = spot.x + "%";
      btn.style.top = spot.y + "%";
      btn.style.width = spot.w + "%";
      btn.style.height = spot.h + "%";
      btn.addEventListener("click", function () {
        goTo(spot.next, true);
      });
      imageWrap.appendChild(btn);
    });
  }

  function renderChoices(scene) {
    choicesEl.innerHTML = "";
    if (!scene.choices || !scene.choices.length) {
      choicesEl.hidden = true;
      return;
    }

    choicesEl.hidden = false;
    scene.choices.forEach(function (choice) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "locus-choice";
      btn.textContent = choice.label;
      btn.addEventListener("click", function () {
        goTo(choice.next, true);
      });
      choicesEl.appendChild(btn);
    });
  }

  function renderBack() {
    if (!backEl) return;
    backEl.hidden = history.length === 0;
  }

  function goBack() {
    if (!history.length) return;
    clearAuto();
    forceResetStage();
    var prevId = history.pop();
    if (!getScene(prevId)) return;
    renderScene(prevId, false);
  }

  if (backEl) {
    backEl.addEventListener("click", goBack);
  }

  function renderScene(id, pushHistory) {
    clearAuto();

    var scene = getScene(id);
    if (!scene) return;

    clearExitState(scene);

    if (pushHistory && currentId && currentId !== id) {
      history.push(currentId);
    }

    currentId = id;
    root.dataset.scene = id;

    titleEl.textContent = scene.title || "";
    captionEl.textContent = scene.caption || "";

    if (scene.compose) {
      if (window.LOCUS_REVEAL && !(slideFrame && slideFrame.dataset.locusOutgoing === "1")) {
        window.LOCUS_REVEAL.reset(imageEl, overlaysEl, imageWrap);
      }
      if (slideFrame) {
        if (slideFrame.dataset.locusOutgoing === "1") {
          slideFrame.hidden = false;
        } else {
          slideFrame.hidden = true;
        }
      }
      imageWrap.hidden = false;
      imageWrap.classList.remove("locus-stage__media--empty", "locus-stage__media--image");
      imageWrap.classList.add("locus-stage__media--compose");
      renderCompose(scene);
    } else if (scene.image) {
      if (window.LOCUS_REVEAL) window.LOCUS_REVEAL.reset(imageEl, overlaysEl, imageWrap);
      if (slideFrame) slideFrame.hidden = false;
      imageEl.hidden = false;
      imageEl.src = scene.image;
      imageEl.alt = scene.title || "Locus Chamber slide";
      imageWrap.hidden = false;
      imageWrap.classList.remove("locus-stage__media--empty", "locus-stage__media--compose");
      if (!scene.castleDoor) {
        imageWrap.classList.add("locus-stage__media--image");
      } else {
        imageWrap.classList.remove("locus-stage__media--image");
      }
      if (composeEl) {
        composeEl.hidden = true;
        composeEl.innerHTML = "";
      }

      if (scene.castleDoor && window.LOCUS_CASTLE) {
        var mountCastle = function () {
          window.LOCUS_CASTLE.mount(imageEl, slideFrame);
          if (imageWrap) imageWrap.classList.add("locus-stage__media--castle");
        };
        if (imageEl.complete && imageEl.naturalWidth) mountCastle();
        else imageEl.onload = function () {
          imageEl.onload = null;
          mountCastle();
        };
      } else if (scene.reveal === "arrow-path" && window.LOCUS_REVEAL) {
        imageEl.onload = function () {
          imageEl.onload = null;
        };
      }
    } else {
      if (slideFrame) slideFrame.hidden = false;
      imageEl.hidden = false;
      imageEl.removeAttribute("src");
      imageEl.alt = "";
      imageWrap.hidden = false;
      imageWrap.classList.add("locus-stage__media--empty");
      imageWrap.classList.remove("locus-stage__media--compose");
      if (composeEl) {
        composeEl.hidden = true;
        composeEl.innerHTML = "";
      }
    }

    if (bodyEl) {
      bodyEl.hidden = !!(scene.immersive || (!scene.title && !scene.caption && !scene.choices));
    }

    renderEffects(scene);
    renderHotspots(scene);
    renderChoices(scene);

    if (scene.reveal === "arrow-path" && window.LOCUS_REVEAL) {
      var startReveal = function () {
        window.LOCUS_REVEAL.start(imageEl, overlaysEl, imageWrap);
      };
      if (imageEl.complete) startReveal();
      else imageEl.onload = function () {
        imageEl.onload = null;
        startReveal();
      };
    }

    applyEnter(scene);

    if (scene.autoNext && scene.autoNext.next) {
      autoTimer = setTimeout(function () {
        runExit(scene, scene.autoNext.next);
      }, scene.autoNext.delayMs || 3000);
    }

    renderBack();
  }

  function goTo(id, pushHistory) {
    if (!getScene(id)) return;
    renderScene(id, pushHistory);
  }

  renderScene(config.start, false);
})();
