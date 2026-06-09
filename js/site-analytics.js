(function () {
  var config = window.SITE_CONFIG || {};
  var measurementId = String(config.gaMeasurementId || "").trim();
  if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return;

  var host = window.location.hostname;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host)) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", measurementId);

  var script = document.createElement("script");
  script.async = true;
  script.src =
    "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
  document.head.appendChild(script);
})();
