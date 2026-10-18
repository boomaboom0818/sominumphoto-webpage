#!/usr/bin/env python3
"""Refresh presets.json from Somnium creative/creative.json.

The dream board reads this one file for filter buttons, badges, keywords,
and /api/photos. Re-run it when the camera adds or renames a mode.

Usage:
  python3 scripts/sync_presets.py /path/to/Somnium/creative/creative.json
  python3 scripts/sync_presets.py https://raw.githubusercontent.com/mm-nair/Somnium/main/creative/creative.json
"""

from __future__ import annotations

import json
import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "presets.json"
PREVIEW_DIR = ROOT / "previews"


def load_creative(source: str) -> dict:
    if source.startswith("http://") or source.startswith("https://"):
        request = urllib.request.Request(source, headers={"User-Agent": "somnium-presets/1"})
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode())
    return json.loads(Path(source).read_text())


def safe_preview(value: str) -> str:
    rel = str(value or "").strip().replace("\\", "/")
    path = Path(rel)
    if not rel or path.is_absolute() or ".." in path.parts:
        raise SystemExit(f"unsafe preview path: {value}")
    return rel


def presets_from(creative: dict) -> list[dict]:
    modes = creative.get("modes") or []
    if not isinstance(modes, list) or not modes:
        raise SystemExit("creative.json has no modes")
    presets = []
    seen = set()
    for mode in modes:
        if not isinstance(mode, dict) or not mode.get("id") or not mode.get("label"):
            raise SystemExit(f"mode is missing id or label: {mode!r}")
        style_id = str(mode["id"])
        if style_id in seen:
            raise SystemExit(f"duplicate mode id: {style_id}")
        seen.add(style_id)
        preset = {
            "id": style_id,
            "label": str(mode["label"]),
            "keywords": str(mode.get("keywords") or ""),
            "prompt": str(mode.get("prompt") or ""),
        }
        if mode.get("preview"):
            preset["preview"] = safe_preview(mode["preview"])
        presets.append(preset)
    return presets


def copy_previews(presets: list[dict], source: str) -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    kept = set()
    creative_dir = None if source.startswith(("http://", "https://")) else Path(source).resolve().parent
    url_dir = source.rsplit("/", 1)[0] if creative_dir is None else ""
    for preset in presets:
        rel = preset.get("preview")
        if not rel:
            continue
        dest = ROOT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if creative_dir is not None:
            src = creative_dir / rel
            if not src.is_file():
                raise SystemExit(f"missing preview: {src}")
            shutil.copyfile(src, dest)
        else:
            preview_url = f"{url_dir}/{rel}"
            request = urllib.request.Request(preview_url, headers={"User-Agent": "somnium-presets/1"})
            with urllib.request.urlopen(request, timeout=30) as response:
                dest.write_bytes(response.read())
        kept.add(dest.resolve())
    for image in PREVIEW_DIR.iterdir():
        if image.is_file() and image.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} and image.resolve() not in kept:
            image.unlink()


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) != 1:
        print("usage: python3 scripts/sync_presets.py CREATIVE_JSON", file=sys.stderr)
        return 1
    presets = presets_from(load_creative(args[0]))
    copy_previews(presets, args[0])
    DEST.write_text(json.dumps({"presets": presets}, indent=2) + "\n")
    print(f"wrote {DEST.relative_to(ROOT)} ({len(presets)} presets)")
    for preset in presets:
        preview = f"  {preset['preview']}" if preset.get("preview") else ""
        print(f"  {preset['id']}: {preset['label']}{preview}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
