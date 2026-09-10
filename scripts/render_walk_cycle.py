from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "sprites" / "mage" / "walk" / "0.png"
RIG = ROOT / "public" / "sprites" / "mage" / "rig"
POSES = ROOT / "workflows" / "walk-cycle" / "openpose"
PUBLIC_POSES = ROOT / "public" / "sprites" / "mage" / "walk-pose"


def walk_pose(t: float) -> dict[str, float]:
    a = (t % 1) * math.tau
    s = math.sin(a)
    c = math.cos(a)
    back_l = max(0.0, -s)
    back_r = max(0.0, s)
    return {
        "bob": abs(s) * 10,
        "thigh_l": s * 28,
        "thigh_r": -s * 28,
        "shin_l": 6 + 24 * back_l + 8 * max(0.0, c),
        "shin_r": 6 + 24 * back_r + 8 * max(0.0, -c),
        "arm_l": -s * 24,
        "arm_r": s * 24,
        "forearm_l": 8 + 10 * back_l,
        "forearm_r": 8 + 10 * back_r,
    }


def fk(origin: tuple[float, float], length: float, angle_deg: float) -> tuple[float, float]:
    r = math.radians(angle_deg)
    return (origin[0] - length * math.sin(r), origin[1] + length * math.cos(r))


def skeleton(t: float, w: int, h: int) -> list[tuple[float, float]]:
    pose = walk_pose(t)
    hip = (w * 0.52, h * 0.52 + pose["bob"])
    neck = (hip[0] + 6, hip[1] - 148)
    nose = (neck[0] - 22, neck[1] - 36)
    r_sho = (neck[0] - 46, neck[1] + 16)
    l_sho = (neck[0] + 48, neck[1] + 18)
    r_elb = fk(r_sho, 62, pose["arm_r"] + 8)
    l_elb = fk(l_sho, 62, pose["arm_l"] - 8)
    r_wri = fk(r_elb, 58, pose["arm_r"] + pose["forearm_r"])
    l_wri = fk(l_elb, 58, pose["arm_l"] + pose["forearm_l"])
    r_hip = (hip[0] - 20, hip[1] + 10)
    l_hip = (hip[0] + 24, hip[1] + 12)
    r_kne = fk(r_hip, 108, pose["thigh_r"])
    l_kne = fk(l_hip, 108, pose["thigh_l"])
    r_ank = fk(r_kne, 102, pose["thigh_r"] + pose["shin_r"] * 0.35)
    l_ank = fk(l_kne, 102, pose["thigh_l"] + pose["shin_l"] * 0.35)
    r_eye = (nose[0] - 6, nose[1] - 8)
    l_eye = (nose[0] + 12, nose[1] - 6)
    r_ear = (nose[0] + 10, nose[1] + 6)
    l_ear = (nose[0] + 24, nose[1] + 4)
    return [
        nose,
        neck,
        r_sho,
        r_elb,
        r_wri,
        l_sho,
        l_elb,
        l_wri,
        r_hip,
        r_kne,
        r_ank,
        l_hip,
        l_kne,
        l_ank,
        r_eye,
        l_eye,
        r_ear,
        l_ear,
    ]


LIMBS = [
    (1, 2),
    (1, 5),
    (2, 3),
    (3, 4),
    (5, 6),
    (6, 7),
    (1, 8),
    (8, 9),
    (9, 10),
    (1, 11),
    (11, 12),
    (12, 13),
    (0, 1),
    (0, 14),
    (0, 15),
    (14, 16),
    (15, 17),
]
LIMB_COLORS = [
    (255, 0, 0),
    (255, 85, 0),
    (255, 170, 0),
    (255, 255, 0),
    (170, 255, 0),
    (85, 255, 0),
    (0, 255, 0),
    (0, 255, 85),
    (0, 255, 170),
    (0, 255, 255),
    (0, 170, 255),
    (0, 85, 255),
    (0, 0, 255),
    (85, 0, 255),
    (170, 0, 255),
    (255, 0, 255),
    (255, 0, 170),
]


def key_background(im: Image.Image) -> Image.Image:
    arr = np.asarray(im.convert("RGBA")).copy()
    rgb = arr[:, :, :3].astype(np.float32)
    bg = np.array([220.0, 217.0, 217.0])
    dist = np.linalg.norm(rgb - bg, axis=2)
    alpha = np.clip((dist - 22.0) / 10.0, 0, 1)
    arr[:, :, 3] = (alpha * arr[:, :, 3]).astype(np.uint8)

    mask = arr[:, :, 3] > 40
    h, w = mask.shape
    # keep the largest connected component
    visited = np.zeros_like(mask, dtype=bool)
    best = None
    best_n = 0
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
        if len(cells) > best_n:
            best_n = len(cells)
            best = cells
    keep = np.zeros_like(mask)
    if best:
        for y, x in best:
            keep[y, x] = True
    arr[:, :, 3] = np.where(keep, arr[:, :, 3], 0)
    ys, xs = np.where(arr[:, :, 3] > 12)
    pad = 12
    x0, x1 = max(0, int(xs.min()) - pad), min(arr.shape[1], int(xs.max()) + pad)
    y0, y1 = max(0, int(ys.min()) - pad), min(arr.shape[0], int(ys.max()) + pad)
    return Image.fromarray(arr).crop((x0, y0, x1, y1))


def draw_openpose(pts: list[tuple[float, float]], w: int, h: int) -> Image.Image:
    im = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, (a, b) in enumerate(LIMBS):
        d.line([pts[a], pts[b]], fill=LIMB_COLORS[i % len(LIMB_COLORS)], width=10)
    for x, y in pts:
        r = 8
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255))
    return im


def main() -> None:
    RIG.mkdir(parents=True, exist_ok=True)
    POSES.mkdir(parents=True, exist_ok=True)
    PUBLIC_POSES.mkdir(parents=True, exist_ok=True)

    keyed = key_background(Image.open(SRC))
    keyed.save(RIG / "texture.png")

    w, h = 512, 768
    for i in range(8):
        pts = skeleton(i / 8, w, h)
        flat: list[float] = []
        for x, y in pts:
            flat.extend([round(x, 2), round(y, 2), 1.0])
        payload = {"canvas_width": w, "canvas_height": h, "people": [{"pose_keypoints_2d": flat}]}
        (POSES / f"{i}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
        png = draw_openpose(pts, w, h)
        png.save(POSES / f"{i}.png")
        png.save(PUBLIC_POSES / f"{i}.png")
    print("texture", RIG / "texture.png")
    print("openpose", POSES)


if __name__ == "__main__":
    main()
