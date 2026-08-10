(function (global) {
  "use strict";

  var LABELS = {
    international: {
      summary: "About Me",
      experience: "Work Experience",
      skills: "Skills",
      education: "Education",
      certifications: "Certifications",
      languages: "Languages"
    },
    russia: {
      summary: "О себе",
      experience: "Опыт работы",
      skills: "Навыки",
      education: "Образование",
      certifications: "Курсы и сертификации",
      languages: "Языки"
    }
  };

  var FONT_URL =
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@v20201228/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
  var jsPdfPromise = null;
  var fontPromise = null;
  var fontBase64 = null;

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
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("PDF library failed to load"));
      };
      document.head.appendChild(script);
    });
  }

  function loadJsPdf() {
    if (jsPdfPromise) return jsPdfPromise;
    jsPdfPromise = loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    ).then(function () {
      if (!global.jspdf?.jsPDF) throw new Error("PDF library failed to load");
    });
    return jsPdfPromise;
  }

  function loadFontData() {
    if (fontPromise) return fontPromise;
    fontPromise = fetch(FONT_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("CV font failed to load");
        return res.arrayBuffer();
      })
      .then(function (buf) {
        fontBase64 = arrayBufferToBase64(buf);
      });
    return fontPromise;
  }

  function applyFont(pdf) {
    if (!pdf.getFontList().NotoSans) {
      pdf.addFileToVFS("NotoSans-Regular.ttf", fontBase64);
      pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    }
    pdf.setFont("NotoSans", "normal");
  }

  /**
   * @param {object} cv
   * @param {"international"|"russia"} variant
   */
  async function buildCvPdf(cv, variant) {
    await loadJsPdf();
    await loadFontData();

    var pdf = new global.jspdf.jsPDF({ orientation: "p", unit: "mm", format: "a4" });
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
      pdf.setFontSize(fontSize);
      var lines = pdf.splitTextToSize(String(text), contentWidth - indent);
      ensureSpace(lines.length * lineHeight);
      pdf.text(lines, margin + indent, y);
      y += lines.length * lineHeight;
    }

    function sectionTitle(title) {
      ensureSpace(10);
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
