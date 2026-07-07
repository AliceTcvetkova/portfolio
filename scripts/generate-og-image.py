"""Generate LinkedIn / Open Graph preview card (1200×630)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PHOTO_PATH = ROOT / "assets" / "photo.png"
OUT_PATH = ROOT / "assets" / "og-image.png"

W, H = 1200, 630
BG = (8, 9, 10)
TEXT = (247, 248, 248)
MUTED = (138, 143, 152)
ACCENT = (113, 112, 255)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates.extend(
            [
                "C:/Windows/Fonts/segoeuib.ttf",
                "C:/Windows/Fonts/arialbd.ttf",
            ]
        )
    else:
        candidates.extend(
            [
                "C:/Windows/Fonts/segoeui.ttf",
                "C:/Windows/Fonts/arial.ttf",
            ]
        )
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def radial_glow(base: Image.Image) -> Image.Image:
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((220, -180, 980, 420), fill=(ACCENT[0], ACCENT[1], ACCENT[2], 38))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    return Image.alpha_composite(base.convert("RGBA"), glow).convert("RGB")


def circular_photo(source: Image.Image, size: int) -> Image.Image:
    photo = source.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    photo.putalpha(mask)
    return photo


def draw_tag(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, font: ImageFont.ImageFont) -> int:
    pad_x, pad_y = 18, 10
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    box_w, box_h = tw + pad_x * 2, th + pad_y * 2
    draw.rounded_rectangle(
        (x, y, x + box_w, y + box_h),
        radius=999,
        fill=(20, 21, 22),
        outline=(255, 255, 255, 20),
        width=1,
    )
    draw.text((x + pad_x, y + pad_y - 1), label, font=font, fill=TEXT)
    return box_w


def main() -> None:
    canvas = Image.new("RGB", (W, H), BG)
    canvas = radial_glow(canvas)
    draw = ImageDraw.Draw(canvas)

    photo_size = 360
    photo_x = 96
    photo_y = (H - photo_size) // 2
    photo = circular_photo(Image.open(PHOTO_PATH), photo_size)
    canvas.paste(photo, (photo_x, photo_y), photo)

    ring = Image.new("RGBA", (photo_size + 8, photo_size + 8), (0, 0, 0, 0))
    ring_draw = ImageDraw.Draw(ring)
    ring_draw.ellipse((0, 0, photo_size + 7, photo_size + 7), outline=(255, 255, 255, 28), width=2)
    canvas.paste(ring, (photo_x - 4, photo_y - 4), ring)

    text_x = photo_x + photo_size + 72
    role_font = load_font(30)
    title_font = load_font(68, bold=True)
    tag_font = load_font(24)

    draw.text((text_x, 150), "Product & Delivery Manager", font=role_font, fill=MUTED)
    draw.text((text_x, 198), "Portfolio", font=title_font, fill=TEXT)

    tags = ["Eco Clean Map", "AI", "UX", "GameDev"]
    tag_y = 320
    tag_x = text_x
    gap = 14
    for tag in tags:
        tag_w = draw_tag(draw, tag_x, tag_y, tag, tag_font)
        tag_x += tag_w + gap
        if tag_x + 120 > W - 48:
            tag_x = text_x
            tag_y += 52

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT_PATH, format="PNG", optimize=True)
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
