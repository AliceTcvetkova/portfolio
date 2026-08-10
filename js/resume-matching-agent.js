(function () {
  "use strict";

  const cfg = window.RESUME_AGENT_CONFIG || { demoMode: true };

  function isLiveMode() {
    return (
      cfg.demoMode !== true &&
      cfg.supabaseUrl &&
      cfg.supabaseAnonKey &&
      !String(cfg.supabaseAnonKey).includes("PASTE")
    );
  }
  const form = document.getElementById("resume-agent-form");
  const vacancyInput = document.getElementById("vacancy-input");
  const analyzeBtn = document.getElementById("analyze-btn");
  const getCvBtn = document.getElementById("get-cv-btn");
  const statusEl = document.getElementById("agent-status");
  const resultsPanel = document.getElementById("results-panel");
  const cvPanel = document.getElementById("cv-panel");
  const matchPercentEl = document.getElementById("match-percent");
  const highlightsList = document.getElementById("highlights-list");
  const concernsList = document.getElementById("concerns-list");
  const cvOutput = document.getElementById("cv-output");
  const cvNotes = document.getElementById("cv-notes");
  const downloadCvBtn = document.getElementById("download-cv-btn");

  let lastVacancy = "";
  let lastAnalyze = null;

  function setStatus(msg, type) {
    statusEl.textContent = msg || "";
    statusEl.className = "resume-agent__status" + (type ? " resume-agent__status--" + type : "");
  }

  function setLoading(loading) {
    form.classList.toggle("is-loading", loading);
    analyzeBtn.disabled = loading;
    getCvBtn.disabled = loading || !lastAnalyze;
  }

  function getVariant() {
    const checked = form.querySelector('input[name="variant"]:checked');
    return checked ? checked.value : "international";
  }

  function renderList(ul, items) {
    ul.innerHTML = "";
    (items || []).forEach(function (text) {
      const li = document.createElement("li");
      li.textContent = text;
      ul.appendChild(li);
    });
    if (!items || !items.length) {
      const li = document.createElement("li");
      li.textContent = "—";
      ul.appendChild(li);
    }
  }

  function showAnalyzeResult(data) {
    lastAnalyze = data;
    const pct = data.match_percent != null ? data.match_percent : "—";
    matchPercentEl.textContent = pct + "%";
    matchPercentEl.classList.toggle("is-poor", pct !== "—" && Number(pct) < 40);

    const fitEl = document.getElementById("fit-verdict");
    if (fitEl && data.fit_verdict) {
      const labels = {
        strong_fit: "Strong fit",
        conditional_fit: "Conditional fit",
        poor_fit: "Poor fit"
      };
      fitEl.textContent = labels[data.fit_verdict] || data.fit_verdict;
      fitEl.hidden = false;
      fitEl.className = "resume-agent__fit resume-agent__fit--" + data.fit_verdict;
    } else if (fitEl) {
      fitEl.hidden = true;
    }

    renderList(highlightsList, data.highlights);
    renderList(concernsList, data.expected_concerns);

    const blockersPanel = document.getElementById("blockers-panel");
    const blockersList = document.getElementById("blockers-list");
    const langPanel = document.getElementById("lang-gaps-panel");
    const langList = document.getElementById("lang-gaps-list");
    if (blockersList && blockersPanel) {
      renderList(blockersList, data.hard_blockers);
      blockersPanel.hidden = !data.hard_blockers || !data.hard_blockers.length;
    }
    if (langList && langPanel) {
      renderList(langList, data.language_gaps);
      langPanel.hidden = !data.language_gaps || !data.language_gaps.length;
    }

    resultsPanel.hidden = false;
    getCvBtn.disabled = data.fit_verdict === "poor_fit" || Number(pct) < 25;
  }

  async function fetchVacancyText(input) {
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed) && trimmed.length < 2000 && !trimmed.includes("\n")) {
      setStatus("Fetching vacancy via server…");
      return trimmed;
    }
    return trimmed;
  }

  async function callAgent(action, vacancy, variant) {
    const url = cfg.supabaseUrl;
    const key = cfg.supabaseAnonKey;
    const fn = cfg.functionName || "resume-match";

    if (!isLiveMode()) {
      return demoResponse(action, vacancy);
    }

    const endpoint = url.replace(/\/$/, "") + "/functions/v1/" + fn;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
        apikey: key
      },
      body: JSON.stringify({ action, vacancy, variant })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function demoResponse(action, vacancy) {
    const lower = vacancy.toLowerCase();
    const gaming = /game|gaming|ea |unity|unreal/.test(lower);
    const highlights = [
      "Cross-functional delivery with 20+ teams (Ozon Bank)",
      "100+ user interviews & platform launch (IRPO)",
      "Process audit with ~20M RUB potential savings (VK)"
    ];
    if (/stakeholder|cross-functional/.test(lower)) {
      highlights.unshift("Stakeholder alignment across business, analytics, dev, ops");
    }
    const concerns = [];
    if (gaming) concerns.push("No direct gaming industry experience");
    if (/chinese|mandarin|китайск/i.test(lower)) {
      concerns.push("Chinese required — not in language profile (EN C1, DE/FR B1 only)");
      if (action === "analyze") {
        return {
          match_percent: 28,
          fit_verdict: "poor_fit",
          highlights: highlights.slice(0, 2),
          expected_concerns: concerns,
          language_gaps: ["Chinese (Mandarin) required — candidate does not speak Chinese"],
          hard_blockers: ["Chinese language required — not available"]
        };
      }
    }
    if (/retail|e-commerce/.test(lower)) concerns.push("Limited recent e-commerce PM depth — Ozon was fintech internal");
    if (!concerns.length) concerns.push("Verify domain-specific requirements against case studies");

    if (action === "analyze") {
      return {
        match_percent: gaming ? 72 : 78,
        highlights: highlights,
        expected_concerns: concerns
      };
    }

    return {
      match_percent: gaming ? 72 : 78,
      cv_markdown: "# Alice Tsvetkova\nProduct & Delivery Manager\n\n(Demo mode — deploy Supabase function for live CV.\nSee docs/resume-agent-setup.md)\n\n## Experience\n- Ozon Bank · Oct 2024 – Apr 2026\n- IRPO · Apr 2022 – Jun 2024\n…",
      ats_score: 80,
      notes: "Demo output. Configure resume-agent-config.js + deploy edge function for tailored CV."
    };
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    setLoading(true);
    cvPanel.hidden = true;
    setStatus("Analyzing…");

    try {
      lastVacancy = await fetchVacancyText(vacancyInput.value);
      const data = await callAgent("analyze", lastVacancy, getVariant());
      showAnalyzeResult(data);
      const fetched = data.fetched_from_url ? " (loaded from URL)" : "";
      setStatus("Analysis complete." + fetched, "ok");
    } catch (err) {
      setStatus(err.message || "Analysis failed", "error");
    } finally {
      setLoading(false);
    }
  });

  getCvBtn.addEventListener("click", async function () {
    if (!lastVacancy) return;
    setLoading(true);
    setStatus("Generating tailored CV…");

    try {
      const data = await callAgent("get_cv", lastVacancy, getVariant());
      cvOutput.textContent = data.cv_markdown || "";
      cvNotes.textContent = data.notes
        ? "ATS score: " + (data.ats_score || "—") + " · " + data.notes
        : "";
      cvPanel.hidden = false;
      setStatus("CV ready.", "ok");
    } catch (err) {
      setStatus(err.message || "CV generation failed", "error");
    } finally {
      setLoading(false);
    }
  });

  downloadCvBtn.addEventListener("click", function () {
    const text = cvOutput.textContent;
    if (!text) return;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Tsvetkova-tailored-cv.md";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  if (isLiveMode()) {
    setStatus("Live mode — LLM backend connected.", "ok");
  } else {
    setStatus("Demo mode — add Supabase anon key + GEMINI_API_KEY secret to go live.", "");
  }
})();
