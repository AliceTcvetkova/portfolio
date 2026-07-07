"""Export Locus Chamber and Eco Clean Map logos to Downloads."""
from __future__ import annotations

import base64
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path.home() / "Downloads"
LOCUS_JS = ROOT / "scripts" / "figma-locus-login" / "code.js"

SIZE = 1024
BG = (32, 55, 47)
CREAM = (255, 247, 232)
GREEN = (111, 163, 111)
GREEN_DARK = (63, 111, 76)
MOSS = (111, 143, 99)
RED = (201, 109, 90)
BORDER = (230, 217, 189)
WHITE = (255, 255, 255)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"]
        if bold
        else ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"]
    )
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def export_locus_chamber_logo() -> Path:
    text = LOCUS_JS.read_text(encoding="utf-8")
    match = re.search(r'const LOGO_BASE64 = "([^"]+)"', text)
    if not match:
        raise SystemExit("LOGO_BASE64 not found in figma-locus-login/code.js")
    out = DOWNLOADS / "locus-chamber-logo.png"
    out.write_bytes(base64.b64decode(match.group(1)))
    return out


def draw_eco_clean_map_logo() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), BG + (255,))
    draw = ImageDraw.Draw(img)

    cx, cy = SIZE // 2, int(SIZE * 0.44)
    draw.ellipse((cx - 210, cy - 210, cx + 210, cy + 210), fill=MOSS + (70,))
    draw.ellipse((cx - 170, cy - 170, cx + 170, cy + 170), fill=CREAM)
    draw.ellipse((cx - 155, cy - 155, cx + 155, cy + 155), outline=BORDER, width=8)

    draw.arc((cx - 120, cy - 40, cx + 120, cy + 120), start=200, end=340, fill=(216, 230, 223, 140), width=0)
    draw.pieslice((cx - 120, cy - 40, cx + 120, cy + 120), start=200, end=340, fill=(216, 230, 223, 110))

    pin_top = cy - 95
    pin_bottom = cy + 95
    draw.polygon(
        [
            (cx, pin_top),
            (cx - 78, cy + 8),
            (cx - 34, cy + 8),
            (cx - 34, pin_bottom),
            (cx + 34, pin_bottom),
            (cx + 34, cy + 8),
            (cx + 78, cy + 8),
        ],
        fill=GREEN,
    )
    draw.ellipse((cx - 34, pin_top + 18, cx + 34, pin_top + 86), fill=CREAM)
    draw.ellipse((cx - 16, pin_top + 36, cx + 16, pin_top + 68), fill=RED)
    draw.line((cx, pin_top + 68, cx, pin_bottom - 8), fill=GREEN_DARK, width=10)

    font = load_font(54, bold=True)
    label = "Eco Clean Map"
    bbox = draw.textbbox((0, 0), label, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((cx - tw // 2, int(SIZE * 0.78)), label, font=font, fill=WHITE)

    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=192, fill=255)
    img.putalpha(mask)
    return img


def export_eco_clean_map_logo() -> tuple[Path, Path]:
    svg_src = ROOT / "assets" / "clean-map" / "eco-clean-map-logo.svg"
    svg_out = DOWNLOADS / "eco-clean-map-logo.svg"
    svg_out.write_text(svg_src.read_text(encoding="utf-8"), encoding="utf-8")
    png_out = DOWNLOADS / "eco-clean-map-logo.png"
    draw_eco_clean_map_logo().save(png_out, format="PNG", optimize=True)
    return svg_out, png_out


def main() -> None:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    locus = export_locus_chamber_logo()
    svg, eco = export_eco_clean_map_logo()
    print(f"Wrote {locus}")
    print(f"Wrote {svg}")
    print(f"Wrote {eco}")


if __name__ == "__main__":
    main()
