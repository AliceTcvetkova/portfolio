import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const src = path.join(
  root,
  "assets/locus-chamber/discovery/insights-searching-source.png"
);

const out = path.join(root, "assets/locus-chamber/discovery/insights-searching.png");

function idx(x, y, width) {
  return y * width + x;
}

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isOutline(r, g, b) {
  return lum(r, g, b) < 55;
}

function findBBox(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[idx(x, y, width) * 4 + 3];
      if (a < 24) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const pad = 2;
  return {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(width, maxX + pad + 1) - Math.max(0, minX - pad),
    height: Math.min(height, maxY + pad + 1) - Math.max(0, minY - pad)
  };
}

function cleanAlphaFringe(data, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (r + g + b < 18) {
        data[i + 3] = 0;
        continue;
      }

      if (a > 0 && lum(r, g, b) < 35) {
        data[i + 3] = a < 200 ? 0 : Math.round(a * 0.55);
      }
    }
  }
}

function softenOutlineSpecks(data, width, height) {
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const i = idx(x, y, width) * 4;
      if (data[i + 3] < 128 || !isOutline(data[i], data[i + 1], data[i + 2])) continue;
      let fill = 0;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ]) {
        const ni = idx(nx, ny, width) * 4;
        if (data[ni + 3] > 128 && !isOutline(data[ni], data[ni + 1], data[ni + 2])) {
          fill++;
          sr += data[ni];
          sg += data[ni + 1];
          sb += data[ni + 2];
        }
      }
      if (fill >= 3) {
        data[i] = Math.round(sr / fill);
        data[i + 1] = Math.round(sg / fill);
        data[i + 2] = Math.round(sb / fill);
      }
    }
  }
}

function removeLightHalo(data, width, height) {
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y, width) * 4;
      const a = data[i + 3];
      if (a < 8) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = lum(r, g, b);
      const sat = Math.max(r, g, b) - Math.min(r, g, b);

      let transparentNeighbors = 0;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ]) {
        if (data[idx(nx, ny, width) * 4 + 3] < 20) transparentNeighbors++;
      }

      if (transparentNeighbors >= 2 && l > 185 && sat < 45) {
        data[i + 3] = 0;
        continue;
      }

      if (a < 255 && l > 170 && sat < 40 && transparentNeighbors >= 1) {
        data[i + 3] = Math.max(0, a - 80);
      }
    }
  }
}

const scale = 5;

const { data: rawIn, info: metaIn } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const crop = findBBox(rawIn, metaIn.width, metaIn.height);

const { data, info } = await sharp(rawIn, {
  raw: { width: metaIn.width, height: metaIn.height, channels: 4 }
})
  .extract(crop)
  .resize(crop.width * scale, crop.height * scale, { kernel: sharp.kernel.lanczos3 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

cleanAlphaFringe(data, info.width, info.height);
removeLightHalo(data, info.width, info.height);
softenOutlineSpecks(data, info.width, info.height);
removeLightHalo(data, info.width, info.height);
cleanAlphaFringe(data, info.width, info.height);

await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 }
})
  .trim({ threshold: 1 })
  .median(3)
  .modulate({ brightness: 1.02, saturation: 1.08 })
  .sharpen({ sigma: 1.15, m1: 0.9, m2: 0.4, x1: 2, y2: 10, y3: 20 })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(out);

const result = await sharp(out).metadata();
console.log("Saved:", out, `${result.width}x${result.height}`);
