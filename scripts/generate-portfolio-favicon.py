"""Generate portfolio favicon PNG/ICO files from assets/favicon.svg design."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ACCENT = (113, 112, 255)
BG = (8, 9, 10)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in ("C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = max(4, round(size * 0.22))
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=BG)
    font = load_font(max(10, round(size * 0.58)))
    letter = "A"
    bbox = draw.textbbox((0, 0), letter, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1] - size * 0.03),
        letter,
        font=font,
        fill=ACCENT,
    )
    return img


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    sizes = {
        "favicon-32.png": 32,
        "apple-touch-icon.png": 180,
        "favicon-512.png": 512,
    }
    images = {}
    for name, size in sizes.items():
        path = ASSETS / name
        img = draw_icon(size)
        img.save(path, format="PNG", optimize=True)
        images[size] = img
        print(f"Wrote {path}")

    ico_path = ROOT / "favicon.ico"
    images[32].save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"Wrote {ico_path}")


if __name__ == "__main__":
    main()
