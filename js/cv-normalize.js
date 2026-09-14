(function (global) {
  "use strict";

  var CANONICAL = {
    ozon: { russia: "Менеджер проектов", international: "Senior Project Manager" },
    vk: { russia: "Product Manager", international: "Project Manager" },
    irpo: { russia: "Product Manager", international: "Product Manager" },
    erich: { russia: "Product Manager", international: "Product Manager" },
    consulting: { russia: "Product & Marketing Consultant", international: "Project Manager" }
  };

  function companyKey(company) {
    var c = String(company || "").toLowerCase();
    if (/ozon|озон/.test(c)) return "ozon";
    if (/\bvk\b|vkontakte|вконтакт/.test(c)) return "vk";
    if (/irpo|ирпо|professionalitet|профессионалитет/.test(c)) return "irpo";
    if (/erich|krause|крауз/.test(c)) return "erich";
    if (/vtb|втб|consulting|консалт/.test(c)) return "consulting";
    return null;
  }

  function isProjectDeliveryVacancy(text) {
    var t = String(text || "").slice(0, 800);
    var project = /project manager|programme manager|program manager|delivery manager|release manager|implementation manager|pmo|project management|менеджер проект|руководитель проект|управлени[ея] проект|проектный менеджер|delivery lead/i.test(t);
    var product = /product manager|продакт-менедж|product owner|head of product|cpo|chief product/i.test(t);
    if (project && !product) return true;
    if (project && product) {
      var projectIdx = t.search(/project manager|programme manager|delivery manager|менеджер проект|руководитель проект|проектный менеджер/i);
      var productIdx = t.search(/product manager|продакт-менедж|product owner/i);
      return projectIdx >= 0 && (productIdx < 0 || projectIdx <= productIdx);
    }
    return false;
  }

  /**
   * Fix immutable titles (Ozon) and project-vacancy headline — runs in browser even if Edge Function is stale.
   */
  function normalizeCvPayload(cv, variant, vacancyText) {
    if (!cv) return cv;
    variant = variant === "russia" ? "russia" : "international";
    var ozonRole = CANONICAL.ozon[variant];
    var fixedOzon = false;
    var projectVacancy = isProjectDeliveryVacancy(vacancyText);

    if (cv.experience && cv.experience.length) {
      cv.experience.forEach(function (exp) {
        var key = companyKey(exp.company);
        if (key === "ozon") {
          if (exp.role !== ozonRole) {
            exp.role = ozonRole;
            fixedOzon = true;
          }
        } else if (key === "vk" && projectVacancy && variant === "russia") {
          if (/product manager|продакт/i.test(exp.role || "")) {
            exp.role = "Project Manager";
          }
        }
      });
    }

    if (cv.summary) {
      cv.summary = cv.summary
        .replace(/Product Manager at Ozon Bank/gi, ozonRole + " at Ozon Bank")
        .replace(/Product Manager в Ozon Bank/gi, ozonRole + " в Ozon Банк")
        .replace(/Product Manager в Ozon/gi, "Менеджер проектов в Ozon Банк")
        .replace(/Продакт-менеджер в Ozon/gi, "Менеджер проектов в Ozon Банк");
    }

    if (projectVacancy && cv.headline && /^(product manager|продакт-менеджер)\s*[·•|/]/i.test(String(cv.headline).trim())) {
      cv.headline = variant === "russia"
        ? "Менеджер проектов / Delivery Manager · 10+ лет"
        : "Senior Project Manager / Delivery Manager · 10+ years";
    }

    if (fixedOzon) {
      cv._normalizeNote = "Ozon Bank: " + ozonRole + " (не Product Manager).";
    }
    return cv;
  }

  global.normalizeCvPayload = normalizeCvPayload;
  global.isProjectDeliveryVacancy = isProjectDeliveryVacancy;
})(typeof window !== "undefined" ? window : globalThis);
