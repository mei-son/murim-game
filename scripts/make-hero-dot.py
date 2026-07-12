#!/usr/bin/env python3
"""hero-*.png → assets/hero-dot/ 완전 도트 스프라이트 (크롭·팔레트·nearest downscale)."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "assets"
OUT_DIR = SRC_DIR / "hero-dot"
POSES = ("idle", "attack", "defend", "evade")

TARGET_H = 48
PAD_X = 3
PAD_BOTTOM = 2
PAD_TOP = 2
PALETTE_SIZE = 20
DISPLAY_SCALE = 2


def is_visible(r: int, g: int, b: int, a: int) -> bool:
    if a < 24:
        return False
    return not (r > 235 and g > 235 and b > 235)


def bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not is_visible(r, g, b, a):
                continue
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if maxx < 0:
        return None
    return minx, miny, maxx + 1, maxy + 1


def quantize(im: Image.Image, colors: int = PALETTE_SIZE) -> Image.Image:
    alpha = im.getchannel("A")
    rgb = im.convert("RGB")
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = q.convert("RGBA")
    out.putalpha(alpha)
    return out


def downscale_sprite(im: Image.Image) -> Image.Image:
    box = bbox(im)
    if box is None:
        raise ValueError("empty sprite")

    cropped = im.crop(box)
    cw, ch = cropped.size
    target_w = max(1, round(cw * (TARGET_H / ch)))
    small = cropped.resize((target_w, TARGET_H), Image.Resampling.NEAREST)
    return quantize(small)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sprites: list[tuple[str, Image.Image]] = []

    for pose in POSES:
        src = SRC_DIR / f"hero-{pose}.png"
        if not src.exists():
            print(f"missing: {src}", file=sys.stderr)
            return 1
        sprites.append((pose, downscale_sprite(Image.open(src).convert("RGBA"))))

    max_w = max(s.size[0] for _, s in sprites)
    canvas_w = max_w + PAD_X * 2
    canvas_h = TARGET_H + PAD_TOP + PAD_BOTTOM

    print("hero-dot sprites:")
    for pose, small in sprites:
        out = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        sw, sh = small.size
        x = PAD_X + (max_w - sw) // 2
        y = PAD_TOP
        out.paste(small, (x, y), small)
        path = OUT_DIR / f"hero-{pose}.png"
        out.save(path, optimize=True)
        print(f"  {path.name}: {out.size[0]}x{out.size[1]} (body {sw}x{sh})")

    print(f"  palette={PALETTE_SIZE}, display_scale={DISPLAY_SCALE}x")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())