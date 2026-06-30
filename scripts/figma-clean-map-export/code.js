/**
 * Clean Map — export screens + Figma file config for the PWA repo.
 *
 * Workflow:
 * 1. Figma → New design file → name it "Clean Map App"
 * 2. Plugins → Development → Import plugin from manifest…
 *    → scripts/figma-clean-map-screens/manifest.json → Run (builds 8 screens)
 * 3. Import this plugin → scripts/figma-clean-map-export/manifest.json → Run
 * 4. Export config JSON → save as scripts/clean-map-figma.config.json
 * 5. Export PNG screens → save into assets/clean-map/figma-export/
 * 6. Optional: node scripts/export-clean-map-figma.mjs (uses config + FIGMA_ACCESS_TOKEN)
 */

const APP_PREFIX = "Clean Map - ";

const FRAMES = [
  { name: "Clean Map - 01 Onboarding", file: "01-onboarding.png", slug: "onboarding" },
  { name: "Clean Map - 02 Map", file: "02-map.png", slug: "map" },
  { name: "Clean Map - 03 Report Pollution", file: "03-report.png", slug: "report" },
  { name: "Clean Map - 04 Task Details", file: "04-task-details.png", slug: "task" },
  { name: "Clean Map - 05 Upload Proof", file: "05-upload-proof.png", slug: "proof" },
  { name: "Clean Map - 06 AI Verification", file: "06-verification.png", slug: "verify" },
  { name: "Clean Map - 07 Profile Rewards", file: "07-profile.png", slug: "profile" },
  { name: "Clean Map - 08 Sponsor View", file: "08-sponsor.png", slug: "sponsor" }
];

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

function normalizeName(name) {
  return String(name || "")
    .replace(/\u2014/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findFrame(page, spec) {
  const wanted = normalizeName(spec.name);
  for (const node of page.findAll(function (n) {
    return n.type === "FRAME";
  })) {
    if (normalizeName(node.name) === wanted) return node;
  }
  for (const node of page.findAll(function (n) {
    return n.type === "FRAME" && normalizeName(n.name).indexOf(APP_PREFIX.toLowerCase()) === 0;
  })) {
    if (normalizeName(node.name).indexOf(normalizeName(spec.name).replace(APP_PREFIX.toLowerCase(), "")) !== -1) {
      return node;
    }
  }
  return null;
}

function collectFrames(page) {
  const found = [];
  const missing = [];

  for (const spec of FRAMES) {
    const frame = findFrame(page, spec);
    if (!frame) {
      missing.push(spec.name);
      continue;
    }
    found.push({
      spec: spec,
      frame: frame
    });
  }

  return { found: found, missing: missing };
}

function buildConfig(page, found) {
  const fileKey = figma.fileKey || null;
  return {
    fileKey: fileKey,
    fileName: figma.root.name,
    figmaUrl: fileKey
      ? "https://www.figma.com/design/" + fileKey + "/" + encodeURIComponent(figma.root.name)
      : null,
    fileKeyNote: fileKey
      ? null
      : "fileKey unavailable — save the file to Figma cloud, then copy the ID from the browser URL into fileKey.",
    exportedAt: new Date().toISOString(),
    appPrefix: APP_PREFIX,
    colors: COLORS,
    screens: found.map(function (entry) {
      return {
        name: entry.spec.name,
        slug: entry.spec.slug,
        nodeId: entry.frame.id,
        file: entry.spec.file,
        width: entry.frame.width,
        height: entry.frame.height
      };
    })
  };
}

function buildTokens(config) {
  return {
    source: "figma-clean-map-export",
    fileKey: config.fileKey,
    exportedAt: config.exportedAt,
    colors: config.colors,
    typography: {
      fontFamily: "Inter",
      weights: ["Regular", "Medium", "Semi Bold"]
    },
    layout: {
      phoneWidth: 390,
      phoneHeight: 844,
      statusBar: 44,
      tabBar: 76,
      radius: 36
    },
    screens: config.screens.map(function (screen) {
      return {
        slug: screen.slug,
        title: screen.name.replace(APP_PREFIX, "").trim()
      };
    })
  };
}

figma.showUI(__html__, { width: 440, height: 420 });

figma.ui.onmessage = async function (msg) {
  if (!msg || !msg.type) return;

  try {
    const page = figma.currentPage;

    if (msg.type === "inspect") {
      const result = collectFrames(page);
      figma.ui.postMessage({
        type: "inspect-result",
        fileKey: figma.fileKey,
        fileName: figma.root.name,
        found: result.found.length,
        missing: result.missing,
        total: FRAMES.length
      });
      return;
    }

    if (msg.type === "export-config") {
      const result = collectFrames(page);
      if (result.missing.length) {
        figma.ui.postMessage({
          type: "error",
          text: "Missing frames: " + result.missing.join(", ") + '. Run "Clean Map - MVP Mobile Screens" first.'
        });
        return;
      }

      const config = buildConfig(page, result.found);
      const tokens = buildTokens(config);

      figma.ui.postMessage({
        type: "json",
        fileName: "clean-map-figma.config.json",
        payload: config
      });
      figma.ui.postMessage({
        type: "json",
        fileName: "figma-tokens.json",
        payload: tokens
      });
      figma.ui.postMessage({
        type: "log",
        text: "Config ready. fileKey=" + figma.fileKey + " · " + config.screens.length + " screens"
      });
      return;
    }

    if (msg.type === "export-png") {
      const result = collectFrames(page);
      if (result.missing.length) {
        figma.ui.postMessage({
          type: "error",
          text: "Missing frames: " + result.missing.join(", ")
        });
        return;
      }

      figma.ui.postMessage({ type: "start", count: result.found.length });

      for (const entry of result.found) {
        figma.ui.postMessage({
          type: "log",
          text: "Exporting " + entry.spec.file + " …"
        });
        const bytes = await entry.frame.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: 2 }
        });
        figma.ui.postMessage({
          type: "file",
          fileName: entry.spec.file,
          bytes: Array.from(bytes)
        });
      }

      figma.ui.postMessage({
        type: "log",
        text: "Queued " + result.found.length + " PNG downloads."
      });
    }
  } catch (err) {
    figma.ui.postMessage({
      type: "error",
      text: err.message || String(err)
    });
  }
};
