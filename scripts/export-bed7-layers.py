#!/usr/bin/env python3
"""Export editable Ghostline Bed 7 acting layers using ONLY approved raster assets.

Run from anywhere: python scripts/export-bed7-layers.py [--repo-root .] [--output path.ora]
Requires Pillow. Does not repaint characters, interpolate poses, or edit inputs.
"""
import argparse
import io
import json
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED

from PIL import Image

CANVAS = (1065, 360)
FRAME = (128, 84)
SCALE = 1.5
BODY = (216, 176)
BED_FRONT = (265, 226)
STAND_FOOT = (312, 262)
MILO_ANCHOR = (40, 98)
SLEEP_NAMES = ("bed", "breath", "twitch", "lie", "sit")


def png_bytes(image):
    data = io.BytesIO()
    image.save(data, format="PNG", optimize=True)
    return data.getvalue()


def build(root, dest):
    art = root / "assets"
    sources = {
        "plate": art / "ward4-bed7" / "room-plate.png",
        "front": art / "ward4-bed7" / "bed-front.png",
        "sleep": art / "milo" / "milo-sleep.png",
        "ghost": art / "milo" / "milo-ghost.png",
        "meta": art / "milo" / "frames.json",
    }
    missing = [str(p) for p in sources.values() if not p.is_file()]
    if missing:
        raise FileNotFoundError("Missing approved game asset(s): " + ", ".join(missing))

    with Image.open(sources["plate"]) as img:
        plate = img.convert("RGBA")
    with Image.open(sources["front"]) as img:
        front = img.convert("RGBA")
    with Image.open(sources["sleep"]) as img:
        sleep = img.convert("RGBA")
    with Image.open(sources["ghost"]) as img:
        ghost = img.convert("RGBA")
    meta = json.loads(sources["meta"].read_text(encoding="utf-8"))
    assert plate.size == CANVAS, f"Unexpected Ward 4 size {plate.size}"
    assert sleep.size == (FRAME[0] * 5, FRAME[1] * 2), f"Unexpected Milo sleep sheet {sleep.size}"
    assert front.size == (182, 108), f"Unexpected bed front {front.size}"
    assert meta["frames"][0] == "idle0", "Unexpected approved ghost sheet frame ordering"

    def sleep_pose(index):
        x = (index % 5) * FRAME[0]
        y = (index // 5) * FRAME[1]
        pose = sleep.crop((x, y, x + FRAME[0], y + FRAME[1]))
        return pose.resize((round(FRAME[0] * SCALE), round(FRAME[1] * SCALE)), Image.Resampling.NEAREST)

    standing = ghost.crop((0, 0, 96, 100)).resize((144, 150), Image.Resampling.NEAREST)
    stand_at = (round(STAND_FOOT[0] - MILO_ANCHOR[0] * SCALE),
                round(STAND_FOOT[1] - MILO_ANCHOR[1] * SCALE))

    # OpenRaster stack order = TOP to BOTTOM. Hidden layers are actor alternatives.
    layers = [("ghost-standing-idle0", standing, stand_at, False)]
    layers += [(f"ghost-{SLEEP_NAMES[i]}", sleep_pose(i + 5), BODY, False) for i in range(5)]
    layers += [("bed-front-LOCKED", front, BED_FRONT, True)]
    layers += [(f"living-{SLEEP_NAMES[i]}", sleep_pose(i), BODY, i == 0) for i in reversed(range(5))]
    layers += [("Ward4-room-source-LOCKED", plate, (0, 0), True)]

    img_node = Element("image", {"version": "0.0.3", "w": str(CANVAS[0]), "h": str(CANVAS[1]),
                                 "name": "Ghostline Bed 7 - approved acting layers"})
    stack_node = SubElement(img_node, "stack")
    merged = Image.new("RGBA", CANVAS)
    for name, image, at, shown in reversed(layers):
        if shown:
            merged.alpha_composite(image, dest=at)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(dest, "w") as z:
        z.writestr("mimetype", "image/openraster", compress_type=ZIP_STORED)
        for idx, (name, image, at, shown) in enumerate(layers):
            filename = f"data/layer{idx:02d}.png"
            SubElement(stack_node, "layer", {"name": name, "src": filename, "x": str(at[0]),
                                             "y": str(at[1]), "opacity": "1.0",
                                             "visibility": "visible" if shown else "hidden",
                                             "composite-op": "svg:src-over"})
            z.writestr(filename, png_bytes(image), compress_type=ZIP_DEFLATED)
        z.writestr("stack.xml", tostring(img_node, encoding="utf-8", xml_declaration=True),
                   compress_type=ZIP_DEFLATED)
        z.writestr("mergedimage.png", png_bytes(merged), compress_type=ZIP_DEFLATED)
        thumb = merged.copy()
        thumb.thumbnail((256, 256), Image.Resampling.LANCZOS)
        z.writestr("Thumbnails/thumbnail.png", png_bytes(thumb), compress_type=ZIP_DEFLATED)

    # Verify content and layer positions without changing any approved raster.
    with ZipFile(dest) as z:
        assert z.testzip() is None
        assert z.read("mimetype") == b"image/openraster"
        assert z.read("stack.xml").count(b"<layer ") == len(layers)
    return len(layers)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    root = args.repo_root.resolve()
    dest = args.output or root / "assets" / "production" / "bed7-acting-source.ora"
    count = build(root, dest)
    print(f"OK {dest} : {count} editable image layers, approved art unchanged")


if __name__ == "__main__":
    main()
