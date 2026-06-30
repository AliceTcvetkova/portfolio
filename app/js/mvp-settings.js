/** MVP product settings (Phase 0 decisions). */
export const MVP = {
  installUrl: "https://alicetcvetkova.github.io/eco_clean_map/app/",
  pilotCity: "Moscow",
  pilotCityRu: "Москва",
  rewardPoints: 240,
  auth: "username_password",
  locales: ["en", "ru"],
  defaultLocale: "ru"
};

export const STRINGS = {
  en: {
    installBanner: "Install Eco Clean Map for quick access from your home screen.",
    install: "Install",
    later: "Later"
  },
  ru: {
    installBanner: "Установите Eco Clean Map на главный экран для быстрого доступа.",
    install: "Установить",
    later: "Позже"
  }
};

export function appLocale() {
  const saved = localStorage.getItem("cleanMapLocale");
  if (saved === "en" || saved === "ru") return saved;
  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : MVP.defaultLocale;
}

export function t(key) {
  const locale = appLocale();
  return STRINGS[locale][key] || STRINGS.en[key] || key;
}

export const DEV_MODE =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  new URLSearchParams(location.search).has("dev");
