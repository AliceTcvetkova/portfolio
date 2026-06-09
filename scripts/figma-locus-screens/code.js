/**
 * Locus Chamber — build separate room screens (English UI).
 * Does NOT modify My Profile / user page.
 *
 * Figma: Plugins → Development → Import plugin from manifest…
 * Point to this folder, then Run once on Locus-Chamber file.
 */

const IMAGE_IDS = ["7:17", "15:3", "15:6", "15:9", "15:12"];

const SCREENS = [
  {
    title: "01 — Opening",
    url: "memory.app / opening",
    warm: false
  },
  {
    title: "02 — Memory scene",
    url: "memory.app / memory",
    warm: false
  },
  {
    title: "03 — Castle corridor",
    url: "memory.app / corridor",
    warm: false
  },
  {
    title: "04 — Living room",
    url: "memory.app / living room",
    warm: true,
    footer: "Your room 1 · Photos · Documents · Books"
  },
  {
    title: "05 — Room detail",
    url: "memory.app / room",
    warm: false
  }
];

const PAGE_NAME = "Locus Chamber — Screens";
const W = 1120;
const H = 720;
const GAP = 80;

function hex(h) {
  const n = parseInt(h.replace("#", ""), 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255
  };
}

function solid(color, opacity) {
  return [{ type: "SOLID", color: color, opacity: opacity == null ? 1 : opacity }];
}

async function loadFonts() {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
}

function findOrCreatePage(name) {
  const existing = figma.root.children.find(function (p) {
    return p.name === name;
  });
  if (existing) return existing;
  const page = figma.createPage();
  page.name = name;
  return page;
}

function clearPage(page) {
  for (let i = page.children.length - 1; i >= 0; i--) {
    page.children[i].remove();
  }
}

async function buildScreens() {
  await loadFonts();

  const page = findOrCreatePage(PAGE_NAME);
  await figma.setCurrentPageAsync(page);
  clearPage(page);

  let x = 0;
  let built = 0;

  const heading = figma.createText();
  heading.fontName = { family: "Inter", style: "Semi Bold" };
  heading.characters = "Locus Chamber — room screens (English)";
  heading.fontSize = 28;
  heading.fills = solid(hex("#f7f8f8"));
  heading.x = 0;
  heading.y = -96;
  page.appendChild(heading);

  for (let i = 0; i < SCREENS.length; i++) {
    const spec = SCREENS[i];
    const srcId = IMAGE_IDS[i];
    const src = await figma.getNodeByIdAsync(srcId);
    if (!src || !("clone" in src)) continue;

    const shell = figma.createFrame();
    shell.name = spec.title;
    shell.resize(W, H);
    shell.x = x;
    shell.y = 0;
    shell.cornerRadius = 16;
    shell.clipsContent = true;
    shell.fills = solid(hex("#08090a"));
    shell.strokes = solid(hex("#ffffff"), 0.08);
    shell.strokeWeight = 1;
    page.appendChild(shell);

    const bar = figma.createFrame();
    bar.name = "App bar";
    bar.resize(W, 44);
    bar.fills = solid(spec.warm ? hex("#34261c") : hex("#141516"));
    bar.strokes = solid(hex("#ffffff"), spec.warm ? 0.12 : 0.08);
    bar.strokeWeight = 1;
    shell.appendChild(bar);

    const dotColors = spec.warm
      ? ["#b8845a", "#d4b483", "#8f6a45"]
      : ["#ff5f57", "#febc2e", "#28c840"];
    dotColors.forEach(function (dc, di) {
      const d = figma.createEllipse();
      d.resize(8, 8);
      d.x = 16 + di * 14;
      d.y = 18;
      d.fills = solid(hex(dc));
      shell.appendChild(d);
    });

    const appTitle = figma.createText();
    appTitle.fontName = { family: "Inter", style: "Semi Bold" };
    appTitle.characters = "Locus Chamber";
    appTitle.fontSize = 13;
    appTitle.fills = solid(spec.warm ? hex("#ede0cc") : hex("#f7f8f8"));
    appTitle.x = 80;
    appTitle.y = 14;
    shell.appendChild(appTitle);

    const appUrl = figma.createText();
    appUrl.fontName = { family: "Inter", style: "Regular" };
    appUrl.characters = spec.url;
    appUrl.fontSize = 11;
    appUrl.fills = solid(spec.warm ? hex("#c4a066") : hex("#8a8f98"));
    appUrl.x = W - 220;
    appUrl.y = 16;
    shell.appendChild(appUrl);

    const footerH = spec.warm ? 36 : 0;
    const viewport = figma.createFrame();
    viewport.name = "Room art";
    viewport.resize(W, H - 44 - footerH);
    viewport.y = 44;
    viewport.clipsContent = true;
    viewport.fills = solid(spec.warm ? hex("#120e0b") : hex("#0f1011"));
    shell.appendChild(viewport);

    if (spec.warm && spec.footer) {
      const footer = figma.createFrame();
      footer.name = "Game UI footer";
      footer.resize(W, footerH);
      footer.y = H - footerH;
      footer.fills = solid(hex("#2f2219"));
      footer.strokes = solid(hex("#b48c58"), 0.28);
      footer.strokeWeight = 1;
      shell.appendChild(footer);

      const roomLabel = figma.createText();
      roomLabel.fontName = { family: "Inter", style: "Regular" };
      roomLabel.characters = spec.footer;
      roomLabel.fontSize = 11;
      roomLabel.fills = solid(hex("#ede0cc"));
      roomLabel.x = 16;
      roomLabel.y = 12;
      footer.appendChild(roomLabel);
    }

    const art = src.clone();
    viewport.appendChild(art);
    const scale = Math.max(viewport.width / art.width, viewport.height / art.height);
    art.resize(art.width * scale, art.height * scale);
    art.x = (viewport.width - art.width) / 2;
    art.y = (viewport.height - art.height) / 2;

    const badge = figma.createFrame();
    badge.name = "Screen label";
    badge.resize(200, 28);
    badge.x = 16;
    badge.y = H - footerH - 44;
    badge.cornerRadius = 8;
    badge.fills = solid(hex("#7170ff"), 0.18);
    badge.strokes = solid(hex("#7170ff"), 0.45);
    badge.strokeWeight = 1;
    shell.appendChild(badge);

    const badgeText = figma.createText();
    badgeText.fontName = { family: "Inter", style: "Medium" };
    badgeText.characters = spec.title;
    badgeText.fontSize = 11;
    badgeText.fills = solid(hex("#f7f8f8"));
    badgeText.x = 10;
    badgeText.y = 7;
    badge.appendChild(badgeText);

    x += W + GAP;
    built += 1;
  }

  figma.viewport.scrollAndZoomIntoView(page.children);
  figma.closePlugin("Built " + built + " room screens on \"" + PAGE_NAME + "\" (English UI). User profile page untouched.");
}

buildScreens().catch(function (err) {
  figma.closePlugin("Error: " + err.message);
});
