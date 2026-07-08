/** MVP product settings (Phase 0 decisions). */
export const MVP = {
  installUrl: "https://alicetcvetkova.github.io/eco_clean_map/app/",
  pilotCity: "Moscow",
  pilotCityRu: "Москва",
  mapCenter: { lat: 55.7558, lng: 37.6173 },
  mapZoom: 12,
  rewardPoints: 240,
  auth: "email_password",
  resetRedirectUrl: "https://alicetcvetkova.github.io/eco_clean_map/app/reset.html",
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
    email: "Email",
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
    photoAfter: "After photo (cleaned)",
    tabMap: "Map",
    tabReport: "Report",
    tabTasks: "Tasks",
    tabProfile: "Profile",
    pullRefresh: "Release to refresh",
    refreshing: "Refreshing…",
    refreshed: "Updated",
    activityTitle: "Your activity",
    activityReport: "Report",
    activityCleanup: "Cleanup",
    activityEmpty: "No activity yet",
    statusPending: "Pending review",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    taskTaken: "Someone already submitted proof for this task",
    taskAccepted: "Task accepted · good luck!",
    signedIn: "Signed in",
    guest: "Guest",
    member: "Clean Map member",
    points: "points",
    cleanups: "cleanups",
    pilot: "pilot",
    noTasks: "No tasks with photos yet",
    nearestCleanup: "Nearest cleanup",
    openTask: "View task",
    reportNew: "Report new",
    loginHint: "Old accounts: latin username still works (alice).",
    resetHint: "",
    forgotPassword: "Forgot password?",
    forgotTitle: "Reset password",
    forgotSubtitle: "We will email you a reset link",
    sendResetLink: "Send reset link",
    resetSent: "Check your email for the reset link",
    backToSignIn: "Back to sign in",
    newPassword: "New password",
    savePassword: "Save new password",
    passwordUpdated: "Password updated — you can sign in",
    resetInvalid: "Link expired. Request a new reset from the app."
  },
  ru: {
    installBanner: "Установите Eco Clean Map на главный экран для быстрого доступа.",
    install: "Установить",
    later: "Позже",
    signIn: "Войти",
    signUp: "Создать аккаунт",
    signOut: "Выйти",
    name: "Имя",
    email: "Email",
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
    photoAfter: "Фото «после» (убрано)",
    tabMap: "Карта",
    tabReport: "Репорт",
    tabTasks: "Задачи",
    tabProfile: "Профиль",
    pullRefresh: "Отпустите для обновления",
    refreshing: "Обновление…",
    refreshed: "Обновлено",
    activityTitle: "Ваша активность",
    activityReport: "Репорт",
    activityCleanup: "Уборка",
    activityEmpty: "Пока нет активности",
    statusPending: "На проверке",
    statusApproved: "Одобрено",
    statusRejected: "Отклонено",
    taskTaken: "Proof по этой задаче уже отправлен",
    taskAccepted: "Задача принята · удачи!",
    signedIn: "Вы вошли",
    guest: "Гость",
    member: "Участник Clean Map",
    points: "баллов",
    cleanups: "уборок",
    pilot: "пилот",
    noTasks: "Пока нет задач с фото",
    nearestCleanup: "Ближайшая уборка",
    openTask: "Открыть задачу",
    reportNew: "Сообщить",
    loginHint: "Старые аккаунты: можно войти латинским именем (alice).",
    resetHint: "",
    forgotPassword: "Забыли пароль?",
    forgotTitle: "Сброс пароля",
    forgotSubtitle: "Отправим ссылку на ваш email",
    sendResetLink: "Отправить ссылку",
    resetSent: "Проверьте почту — там ссылка для сброса",
    backToSignIn: "Назад ко входу",
    newPassword: "Новый пароль",
    savePassword: "Сохранить пароль",
    passwordUpdated: "Пароль обновлён — можно войти",
    resetInvalid: "Ссылка устарела. Запросите сброс снова в приложении."
  }
};

export function appLocale() {
  const saved = localStorage.getItem("cleanMapLocale");
  if (saved === "en" || saved === "ru") return saved;
  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : MVP.defaultLocale;
}

export function setLocale(locale) {
  if (locale === "en" || locale === "ru") {
    localStorage.setItem("cleanMapLocale", locale);
  }
}

export function toggleLocale() {
  setLocale(appLocale() === "ru" ? "en" : "ru");
}

export function t(key) {
  const locale = appLocale();
  return STRINGS[locale][key] || STRINGS.en[key] || key;
}

export const DEV_MODE =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  new URLSearchParams(location.search).has("dev");
