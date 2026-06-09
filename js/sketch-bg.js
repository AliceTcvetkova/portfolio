(function () {
  var page = document.body.dataset.sketches;
  if (!page) return;

  var PAGE_SKETCHES = {
    home: [
      { file: "line-tree.png", top: "10%", left: "3%", width: "min(260px, 28vw)", rotate: "-2deg", opacity: 0.18 },
      { file: "line-village.png", bottom: "4%", right: "-12%", width: "min(500px, 56vw)", rotate: "2deg", opacity: 0.18 }
    ],
    "locus-chamber": [
      { file: "line-sprout.png", top: "12%", right: "-4%", width: "min(300px, 34vw)", rotate: "5deg", opacity: 0.2 },
      { file: "line-spear.png", bottom: "0", left: "0", width: "min(280px, 24vw)", rotate: "-2deg", opacity: 0.15 }
    ],
    "clean-map": [
      { file: "line-gazelles.png", top: "18%", left: "-12%", width: "min(580px, 64vw)", rotate: "0deg", opacity: 0.19 },
      { file: "line-tree.png", bottom: "8%", right: "4%", width: "min(240px, 26vw)", rotate: "2deg", opacity: 0.16 }
    ],
    "vision-projects": [
      { file: "line-horse.png", top: "8%", right: "-10%", width: "min(520px, 58vw)", rotate: "-2deg", opacity: 0.2 },
      { file: "line-village.png", bottom: "10%", left: "-12%", width: "min(480px, 52vw)", rotate: "4deg", opacity: 0.16 }
    ]
  };

  var sketches = PAGE_SKETCHES[page];
  if (!sketches) return;

  var base = "assets/sketches/";
  var wrap = document.createElement("div");
  wrap.className = "sketch-bg";
  wrap.setAttribute("aria-hidden", "true");

  sketches.forEach(function (s, i) {
    var img = document.createElement("img");
    img.src = base + s.file;
    img.alt = "";
    img.className = "sketch-bg__piece sketch-bg__piece--" + (i + 1);
    img.loading = "lazy";
    img.decoding = "async";

    var style = "width:" + s.width + ";transform:rotate(" + s.rotate + ");opacity:" + s.opacity + ";";
    if (s.top) style += "top:" + s.top + ";";
    if (s.bottom) style += "bottom:" + s.bottom + ";";
    if (s.left) style += "left:" + s.left + ";";
    if (s.right) style += "right:" + s.right + ";";
    img.style.cssText = style;

    wrap.appendChild(img);
  });

  document.body.insertBefore(wrap, document.body.firstChild);
})();
