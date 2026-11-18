(function (global) {
  "use strict";

  var LABELS = {
    international: {
      summary: "About Me",
      experience: "Work Experience",
      game_projects: "Game Development Projects",
      skills: "Skills",
      education: "Education",
      certifications: "Certifications",
      languages: "Languages"
    },
    russia: {
      summary: "О себе",
      experience: "Опыт работы",
      game_projects: "Проекты в game development",
      skills: "Навыки",
      education: "Образование",
      certifications: "Курсы и сертификации",
      languages: "Языки"
    }
  };

  var FONT_PATH = "assets/fonts/NotoSans-Regular.ttf";
  var JSPDF_SRC =
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  var jsPdfPromise = null;
  var fontPromise = null;
  var fontBase64 = null;
  var fontRegistered = false;

  function getJsPdfConstructor() {
    if (global.jspdf && global.jspdf.jsPDF) return global.jspdf.jsPDF;
    if (global.jsPDF) return global.jsPDF;
    return null;
  }

  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var chunks = [];
    var chunkSize = 0x8000;
    for (var i = 0; i < bytes.length; i += chunkSize) {
      chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize)));
    }
    return btoa(chunks.join(""));
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        waitForJsPdf().then(resolve).catch(reject);
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.onload = function () {
        waitForJsPdf().then(resolve).catch(reject);
      };
      script.onerror = function () {
        reject(new Error("PDF library failed to load"));
      };
      document.head.appendChild(script);
    });
  }

  function waitForJsPdf() {
    return new Promise(function (resolve, reject) {
      var attempts = 0;
      function check() {
        if (getJsPdfConstructor()) {
          resolve();
          return;
        }
        attempts += 1;
        if (attempts > 40) {
          reject(new Error("PDF library failed to load"));
          return;
        }
        setTimeout(check, 50);
      }
      check();
    });
  }

  function loadJsPdf() {
    if (!jsPdfPromise) {
      jsPdfPromise = loadScript(JSPDF_SRC);
    }
    return jsPdfPromise;
  }

  function resolveFontUrl() {
    try {
      return new URL(FONT_PATH, document.baseURI || window.location.href).href;
    } catch (_e) {
      return FONT_PATH;
    }
  }

  function loadFontData() {
    if (fontBase64) return Promise.resolve();
    if (fontPromise) return fontPromise;

    fontPromise = fetch(resolveFontUrl())
      .then(function (res) {
        if (!res.ok) throw new Error("CV font failed to load (" + res.status + ")");
        return res.arrayBuffer();
      })
      .then(function (buf) {
        fontBase64 = arrayBufferToBase64(buf);
      })
      .catch(function (err) {
        fontPromise = null;
        throw err;
      });

    return fontPromise;
  }

  function applyFont(pdf) {
    if (fontBase64 && !fontRegistered) {
      pdf.addFileToVFS("NotoSans-Regular.ttf", fontBase64);
      pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
      fontRegistered = true;
    }
    if (fontRegistered) {
      pdf.setFont("NotoSans", "normal");
    } else {
      pdf.setFont("helvetica", "normal");
    }
  }

  /**
   * @param {object} cv
   * @param {"international"|"russia"} variant
   */
  async function buildCvPdf(cv, variant) {
    await loadJsPdf();
    await loadFontData();

    var JsPDF = getJsPdfConstructor();
    if (!JsPDF) throw new Error("PDF library failed to load");

    var pdf = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });
    applyFont(pdf);

    var margin = 14;
    var pageWidth = pdf.internal.pageSize.getWidth();
    var pageHeight = pdf.internal.pageSize.getHeight();
    var contentWidth = pageWidth - margin * 2;
    var y = margin;
    var labels = LABELS[variant] || LABELS.international;

    function ensureSpace(needed) {
      if (y + needed > pageHeight - margin) {
        pdf.addPage();
        applyFont(pdf);
        y = margin;
      }
    }

    function writeBlock(text, fontSize, lineHeight, indent) {
      if (!text) return;
      indent = indent || 0;
      applyFont(pdf);
      pdf.setFontSize(fontSize);
      var lines = pdf.splitTextToSize(String(text), contentWidth - indent);
      ensureSpace(lines.length * lineHeight);
      pdf.text(lines, margin + indent, y);
      y += lines.length * lineHeight;
    }

    function sectionTitle(title) {
      ensureSpace(10);
      applyFont(pdf);
      pdf.setFontSize(10);
      pdf.text(String(title).toUpperCase(), margin, y);
      y += 2;
      pdf.setDrawColor(170);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 5;
    }

    writeBlock(cv.full_name || "Alice Tsvetkova", 18, 7);
    writeBlock(cv.headline, 11, 5);
    writeBlock(
      cv.contact_line ||
        [cv.phone, cv.email, cv.location].filter(Boolean).join(" · "),
      9,
      4.5
    );

    var portfolio = cv.portfolio_url || "https://alicetcvetkova.github.io/portfolio/";
    var linkedin = cv.linkedin_url || "https://www.linkedin.com/in/alice-tsvetkova";
    writeBlock("Portfolio: " + portfolio + " · LinkedIn: " + linkedin, 9, 4.5);
    y += 2;

    if (cv.summary) {
      sectionTitle(labels.summary);
      writeBlock(cv.summary, 10, 4.5);
      y += 2;
    }

    if (cv.experience && cv.experience.length) {
      sectionTitle(labels.experience);
      cv.experience.forEach(function (job) {
        var roleLine =
          (job.role || job.title || "") + (job.company ? " · " + job.company : "");
        writeBlock(roleLine, 10.5, 5);
        writeBlock(job.dates, 9, 4.5);
        (job.bullets || []).forEach(function (bullet) {
          writeBlock("• " + bullet, 10, 4.5, 3);
        });
        y += 2;
      });
    }

    if (cv.game_development_projects && cv.game_development_projects.length) {
      sectionTitle(labels.game_projects);
      cv.game_development_projects.forEach(function (item) {
        writeBlock("• " + item, 10, 4.5, 3);
      });
      y += 2;
    }

    if (cv.skills) {
      sectionTitle(labels.skills);
      writeBlock(cv.skills, 10, 4.5);
      y += 2;
    }

    if (cv.education && cv.education.length) {
      sectionTitle(labels.education);
      cv.education.forEach(function (item) {
        writeBlock("• " + item, 10, 4.5, 3);
      });
      y += 2;
    }

    if (cv.certifications && cv.certifications.length) {
      sectionTitle(labels.certifications);
      cv.certifications.forEach(function (item) {
        writeBlock("• " + item, 10, 4.5, 3);
      });
      y += 2;
    }

    if (cv.languages) {
      sectionTitle(labels.languages);
      writeBlock(cv.languages, 10, 4.5);
    }

    return pdf;
  }

  global.saveCvPdfFile = async function (cv, variant, filename) {
    var pdf = await buildCvPdf(cv, variant);
    pdf.save(filename || "Tsvetkova-tailored-cv.pdf");
  };
})(typeof window !== "undefined" ? window : globalThis);
