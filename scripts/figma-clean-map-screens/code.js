/**
 * Clean Map - MVP mobile app templates.
 * Visual direction: soft East Asian pastoral storybook UI.
 *
 * Figma workflow (Clean Map App):
 * 1. Figma → New design file → rename to "Clean Map App"
 * 2. Plugins → Development → Import plugin from manifest…
 *    → scripts/figma-clean-map-screens/manifest.json
 *    → Run "Clean Map - MVP Mobile Screens" (creates 8 frames)
 * 3. Import scripts/figma-clean-map-export/manifest.json
 *    → Run "Clean Map — Export for PWA"
 *    → Inspect file → Export config + tokens → Export PNG screens
 * 4. Save clean-map-figma.config.json → scripts/
 *    Save PNGs → assets/clean-map/figma-export/
 *    Save figma-tokens.json → app/js/ (optional)
 * 5. CLI re-export (optional):
 *    set FIGMA_ACCESS_TOKEN=figd_...
 *    node scripts/export-clean-map-figma.mjs
 */

const APP_PREFIX = "Clean Map - ";
const W = 390;
const H = 844;
const GAP = 36;
const COLS = 4;
const STATUS_H = 44;
const TAB_H = 76;
const RADIUS = 36;

const COLORS = {
  bg: "#20372f",
  surface: "#2f4b3c",
  surface2: "#476a50",
  card: "#fff7e8",
  cardMuted: "#f4ead2",
  text: "#24362d",
  muted: "#75806f",
  white: "#ffffff",
  green: "#6fa36f",
  greenDark: "#3f6f4c",
  lime: "#d8e6a3",
  amber: "#d9955f",
  red: "#c96d5a",
  blue: "#91c9cf",
  border: "#e6d9bd",
  paper: "#fffaf0",
  peach: "#f1b58f",
  moss: "#6f8f63",
  mist: "#d8e6df"
};

const SCREENS = [
  {
    name: "01 Onboarding",
    title: "Clean Map",
    subtitle: "Turn polluted places into cleanup quests.",
    tab: "Home"
  },
  {
    name: "02 Map",
    title: "Nearby cleanup tasks",
    subtitle: "3 tasks within 1.2 km",
    tab: "Map"
  },
  {
    name: "03 Report Pollution",
    title: "Report a polluted place",
    subtitle: "Photo, location, AI estimate",
    tab: "Report"
  },
  {
    name: "04 Task Details",
    title: "Riverside cleanup",
    subtitle: "Estimated reward: 240 pts",
    tab: "Tasks"
  },
  {
    name: "05 Upload Proof",
    title: "Upload cleanup proof",
    subtitle: "Before and after comparison",
    tab: "Tasks"
  },
  {
    name: "06 AI Verification",
    title: "Cleanup verified",
    subtitle: "Reward unlocked",
    tab: "Tasks"
  },
  {
    name: "07 Profile Rewards",
    title: "Your impact",
    subtitle: "12 cleanups completed",
    tab: "Profile"
  },
  {
    name: "08 Sponsor View",
    title: "Fund local cleanups",
    subtitle: "Sponsor visible impact",
    tab: "Sponsor"
  }
];

function hex(value) {
  const n = parseInt(value.replace("#", ""), 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255
  };
}

function solid(color, opacity) {
  return [{ type: "SOLID", color: hex(color), opacity: opacity == null ? 1 : opacity }];
}

function shadow(alpha, y, radius) {
  return [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: alpha },
      offset: { x: 0, y: y },
      radius: radius,
      visible: true,
      blendMode: "NORMAL"
    }
  ];
}

async function loadFonts() {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
}

function removePreviousScreens(page) {
  const nodes = page.findAll(function (node) {
    return node.type === "FRAME" && node.name.indexOf(APP_PREFIX) === 0;
  });
  nodes.forEach(function (node) {
    node.remove();
  });
  return nodes.length;
}

function createFrame(parent, opts) {
  const frame = figma.createFrame();
  frame.name = opts.name || "Frame";
  frame.resize(opts.w, opts.h);
  frame.x = opts.x || 0;
  frame.y = opts.y || 0;
  frame.cornerRadius = opts.radius || 0;
  frame.clipsContent = !!opts.clip;
  frame.fills = opts.fill ? solid(opts.fill, opts.opacity) : [];
  if (opts.stroke) {
    frame.strokes = solid(opts.stroke, opts.strokeOpacity == null ? 1 : opts.strokeOpacity);
    frame.strokeWeight = opts.strokeWeight || 1;
  }
  if (opts.shadow) frame.effects = opts.shadow;
  parent.appendChild(frame);
  return frame;
}

function createRect(parent, opts) {
  const rect = figma.createRectangle();
  rect.name = opts.name || "Rectangle";
  rect.resize(opts.w, opts.h);
  rect.x = opts.x || 0;
  rect.y = opts.y || 0;
  rect.cornerRadius = opts.radius || 0;
  rect.fills = solid(opts.fill || COLORS.white, opts.opacity);
  if (opts.stroke) {
    rect.strokes = solid(opts.stroke, opts.strokeOpacity == null ? 1 : opts.strokeOpacity);
    rect.strokeWeight = opts.strokeWeight || 1;
  }
  parent.appendChild(rect);
  return rect;
}

function createLine(parent, x1, y1, x2, y2, color, opacity, weight) {
  const line = figma.createLine();
  line.name = "Map road";
  line.x = x1;
  line.y = y1;
  line.resize(Math.max(1, Math.abs(x2 - x1)), 0);
  line.rotation = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  line.strokes = solid(color, opacity);
  line.strokeWeight = weight || 3;
  parent.appendChild(line);
  return line;
}

function createText(parent, opts) {
  const text = figma.createText();
  text.name = opts.name || "Text";
  text.fontName = { family: "Inter", style: opts.weight || "Regular" };
  text.characters = opts.text || "";
  text.fontSize = opts.size || 14;
  text.lineHeight = { unit: "PIXELS", value: opts.lineHeight || Math.round((opts.size || 14) * 1.35) };
  text.fills = solid(opts.color || COLORS.text, opts.opacity);
  text.x = opts.x || 0;
  text.y = opts.y || 0;
  if (opts.w) text.resize(opts.w, text.height);
  parent.appendChild(text);
  return text;
}

function createStatusBar(parent) {
  const bar = createFrame(parent, { name: "Status bar", w: W, h: STATUS_H, fill: COLORS.bg, opacity: 0.72 });
  createText(bar, { text: "9:41", size: 14, weight: "Semi Bold", color: COLORS.paper, x: 24, y: 14 });
  createRect(bar, { name: "Signal", w: 16, h: 8, x: W - 72, y: 18, radius: 2, fill: COLORS.paper, opacity: 0.7 });
  createRect(bar, { name: "WiFi", w: 14, h: 8, x: W - 50, y: 18, radius: 2, fill: COLORS.paper, opacity: 0.7 });
  createRect(bar, { name: "Battery", w: 22, h: 8, x: W - 28, y: 18, radius: 2, fill: COLORS.paper, opacity: 0.9 });
}

function createHeader(parent, spec) {
  const header = createFrame(parent, { name: "Header", w: W, h: 110, y: STATUS_H, fill: COLORS.bg, opacity: 0.62 });
  createText(header, { text: spec.title, size: 22, weight: "Semi Bold", color: COLORS.paper, x: 20, y: 18, w: 260 });
  createText(header, { text: spec.subtitle, size: 13, color: "#d6dfc7", x: 20, y: 52, w: 260 });
  createRect(header, { name: "Avatar", w: 42, h: 42, x: W - 62, y: 18, radius: 21, fill: COLORS.peach, stroke: COLORS.paper, strokeOpacity: 0.6 });
  createText(header, { text: "A", size: 16, weight: "Semi Bold", color: COLORS.text, x: W - 49, y: 29 });
}

function createTabBar(parent, active) {
  const tab = createFrame(parent, {
    name: "Bottom navigation",
    w: W,
    h: TAB_H,
    y: H - TAB_H,
    fill: COLORS.paper,
    stroke: COLORS.border
  });
  const items = ["Map", "Report", "Tasks", "Profile"];
  items.forEach(function (label, i) {
    const x = i * (W / 4);
    const isActive = active === label || (active === "Home" && label === "Map") || (active === "Sponsor" && label === "Tasks");
    createRect(tab, {
      name: label + " icon",
      w: 24,
      h: 24,
      x: x + 37,
      y: 14,
      radius: 12,
      fill: isActive ? COLORS.green : "#ded6bd"
    });
    createText(tab, {
      text: label,
      size: 11,
      weight: isActive ? "Semi Bold" : "Regular",
      color: isActive ? COLORS.greenDark : COLORS.muted,
      x: x + 20,
      y: 44,
      w: 58
    });
  });
}

function createButton(parent, label, x, y, w, fill, textColor) {
  const btn = createFrame(parent, {
    name: "Button - " + label,
    w: w,
    h: 48,
    x: x,
    y: y,
    radius: 18,
    fill: fill || COLORS.green,
    shadow: shadow(0.1, 7, 14)
  });
  createText(btn, {
    text: label,
    size: 14,
    weight: "Semi Bold",
    color: textColor || COLORS.white,
    x: 18,
    y: 15,
    w: w - 36
  });
  return btn;
}

function createCard(parent, opts) {
  const card = createFrame(parent, {
    name: opts.name || "Card",
    w: opts.w || 350,
    h: opts.h || 120,
    x: opts.x == null ? 20 : opts.x,
    y: opts.y || 0,
    radius: opts.radius || 22,
    fill: opts.fill || COLORS.card,
    stroke: opts.stroke || COLORS.border,
    shadow: opts.shadow === false ? null : shadow(0.07, 8, 18)
  });
  return card;
}

function createBackdrop(parent) {
  createRect(parent, { name: "Warm dusk wash", w: W + 120, h: 260, x: -60, y: 40, radius: 120, fill: "#eabf87", opacity: 0.12 });
  createRect(parent, { name: "Misty hill back", w: W + 80, h: 190, x: -40, y: 500, radius: 95, fill: "#91b986", opacity: 0.24 });
  createRect(parent, { name: "Misty hill front", w: W + 120, h: 210, x: -80, y: 570, radius: 105, fill: "#5f815a", opacity: 0.3 });
  createRect(parent, { name: "Small moon", w: 76, h: 76, x: 278, y: 116, radius: 38, fill: "#f8dfaf", opacity: 0.34 });
  createRect(parent, { name: "Tiny cloud 1", w: 70, h: 24, x: 36, y: 128, radius: 12, fill: COLORS.paper, opacity: 0.18 });
  createRect(parent, { name: "Tiny cloud 2", w: 96, h: 28, x: 216, y: 318, radius: 14, fill: COLORS.paper, opacity: 0.16 });
}

function createPhoneShell(spec, index) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const shell = createFrame(figma.currentPage, {
    name: APP_PREFIX + spec.name,
    w: W,
    h: H,
    x: col * (W + GAP),
    y: row * (H + GAP),
    radius: RADIUS,
    fill: COLORS.bg,
    stroke: "#b7d6a6",
    strokeOpacity: 0.7,
    strokeWeight: 2,
    clip: true,
    shadow: shadow(0.2, 20, 36)
  });
  createBackdrop(shell);
  createStatusBar(shell);
  createHeader(shell, spec);
  return shell;
}

function addMap(parent, x, y, w, h) {
  const map = createFrame(parent, { name: "Watercolor map canvas", w: w, h: h, x: x, y: y, radius: 32, fill: "#edf0d6", stroke: COLORS.border, clip: true });
  createRect(map, { name: "Park wash", w: 190, h: 170, x: 10, y: 30, radius: 62, fill: "#b8d79d", opacity: 0.82 });
  createRect(map, { name: "Forest patch", w: 130, h: 100, x: 40, y: 210, radius: 50, fill: "#88ad78", opacity: 0.58 });
  createRect(map, { name: "River wash", w: 96, h: 380, x: 248, y: -40, radius: 52, fill: COLORS.blue, opacity: 0.78 });
  createLine(map, 12, 76, 330, 102, COLORS.paper, 0.86, 11);
  createLine(map, 20, 200, 320, 166, COLORS.paper, 0.86, 10);
  createLine(map, 108, 0, 168, 300, COLORS.paper, 0.82, 8);
  createLine(map, 0, 260, 350, 236, "#c9b98f", 0.52, 3);
  addPin(map, 98, 92, COLORS.red, "High");
  addPin(map, 250, 146, COLORS.amber, "Med");
  addPin(map, 180, 236, COLORS.green, "Done");
  return map;
}

function addPin(parent, x, y, color, label) {
  createRect(parent, { name: "Task pin glow", w: 38, h: 38, x: x - 7, y: y - 7, radius: 19, fill: color, opacity: 0.18 });
  createRect(parent, { name: "Task pin", w: 24, h: 24, x: x, y: y, radius: 12, fill: color, stroke: COLORS.paper, strokeWeight: 3 });
  createText(parent, { text: label, size: 10, weight: "Semi Bold", color: COLORS.text, x: x - 8, y: y + 30, w: 54 });
}

function buildOnboarding(shell) {
  const hero = createFrame(shell, { name: "Storybook hero illustration", w: 290, h: 290, x: 50, y: 184, radius: 145, fill: "#f2d9aa", stroke: COLORS.paper, strokeOpacity: 0.5 });
  createRect(hero, { name: "Forest ring", w: 250, h: 250, x: 20, y: 20, radius: 125, fill: "#6f8f63", opacity: 0.18 });
  addMap(hero, 25, 40, 240, 190);
  createRect(hero, { name: "Clean area glow", w: 84, h: 84, x: 104, y: 96, radius: 42, fill: COLORS.green, opacity: 0.3 });
  createText(shell, { text: "Find polluted places. Clean them. Get rewarded.", size: 28, weight: "Semi Bold", color: COLORS.paper, x: 24, y: 506, w: 330, lineHeight: 36 });
  createText(shell, { text: "A mobile map that turns real-world cleanup into verified local quests.", size: 15, color: "#d6dfc7", x: 24, y: 610, w: 320, lineHeight: 22 });
  createButton(shell, "Start exploring", 24, 694, 342, COLORS.green);
  createTabBar(shell, "Home");
}

function buildMapScreen(shell) {
  addMap(shell, 20, 168, 350, 420);
  const search = createFrame(shell, { name: "Search field", w: 318, h: 44, x: 36, y: 184, radius: 22, fill: COLORS.white, shadow: shadow(0.08, 8, 18) });
  createText(search, { text: "Search park, river, beach...", size: 13, color: COLORS.muted, x: 18, y: 13, w: 230 });
  const sheet = createCard(shell, { name: "Nearby task sheet", h: 180, y: 566 });
  createText(sheet, { text: "Nearest cleanup", size: 13, weight: "Semi Bold", color: COLORS.muted, x: 18, y: 18 });
  createText(sheet, { text: "Riverside plastic waste", size: 19, weight: "Semi Bold", color: COLORS.text, x: 18, y: 44, w: 230 });
  createText(sheet, { text: "0.8 km away - medium pollution - 240 pts", size: 13, color: COLORS.muted, x: 18, y: 76, w: 280 });
  createButton(sheet, "View task", 18, 112, 150, COLORS.green);
  createButton(sheet, "Report new", 182, 112, 148, COLORS.cardMuted, COLORS.greenDark);
  createTabBar(shell, "Map");
}

function buildReportScreen(shell) {
  const camera = createFrame(shell, { name: "Camera preview", w: 350, h: 250, x: 20, y: 170, radius: 32, fill: "#6c806e", stroke: COLORS.paper, strokeOpacity: 0.42, clip: true });
  createRect(camera, { name: "Photo placeholder", w: 270, h: 170, x: 40, y: 40, radius: 28, fill: "#d7c39e", opacity: 0.5 });
  createRect(camera, { name: "Hills in preview", w: 300, h: 90, x: 24, y: 128, radius: 45, fill: COLORS.moss, opacity: 0.42 });
  createText(camera, { text: "Add photo", size: 26, weight: "Semi Bold", color: COLORS.paper, x: 100, y: 100 });
  createRect(camera, { name: "Camera action", w: 70, h: 70, x: 140, y: 165, radius: 35, fill: COLORS.paper, stroke: COLORS.peach, strokeOpacity: 0.7, strokeWeight: 2 });
  const form = createCard(shell, { name: "Report form", h: 260, y: 444 });
  createText(form, { text: "Location detected", size: 12, weight: "Semi Bold", color: COLORS.greenDark, x: 18, y: 18 });
  createText(form, { text: "Northern Park, riverside path", size: 16, weight: "Semi Bold", color: COLORS.text, x: 18, y: 42, w: 250 });
  createText(form, { text: "Pollution category", size: 12, color: COLORS.muted, x: 18, y: 84 });
  ["Plastic", "Glass", "Mixed"].forEach(function (label, i) {
    createButton(form, label, 18 + i * 104, 110, 94, i === 0 ? COLORS.green : COLORS.cardMuted, i === 0 ? COLORS.white : COLORS.greenDark);
  });
  createText(form, { text: "AI estimate: medium severity - suggested reward 240 pts", size: 13, color: COLORS.muted, x: 18, y: 176, w: 280 });
  createButton(form, "Submit report", 18, 208, 314, COLORS.green);
  createTabBar(shell, "Report");
}

function buildTaskDetails(shell) {
  addMap(shell, 20, 168, 350, 230);
  const details = createCard(shell, { name: "Task details", h: 330, y: 420 });
  createText(details, { text: "Medium pollution", size: 12, weight: "Semi Bold", color: COLORS.amber, x: 18, y: 18 });
  createText(details, { text: "Riverside plastic waste", size: 23, weight: "Semi Bold", color: COLORS.text, x: 18, y: 44, w: 260, lineHeight: 30 });
  createText(details, { text: "Reported 18 min ago - 0.8 km away", size: 13, color: COLORS.muted, x: 18, y: 104, w: 250 });
  createText(details, { text: "Reward", size: 12, color: COLORS.muted, x: 18, y: 146 });
  createText(details, { text: "240 points + Riverside badge", size: 17, weight: "Semi Bold", color: COLORS.greenDark, x: 18, y: 168, w: 280 });
  createText(details, { text: "Checklist: bring gloves, collect visible plastic, upload after photo from same location.", size: 13, color: COLORS.muted, x: 18, y: 210, w: 300, lineHeight: 20 });
  createButton(details, "Accept task", 18, 270, 314, COLORS.green);
  createTabBar(shell, "Tasks");
}

function buildUploadProof(shell) {
  const before = createFrame(shell, { name: "Before photo", w: 166, h: 210, x: 20, y: 170, radius: 28, fill: "#6d7058", stroke: COLORS.paper, strokeOpacity: 0.38, clip: true });
  const after = createFrame(shell, { name: "After photo", w: 166, h: 210, x: 204, y: 170, radius: 28, fill: "#edf0d6", stroke: COLORS.paper, strokeOpacity: 0.5, clip: true });
  createText(before, { text: "Before", size: 14, weight: "Semi Bold", color: COLORS.paper, x: 18, y: 18 });
  createText(after, { text: "After", size: 14, weight: "Semi Bold", color: COLORS.greenDark, x: 18, y: 18 });
  createRect(before, { name: "Trash marker", w: 72, h: 36, x: 48, y: 98, radius: 16, fill: COLORS.red, opacity: 0.62 });
  createRect(after, { name: "Clean ground", w: 110, h: 54, x: 28, y: 96, radius: 24, fill: COLORS.green, opacity: 0.25 });
  const card = createCard(shell, { name: "Upload checklist", h: 280, y: 408 });
  createText(card, { text: "Proof checklist", size: 18, weight: "Semi Bold", color: COLORS.text, x: 18, y: 20 });
  ["Same location", "After photo uploaded", "Waste removed", "Ready for AI check"].forEach(function (label, i) {
    createRect(card, { name: "Check", w: 22, h: 22, x: 18, y: 62 + i * 38, radius: 11, fill: COLORS.green });
    createText(card, { text: label, size: 14, color: COLORS.text, x: 52, y: 64 + i * 38 });
  });
  createButton(card, "Send for verification", 18, 214, 314, COLORS.green);
  createTabBar(shell, "Tasks");
}

function buildVerification(shell) {
  createRect(shell, { name: "Success glow", w: 250, h: 250, x: 70, y: 176, radius: 125, fill: COLORS.lime, opacity: 0.18 });
  createRect(shell, { name: "Success seal", w: 128, h: 128, x: 131, y: 232, radius: 64, fill: COLORS.peach, stroke: COLORS.paper, strokeOpacity: 0.65, strokeWeight: 3 });
  createText(shell, { text: "OK", size: 34, weight: "Semi Bold", color: COLORS.text, x: 168, y: 274 });
  createText(shell, { text: "AI comparison matched the cleanup result.", size: 15, color: "#d6dfc7", x: 52, y: 402, w: 286, lineHeight: 22 });
  const reward = createCard(shell, { name: "Reward card", h: 210, y: 470 });
  createText(reward, { text: "Reward received", size: 13, weight: "Semi Bold", color: COLORS.muted, x: 18, y: 20 });
  createText(reward, { text: "+240 points", size: 34, weight: "Semi Bold", color: COLORS.greenDark, x: 18, y: 52 });
  createText(reward, { text: "New badge: Riverside Cleaner", size: 15, color: COLORS.text, x: 18, y: 104 });
  createButton(reward, "Share impact", 18, 144, 150, COLORS.green);
  createButton(reward, "Next task", 182, 144, 148, COLORS.cardMuted, COLORS.greenDark);
  createTabBar(shell, "Tasks");
}

function buildProfile(shell) {
  createRect(shell, { name: "Profile avatar", w: 86, h: 86, x: 24, y: 176, radius: 43, fill: COLORS.peach, stroke: COLORS.paper, strokeOpacity: 0.56, strokeWeight: 2 });
  createText(shell, { text: "Alice", size: 24, weight: "Semi Bold", color: COLORS.paper, x: 128, y: 184 });
  createText(shell, { text: "Level 4 - Local Cleaner", size: 14, color: "#d6dfc7", x: 128, y: 222 });
  const stats = createCard(shell, { name: "Impact stats", h: 136, y: 292 });
  [["12", "cleanups"], ["3.8km", "area covered"], ["2,840", "points"]].forEach(function (item, i) {
    createText(stats, { text: item[0], size: 22, weight: "Semi Bold", color: COLORS.greenDark, x: 24 + i * 104, y: 34 });
    createText(stats, { text: item[1], size: 12, color: COLORS.muted, x: 24 + i * 104, y: 70, w: 80 });
  });
  const badges = createCard(shell, { name: "Badges", h: 230, y: 452 });
  createText(badges, { text: "Badges", size: 18, weight: "Semi Bold", color: COLORS.text, x: 18, y: 20 });
  ["Riverside", "Park Hero", "First Report", "Team Sprint"].forEach(function (label, i) {
    const x = 22 + (i % 2) * 154;
    const y = 62 + Math.floor(i / 2) * 72;
    createRect(badges, { name: label + " badge", w: 48, h: 48, x: x, y: y, radius: 24, fill: i === 0 ? COLORS.green : COLORS.cardMuted });
    createText(badges, { text: label, size: 12, weight: "Medium", color: COLORS.text, x: x + 60, y: y + 16, w: 78 });
  });
  createTabBar(shell, "Profile");
}

function buildSponsor(shell) {
  addMap(shell, 20, 168, 350, 250);
  const campaign = createCard(shell, { name: "Campaign card", h: 300, y: 444 });
  createText(campaign, { text: "Sponsor campaign", size: 13, weight: "Semi Bold", color: COLORS.muted, x: 18, y: 20 });
  createText(campaign, { text: "Clean Northern Park", size: 23, weight: "Semi Bold", color: COLORS.text, x: 18, y: 48, w: 260, lineHeight: 30 });
  createText(campaign, { text: "Fund 14 open cleanup tasks around the riverside path and playground.", size: 13, color: COLORS.muted, x: 18, y: 112, w: 286, lineHeight: 20 });
  createRect(campaign, { name: "Progress bg", w: 314, h: 12, x: 18, y: 172, radius: 6, fill: COLORS.cardMuted });
  createRect(campaign, { name: "Progress", w: 198, h: 12, x: 18, y: 172, radius: 6, fill: COLORS.green });
  createText(campaign, { text: "$420 funded of $650", size: 13, weight: "Semi Bold", color: COLORS.greenDark, x: 18, y: 198 });
  createButton(campaign, "Fund campaign", 18, 236, 314, COLORS.green);
  createTabBar(shell, "Sponsor");
}

function buildScreen(spec, index) {
  const shell = createPhoneShell(spec, index);
  if (index === 0) buildOnboarding(shell);
  if (index === 1) buildMapScreen(shell);
  if (index === 2) buildReportScreen(shell);
  if (index === 3) buildTaskDetails(shell);
  if (index === 4) buildUploadProof(shell);
  if (index === 5) buildVerification(shell);
  if (index === 6) buildProfile(shell);
  if (index === 7) buildSponsor(shell);
  return shell;
}

async function buildScreens() {
  await loadFonts();
  const page = figma.currentPage;
  const removed = removePreviousScreens(page);
  const created = SCREENS.map(function (spec, index) {
    return buildScreen(spec, index);
  });

  figma.viewport.scrollAndZoomIntoView(created);
  figma.closePlugin(
    "Built " + created.length + " Clean Map MVP mobile screens. Removed " + removed + " old Clean Map frames."
  );
}

buildScreens().catch(function (err) {
  figma.closePlugin("Error: " + err.message);
});
