# Somnium Dream Board (static, Vercel-ready)
Static site: index.html, style.css, app.js, gallery.json (manifest), images/.
Entries with `"example": true` are placeholder data.

## Add photos
Somnium server writes `<stem>_0_orig.jpg`, `<stem>_1_dream.jpg`, `<stem>.json` to its `output_dir` (default `outputs`).
    python3 scripts/sync_from_server.py /path/to/Somnium/server/outputs --drop-examples
Then commit and redeploy (or `vercel --prod`). Possible later step: have the FastAPI server run this script after each shot.

## Local
    python3 -m http.server 8000
## Deploy
`vercel` in this folder (Framework: Other, no build command, output dir `.`), or import the Git repo in Vercel and add the custom domain under Project → Domains.
