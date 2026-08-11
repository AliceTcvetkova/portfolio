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
  const saveCvBtn = document.getElementById("save-cv-btn");

  let lastVacancy = "";
  let lastAnalyze = null;
  let lastCvData = null;
  let lastCvVariant = "international";

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

  function renderCvPanel(data, variant) {
    lastCvData = data;
    lastCvVariant = variant;
    if (!data || !data.cv || typeof window.renderCvDocument !== "function") {
      cvOutput.innerHTML = "<p>CV preview unavailable.</p>";
      return;
    }
    cvOutput.innerHTML = window.renderCvDocument(data.cv, variant);
    cvNotes.textContent = data.notes
      ? "ATS score: " + (data.ats_score != null ? Math.round(data.ats_score * 100) + "%" : "—") + " · " + data.notes
      : data.ats_score != null
        ? "ATS score: " + Math.round(data.ats_score * 100) + "%"
        : "";
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
      return demoResponse(action, vacancy, variant);
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

  function demoResponse(action, vacancy, variant) {
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
      ats_score: 0.8,
      notes: "Demo preview — connect Supabase for live tailored CV.",
      cv: {
        full_name: "Alice Tsvetkova",
        headline: variant === "russia" ? "Product Manager · 10+ лет" : "Product & Delivery Manager",
        contact_line: "+7 (910) 545-60-06 · 1409alice@gmail.com · Remote",
        summary: variant === "russia"
          ? "Product Manager с опытом в FinTech, EdTech и platform PM. 100+ CustDev, 20+ команд."
          : "Product & Delivery Manager with 10+ years in EdTech, FinTech and platform products.",
        experience: [
          {
            role: "Product Manager",
            company: "Ozon Bank",
            dates: "Oct 2024 – Apr 2026",
            bullets: [
              "Launched Early Payments product in 9 months with 20+ teams",
              "Contributed to 5% annual bank turnover growth"
            ]
          },
          {
            role: "Product Manager",
            company: "IRPO",
            dates: "Apr 2022 – Jun 2024",
            bullets: ["100+ user interviews; platform concept to pilot in 1 year"]
          }
        ],
        skills: "Product Management · Delivery · SQL · Agile · CustDev · Roadmaps",
        education: ["University of Cape Town — Marketing, 2019", "SUM Moscow — Financial Management, 2015"],
        certifications: ["META — Marketing Analytics, 2022"],
        languages: "Russian — Native · English — C1 · German — B1 · French — B1",
        game_development_projects: gaming
          ? [
              "Defined core gameplay loop and meta-progression system",
              "Designed player progression and world progression systems",
              "Analyzed retention mechanics of desktop/cozy/sandbox games"
            ]
          : undefined
      }
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
    const variant = getVariant();
    setLoading(true);
    setStatus("Generating tailored CV…");

    try {
      const data = await callAgent("get_cv", lastVacancy, variant);
      renderCvPanel(data, variant);
      cvPanel.hidden = false;
      setStatus("CV ready — formatted preview below.", "ok");
    } catch (err) {
      setStatus(err.message || "CV generation failed", "error");
    } finally {
      setLoading(false);
    }
  });

  async function saveCvAsPdf() {
    if (!saveCvBtn) return;
    if (!lastCvData || !lastCvData.cv) {
      setStatus("Generate a CV first, then save as PDF.", "error");
      return;
    }
    if (typeof window.saveCvPdfFile !== "function") {
      setStatus("PDF module not loaded — refresh the page.", "error");
      return;
    }

    saveCvBtn.disabled = true;
    setStatus("Saving PDF…");

    try {
      await window.saveCvPdfFile(
        lastCvData.cv,
        lastCvVariant,
        "Tsvetkova-tailored-cv.pdf"
      );
      setStatus("PDF saved to Downloads.", "ok");
    } catch (err) {
      setStatus(err.message || "PDF save failed", "error");
    } finally {
      saveCvBtn.disabled = false;
    }
  }

  if (saveCvBtn) {
    saveCvBtn.addEventListener("click", saveCvAsPdf);
  }

  if (isLiveMode()) {
    setStatus("Live mode — LLM backend connected.", "ok");
  } else {
    setStatus("Demo mode — add Supabase anon key + GEMINI_API_KEY secret to go live.", "");
  }
})();
