"""Remove bright golden thread pixels from living room slide."""
from __future__ import annotations

import shutil
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:
    raise SystemExit("Pillow required: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "locus-chamber" / "slide-07-living-room.png"
BAK = ROOT / "assets" / "locus-chamber" / "slide-07-living-room.source.png"
OUT = SRC


def is_gold(r: int, g: int, b: int) -> bool:
    if r < 165 or g < 110 or b > 130:
        return False
    if r - b < 70:
        return False
    if g - b < 25:
        return False
    # bright glowing thread strokes
    if r + g > 380 and r > g > b:
        return True
    return r > 190 and g > 130 and b < 95


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing {SRC}")

    if not BAK.exists():
        shutil.copy2(SRC, BAK)

    img = Image.open(BAK if BAK.exists() else SRC).convert("RGB")
    px = img.load()
    w, h = img.size
    mask = [[False] * w for _ in range(h)]

    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if is_gold(r, g, b):
                mask[y][x] = True

    # dilate mask slightly to catch glow halos
    dilated = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if mask[y][x]:
                for dy in range(-1, 2):
                    for dx in range(-1, 2):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w:
                            dilated[ny][nx] = True

    for y in range(h):
        for x in range(w):
            if not dilated[y][x]:
                continue
            samples = []
            for dy in range(-3, 4):
                for dx in range(-3, 4):
                    if dx == 0 and dy == 0:
                        continue
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and not dilated[ny][nx]:
                        samples.append(px[nx, ny])
            if samples:
                r = sum(s[0] for s in samples) // len(samples)
                g = sum(s[1] for s in samples) // len(samples)
                b = sum(s[2] for s in samples) // len(samples)
                px[x, y] = (r, g, b)

    img = img.filter(ImageFilter.GaussianBlur(radius=0.4))
    img.save(OUT, optimize=True)
    print(f"Cleaned {OUT}")


if __name__ == "__main__":
    main()
