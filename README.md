# Somnium Dream Board

Static gallery (framework Other, no build, output directory `.`) plus two Node routes that store camera shots in Vercel Blob. The page loads `/api/photos`. Cards stay upright on the bright pink daytime background. With no shots yet, the board shows an empty state.

## Environment variables

Set these on the **Vercel project** (Production and Preview):

| Name | Purpose |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Public Blob store token. Create a Blob store in the Vercel dashboard (or `vercel blob create-store`) and connect it to this project so the token is injected. `/api/upload` and `/api/photos` both need it. |
| `SOMNIUM_UPLOAD_TOKEN` | Shared secret. The laptop sends it in the `X-Somnium-Token` header. Generate a long random string and use the same value on the laptop. |

Set these on the **laptop** that runs the Somnium FastAPI server (not on Vercel):

| Name | Purpose |
| --- | --- |
| `SOMNIUM_UPLOAD_URL` | Full upload URL, for example `https://your-domain.vercel.app/api/upload`. |
| `SOMNIUM_UPLOAD_TOKEN` | The same secret as on Vercel. |

Copy `.env.example` when filling these in. Do not commit real values.

Vercel Functions accept about **4.5 MB** per request. A shot is the original JPEG, the dream JPEG, and the metadata JSON together, so keep each pair under about 4.2 MB.

## Deploy

Import this repo in Vercel. Framework preset **Other**, build command empty, output directory `.`. `package.json` only supplies `@vercel/blob` for the `/api` routes; there is no site build.

After the env vars above are set, deploy. Opening the site shows the empty state until the camera uploads a shot.

## Connect the camera

The Somnium server (`pipeline.py`) saves each shot in its `output_dir` (default `outputs`, resolved under `server/`):

- `<stem>_0_orig.jpg`
- `<stem>_1_dream.jpg`
- `<stem>.json` with `style_id`, `taken_at`, and `context` (place, day or night, weather)

Leave that repo as it is and run the watcher beside it:

```bash
export SOMNIUM_UPLOAD_URL=https://your-domain.vercel.app/api/upload
export SOMNIUM_UPLOAD_TOKEN=the-same-secret
python3 scripts/somnium_uploader.py watch /path/to/Somnium/server/outputs
```

`--once` uploads shots already in the folder and exits. One trio can also be sent directly:

```bash
python3 scripts/somnium_uploader.py upload path/STEM_0_orig.jpg path/STEM_1_dream.jpg path/STEM.json
```

The watcher records what it sent in `outputs/.somnium-uploaded.json` and retries anything that failed. It leaves a shot alone while its newest file is under 1.5 seconds old, ignores the state file and `*.tmp`, and stops retrying a shot after three HTTP 413 responses. Uploading the same stem again overwrites that shot.

Delete one uploaded shot (same URL and token):

```bash
python3 scripts/somnium_uploader.py delete STEM
```

On Windows, run the same commands with `py` instead of `python3`.

To push at the end of a request instead of polling, call `upload_shot` from your own code (this is optional; the watcher does not need it):

```python
import sys
from pathlib import Path
sys.path.append("/path/to/this-repo/scripts")
from somnium_uploader import upload_shot

orig = Path(result.meta["orig_path"])
dream = Path(result.meta["dream_path"])
meta = orig.with_name(orig.name.replace("_0_orig.jpg", ".json"))
upload_shot(orig, dream, meta)
```

`/api/upload` checks `X-Somnium-Token`, stores `shots/<stem>/orig.jpg`, `dream.jpg`, and a public `meta.json` in Blob, and `/api/photos` lists those shots newest first. Each photo keeps the pipeline field names: `style_id`, `prompt`, `taken_at`, `context` (`location_label`, `day_part`, `weather`, plus sun, astro, and mood fields when present), and `files.orig` / `files.dream` (public image URLs for `<stem>_0_orig.jpg` and `<stem>_1_dream.jpg`). The client IP and coordinates are left out. The response also includes the current `presets` list.

## Presets

Filters, badges, keywords, prompts, and preview images come from `presets.json`, copied from the camera's `creative/creative.json`. The filter row keeps that order except `surprise` is always last: All, COMIC, WATERCOLOR, ANIME, PENCIL SKETCH, SURPRISE. Every filter tab, including All, uses the same width, height, and 28px rounded thumbnail slot. Surprise stays last and, like any mode with no preview image, uses a pastel question-mark tile in that slot. A preview such as `previews/pencil.jpg` is copied beside the file. A `style_id` that is not in that file still renders, with the id itself as a generic badge. When the camera adds a mode, refresh the file and redeploy:

```bash
python3 scripts/sync_presets.py /path/to/Somnium/creative/creative.json
```

A raw GitHub URL works in place of the local path.

## Local

Static files only:

```bash
python3 -m http.server 8000
```

`/api/photos` is a Vercel function, so this server shows the "can't reach the photo feed" message. With Blob credentials in `.env.local`, `npx vercel dev` serves the page and both routes.

`scripts/sync_from_server.py` still copies shots into `images/shots/` and `gallery.json` for a manual commit. The live board does not read that file.
