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

    document.dispatchEvent(new CustomEvent("locus:section", { detail: { id: id } }));
  }

  function remember(id) {
    if (id === "product") {
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
      return;
    }
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-locus-section");
      showSection(id);
      remember(id);
    });
  });

  document.querySelectorAll("[data-locus-section-jump]").forEach(function (link) {
    link.addEventListener("click", function () {
      var id = link.getAttribute("data-locus-section-jump");
      showSection(id);
      remember(id);
    });
  });

  var initial = (location.hash || "").replace(/^#/, "");
  var known = false;
  buttons.forEach(function (btn) {
    if (btn.getAttribute("data-locus-section") === initial) known = true;
  });
  if (initial && !known && location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  showSection(known ? initial : "product");
})();
