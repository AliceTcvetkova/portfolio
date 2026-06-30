/**
 * Export Clean Map Figma screens via REST API.
 *
 * Prerequisites:
 * 1. Run Figma plugin scripts/figma-clean-map-export → Export config + tokens
 * 2. Save clean-map-figma.config.json into scripts/
 * 3. Figma → Settings → Security → create Personal access token
 *
 * Usage:
 *   set FIGMA_ACCESS_TOKEN=figd_...
 *   node scripts/export-clean-map-figma.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const configPath = path.join(__dirname, "clean-map-figma.config.json");
const exportDir = path.join(root, "assets", "clean-map", "figma-export");
const tokensPath = path.join(root, "app", "js", "figma-tokens.json");
const SCALE = 2;

const token = process.env.FIGMA_ACCESS_TOKEN;
if (!token) {
  console.error("Set FIGMA_ACCESS_TOKEN (Figma → Settings → Security → Personal access tokens).");
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  console.error("Missing scripts/clean-map-figma.config.json");
  console.error("Run the Figma plugin: Clean Map — Export for PWA → Export config + tokens.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (!config.fileKey || config.fileKey === "REPLACE_WITH_FILE_KEY") {
  console.error("clean-map-figma.config.json has no valid fileKey. Re-export from Figma.");
  process.exit(1);
}

async function figmaImages(fileKey, nodeIds) {
  const ids = nodeIds.join(",");
  const url =
    "https://api.figma.com/v1/images/" +
    fileKey +
    "?ids=" +
    encodeURIComponent(ids) +
    "&format=png&scale=" +
    SCALE;

  const res = await fetch(url, { headers: { "X-Figma-Token": token } });
  if (!res.ok) {
    throw new Error("Figma images API " + res.status + ": " + (await res.text()));
  }

  const data = await res.json();
  if (data.err) throw new Error(data.err);
  return data.images;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed " + res.status + " → " + dest);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

async function main() {
  fs.mkdirSync(exportDir, { recursive: true });

  const screens = config.screens || [];
  if (!screens.length) {
    throw new Error("No screens in config.");
  }

  const nodeIds = screens.map((screen) => screen.nodeId);
  const images = await figmaImages(config.fileKey, nodeIds);

  for (const screen of screens) {
    const imageUrl = images[screen.nodeId];
    if (!imageUrl) {
      throw new Error('No export URL for "' + screen.name + '" (' + screen.nodeId + ")");
    }
    const dest = path.join(exportDir, screen.file);
    await download(imageUrl, dest);
    console.log("Saved", screen.file);
  }

  const tokens = {
    source: "export-clean-map-figma.mjs",
    fileKey: config.fileKey,
    exportedAt: new Date().toISOString(),
    colors: config.colors,
    typography: { fontFamily: "Inter", weights: ["Regular", "Medium", "Semi Bold"] },
    layout: { phoneWidth: 390, phoneHeight: 844, statusBar: 44, tabBar: 76, radius: 36 },
    screens: screens.map((screen) => ({
      slug: screen.slug,
      title: screen.name.replace(config.appPrefix || "Clean Map - ", "").trim(),
      nodeId: screen.nodeId
    }))
  };

  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2) + "\n");
  console.log("Updated", path.relative(root, tokensPath));
  console.log("\nFigma file:", config.figmaUrl || config.fileKey);
  console.log("Done:", exportDir);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
