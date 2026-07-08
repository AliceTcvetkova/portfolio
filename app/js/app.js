import { FALLBACK_ROWS, CAMPAIGN, REPORT_CATEGORIES } from "./data.js";
import { loadFigmaTokens, applyFigmaTokens, figmaScreenAsset } from "./figma.js";
import { DEV_MODE, MVP, appLocale, t, toggleLocale } from "./mvp-settings.js";
import { getSupabase } from "./supabase-client.js";
import { loadTasksFromSupabase, normalizeTask, requestUserLocation, sortByDistance, filterPlayableTasks } from "./tasks-api.js";
import { destroyMaps, mountLeafletMap } from "./leaflet-map.js";
import { getSession, loadProfile, signIn, signUp, signOut, formatAuthError, requestPasswordReset } from "./auth.js";
import { createReport, createSubmission } from "./reports-api.js";
import { loadUserActivity } from "./activity-api.js";

const state = {
  screen: "onboarding",
  tab: "Map",
  selectedTaskId: null,
  reportCategory: REPORT_CATEGORIES[0],
  acceptedTaskId: null,
  onboardingDone: localStorage.getItem("cleanMapOnboarded") === "1",
  figmaOverlay: localStorage.getItem("cleanMapFigmaOverlay") === "1",
  userLocation: null,
  tasks: [],
  session: null,
  profile: null,
  authMode: "login",
  authReturn: "map",
  reportPhotoFile: null,
  reportPhotoUrl: null,
  proofAfterFile: null,
  proofAfterUrl: null,
  activity: { reports: [], submissions: [] },
  mapRefreshing: false
};

let figmaData = null;
let pullTouch = { active: false, startY: 0 };

const TAB_LABELS = {
  Map: "tabMap",
  Report: "tabReport",
  Tasks: "tabTasks",
  Profile: "tabProfile"
};

const screens = {
  onboarding: { title: "Clean Map", subtitle: "Turn polluted places into cleanup quests.", tab: "Home", hideTabs: true },
  map: { title: "Nearby cleanup tasks", subtitle: "3 tasks within 1.2 km", tab: "Map" },
  report: { title: "Report a polluted place", subtitle: "Before photo + location", tab: "Report" },
  task: { title: "Riverside cleanup", subtitle: "Estimated reward: 240 pts", tab: "Tasks" },
  proof: { title: "Upload cleanup proof", subtitle: "After photo from same spot", tab: "Tasks" },
  verify: { title: "Cleanup verified", subtitle: "Reward unlocked", tab: "Tasks" },
  profile: { title: "Your impact", subtitle: "12 cleanups completed", tab: "Profile" },
  sponsor: { title: "Fund local cleanups", subtitle: "Sponsor visible impact", tab: "Sponsor" }
};

const phone = document.getElementById("phone");
const toastEl = document.getElementById("toast");
const installBanner = document.getElementById("install-banner");
let deferredPrompt = null;
let toastTimer = null;

function getTasks() {
  return state.tasks;
}

function selectedTask() {
  const tasks = getTasks();
  return tasks.find((task) => task.id === state.selectedTaskId) || tasks[0] || null;
}

function mapSubtitle() {
  const tasks = getTasks();
  const locale = appLocale();
  if (!tasks.length) {
    return locale === "ru" ? `${t("noTasks")} · ${MVP.pilotCityRu}` : `${t("noTasks")} · ${MVP.pilotCity}`;
  }
  const nearest = tasks[0];
  if (locale === "ru") {
    return nearest.distanceKm != null
      ? `${tasks.length} задач · ближайшая ${nearest.distance}`
      : `${tasks.length} задач · ${MVP.pilotCityRu}`;
  }
  return nearest.distanceKm != null
    ? `${tasks.length} tasks · nearest ${nearest.distance}`
    : `${tasks.length} tasks in ${MVP.pilotCity}`;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2200);
}

function profileInitial() {
  const name = state.profile?.display_name || "U";
  return name.charAt(0).toUpperCase();
}

function requireAuth(returnScreen) {
  if (state.session) return true;
  state.authReturn = returnScreen || state.screen;
  state.authMode = "login";
  state.screen = "auth";
  showToast(t("needAuth"));
  render();
  return false;
}

function setPhotoFile(kind, file) {
  const urlKey = kind + "Url";
  const fileKey = kind + "File";
  if (state[urlKey]) URL.revokeObjectURL(state[urlKey]);
  state[fileKey] = file || null;
  state[urlKey] = file ? URL.createObjectURL(file) : null;
}

function reportLocationText() {
  const locale = appLocale();
  if (!state.userLocation) return t("waitingGps");
  const { lat, lng } = state.userLocation;
  if (locale === "ru") return `${MVP.pilotCityRu} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  return `${MVP.pilotCity} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

async function refreshAuth() {
  try {
    state.session = await getSession();
    if (state.session) {
      state.profile = await loadProfile(state.session.user.id);
    } else {
      state.profile = null;
    }
  } catch (err) {
    console.warn("auth refresh failed", err);
    state.session = null;
    state.profile = null;
  }
}

function heroMapMarkup() {
  return `
    <div class="map-canvas">
      <div class="map-canvas__park" style="width:190px;height:170px;left:10px;top:30px"></div>
      <div class="map-canvas__forest" style="width:130px;height:100px;left:40px;top:210px"></div>
      <div class="map-canvas__river" style="width:96px;height:380px;right:-10px;top:-40px"></div>
    </div>
  `;
}

function mapContainer(options = {}) {
  const tall = options.tall ? " leaflet-map--tall" : "";
  const fit = options.fit ? "1" : "0";
  return `<div class="leaflet-map${tall}" data-leaflet-map data-map-fit="${fit}"></div>`;
}

function mountActiveMaps() {
  destroyMaps();
  const mapEl = phone.querySelector("[data-leaflet-map]");
  if (!mapEl) return;

  const task = selectedTask();
  mountLeafletMap(mapEl, {
    tasks: getTasks(),
    userLocation: state.userLocation,
    fitTasks: mapEl.dataset.mapFit === "1",
    zoom: state.screen === "task" && task ? 15 : MVP.mapZoom,
    onTaskSelect: (taskId) => navigate("task", { taskId })
  });
}

function statusLabel(status) {
  if (status === "approved") return t("statusApproved");
  if (status === "rejected") return t("statusRejected");
  return t("statusPending");
}

function statusClass(status) {
  if (status === "approved") return "activity-item__status--approved";
  if (status === "rejected") return "activity-item__status--rejected";
  return "activity-item__status--pending";
}

function formatActivityDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(appLocale() === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "short"
  });
}

async function loadActivity() {
  if (!state.session) {
    state.activity = { reports: [], submissions: [] };
    return;
  }
  try {
    state.activity = await loadUserActivity(state.session.user.id);
  } catch (_) {
    state.activity = { reports: [], submissions: [] };
  }
}

function renderHeader(meta) {
  const locale = appLocale();
  const otherLocale = locale === "ru" ? "EN" : "RU";
  return `
    <header class="header">
      <div class="header__row">
        <div>
          <h1 class="header__title">${meta.title}</h1>
          <p class="header__subtitle">${meta.subtitle}</p>
        </div>
        <div class="header__actions">
          <button type="button" class="locale-toggle" data-action="toggle-locale" aria-label="Language">${otherLocale}</button>
          ${meta.tab === "Profile" || meta.tab === "Home" ? "" : `<div class="avatar" aria-hidden="true">${profileInitial()}</div>`}
        </div>
      </div>
    </header>
  `;
}

function renderTabBar(activeTab) {
  const tabs = ["Map", "Report", "Tasks", "Profile"];
  return `
    <nav class="tab-bar" aria-label="Main navigation">
      ${tabs.map((label) => `
        <button type="button" class="tab-bar__item${activeTab === label || (activeTab === "Home" && label === "Map") || (activeTab === "Sponsor" && label === "Tasks") ? " is-active" : ""}" data-tab="${label}">
          <span class="tab-bar__icon"></span>
          <span>${t(TAB_LABELS[label])}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderOnboarding() {
  return `
    <section class="screen screen--no-tabs is-active" data-screen="onboarding">
      ${renderHeader(screens.onboarding)}
      <div class="screen__body">
        <div class="hero">
          <div class="hero__ring"></div>
          <div class="hero__map">${heroMapMarkup()}</div>
        </div>
        <div class="hero-copy">
          <h2>Find polluted places. Clean them. Get rewarded.</h2>
          <p>A mobile map that turns real-world cleanup into verified local quests.</p>
        </div>
        <div class="onboarding-actions">
          <button type="button" class="btn btn--primary btn--block" data-action="start">Start exploring</button>
        </div>
      </div>
    </section>
  `;
}

function renderMap() {
  const task = selectedTask();
  const locale = appLocale();
  return `
    <section class="screen is-active" data-screen="map">
      ${renderHeader({ ...screens.map, subtitle: mapSubtitle() })}
      <div class="screen__body screen__body--flush screen__body--scroll" data-pull-zone>
        <p class="pull-hint" data-pull-hint>${t("pullRefresh")}</p>
        <div style="padding:0 20px">
          <div class="map-wrap">
            ${mapContainer({ tall: true, fit: true })}
            <div class="search-field">${locale === "ru" ? "Парк, река, набережная…" : "Search park, river, beach..."}</div>
          </div>
        </div>
        ${task ? `
        <div class="sheet card">
          <p class="card__label">${t("nearestCleanup")}</p>
          <h2 class="card__title">${task.title}</h2>
          <p class="card__meta">${task.distance} · ${task.severity} · ${task.reward} pts</p>
          <div class="btn-row" style="margin-top:18px">
            <button type="button" class="btn btn--primary" data-action="open-task">${t("openTask")}</button>
            <button type="button" class="btn btn--secondary" data-action="go-report">${t("reportNew")}</button>
          </div>
        </div>` : ""}
      </div>
      ${renderTabBar("Map")}
    </section>
  `;
}

function renderAuth() {
  const locale = appLocale();
  const mode = state.authMode;
  const register = mode === "register";
  const forgot = mode === "forgot";
  const subtitle = forgot
    ? t("forgotSubtitle")
    : register
      ? (locale === "ru" ? "Email, имя и пароль" : "Email, name and password")
      : (locale === "ru" ? "Email и пароль" : "Email and password");

  const fields = forgot
    ? `
        <div class="auth-field">
          <label for="auth-email">${t("email")}</label>
          <input id="auth-email" name="email" type="email" autocomplete="email" inputmode="email" required>
        </div>
        <button type="button" class="btn btn--primary btn--block" data-action="auth-forgot-submit">${t("sendResetLink")}</button>
      `
    : register
      ? `
        <div class="auth-field">
          <label for="auth-email">${t("email")}</label>
          <input id="auth-email" name="email" type="email" autocomplete="email" inputmode="email" required>
        </div>
        <div class="auth-field">
          <label for="auth-username">${t("name")}</label>
          <input id="auth-username" name="username" autocomplete="username" autocapitalize="words" required minlength="2" maxlength="32">
        </div>
        <div class="auth-field">
          <label for="auth-password">${t("password")}</label>
          <input id="auth-password" name="password" type="password" autocomplete="new-password" required minlength="6">
        </div>
        <button type="button" class="btn btn--primary btn--block" data-action="auth-submit">${t("signUp")}</button>
      `
      : `
        <div class="auth-field">
          <label for="auth-email">${t("email")}</label>
          <input id="auth-email" name="email" type="text" autocomplete="username" inputmode="email" required>
          <p class="auth-login-hint">${t("loginHint")}</p>
        </div>
        <div class="auth-field">
          <label for="auth-password">${t("password")}</label>
          <input id="auth-password" name="password" type="password" autocomplete="current-password" required minlength="6">
        </div>
        <button type="button" class="btn btn--link" data-action="auth-forgot">${t("forgotPassword")}</button>
        <button type="button" class="btn btn--primary btn--block" data-action="auth-submit">${t("signIn")}</button>
      `;

  return `
    <section class="screen screen--no-tabs is-active" data-screen="auth">
      ${renderHeader({
        title: "Clean Map",
        subtitle: forgot ? t("forgotTitle") : subtitle,
        tab: "Home"
      })}
      <div class="screen__body">
        <div class="card">
          <form class="auth-form" data-auth-form>
            ${fields}
          </form>
          ${forgot ? `
            <button type="button" class="btn btn--secondary btn--block" style="margin-top:12px" data-action="auth-back">${t("backToSignIn")}</button>
          ` : `
            <p class="auth-toggle">
              ${register ? (locale === "ru" ? "Уже есть аккаунт?" : "Have an account?") : (locale === "ru" ? "Нет аккаунта?" : "No account?")}
              <button type="button" data-action="auth-toggle">${register ? t("signIn") : t("signUp")}</button>
            </p>
            <button type="button" class="btn btn--secondary btn--block" style="margin-top:12px" data-action="auth-skip">${locale === "ru" ? "Карта без входа" : "Browse map as guest"}</button>
          `}
        </div>
      </div>
    </section>
  `;
}

function renderReport() {
  const locale = appLocale();
  return `
    <section class="screen is-active" data-screen="report">
      ${renderHeader(screens.report)}
      <div class="screen__body">
        <label class="camera-preview camera-preview--live">
          <input type="file" accept="image/*" capture="environment" data-photo-input="report" hidden>
          ${state.reportPhotoUrl
            ? `<img src="${state.reportPhotoUrl}" alt="">`
            : `<div class="camera-preview__placeholder"></div>
               <div class="camera-preview__hills"></div>
               <span class="camera-preview__label">${t("photoBefore")}</span>
               <span class="camera-preview__shutter"></span>`}
        </label>
        <div class="card" style="margin-top:16px">
          <p class="card__label" style="color:var(--green-dark)">${locale === "ru" ? "Локация" : "Location detected"}</p>
          <h2 class="card__title">${reportLocationText()}</h2>
          <p class="card__label" style="margin-top:18px">${locale === "ru" ? "Категория" : "Pollution category"}</p>
          <div class="chip-row">
            ${REPORT_CATEGORIES.map((label) => `
              <button type="button" class="chip${state.reportCategory === label ? " is-active" : ""}" data-category="${label}">${label}</button>
            `).join("")}
          </div>
          <p class="card__meta" style="margin-top:16px">${locale === "ru" ? "Награда после проверки:" : "Reward after review:"} ${MVP.rewardPoints} pts</p>
          <button type="button" class="btn btn--primary btn--block" style="margin-top:18px" data-action="submit-report">${locale === "ru" ? "Отправить репорт" : "Submit report"}</button>
        </div>
      </div>
      ${renderTabBar("Report")}
    </section>
  `;
}

function renderTask() {
  const task = selectedTask();
  if (!task) return renderMap();
  return `
    <section class="screen is-active" data-screen="task">
      ${renderHeader({ ...screens.task, title: task.title, subtitle: `${task.reward} pts` })}
      <div class="screen__body">
        ${mapContainer({ fit: false })}
        <div class="card" style="margin-top:16px">
          <p class="card__label severity--${task.severity}">${task.severityLabel}</p>
          <h2 class="card__title">${task.title}</h2>
          <p class="card__meta">${task.location} · ${task.distance} · ${task.reported}</p>
          <p class="card__label" style="margin-top:18px">Reward</p>
          <p class="card__title" style="font-size:17px;color:var(--green-dark)">${task.reward} points + ${task.badge}</p>
          <p class="card__meta" style="margin-top:12px">Checklist: bring gloves, collect visible plastic, upload after photo from same location.</p>
          <button type="button" class="btn btn--primary btn--block" style="margin-top:18px" data-action="accept-task">${state.acceptedTaskId === task.id ? "Continue to proof" : "Accept task"}</button>
        </div>
      </div>
      ${renderTabBar("Tasks")}
    </section>
  `;
}

function renderProof() {
  const locale = appLocale();
  const task = selectedTask();
  const beforeUrl = task?.beforePhotoUrl;
  return `
    <section class="screen is-active" data-screen="proof">
      ${renderHeader(screens.proof)}
      <div class="screen__body">
        <p class="proof-hint">${locale === "ru" ? "Фото «до» от автора объявления · вы загружаете только «после»" : "Before photo from reporter · you upload after only"}</p>
        <div class="photo-grid">
          <div class="photo-card photo-card--before photo-card--readonly">
            <strong>${locale === "ru" ? "До" : "Before"}</strong>
            ${beforeUrl
              ? `<img class="photo-card__img" src="${beforeUrl}" alt="">`
              : `<span class="photo-card__empty">${t("noBeforePhoto")}</span>`}
          </div>
          <div class="photo-card photo-card--after">
            <strong>${locale === "ru" ? "После" : "After"}</strong>
            <label>
              <input type="file" accept="image/*" capture="environment" data-photo-input="proofAfter">
              ${state.proofAfterUrl
                ? `<img class="photo-card__img" src="${state.proofAfterUrl}" alt="">`
                : `<span class="photo-card__marker photo-card__marker--clean"></span>
                   <span class="photo-card__tap">${t("photoAfter")}</span>`}
            </label>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <h2 class="card__title">${locale === "ru" ? "Чеклист" : "Proof checklist"}</h2>
          <ul class="checklist">
            <li><span class="checklist__mark"></span>${locale === "ru" ? "Та же локация" : "Same location"}</li>
            <li><span class="checklist__mark"></span>${locale === "ru" ? "Фото «после» с вашей камеры" : "Your after photo uploaded"}</li>
            <li><span class="checklist__mark"></span>${locale === "ru" ? "Мусор убран" : "Waste removed"}</li>
          </ul>
          <button type="button" class="btn btn--primary btn--block" style="margin-top:18px" data-action="send-proof"${!beforeUrl ? " disabled" : ""}>${locale === "ru" ? "Отправить на проверку" : "Send for verification"}</button>
        </div>
      </div>
      ${renderTabBar("Tasks")}
    </section>
  `;
}

function renderVerify() {
  const locale = appLocale();
  return `
    <section class="screen is-active" data-screen="verify">
      ${renderHeader({
        ...screens.verify,
        title: locale === "ru" ? "Отправлено" : "Submitted",
        subtitle: locale === "ru" ? "Ожидает проверки" : "Pending review"
      })}
      <div class="screen__body">
        <div class="success">
          <div class="success__glow"><div class="success__seal">…</div></div>
          <p class="success__text">${locale === "ru" ? "Администратор проверит фото и начислит бонусы." : "An admin will review your photos and award points."}</p>
        </div>
        <div class="card" style="margin-top:16px">
          <p class="card__label">${locale === "ru" ? "Статус" : "Status"}</p>
          <p class="card__title" style="font-size:22px;color:var(--amber)">pending</p>
          <p class="card__meta">${locale === "ru" ? `После approve: +${MVP.rewardPoints} pts` : `After approve: +${MVP.rewardPoints} pts`}</p>
          <div class="btn-row" style="margin-top:18px">
            <button type="button" class="btn btn--primary" data-action="next-task">${locale === "ru" ? "К карте" : "Back to map"}</button>
          </div>
        </div>
      </div>
      ${renderTabBar("Tasks")}
    </section>
  `;
}

function renderActivitySection() {
  const { reports, submissions } = state.activity;
  if (!reports.length && !submissions.length) {
    return `<p class="activity-empty">${t("activityEmpty")}</p>`;
  }
  const reportItems = reports.map((item) => `
    <li class="activity-item">
      <div>
        <strong>${t("activityReport")}</strong>
        <span>${item.location_name || item.category}</span>
      </div>
      <span class="activity-item__status ${statusClass(item.status)}">${statusLabel(item.status)}</span>
      <time>${formatActivityDate(item.created_at)}</time>
    </li>
  `).join("");
  const subItems = submissions.map((item) => `
    <li class="activity-item">
      <div>
        <strong>${t("activityCleanup")}</strong>
        <span>${item.tasks?.title || item.tasks?.location_name || "—"}</span>
      </div>
      <span class="activity-item__status ${statusClass(item.status)}">${statusLabel(item.status)}</span>
      <time>${formatActivityDate(item.created_at)}</time>
    </li>
  `).join("");
  return `<ul class="activity-list">${reportItems}${subItems}</ul>`;
}

function renderProfile() {
  const name = state.profile?.display_name || t("guest");
  const points = state.profile?.points ?? 0;
  const cleanups = state.profile?.cleanups ?? 0;
  return `
    <section class="screen is-active" data-screen="profile">
      ${renderHeader(screens.profile)}
      <div class="screen__body screen__body--scroll">
        <div class="profile-head">
          <div class="avatar avatar--lg" aria-hidden="true">${name.charAt(0).toUpperCase()}</div>
          <div>
            <h2>${name}</h2>
            <p>${state.session ? t("member") : t("guest")}</p>
          </div>
        </div>
        <div class="card" style="margin-top:24px">
          <div class="stats-grid">
            <div><strong>${cleanups}</strong><span>${t("cleanups")}</span></div>
            <div><strong>${MVP.pilotCityRu.slice(0, 4)}</strong><span>${t("pilot")}</span></div>
            <div><strong>${points.toLocaleString()}</strong><span>${t("points")}</span></div>
          </div>
        </div>
        ${state.session ? `
          <div class="card" style="margin-top:16px">
            <h2 class="card__title">${t("activityTitle")}</h2>
            ${renderActivitySection()}
          </div>
          <button type="button" class="btn btn--secondary btn--block" style="margin-top:16px" data-action="sign-out">${t("signOut")}</button>
        ` : `
          <button type="button" class="btn btn--primary btn--block" style="margin-top:16px" data-action="go-auth">${t("signIn")}</button>
        `}
      </div>
      ${renderTabBar("Profile")}
    </section>
  `;
}

function renderSponsor() {
  const progress = Math.round((CAMPAIGN.funded / CAMPAIGN.goal) * 100);
  return `
    <section class="screen is-active" data-screen="sponsor">
      ${renderHeader(screens.sponsor)}
      <div class="screen__body">
        ${mapContainer({ fit: true })}
        <div class="card" style="margin-top:16px">
          <p class="card__label">Sponsor campaign</p>
          <h2 class="card__title">${CAMPAIGN.title}</h2>
          <p class="card__meta">${CAMPAIGN.description}</p>
          <div class="progress">
            <div class="progress__track"><div class="progress__fill" style="width:${progress}%"></div></div>
            <p class="progress__label">$${CAMPAIGN.funded} funded of $${CAMPAIGN.goal}</p>
          </div>
          <button type="button" class="btn btn--primary btn--block" style="margin-top:18px" data-action="fund">Fund campaign</button>
        </div>
      </div>
      ${renderTabBar("Sponsor")}
    </section>
  `;
}

const renderers = {
  onboarding: renderOnboarding,
  auth: renderAuth,
  map: renderMap,
  report: renderReport,
  task: renderTask,
  proof: renderProof,
  verify: renderVerify,
  profile: renderProfile,
  sponsor: renderSponsor
};

async function navigate(screen, options = {}) {
  if (options.taskId) state.selectedTaskId = options.taskId;
  state.screen = screen;
  if (options.persistOnboarding && screen !== "onboarding") {
    localStorage.setItem("cleanMapOnboarded", "1");
    state.onboardingDone = true;
  }
  if (screen === "profile") await loadActivity();
  render();
}

function resolveScreen() {
  if (!state.onboardingDone && state.screen === "onboarding") return "onboarding";
  if (!state.onboardingDone && state.screen === "map") return "onboarding";
  if (!state.session && ["report", "proof"].includes(state.screen)) return "auth";
  return state.screen;
}

function render() {
  try {
    const initial = resolveScreen();
    const renderer = renderers[initial] || renderOnboarding;
    const figmaSrc = figmaData ? figmaScreenAsset(figmaData, initial) : null;
    document.body.classList.toggle("figma-overlay-on", state.figmaOverlay && !!figmaSrc);
    phone.innerHTML = `
      <div class="backdrop" aria-hidden="true">
        <div class="backdrop__wash backdrop__wash--dusk"></div>
        <div class="backdrop__wash backdrop__wash--hill-back"></div>
        <div class="backdrop__wash backdrop__wash--hill-front"></div>
        <div class="backdrop__moon"></div>
        <div class="backdrop__cloud backdrop__cloud--1"></div>
        <div class="backdrop__cloud backdrop__cloud--2"></div>
      </div>
      ${DEV_MODE && figmaData ? `<button type="button" class="figma-toggle" data-action="toggle-figma" aria-pressed="${state.figmaOverlay}">${state.figmaOverlay ? "Live UI" : "Figma ref"}</button>` : ""}
      ${state.figmaOverlay && figmaSrc ? `<img class="figma-ref" src="${figmaSrc}" alt="Figma reference for ${initial} screen">` : ""}
      ${renderer()}
    `;
    requestAnimationFrame(() => {
      mountActiveMaps();
      setupPullRefresh();
    });
  } catch (err) {
    console.error("render failed", err);
    phone.innerHTML = `
      <section class="screen is-active">
        <div class="screen__body">
          <div class="card">
            <h2 class="card__title">${appLocale() === "ru" ? "Ошибка загрузки" : "Load error"}</h2>
            <p class="card__meta">${err.message || err}</p>
            <button type="button" class="btn btn--primary btn--block" style="margin-top:16px" onclick="location.reload()">${appLocale() === "ru" ? "Обновить" : "Reload"}</button>
          </div>
        </div>
      </section>
    `;
  }
}

async function refreshMapData() {
  if (state.mapRefreshing) return;
  state.mapRefreshing = true;
  showToast(t("refreshing"));
  await loadTasks();
  if (state.session) await refreshAuth();
  state.mapRefreshing = false;
  showToast(t("refreshed"));
  render();
}

function setupPullRefresh() {
  const zone = phone.querySelector("[data-pull-zone]");
  if (!zone) return;
  if (zone.dataset.pullReady) return;
  zone.dataset.pullReady = "1";
  const hint = zone.querySelector("[data-pull-hint]");

  zone.addEventListener("touchstart", (event) => {
    if (zone.scrollTop > 4) return;
    pullTouch.active = true;
    pullTouch.startY = event.touches[0].clientY;
  }, { passive: true });

  zone.addEventListener("touchmove", (event) => {
    if (!pullTouch.active) return;
    const delta = event.touches[0].clientY - pullTouch.startY;
    if (delta > 48 && zone.scrollTop <= 0) {
      hint?.classList.add("is-visible");
    } else {
      hint?.classList.remove("is-visible");
    }
  }, { passive: true });

  zone.addEventListener("touchend", () => {
    if (!pullTouch.active) return;
    const shouldRefresh = hint?.classList.contains("is-visible");
    pullTouch.active = false;
    hint?.classList.remove("is-visible");
    if (shouldRefresh) refreshMapData();
  });
}

function handleAction(action) {
  switch (action) {
    case "start":
      navigate("map", { persistOnboarding: true });
      break;
    case "open-task":
      navigate("task");
      break;
    case "go-report":
      if (requireAuth("report")) navigate("report");
      break;
    case "go-auth":
      state.authMode = "login";
      navigate("auth");
      break;
    case "auth-toggle":
      state.authMode = state.authMode === "register" ? "login" : "register";
      render();
      break;
    case "auth-forgot":
      state.authMode = "forgot";
      render();
      break;
    case "auth-back":
      state.authMode = "login";
      render();
      break;
    case "auth-forgot-submit":
      handleForgotPassword();
      break;
    case "auth-skip":
      navigate("map");
      break;
    case "auth-submit":
      handleAuthSubmit();
      break;
    case "sign-out":
      handleSignOut();
      break;
    case "submit-report":
      handleSubmitReport();
      break;
    case "accept-task":
      if (!requireAuth("task")) break;
      {
        const task = selectedTask();
        if (task?.reporterId && state.session?.user?.id === task.reporterId) {
          showToast(t("ownTask"));
          break;
        }
        if (state.acceptedTaskId !== task?.id) {
          state.acceptedTaskId = task.id;
          showToast(t("taskAccepted"));
          render();
        } else {
          navigate("proof");
        }
      }
      break;
    case "send-proof":
      handleSendProof();
      break;
    case "next-task":
      navigate("map");
      break;
    case "go-sponsor":
      navigate("sponsor");
      break;
    case "fund":
      showToast("Campaign funded · thank you!");
      break;
    case "toggle-locale":
      toggleLocale();
      setupInstallBanner();
      render();
      break;
    case "toggle-figma":
      state.figmaOverlay = !state.figmaOverlay;
      localStorage.setItem("cleanMapFigmaOverlay", state.figmaOverlay ? "1" : "0");
      render();
      break;
    default:
      break;
  }
}

async function handleAuthSubmit() {
  const form = phone.querySelector("[data-auth-form]");
  if (!form) return;
  const password = form.password?.value;
  try {
    if (state.authMode === "register") {
      await signUp({
        email: form.email.value,
        displayName: form.username.value,
        password
      });
    } else {
      await signIn(form.email.value, password);
    }
    await refreshAuth();
    showToast(t("signedIn"));
    navigate(state.authReturn || "map");
  } catch (err) {
    showToast(formatAuthError(err));
  }
}

async function handleForgotPassword() {
  const form = phone.querySelector("[data-auth-form]");
  if (!form?.email) return;
  try {
    await requestPasswordReset(form.email.value);
    showToast(t("resetSent"));
    state.authMode = "login";
    render();
  } catch (err) {
    showToast(formatAuthError(err));
  }
}

async function handleSignOut() {
  await signOut();
  await refreshAuth();
  navigate("map");
}

async function handleSubmitReport() {
  if (!requireAuth("report")) return;
  if (!state.reportPhotoFile) {
    showToast(t("missingPhoto"));
    return;
  }
  if (!state.userLocation) {
    state.userLocation = await requestUserLocation();
  }
  if (!state.userLocation) {
    showToast(t("missingGps"));
    return;
  }
  try {
    await createReport({
      userId: state.session.user.id,
      category: state.reportCategory,
      lat: state.userLocation.lat,
      lng: state.userLocation.lng,
      photoFile: state.reportPhotoFile,
      locale: appLocale()
    });
    setPhotoFile("reportPhoto", null);
    await loadTasks();
    showToast(t("reportSent"));
    navigate("map");
  } catch (err) {
    showToast(err.message || String(err));
  }
}

async function handleSendProof() {
  if (!requireAuth("proof")) return;
  const task = selectedTask();
  if (!task) return;
  if (!task.beforePhotoPath) {
    showToast(t("noBeforePhoto"));
    return;
  }
  if (!state.proofAfterFile) {
    showToast(t("missingProof"));
    return;
  }
  try {
    await createSubmission({
      userId: state.session.user.id,
      taskId: task.id,
      beforePhotoPath: task.beforePhotoPath,
      afterFile: state.proofAfterFile
    });
    setPhotoFile("proofAfter", null);
    state.acceptedTaskId = null;
    await loadTasks();
    showToast(t("proofSent"));
    navigate("verify");
  } catch (err) {
    if (err.code === "23505" || /duplicate/i.test(err.message || "")) {
      showToast(t("taskTaken"));
      state.acceptedTaskId = null;
      await loadTasks();
    } else {
      showToast(err.message || String(err));
    }
  }
}

function handleTab(tab) {
  const routes = {
    Map: "map",
    Report: "report",
    Tasks: state.acceptedTaskId ? "proof" : "task",
    Profile: "profile"
  };
  const target = routes[tab] || "map";
  if ((target === "report" || target === "proof") && !requireAuth(target)) {
    return;
  }
  if (target === "profile") {
    refreshAuth().then(() => navigate("profile"));
    return;
  }
  navigate(target);
}

phone.addEventListener("change", (event) => {
  const input = event.target.closest("[data-photo-input]");
  if (!input || !input.files || !input.files[0]) return;
  const kind = input.dataset.photoInput;
  if (kind === "report") setPhotoFile("reportPhoto", input.files[0]);
  if (kind === "proofAfter") setPhotoFile("proofAfter", input.files[0]);
  render();
});

phone.addEventListener("click", (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (actionEl) {
    handleAction(actionEl.dataset.action);
    return;
  }

  const tabEl = event.target.closest("[data-tab]");
  if (tabEl) {
    handleTab(tabEl.dataset.tab);
    return;
  }

  const categoryEl = event.target.closest("[data-category]");
  if (categoryEl) {
    state.reportCategory = categoryEl.dataset.category;
    render();
    return;
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBanner.classList.add("is-visible");
});

document.getElementById("install-btn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBanner.classList.remove("is-visible");
});

document.getElementById("install-dismiss").addEventListener("click", () => {
  installBanner.classList.remove("is-visible");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

function setupInstallBanner() {
  document.getElementById("install-text").textContent = t("installBanner");
  document.getElementById("install-btn").textContent = t("install");
  document.getElementById("install-dismiss").textContent = t("later");
}

async function loadTasks() {
  state.userLocation = await requestUserLocation();
  try {
    state.tasks = await loadTasksFromSupabase(getSupabase(), state.userLocation);
  } catch (_) {
    state.tasks = filterPlayableTasks(
      sortByDistance(FALLBACK_ROWS.map((row) => normalizeTask(row, state.userLocation)))
    );
  }
  if (!state.tasks.find((task) => task.id === state.selectedTaskId)) {
    state.selectedTaskId = state.tasks[0]?.id || null;
  }
  if (state.acceptedTaskId && !state.tasks.find((task) => task.id === state.acceptedTaskId)) {
    state.acceptedTaskId = null;
  }
}

async function init() {
  if (state.onboardingDone) state.screen = "map";
  render();

  try {
    setupInstallBanner();
  } catch (_) {}

  try {
    figmaData = await loadFigmaTokens();
    applyFigmaTokens(figmaData);
  } catch (_) {
    figmaData = null;
  }

  await refreshAuth();
  render();

  try {
    await loadTasks();
  } catch (_) {
    state.tasks = filterPlayableTasks(
      sortByDistance(FALLBACK_ROWS.map((row) => normalizeTask(row, state.userLocation)))
    );
  }
  render();
}

init().catch((err) => {
  console.error("init failed", err);
  if (phone) {
    phone.innerHTML = `
      <section class="screen is-active">
        <div class="screen__body">
          <div class="card">
            <h2 class="card__title">Load error</h2>
            <p class="card__meta">${err.message || err}</p>
            <button type="button" class="btn btn--primary btn--block" style="margin-top:16px" onclick="location.reload()">Reload</button>
          </div>
        </div>
      </section>
    `;
  }
});
