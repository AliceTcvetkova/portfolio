(function () {
  var root = document.getElementById("reels-agent-progress");
  if (!root) return;

  var metaEl = document.getElementById("reels-progress-meta");
  var resourcesEl = document.getElementById("reels-progress-resources");
  var goalsEl = document.getElementById("reels-progress-goals");
  var unlocksEl = document.getElementById("reels-progress-unlocks");
  var logEl = document.getElementById("reels-progress-log");

  var cfg = window.REELS_AGENT_CONFIG || {};
  var useLive =
    cfg.useLiveProgress &&
    cfg.supabaseUrl &&
    cfg.supabaseAnonKey &&
    !String(cfg.supabaseAnonKey).includes("PASTE");

  function barBlocks(current, target) {
    var pct = target > 0 ? Math.round((current / target) * 100) : 0;
    var filled = Math.round(pct / 10);
    if (filled > 10) filled = 10;
    if (filled < 0) filled = 0;
    var out = "";
    for (var i = 0; i < 10; i++) out += i < filled ? "█" : "░";
    return { blocks: out, pct: pct };
  }

  function resourceLabel(key) {
    var map = {
      Inspiration: "Inspiration · Вдохновение",
      Experience: "Experience · Опыт",
      Energy: "Energy · Энергия",
      Reputation: "Reputation · Репутация",
      Coins: "Coins · Монеты"
    };
    return map[key] || key;
  }

  function render(data) {
    if (metaEl) {
      metaEl.innerHTML =
        "<p><strong>Level " +
        (data.level || 33) +
        "</strong> · Updated: " +
        (data.updated || "—") +
        " · synced from Telegram <code>/log</code></p>";
    }

    if (resourcesEl && data.resources) {
      resourcesEl.innerHTML = Object.keys(data.resources)
        .map(function (key) {
          var val = data.resources[key];
          return (
            '<div class="reels-agent__progress-row">' +
            '<span class="reels-agent__progress-label">' +
            resourceLabel(key) +
            "</span>" +
            '<span class="reels-agent__progress-value">' +
            val +
            "</span></div>"
          );
        })
        .join("");
    }

    if (goalsEl && data.goals && data.goals.length) {
      goalsEl.innerHTML = data.goals
        .map(function (g) {
          var bars = (g.bars || [])
            .map(function (b) {
              var bar = barBlocks(b.current, b.target);
              return (
                '<div class="reels-agent__progress-row reels-agent__progress-row--goal">' +
                '<span class="reels-agent__progress-label">' +
                b.resource +
                "</span>" +
                '<span class="reels-agent__progress-bar" aria-label="' +
                bar.pct +
                '%">' +
                bar.blocks +
                "</span>" +
                '<span class="reels-agent__progress-pct">' +
                b.current +
                "/" +
                b.target +
                "</span></div>"
              );
            })
            .join("");
          return (
            '<article class="reels-agent__goal-card">' +
            "<h3>" +
            (g.labelRu || g.label) +
            ' <span class="reels-agent__goal-pct">' +
            (g.percent || 0) +
            "%</span></h3>" +
            bars +
            '<p class="reels-agent__note">Reward on completion: ' +
            (g.reward || "") +
            "</p></article>"
          );
        })
        .join("");
    }

    if (unlocksEl && data.unlocks) {
      unlocksEl.innerHTML = data.unlocks
        .map(function (u) {
          return (
            '<div class="reels-agent__unlock">' +
            (u.locked ? "🔒" : "✅") +
            " <strong>" +
            (u.labelRu || u.label) +
            "</strong> — " +
            (u.reasonRu || u.reason || "") +
            "</div>"
          );
        })
        .join("");
    }

    if (logEl) {
      var log = data.recentLog || [];
      if (!log.length) {
        logEl.innerHTML =
          '<p class="reels-agent__note">No entries yet — log resources in Telegram with <code>/log +15 experience</code>.</p>';
      } else {
        logEl.innerHTML =
          '<ul class="reels-agent__bullets reels-agent__bullets--compact">' +
          log
            .map(function (entry) {
              return "<li>" + (entry.note || entry.at || "log") + "</li>";
            })
            .join("") +
          "</ul>";
      }
    }
  }

  function loadStatic() {
    return fetch("data/reels-agent-progress.json").then(function (r) {
      if (!r.ok) throw new Error("static progress");
      return r.json();
    });
  }

  function loadLive() {
    var url =
      cfg.supabaseUrl +
      "/rest/v1/reels_agent_public_progress?id=eq.1&select=payload,updated_at";
    return fetch(url, {
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: "Bearer " + cfg.supabaseAnonKey
      }
    }).then(function (r) {
      if (!r.ok) throw new Error("live progress");
      return r.json();
    }).then(function (rows) {
      if (!rows || !rows[0] || !rows[0].payload) throw new Error("empty");
      var p = rows[0].payload;
      if (rows[0].updated_at) p.updated = String(rows[0].updated_at).slice(0, 10);
      return p;
    });
  }

  (useLive ? loadLive() : loadStatic())
    .catch(function () {
      if (useLive) return loadStatic();
      throw new Error("no data");
    })
    .then(render)
    .catch(function () {
      if (resourcesEl) {
        resourcesEl.innerHTML =
          '<p class="reels-agent__note">Progress data unavailable.</p>';
      }
    });
})();
