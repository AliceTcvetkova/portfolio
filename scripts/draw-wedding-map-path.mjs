import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const src =
  "C:/Users/Alice/.cursor/projects/d-eco-clean-map-eco-clean-map/assets/c__Users_Alice_AppData_Roaming_Cursor_User_workspaceStorage_cfc785182f48ff1e0133066f1f8fff21_images_______________2026-06-15_225722-a9d12ff0-0d3f-4b25-86c0-088897df2681.png";

const out = path.join(root, "assets/wedding-map-solnechnaya.png");

const pathPoints = [
  [528, 170],
  [555, 187],
  [600, 205],
  [591, 219],
  [576, 236],
  [564, 251],
  [554, 268],
  [543, 284],
  [534, 301],
  [525, 316],
  [516, 333],
  [507, 349],
  [497, 365],
  [487, 382],
  [474, 397],
  [461, 413],
  [443, 429],
  [424, 445],
  [410, 462],
  [398, 479],
  [382, 494],
  [368, 511],
  [352, 527],
  [323, 543],
  [313, 558],
];

function smoothPath(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const cx = x1;
    const cy = y1;
    const mx = (x0 + x2) / 2;
    const my = (y0 + y2) / 2;
    d += ` Q ${cx} ${cy} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` T ${last[0]} ${last[1]}`;
  return d;
}

const routeD = smoothPath(pathPoints);
const labelX = 334;
const labelY = 539;

function isGreen(r, g, b) {
  return g > 100 && g > r + 30 && g > b + 20 && r < 120;
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const pixels = Buffer.from(data);

for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (!isGreen(r, g, b)) continue;

    let best = null;
    let bestDist = Infinity;
    for (let radius = 1; radius <= 14; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
          const j = (ny * info.width + nx) * 4;
          const nr = pixels[j];
          const ng = pixels[j + 1];
          const nb = pixels[j + 2];
          if (isGreen(nr, ng, nb)) continue;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = j;
          }
        }
      }
      if (best) break;
    }

    if (best !== null) {
      pixels[i] = pixels[best];
      pixels[i + 1] = pixels[best + 1];
      pixels[i + 2] = pixels[best + 2];
      pixels[i + 3] = 255;
    }
  }
}

const cleaned = await sharp(pixels, {
  raw: { width: info.width, height: info.height, channels: 4 },
}).png().toBuffer();

const svg = `
<svg width="873" height="742" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7B2D42"/>
      <stop offset="100%" stop-color="#B85C6E"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.22"/>
    </filter>
  </defs>

  <path d="${routeD}" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" opacity="0.98"/>
  <path d="${routeD}" fill="none" stroke="url(#routeGrad)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#softShadow)"/>

  ${pathPoints
    .filter((_, i) => i % 5 === 2)
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#FFFFFF" stroke="#7B2D42" stroke-width="1.4"/>`)
    .join("\n")}

  <circle cx="${labelX}" cy="${labelY}" r="20" fill="#F4F2EE"/>

  <rect x="${labelX - 78}" y="${labelY - 18}" width="156" height="36" rx="11"
        fill="#FFFFFF" stroke="#D4C4C8" stroke-width="1.3"/>

  <text x="${labelX}" y="${labelY + 6}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="18" font-weight="600"
        fill="#5A1F2E">Лесной Бал</text>
</svg>`;

await sharp(cleaned)
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .png({ quality: 95 })
  .toFile(out);

console.log("Saved:", out);
