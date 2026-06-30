import { TASKS, PROFILE, CAMPAIGN, REPORT_CATEGORIES } from "./data.js";
import { loadFigmaTokens, applyFigmaTokens, figmaScreenAsset } from "./figma.js";
import { DEV_MODE, t } from "./mvp-settings.js";

const state = {
  screen: "onboarding",
  tab: "Map",
  selectedTaskId: TASKS[0].id,
  reportCategory: REPORT_CATEGORIES[0],
  acceptedTaskId: null,
  onboardingDone: localStorage.getItem("cleanMapOnboarded") === "1",
  figmaOverlay: localStorage.getItem("cleanMapFigmaOverlay") === "1"
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

function selectedTask() {
  return TASKS.find((task) => task.id === state.selectedTaskId) || TASKS[0];
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2200);
}

function mapMarkup(options = {}) {
  const tall = options.tall ? " map-canvas--tall" : "";
  const pins = (options.pins || TASKS).map((task) => `
    <button type="button" class="map-pin map-pin--${task.pinColor}" data-task-id="${task.id}" style="left:${task.x}%;top:${task.y}%" aria-label="${task.title}">
      <span class="map-pin__glow"></span>
      <span class="map-pin__dot"></span>
      <span class="map-pin__label">${task.pinLabel}</span>
    </button>
  `).join("");

  return `
    <div class="map-canvas${tall}">
      <div class="map-canvas__park" style="width:190px;height:170px;left:10px;top:30px"></div>
      <div class="map-canvas__forest" style="width:130px;height:100px;left:40px;top:210px"></div>
      <div class="map-canvas__river" style="width:96px;height:380px;right:-10px;top:-40px"></div>
      <div class="map-canvas__road" style="width:318px;left:12px;top:76px;transform:rotate(4deg)"></div>
      <div class="map-canvas__road" style="width:300px;left:20px;top:200px;transform:rotate(-8deg)"></div>
      <div class="map-canvas__road" style="width:160px;left:108px;top:0;transform:rotate(72deg)"></div>
      <div class="map-canvas__road map-canvas__road--thin" style="width:350px;left:0;top:260px"></div>
      ${options.search ? `<div class="search-field">Search park, river, beach...</div>` : ""}
      ${pins}
    </div>
  `;
}

function renderHeader(meta) {
  return `
    <header class="header">
      <div class="header__row">
        <div>
          <h1 class="header__title">${meta.title}</h1>
          <p class="header__subtitle">${meta.subtitle}</p>
        </div>
        ${meta.tab === "Profile" || meta.tab === "Home" ? "" : `<div class="avatar" aria-hidden="true">A</div>`}
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
          <div class="hero__map">${mapMarkup({ pins: [TASKS[0], TASKS[1], TASKS[2]] })}</div>
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
  return `
    <section class="screen is-active" data-screen="map">
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
      ${renderHeader(screens.map)}
      <div class="screen__body screen__body--flush">
        <div style="padding:0 20px">${mapMarkup({ tall: true, search: true })}</div>
        <div class="sheet card">
          <p class="card__label">Nearest cleanup</p>
          <h2 class="card__title">${task.title}</h2>
          <p class="card__meta">${task.distance} away · ${task.severity} pollution · ${task.reward} pts</p>
          <div class="btn-row" style="margin-top:18px">
            <button type="button" class="btn btn--primary" data-action="open-task">View task</button>
            <button type="button" class="btn btn--secondary" data-action="go-report">Report new</button>
          </div>
        </div>
      </div>
      ${renderTabBar("Map")}
    </section>
  `;
}

function renderReport() {
  return `
    <section class="screen is-active" data-screen="report">
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
      ${renderHeader(screens.report)}
      <div class="screen__body">
        <div class="camera-preview" role="img" aria-label="Camera preview">
          <div class="camera-preview__placeholder"></div>
          <div class="camera-preview__hills"></div>
          <span class="camera-preview__label">Add photo</span>
          <span class="camera-preview__shutter"></span>
        </div>
        <div class="card" style="margin-top:16px">
          <p class="card__label" style="color:var(--green-dark)">Location detected</p>
          <h2 class="card__title">Northern Park, riverside path</h2>
          <p class="card__label" style="margin-top:18px">Pollution category</p>
          <div class="chip-row">
            ${REPORT_CATEGORIES.map((label) => `
              <button type="button" class="chip${state.reportCategory === label ? " is-active" : ""}" data-category="${label}">${label}</button>
            `).join("")}
          </div>
          <p class="card__meta" style="margin-top:16px">AI estimate: medium severity · suggested reward 240 pts</p>
          <button type="button" class="btn btn--primary btn--block" style="margin-top:18px" data-action="submit-report">Submit report</button>
        </div>
      </div>
      ${renderTabBar("Report")}
    </section>
  `;
}

function renderTask() {
  const task = selectedTask();
  return `
    <section class="screen is-active" data-screen="task">
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
      ${renderHeader({ ...screens.task, title: task.title.replace(" waste", " cleanup"), subtitle: `Estimated reward: ${task.reward} pts` })}
      <div class="screen__body">
        ${mapMarkup({ pins: [task] })}
        <div class="card" style="margin-top:16px">
          <p class="card__label severity--${task.severity}">${task.severityLabel}</p>
          <h2 class="card__title">${task.title}</h2>
          <p class="card__meta">Reported ${task.reported} · ${task.distance} away</p>
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
  return `
    <section class="screen is-active" data-screen="proof">
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
      ${renderHeader(screens.proof)}
      <div class="screen__body">
        <div class="photo-grid">
          <div class="photo-card photo-card--before"><strong>Before</strong><span class="photo-card__marker photo-card__marker--trash"></span></div>
          <div class="photo-card photo-card--after"><strong>After</strong><span class="photo-card__marker photo-card__marker--clean"></span></div>
        </div>
        <div class="card" style="margin-top:16px">
          <h2 class="card__title">Proof checklist</h2>
          <ul class="checklist">
            <li><span class="checklist__mark"></span>Same location</li>
            <li><span class="checklist__mark"></span>After photo uploaded</li>
            <li><span class="checklist__mark"></span>Waste removed</li>
            <li><span class="checklist__mark"></span>Ready for AI check</li>
          </ul>
          <button type="button" class="btn btn--primary btn--block" style="margin-top:18px" data-action="send-proof">Send for verification</button>
        </div>
      </div>
      ${renderTabBar("Tasks")}
    </section>
  `;
}

function renderVerify() {
  const task = selectedTask();
  return `
    <section class="screen is-active" data-screen="verify">
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
      ${renderHeader(screens.verify)}
      <div class="screen__body">
        <div class="success">
          <div class="success__glow"><div class="success__seal">OK</div></div>
          <p class="success__text">AI comparison matched the cleanup result.</p>
        </div>
        <div class="card" style="margin-top:16px">
          <p class="card__label">Reward received</p>
          <p class="card__title" style="font-size:34px;color:var(--green-dark)">+${task.reward} points</p>
          <p class="card__meta">New badge: Riverside Cleaner</p>
          <div class="btn-row" style="margin-top:18px">
            <button type="button" class="btn btn--primary" data-action="share">Share impact</button>
            <button type="button" class="btn btn--secondary" data-action="next-task">Next task</button>
          </div>
        </div>
      </div>
      ${renderTabBar("Tasks")}
    </section>
  `;
}

function renderProfile() {
  return `
    <section class="screen is-active" data-screen="profile">
      <div class="status-bar"><span>9:41</span><div class="status-bar__icons"><span class="status-bar__icon"></span><span class="status-bar__icon"></span><span class="status-bar__icon status-bar__icon--battery"></span></div></div>
      ${renderHeader(screens.profile)}
      <div class="screen__body">
        <div class="profile-head">
          <div class="avatar avatar--lg" aria-hidden="true">${PROFILE.name[0]}</div>
          <div>
            <h2>${PROFILE.name}</h2>
            <p>${PROFILE.level}</p>
          </div>
        </div>
        <div class="card" style="margin-top:24px">
          <div class="stats-grid">
            <div><strong>${PROFILE.cleanups}</strong><span>cleanups</span></div>
            <div><strong>${PROFILE.area}</strong><span>area covered</span></div>
            <div><strong>${PROFILE.points.toLocaleString()}</strong><span>points</span></div>
          </div>
        </div>
        <div class="card">
          <h2 class="card__title">Badges</h2>
          <div class="badge-grid">
            ${PROFILE.badges.map((badge, index) => `
              <div class="badge-item">
                <span class="badge-item__icon${index === 0 ? " is-earned" : ""}"></span>
                <span>${badge}</span>
              </div>
            `).join("")}
          </div>
        </div>
        <button type="button" class="btn btn--secondary btn--block" style="margin-top:16px" data-action="go-sponsor">View sponsor campaigns</button>
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
        ${mapMarkup()}
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

function render() {
  const initial = !state.onboardingDone && state.screen === "onboarding" ? "onboarding" : state.screen;
  if (!state.onboardingDone && state.screen === "map") state.screen = "onboarding";
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
      navigate("report");
      break;
    case "submit-report":
      showToast("Report submitted · AI estimate ready");
      state.selectedTaskId = TASKS[0].id;
      setTimeout(() => navigate("map"), 900);
      break;
    case "accept-task":
      if (state.acceptedTaskId !== selectedTask().id) {
        state.acceptedTaskId = selectedTask().id;
        showToast("Task accepted · good luck!");
        render();
      } else {
        navigate("proof");
      }
      break;
    case "send-proof":
      navigate("verify");
      break;
    case "share":
      if (navigator.share) {
        navigator.share({
          title: "Clean Map impact",
          text: `I just completed a cleanup and earned ${selectedTask().reward} points on Clean Map.`
        }).catch(() => showToast("Impact ready to share"));
      } else {
        showToast("Impact copied to clipboard");
      }
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

function handleTab(tab) {
  const routes = {
    Map: "map",
    Report: "report",
    Tasks: state.acceptedTaskId ? "proof" : "task",
    Profile: "profile"
  };
  navigate(routes[tab] || "map");
}

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

  const pinEl = event.target.closest("[data-task-id]");
  if (pinEl) {
    navigate("task", { taskId: pinEl.dataset.taskId });
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

async function init() {
  setupInstallBanner();
  try {
    figmaData = await loadFigmaTokens();
    applyFigmaTokens(figmaData);
  } catch (_) {
    figmaData = null;
  }
  if (state.onboardingDone) state.screen = "map";
  render();
}

init();
