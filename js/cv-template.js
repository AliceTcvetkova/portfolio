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

  function esc(text) {
    if (text == null) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function section(title, inner) {
    if (!inner) return "";
    return (
      '<section class="cv-document__section">' +
      '<h2 class="cv-document__section-title">' + esc(title) + "</h2>" +
      inner +
      "</section>"
    );
  }

  function renderExperience(items) {
    if (!items || !items.length) return "";
    return items
      .map(function (job) {
        var bullets = (job.bullets || [])
          .map(function (b) {
            return "<li>" + esc(b) + "</li>";
          })
          .join("");
        return (
          '<article class="cv-document__job">' +
          '<div class="cv-document__job-head">' +
          '<strong class="cv-document__job-title">' +
          esc(job.role || job.title || "") +
          "</strong>" +
          (job.company
            ? '<span class="cv-document__job-company"> · ' + esc(job.company) + "</span>"
            : "") +
          (job.dates
            ? '<div class="cv-document__job-dates">' + esc(job.dates) + "</div>"
            : "") +
          "</div>" +
          (bullets ? '<ul class="cv-document__bullets">' + bullets + "</ul>" : "") +
          "</article>"
        );
      })
      .join("");
  }

  function renderList(items) {
    if (!items || !items.length) return "";
    return (
      '<ul class="cv-document__list">' +
      items.map(function (i) {
        return "<li>" + esc(i) + "</li>";
      }).join("") +
      "</ul>"
    );
  }

  /**
   * @param {object} cv - structured CV from API
   * @param {"international"|"russia"} variant
   */
  function renderCvDocument(cv, variant) {
    if (!cv) return "";
    var labels = LABELS[variant] || LABELS.international;
    var portfolio =
      cv.portfolio_url || "https://alicetcvetkova.github.io/portfolio/";
    var linkedin =
      cv.linkedin_url || "https://www.linkedin.com/in/alice-tsvetkova";

    var contact =
      cv.contact_line ||
      [cv.phone, cv.email, cv.location].filter(Boolean).join(" · ");

    var links =
      '<p class="cv-document__links">' +
      '<a href="' + esc(portfolio) + '">Portfolio</a>' +
      " · " +
      '<a href="' + esc(linkedin) + '">LinkedIn</a>' +
      "</p>";

    var html =
      '<article class="cv-document" id="cv-document-print">' +
      '<header class="cv-document__header">' +
      '<h1 class="cv-document__name">' +
      esc(cv.full_name || "Alice Tsvetkova") +
      "</h1>" +
      (cv.headline
        ? '<p class="cv-document__headline">' + esc(cv.headline) + "</p>"
        : "") +
      (contact ? '<p class="cv-document__contact">' + esc(contact) + "</p>" : "") +
      links +
      "</header>";

    if (cv.summary) {
      html += section(
        labels.summary,
        '<p class="cv-document__summary">' + esc(cv.summary) + "</p>"
      );
    }

    html += section(labels.experience, renderExperience(cv.experience));

    if (cv.skills) {
      html += section(
        labels.skills,
        '<p class="cv-document__skills">' + esc(cv.skills) + "</p>"
      );
    }

    if (cv.education && cv.education.length) {
      html += section(labels.education, renderList(cv.education));
    }

    if (cv.certifications && cv.certifications.length) {
      html += section(labels.certifications, renderList(cv.certifications));
    }

    if (cv.languages) {
      html += section(
        labels.languages,
        '<p class="cv-document__languages">' + esc(cv.languages) + "</p>"
      );
    }

    html += "</article>";
    return html;
  }

  global.renderCvDocument = renderCvDocument;
})(typeof window !== "undefined" ? window : globalThis);
