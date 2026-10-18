#!/usr/bin/env python3
"""Copy Somnium server outputs (<stem>_0_orig.jpg, <stem>_1_dream.jpg, <stem>.json) into
images/shots/ and merge them into gallery.json. Usage:
  python3 scripts/sync_from_server.py /path/to/Somnium/server/outputs [--drop-examples]"""
import json, shutil, sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent; out=Path(sys.argv[1]); dest=root/"images/shots"; dest.mkdir(parents=True,exist_ok=True)
g=json.loads((root/"gallery.json").read_text())
if "--drop-examples" in sys.argv: g["photos"]=[p for p in g["photos"] if not p.get("example")]
have={p["id"] for p in g["photos"]}; added=0
for m in sorted(out.glob("*.json")):
    meta=json.loads(m.read_text()); f=meta.get("files",{}); ctx=meta.get("context",{})
    if m.stem in have or not f.get("dream"): continue
    for k in ("orig","dream"): shutil.copy2(out/f[k], dest/f[k])
    w=ctx.get("weather",{})
    g["photos"].append(dict(id=m.stem,style_id=meta.get("style_id"),taken_at=meta.get("taken_at") or ctx.get("taken_at"),
      location_label=ctx.get("location_label"),day_part=ctx.get("day_part"),
      weather={"summary":w.get("summary"),"temp_c":w.get("temp_c")},
      orig=f"images/shots/{f['orig']}",dream=f"images/shots/{f['dream']}")); added+=1
(root/"gallery.json").write_text(json.dumps(g,indent=2)); print(f"added {added}, total {len(g['photos'])}")
