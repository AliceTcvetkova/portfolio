(function () {
  var root = document.getElementById("gamedev-progress");
  if (!root) return;

  var barsEl = document.getElementById("gamedev-progress-bars");
  var metaEl = document.getElementById("gamedev-progress-meta");
  var completedEl = document.getElementById("gamedev-progress-completed");
  var weakEl = document.getElementById("gamedev-progress-weak");
  var tracksEl = document.getElementById("gamedev-progress-tracks");

  function barBlocks(percent) {
    var filled = Math.round(percent / 10);
    if (filled > 10) filled = 10;
    if (filled < 0) filled = 0;
    var out = "";
    for (var i = 0; i < 10; i++) {
      out += i < filled ? "█" : "░";
    }
    return out;
  }

  function render(data) {
    if (metaEl) {
      metaEl.innerHTML =
        "<p><strong>Updated:</strong> " +
        data.updated +
        " · <strong>Current:</strong> " +
        data.currentLesson +
        " · <strong>Next:</strong> " +
        data.nextTopic +
        (data.streak ? " · <strong>Streak:</strong> " + data.streak + " days" : "") +
        "</p>";
    }

    if (barsEl && data.areas) {
      barsEl.innerHTML = data.areas
        .map(function (a) {
          var detail = a.detail ? ' <span class="gamedev-agent__progress-detail">' + a.detail + "</span>" : "";
          return (
            '<div class="gamedev-agent__progress-row">' +
            '<span class="gamedev-agent__progress-label">' +
            a.label +
            detail +
            "</span>" +
            '<span class="gamedev-agent__progress-bar" aria-label="' +
            a.percent +
            '%">' +
            barBlocks(a.percent) +
            "</span>" +
            '<span class="gamedev-agent__progress-pct">' +
            a.percent +
            "%</span>" +
            "</div>"
          );
        })
        .join("");
    }

    if (completedEl) {
      if (data.completed && data.completed.length) {
        completedEl.innerHTML =
          "<ul class=\"gamedev-agent__bullets gamedev-agent__bullets--compact\">" +
          data.completed.map(function (c) {
            return "<li>✓ " + c + "</li>";
          }).join("") +
          "</ul>";
      } else {
        completedEl.innerHTML = "<p class=\"gamedev-agent__note\">No topics passed yet (threshold ≥7/10).</p>";
      }
    }

    if (weakEl && data.weakAreas) {
      weakEl.innerHTML =
        "<ul class=\"gamedev-agent__bullets gamedev-agent__bullets--compact\">" +
        data.weakAreas.map(function (w) {
          return "<li>" + w + "</li>";
        }).join("") +
        "</ul>";
    }

    if (tracksEl && data.unreal) {
      var ue = data.unreal;
      var ueRows = (ue.tracks || [])
        .map(function (t) {
          return "<li><strong>" + t.name + "</strong> — " + t.done + "/" + t.total + "</li>";
        })
        .join("");
      tracksEl.innerHTML =
        "<div class=\"gamedev-agent__layer-grid\">" +
        '<article class="gamedev-agent__layer">' +
        "<h3>Unreal Engine</h3>" +
        "<p>Phase " +
        ue.phase +
        " · <code>" +
        ue.current +
        "</code></p>" +
        "<ul>" +
        ueRows +
        "</ul>" +
        "</article>" +
        '<article class="gamedev-agent__layer">' +
        "<h3>Blender (YouTube)</h3>" +
        "<p>Current: <code>" +
        (data.blender && data.blender.current ? data.blender.current : "—") +
        "</code></p>" +
        "<p class=\"gamedev-agent__note\">Self-study: agent assigns topic + deliverable; any suitable YouTube tutorial.</p>" +
        "</article>" +
        "</div>";
    }
  }

  fetch("data/gamedev-agent-progress.json")
    .then(function (r) {
      if (!r.ok) throw new Error("progress json");
      return r.json();
    })
    .then(render)
    .catch(function () {
      if (barsEl) {
        barsEl.innerHTML = "<p class=\"gamedev-agent__note\">Progress data unavailable.</p>";
      }
    });
})();
