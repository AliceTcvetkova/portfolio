window.LOCUS_COMPOSE = {
  "folder-question": function () {
    var icons = [
      { id: "dropbox", label: "Dropbox", svg: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M24 8L8 18l16 10 16-10L24 8z"/><path d="M8 30l16 10 16-10"/><path d="M8 24l16 10 16-10"/></svg>' },
      { id: "gdrive", label: "Google Drive", svg: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M24 6L42 38H6L24 6z"/><path d="M24 6l9 16H15L24 6z"/><path d="M6 38h18"/></svg>' },
      { id: "notion", label: "Notion", svg: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="10" y="10" width="28" height="28" rx="3"/><path d="M16 14h16M16 22h12M16 30h14"/><path d="M30 14v20"/></svg>' },
      { id: "obsidian", label: "Obsidian", svg: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M24 6l14 8v16l-14 8-14-8V14l14-8z"/><path d="M24 6v32M10 14l14 8 14-8M10 30l14-8 14 8"/></svg>' },
      { id: "folder", label: "Folders", svg: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 14h12l4 4h18v22H8V14z"/></svg>' },
      { id: "list", label: "Lists", svg: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M16 16h24M16 24h24M16 32h24"/><circle cx="10" cy="16" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="24" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="32" r="2" fill="currentColor" stroke="none"/></svg>' },
      { id: "search", label: "Search", svg: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="21" cy="21" r="10"/><path d="M29 29l10 10"/></svg>' }
    ];

    var items = icons
      .map(function (icon, i) {
        return (
          '<li class="locus-icon-sketch" style="--i:' + i + '">' +
          '<span class="locus-icon-sketch__glyph" aria-hidden="true">' + icon.svg + "</span>" +
          '<span class="locus-icon-sketch__label">' + icon.label + "</span>" +
          "</li>"
        );
      })
      .join("");

    return (
      '<div class="locus-compose-panel locus-compose-panel--question">' +
      '<p class="locus-compose-question">Why do we store our memories in folders?</p>' +
      '<ul class="locus-icon-grid">' + items + "</ul>" +
      "</div>"
    );
  },

  "memory-truth": function () {
    return (
      '<div class="locus-compose-panel locus-compose-panel--statement">' +
      '<p class="locus-compose-statement">Human memory doesn\u2019t work like that.</p>' +
      window.LOCUS_THREAD.buildExitOverlay() +
      "</div>"
    );
  },

  "memory-chain": function () {
    var nodes = [
      {
        label: "Summer",
        svg:
          '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4">' +
          '<circle cx="24" cy="24" r="8"/><path d="M24 4v4M24 40v4M4 24h4M40 24h4M9 9l3 3M36 36l3 3M39 9l-3 3M12 36l-3 3" stroke-linecap="round"/></svg>'
      },
      {
        label: "Summer house",
        svg:
          '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">' +
          '<path d="M8 22L24 8l16 14v20H8V22z"/><path d="M18 42V28h12v14"/></svg>'
      },
      {
        label: "Grandmother",
        svg:
          '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' +
          '<circle cx="24" cy="14" r="6"/><path d="M14 42c0-8 4-14 10-14s10 6 10 14"/><path d="M12 20c4-4 20-4 24 0"/></svg>'
      },
      {
        label: "Dog",
        svg:
          '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">' +
          '<path d="M10 18c0-4 3-8 6-6s2 8 5 8 4-10 8-8 4 14-2 18-8 6-16 2-20-4"/><circle cx="30" cy="20" r="1.2" fill="currentColor"/></svg>'
      },
      {
        label: "Children\u2019s bicycle",
        svg:
          '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' +
          '<circle cx="14" cy="30" r="8"/><circle cx="36" cy="30" r="8"/><path d="M14 30h10l4-10h8M24 20l6 10M30 20h6"/></svg>'
      }
    ];

    var items = nodes
      .map(function (node, i) {
        return (
          '<li class="locus-chain-node" style="--i:' + i + '">' +
          '<span class="locus-chain-node__icon" aria-hidden="true">' + node.svg + "</span>" +
          '<span class="locus-chain-node__label">' + node.label + "</span>" +
          "</li>"
        );
      })
      .join("");

    return (
      '<div class="locus-compose-panel locus-compose-panel--chain">' +
      '<div class="locus-memory-chain">' +
      '<ol class="locus-memory-chain__nodes">' + items + "</ol>" +
      '<div class="locus-memory-chain__path">' +
      '<svg class="locus-memory-chain__thread" viewBox="0 0 500 72" preserveAspectRatio="none" aria-hidden="true">' +
      "<defs>" +
      '<linearGradient id="locusChainGrad" gradientUnits="userSpaceOnUse" x1="20" y1="44" x2="484" y2="42">' +
      '<stop offset="0%" stop-color="rgba(255,175,70,0.35)"/>' +
      '<stop offset="72%" stop-color="rgba(255,210,120,0.85)"/>' +
      '<stop offset="100%" stop-color="rgba(255,235,185,1)"/>' +
      "</linearGradient>" +
      "</defs>" +
      '<path class="locus-thread-path locus-thread-path--chain-wisp" pathLength="100" d="M 22 47 C 95 43, 165 49, 235 45 C 305 41, 375 47, 408 43"/>' +
      '<path class="locus-thread-path locus-thread-path--chain-main" pathLength="100" d="M 20 44 C 92 40, 162 46, 232 43 C 302 40, 372 45, 408 42"/>' +
      "</svg>" +
      '<div class="locus-chain-synapse-end">' +
      '<svg class="locus-chain-synapse-svg" viewBox="0 0 52 20" aria-hidden="true">' +
      "<defs>" +
      '<linearGradient id="locusSynapseGrad" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="52" y2="10">' +
      '<stop offset="0%" stop-color="rgba(255,210,120,0.9)"/>' +
      '<stop offset="100%" stop-color="rgba(255,235,185,1)"/>' +
      "</linearGradient>" +
      "</defs>" +
      '<line class="locus-chain-synapse-svg__link" x1="0" y1="10" x2="14" y2="10"/>' +
      '<circle class="locus-chain-synapse-svg__node" cx="18" cy="10" r="5"/>' +
      '<line class="locus-chain-synapse-svg__bridge" x1="23" y1="10" x2="32" y2="8"/>' +
      '<circle class="locus-chain-synapse-svg__node locus-chain-synapse-svg__node--b" cx="38" cy="7" r="4"/>' +
      "</svg></div>" +
      "</div></div></div>"
    );
  },

  "app-living-room": function () {
    var img = "assets/locus-chamber/slide-07-living-room.png";

    var frames = [
      { id: "frame-1", label: "Photo frame 1", x: 31.6, y: 73.4, w: 4.2, h: 6.1 },
      { id: "frame-2", label: "Photo frame 2", x: 36.9, y: 72.8, w: 3.9, h: 5.7 },
      { id: "frame-3", label: "Photo frame 3", x: 41.3, y: 73.6, w: 3.7, h: 5.5 },
      { id: "frame-4", label: "Photo frame 4", x: 45.6, y: 74.4, w: 3.5, h: 5.1 },
      { id: "frame-5", label: "Photo frame 5", x: 49.8, y: 75.2, w: 3.3, h: 4.9 }
    ];

    function roundPct(n) {
      return Math.round(n * 100) / 100;
    }

    function expandFromCenter(x, y, w, h, scaleW, scaleH) {
      var cx = x + w / 2;
      var cy = y + h / 2;
      var nw = w * scaleW;
      var nh = h * (scaleH == null ? scaleW : scaleH);
      return {
        x: cx - nw / 2,
        y: cy - nh / 2,
        w: nw,
        h: nh
      };
    }

    function transformFrame(spot, index) {
      var x = spot.x;
      var y = spot.y;
      var w = spot.w;
      var h = spot.h;
      var round = false;
      var rotate = false;

      if (index === 0) {
        y -= h * 0.7;
        x -= w;
        w *= 2;
      } else if (index === 1) {
        x -= w * 5;
        round = true;
        var size = Math.max(w, h);
        w = size;
        h = size;
        x += w * 5;
        x += w * 0.8;
        w *= 0.5;
        x += w * 0.5;
      } else if (index === 2) {
        y += h * 4;
        x += w * 8;
        y -= h * 0.5;
        var wide = expandFromCenter(x, y, w, h, 2, 1);
        x = wide.x;
        y = wide.y;
        w = wide.w;
        h = wide.h;
      } else if (index === 3) {
        x += w * 12;
        var big = expandFromCenter(x, y, w, h, 2, 2);
        x = big.x;
        y = big.y;
        w = big.w;
        h = big.h;
        var bigger = expandFromCenter(x, y, w, h, 2, 2);
        x = bigger.x;
        y = bigger.y;
        w = bigger.w;
        h = bigger.h;
      } else if (index === 4) {
        x += w * 9;
        y -= h * 4;
        w *= 2;
        h *= 2;
        var cx5 = x + w / 2;
        w /= 3;
        x = cx5 - w / 2;
        rotate = true;
        y -= h * 0.5;
      }

      return {
        id: spot.id,
        label: spot.label,
        x: roundPct(x),
        y: roundPct(y),
        w: roundPct(w),
        h: roundPct(h),
        round: round,
        rotate: rotate,
        isCat: index === 0,
        primary: index === 0
      };
    }

    var frameColors = {
      "frame-1": {
        border: "rgba(210, 178, 120, 0.72)",
        fill: "rgba(190, 145, 85, 0.18)",
        glow: "rgba(228, 196, 140, 0.42)"
      },
      "frame-2": {
        border: "rgba(180, 168, 152, 0.68)",
        fill: "rgba(150, 138, 122, 0.16)",
        glow: "rgba(200, 188, 170, 0.36)"
      },
      "frame-3": {
        border: "rgba(196, 150, 92, 0.7)",
        fill: "rgba(170, 120, 65, 0.17)",
        glow: "rgba(220, 175, 110, 0.4)"
      },
      "frame-4": {
        border: "rgba(205, 162, 98, 0.68)",
        fill: "rgba(175, 130, 72, 0.16)",
        glow: "rgba(232, 188, 120, 0.38)"
      },
      "frame-5": {
        border: "rgba(188, 140, 78, 0.74)",
        fill: "rgba(155, 105, 55, 0.18)",
        glow: "rgba(212, 168, 100, 0.44)"
      }
    };

    var catSilhouettes = [
      '<svg viewBox="0 0 64 48" aria-hidden="true"><path fill="#120c06" d="M10 34c0-8 6-14 14-14 2 0 4 .5 5.5 1.5L34 12l4.5 9.5C40 20 42 19 44 19c8 0 14 6 14 14v2H10v-1z"/><path fill="#120c06" d="M18 14l-4-8 6 3 4-6 4 6 6-3-4 8"/></svg>',
      '<svg viewBox="0 0 64 48" aria-hidden="true"><path fill="#120c06" d="M8 36c2-10 10-16 20-16s18 6 20 16H8zm12-22c-1-6 3-10 8-10s9 4 8 10c-4-2-12-2-16 0z"/></svg>',
      '<svg viewBox="0 0 64 48" aria-hidden="true"><ellipse fill="#120c06" cx="32" cy="30" rx="22" ry="12"/><circle fill="#120c06" cx="32" cy="20" r="10"/><path fill="#120c06" d="M22 14l-3-7 5 2 3-5 3 5 5-2-3 7"/></svg>',
      '<svg viewBox="0 0 64 48" aria-hidden="true"><path fill="#120c06" d="M6 32c8-4 16-4 24 0 4-6 12-8 20-4 2 8-2 14-10 14H12c-6 0-10-5-6-10z"/><path fill="#120c06" d="M40 12l3-6 4 4 5-5 2 8"/></svg>'
    ];

    var catPhotos = catSilhouettes
      .map(function (svg) {
        return '<div class="locus-cat-folder__photo">' + svg + "</div>";
      })
      .join("");

    var spots = frames
      .map(transformFrame)
      .map(function (spot, i) {
        var roundClass = spot.round ? " locus-room-spot--round" : "";
        var rotateClass = spot.rotate ? " locus-room-spot--rotated" : "";
        var catClass = spot.isCat ? " locus-room-spot--cat" : "";
        var primaryClass = spot.primary ? " locus-room-spot--primary" : "";
        var catAttr = spot.isCat ? ' data-locus-cat-spot=""' : "";
        var colors = frameColors[spot.id] || frameColors["frame-1"];
        return (
          '<button type="button" class="locus-room-spot locus-room-spot--' + spot.id + roundClass + rotateClass + catClass + primaryClass + '"' + catAttr +
          ' style="--i:' + i +
          ";--ring-border:" + colors.border +
          ";--ring-fill:" + colors.fill +
          ";--ring-glow:" + colors.glow +
          ";left:" + spot.x + "%;top:" + spot.y + "%;width:" + spot.w + "%;height:" + spot.h + '%;" aria-label="' + (spot.isCat ? "Cat photos" : spot.label) + '">' +
          '<span class="locus-room-spot__ring" aria-hidden="true"></span>' +
          "</button>"
        );
      })
      .join("");

    return (
      '<div class="locus-compose-panel locus-compose-panel--app">' +
      '<div class="locus-app-shell locus-app-room">' +
      '<header class="locus-app-shell__bar">' +
      '<span class="locus-app-shell__dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="locus-app-shell__title">Locus Chamber</span>' +
      '<span class="locus-app-shell__url">memory.app / living room</span>' +
      "</header>" +
      '<div class="locus-app-shell__body">' +
      '<div class="locus-app-shell__viewport">' +
      '<img class="locus-app-room__art" src="' + img + '" alt="Living room" width="1536" height="1024" decoding="async" fetchpriority="high">' +
      '<div class="locus-room-highlights">' + spots + "</div>" +
      '<div class="locus-room-overlay">' +
      '<div class="locus-demo-cursor" data-locus-demo-cursor hidden aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" stroke="#1a1a1a" stroke-width="1.25" d="M5 3l3 14 3-4 4 7 2-1-4-7h5L5 3z"/></svg>' +
      "</div>" +
      '<div class="locus-cat-folder" data-locus-cat-folder hidden aria-hidden="true">' +
      '<div class="locus-cat-folder__bar">' +
      '<span class="locus-cat-folder__icon" aria-hidden="true">📁</span>' +
      "<span>Cat photos</span>" +
      "</div>" +
      '<div class="locus-cat-folder__grid">' + catPhotos + "</div>" +
      "</div></div>" +
      "</div>" +
      '<footer class="locus-app-game-ui">' +
      '<div class="locus-app-game-ui__room">' +
      '<span class="locus-app-game-ui__room-label">Room</span>' +
      '<span class="locus-app-game-ui__room-name">Your room 1</span>' +
      "</div>" +
      '<ul class="locus-app-game-ui__files">' +
      '<li class="locus-app-game-ui__file locus-app-game-ui__file--active"><span class="locus-app-game-ui__file-icon" aria-hidden="true">◻</span>Photos</li>' +
      '<li class="locus-app-game-ui__file"><span class="locus-app-game-ui__file-icon" aria-hidden="true">◻</span>Documents</li>' +
      '<li class="locus-app-game-ui__file"><span class="locus-app-game-ui__file-icon" aria-hidden="true">◻</span>Books</li>' +
      "</ul>" +
      "</footer></div></div></div>"
    );
  }
};
