"""Pull a SAM3-style hair cosmetic layer from the mage still (color + y-gate)."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
TEX = ROOT / "public" / "sprites" / "mage" / "rig" / "texture.png"
OUT = ROOT / "public" / "sprites" / "mage" / "rig"


def hair_mask(arr: np.ndarray) -> np.ndarray:
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    a = arr[:, :, 3]
    h, w = r.shape
    ys = np.arange(h)[:, None]
    xs = np.arange(w)[None, :]
    gold = (
        (a > 40)
        & (r > 165)
        & (g > 120)
        & (r > b + 20)
        & (g > b + 10)
        & (r - g < 72)  # drop orange skin / hands
        & (ys < int(h * 0.48))
        & (xs > int(w * 0.16))  # drop outstretched hand
    )
    return gold


def keep_head_blobs(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    keep = np.zeros_like(mask)
    ys, xs = np.where(mask)
    for y, x in zip(ys, xs):
        if visited[y, x]:
            continue
        q = deque([(y, x)])
        visited[y, x] = True
        cells = [(y, x)]
        while q:
            cy, cx = q.popleft()
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    q.append((ny, nx))
                    cells.append((ny, nx))
        cy = sum(p[0] for p in cells) / len(cells)
        cx = sum(p[1] for p in cells) / len(cells)
        if len(cells) < 80:
            continue
        if cy > h * 0.46:
            continue
        if cx < w * 0.18:
            continue
        for py, px in cells:
            keep[py, px] = True
    return keep


def main() -> None:
    im = Image.open(TEX).convert("RGBA")
    arr = np.asarray(im).copy()
    mask = keep_head_blobs(hair_mask(arr))
    # soften edges like W5 MASK_SMOOTH
    mask_img = Image.fromarray((mask.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(3))
    mask = np.asarray(mask_img) > 127
    hair = arr.copy()
    hair[:, :, 3] = np.where(mask, arr[:, :, 3], 0)
    Image.fromarray(hair).save(OUT / "hair.png")
    Image.fromarray((mask.astype(np.uint8) * 255)).save(OUT / "hair-mask.png")

    ys, xs = np.where(mask)
    bbox = {
        "x": int(xs.min()),
        "y": int(ys.min()),
        "w": int(xs.max() - xs.min() + 1),
        "h": int(ys.max() - ys.min() + 1),
        "pivotX": float(np.median(xs[ys < ys.min() + (ys.max() - ys.min()) * 0.28])),
        "pivotY": float(ys.min() + (ys.max() - ys.min()) * 0.16),
    }
    (OUT / "hair.json").write_text(json.dumps(bbox, indent=2), encoding="utf-8")
    print("hair pixels", int(mask.sum()), "bbox", bbox)


if __name__ == "__main__":
    main()
