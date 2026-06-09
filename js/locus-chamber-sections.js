(function () {
  var nav = document.querySelector("[data-locus-section-nav]");
  if (!nav) return;

  var buttons = nav.querySelectorAll("[data-locus-section]");
  var panels = document.querySelectorAll("[data-locus-section-panel]");

  function showSection(id) {
    buttons.forEach(function (btn) {
      var active = btn.getAttribute("data-locus-section") === id;
      btn.classList.toggle("locus-section-nav__item--active", active);
      btn.setAttribute("aria-current", active ? "page" : "false");
    });

    panels.forEach(function (panel) {
      var match = panel.getAttribute("data-locus-section-panel") === id;
      panel.hidden = !match;
      panel.classList.toggle("locus-section--active", match);
    });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      showSection(btn.getAttribute("data-locus-section"));
    });
  });

  showSection("product");
})();
