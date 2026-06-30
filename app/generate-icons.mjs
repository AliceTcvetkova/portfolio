import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svgPath = path.join(__dirname, "icons", "icon.svg");
const svg = fs.readFileSync(svgPath);

Promise.all(
  [192, 512].map((size) =>
    sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, "icons", `icon-${size}.png`))
  )
).then(() => console.log("icons generated"));
