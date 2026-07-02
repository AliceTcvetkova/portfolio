/** MVP product settings (Phase 0 decisions). */
export const MVP = {
  installUrl: "https://alicetcvetkova.github.io/eco_clean_map/app/",
  pilotCity: "Moscow",
  pilotCityRu: "Москва",
  mapCenter: { lat: 55.7558, lng: 37.6173 },
  mapZoom: 12,
  rewardPoints: 240,
  auth: "username_password",
  locales: ["en", "ru"],
  defaultLocale: "ru"
};

export const STRINGS = {
  en: {
    installBanner: "Install Eco Clean Map for quick access from your home screen.",
    install: "Install",
    later: "Later",
    signIn: "Sign in",
    signUp: "Create account",
    signOut: "Sign out",
    name: "Name",
    password: "Password",
    needAuth: "Sign in to continue",
    addPhoto: "Tap to add photo",
    waitingGps: "Waiting for GPS…",
    reportSent: "Report sent · pending review",
    proofSent: "Proof sent · pending review",
    missingPhoto: "Add a photo first",
    missingGps: "Allow location to submit",
    missingProof: "Add an after photo",
    ownTask: "You reported this — another user should clean it",
    noBeforePhoto: "This task has no before photo yet",
    photoBefore: "Before photo (pollution)",
    photoAfter: "After photo (cleaned)"
  },
  ru: {
    installBanner: "Установите Eco Clean Map на главный экран для быстрого доступа.",
    install: "Установить",
    later: "Позже",
    signIn: "Войти",
    signUp: "Создать аккаунт",
    signOut: "Выйти",
    name: "Имя",
    password: "Пароль",
    needAuth: "Войдите, чтобы продолжить",
    addPhoto: "Нажмите, чтобы добавить фото",
    waitingGps: "Ожидание GPS…",
    reportSent: "Репорт отправлен · на проверке",
    proofSent: "Фото отправлены · на проверке",
    missingPhoto: "Сначала добавьте фото",
    missingGps: "Разрешите геолокацию",
    missingProof: "Добавьте фото «после»",
    ownTask: "Вы создали это объявление — убирать должен другой пользователь",
    noBeforePhoto: "У задачи пока нет фото «до»",
    photoBefore: "Фото «до» (загрязнение)",
    photoAfter: "Фото «после» (убрано)"
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
