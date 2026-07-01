import { FALLBACK_ROWS, CAMPAIGN, REPORT_CATEGORIES } from "./data.js";
import { loadFigmaTokens, applyFigmaTokens, figmaScreenAsset } from "./figma.js";
import { DEV_MODE, MVP, appLocale, t } from "./mvp-settings.js";
import { getSupabase } from "./supabase-client.js";
import { loadTasksFromSupabase, normalizeTask, requestUserLocation, sortByDistance } from "./tasks-api.js";
import { destroyMaps, mountLeafletMap } from "./leaflet-map.js";
import { getSession, loadProfile, signIn, signUp, signOut } from "./auth.js";
import { createReport, createSubmission } from "./reports-api.js";

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
  proofBeforeFile: null,
  proofBeforeUrl: null,
  proofAfterFile: null,
  proofAfterUrl: null
};

let figmaData = null;

const screens = {
  onboarding: { title: "Clean Map", subtitle: "Turn polluted places into cleanup quests.", tab: "Home", hideTabs: true },
  map: { title: "Nearby cleanup tasks", subtitle: "3 tasks within 1.2 km", tab: "Map" },
  report: { title: "Report a polluted place", subtitle: "Photo, location, AI estimate", tab: "Report" },
  task: { title: "Riverside cleanup", subtitle: "Estimated reward: 240 pts", tab: "Tasks" },
  proof: { title: "Upload cleanup proof", subtitle: "Before and after comparison", tab: "Tasks" },
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
    return locale === "ru" ? `Нет задач · ${MVP.pilotCityRu}` : `No tasks · ${MVP.pilotCity}`;
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
  state.session = await getSession();
  if (state.session) {
    state.profile = await loadProfile(state.session.user.id);
  } else {
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

function renderHeader(meta) {
  return `
    <header class="header">
      <div class="header__row">
        <div>
          <h1 class="header__title">${meta.title}</h1>
          <p class="header__subtitle">${meta.subtitle}</p>
        </div>
        ${meta.tab === "Profile" || meta.tab === "Home" ? "" : `<div class="avatar" aria-hidden="true">${profileInitial()}</div>`}
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
          <span>${label}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderOnboarding() {
  return `
    <section class="screen screen--no-tabs is-active" data-screen="onboarding">
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
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
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
      ${renderHeader({ ...screens.map, subtitle: mapSubtitle() })}
      <div class="screen__body screen__body--flush">
        <div style="padding:0 20px">
          <div class="map-wrap">
            ${mapContainer({ tall: true, fit: true })}
            <div class="search-field">${locale === "ru" ? "Парк, река, набережная…" : "Search park, river, beach..."}</div>
          </div>
        </div>
        ${task ? `
        <div class="sheet card">
          <p class="card__label">${locale === "ru" ? "Ближайшая уборка" : "Nearest cleanup"}</p>
          <h2 class="card__title">${task.title}</h2>
          <p class="card__meta">${task.distance} · ${task.severity} · ${task.reward} pts</p>
          <div class="btn-row" style="margin-top:18px">
            <button type="button" class="btn btn--primary" data-action="open-task">${locale === "ru" ? "Открыть задачу" : "View task"}</button>
            <button type="button" class="btn btn--secondary" data-action="go-report">${locale === "ru" ? "Сообщить" : "Report new"}</button>
          </div>
        </div>` : ""}
      </div>
      ${renderTabBar("Map")}
    </section>
  `;
}

function renderAuth() {
  const locale = appLocale();
  const register = state.authMode === "register";
  return `
    <section class="screen screen--no-tabs is-active" data-screen="auth">
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
      ${renderHeader({
        title: "Clean Map",
        subtitle: register
          ? (locale === "ru" ? "Создайте аккаунт" : "Create your account")
          : (locale === "ru" ? "Войдите в аккаунт" : "Sign in to your account"),
        tab: "Home"
      })}
      <div class="screen__body">
        <div class="card">
          <form class="auth-form" data-auth-form>
            <div class="auth-field">
              <label for="auth-username">${t("name")}</label>
              <input id="auth-username" name="username" autocomplete="username" required minlength="2" maxlength="32">
            </div>
            <div class="auth-field">
              <label for="auth-password">${t("password")}</label>
              <input id="auth-password" name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" required minlength="6">
            </div>
            <button type="button" class="btn btn--primary btn--block" data-action="auth-submit">${register ? t("signUp") : t("signIn")}</button>
          </form>
          <p class="auth-toggle">
            ${register ? (locale === "ru" ? "Уже есть аккаунт?" : "Have an account?") : (locale === "ru" ? "Нет аккаунта?" : "No account?")}
            <button type="button" data-action="auth-toggle">${register ? t("signIn") : t("signUp")}</button>
          </p>
          <button type="button" class="btn btn--secondary btn--block" style="margin-top:12px" data-action="auth-skip">${locale === "ru" ? "Карта без входа" : "Browse map as guest"}</button>
        </div>
      </div>
    </section>
  `;
}

function renderReport() {
  const locale = appLocale();
  return `
    <section class="screen is-active" data-screen="report">
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
      ${renderHeader(screens.report)}
      <div class="screen__body">
        <label class="camera-preview camera-preview--live">
          <input type="file" accept="image/*" capture="environment" data-photo-input="report" hidden>
          ${state.reportPhotoUrl
            ? `<img src="${state.reportPhotoUrl}" alt="">`
            : `<div class="camera-preview__placeholder"></div>
               <div class="camera-preview__hills"></div>
               <span class="camera-preview__label">${t("addPhoto")}</span>
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
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
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
  return `
    <section class="screen is-active" data-screen="proof">
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
      ${renderHeader(screens.proof)}
      <div class="screen__body">
        <div class="photo-grid">
          <div class="photo-card photo-card--before">
            <strong>Before</strong>
            <label>
              <input type="file" accept="image/*" capture="environment" data-photo-input="proofBefore">
              ${state.proofBeforeUrl ? `<img class="photo-card__img" src="${state.proofBeforeUrl}" alt="">` : `<span class="photo-card__marker photo-card__marker--trash"></span>`}
            </label>
          </div>
          <div class="photo-card photo-card--after">
            <strong>After</strong>
            <label>
              <input type="file" accept="image/*" capture="environment" data-photo-input="proofAfter">
              ${state.proofAfterUrl ? `<img class="photo-card__img" src="${state.proofAfterUrl}" alt="">` : `<span class="photo-card__marker photo-card__marker--clean"></span>`}
            </label>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <h2 class="card__title">${locale === "ru" ? "Чеклист" : "Proof checklist"}</h2>
          <ul class="checklist">
            <li><span class="checklist__mark"></span>${locale === "ru" ? "Та же локация" : "Same location"}</li>
            <li><span class="checklist__mark"></span>${locale === "ru" ? "Фото «после»" : "After photo uploaded"}</li>
            <li><span class="checklist__mark"></span>${locale === "ru" ? "Мусор убран" : "Waste removed"}</li>
            <li><span class="checklist__mark"></span>${locale === "ru" ? "На проверку" : "Ready for review"}</li>
          </ul>
          <button type="button" class="btn btn--primary btn--block" style="margin-top:18px" data-action="send-proof">${locale === "ru" ? "Отправить на проверку" : "Send for verification"}</button>
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
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
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

function renderProfile() {
  const locale = appLocale();
  const name = state.profile?.display_name || (locale === "ru" ? "Гость" : "Guest");
  const points = state.profile?.points ?? 0;
  const cleanups = state.profile?.cleanups ?? 0;
  return `
    <section class="screen is-active" data-screen="profile">
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
      ${renderHeader(screens.profile)}
      <div class="screen__body">
        <div class="profile-head">
          <div class="avatar avatar--lg" aria-hidden="true">${name.charAt(0).toUpperCase()}</div>
          <div>
            <h2>${name}</h2>
            <p>${state.session ? (locale === "ru" ? "Участник Clean Map" : "Clean Map member") : (locale === "ru" ? "Гость" : "Guest")}</p>
          </div>
        </div>
        <div class="card" style="margin-top:24px">
          <div class="stats-grid">
            <div><strong>${cleanups}</strong><span>${locale === "ru" ? "уборок" : "cleanups"}</span></div>
            <div><strong>${MVP.pilotCityRu.slice(0, 4)}</strong><span>${locale === "ru" ? "пилот" : "pilot"}</span></div>
            <div><strong>${points.toLocaleString()}</strong><span>points</span></div>
          </div>
        </div>
        ${state.session ? `
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
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
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

function navigate(screen, options = {}) {
  if (options.taskId) state.selectedTaskId = options.taskId;
  state.screen = screen;
  if (options.persistOnboarding && screen !== "onboarding") {
    localStorage.setItem("cleanMapOnboarded", "1");
    state.onboardingDone = true;
  }
  render();
}

function resolveScreen() {
  if (!state.onboardingDone && state.screen === "onboarding") return "onboarding";
  if (!state.onboardingDone && state.screen === "map") return "onboarding";
  if (!state.session && ["report", "proof"].includes(state.screen)) return "auth";
  return state.screen;
}

function render() {
  const initial = resolveScreen();
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
    ${renderers[initial]()}
  `;
  requestAnimationFrame(() => mountActiveMaps());
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
      if (state.acceptedTaskId !== selectedTask()?.id) {
        state.acceptedTaskId = selectedTask().id;
        showToast(appLocale() === "ru" ? "Задача принята" : "Task accepted · good luck!");
        render();
      } else {
        navigate("proof");
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
  const username = form.username.value.trim();
  const password = form.password.value;
  try {
    if (state.authMode === "register") {
      await signUp(username, password);
    } else {
      await signIn(username, password);
    }
    await refreshAuth();
    showToast(appLocale() === "ru" ? "Вы вошли" : "Signed in");
    navigate(state.authReturn || "map");
  } catch (err) {
    showToast(err.message || String(err));
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
  if (!state.proofBeforeFile || !state.proofAfterFile) {
    showToast(t("missingProof"));
    return;
  }
  try {
    await createSubmission({
      userId: state.session.user.id,
      taskId: task.id,
      beforeFile: state.proofBeforeFile,
      afterFile: state.proofAfterFile
    });
    setPhotoFile("proofBefore", null);
    setPhotoFile("proofAfter", null);
    showToast(t("proofSent"));
    navigate("verify");
  } catch (err) {
    showToast(err.message || String(err));
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
  navigate(target);
}

phone.addEventListener("change", (event) => {
  const input = event.target.closest("[data-photo-input]");
  if (!input || !input.files || !input.files[0]) return;
  const kind = input.dataset.photoInput;
  if (kind === "report") setPhotoFile("reportPhoto", input.files[0]);
  if (kind === "proofBefore") setPhotoFile("proofBefore", input.files[0]);
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
    state.tasks = sortByDistance(
      FALLBACK_ROWS.map((row) => normalizeTask(row, state.userLocation))
    );
  }
  if (state.tasks[0] && !state.selectedTaskId) {
    state.selectedTaskId = state.tasks[0].id;
  }
}

async function init() {
  setupInstallBanner();
  try {
    figmaData = await loadFigmaTokens();
    applyFigmaTokens(figmaData);
  } catch (_) {
    figmaData = null;
  }
  await refreshAuth();
  await loadTasks();
  if (state.onboardingDone) state.screen = "map";
  render();
}

init();
