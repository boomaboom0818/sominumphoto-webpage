import { timingSafeEqual } from "node:crypto";
import presetFile from "../presets.json" with { type: "json" };

const SHOT_PREFIX = "shots/";
const MAX_IMAGE_BYTES = 4_000_000;
const MAX_META_BYTES = 256_000;
const MAX_TOTAL_BYTES = 4_200_000;
const LIST_PAGE_GUARD = 20;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function safeStem(value) {
  const stem = String(value || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(stem)) return null;
  if (stem.includes("..")) return null;
  return stem;
}

function stripJsonName(name) {
  return String(name || "").replace(/\.json$/i, "");
}

function stemFromOrigName(name) {
  return String(name || "").replace(/_0_orig\.jpe?g$/i, "");
}

export function stemFromUpload(metaName, meta) {
  let fromFile = safeStem(stripJsonName(metaName));
  if (fromFile === "meta" || fromFile === "blob") fromFile = null;
  const fromOrig = safeStem(stemFromOrigName(meta?.files?.orig));
  return fromFile || fromOrig;
}

function clip(value, max) {
  const text = String(value ?? "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function displayPresetOrder(presets) {
  const rest = [];
  const surprise = [];
  for (const preset of presets) {
    if (preset.id === "surprise") surprise.push(preset);
    else rest.push(preset);
  }
  return rest.concat(surprise);
}

export function presetList() {
  const presets = Array.isArray(presetFile.presets) ? presetFile.presets : [];
  return displayPresetOrder(presets.filter((preset) => preset && preset.id && preset.label));
}

export function presetFor(styleId) {
  return presetList().find((preset) => preset.id === styleId) || null;
}

export function decoratePhoto(photo) {
  const next = { ...photo };
  const preset = presetFor(next.style_id);
  if (preset) {
    next.label = preset.label;
    next.keywords = preset.keywords;
    delete next.known;
    return next;
  }
  next.label = next.style_id || "Dream";
  delete next.keywords;
  next.known = false;
  return next;
}

const WEATHER_NUMBERS = ["temp_c", "feels_like_c", "humidity_pct", "cloud_cover_pct", "wind_ms", "precip_mm", "pressure_hpa", "wmo_code"];

function copyWeather(weather) {
  if (!weather || typeof weather !== "object") return undefined;
  const out = {};
  if (weather.summary) out.summary = clip(weather.summary, 120);
  for (const key of WEATHER_NUMBERS) {
    const number = asNumber(weather[key]);
    if (number != null) out[key] = number;
  }
  return Object.keys(out).length ? out : undefined;
}

function copyStrings(value, max, limit) {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => clip(item, max)).filter(Boolean).slice(0, limit);
  return items.length ? items : undefined;
}

function publicContext(context) {
  const out = {};
  const location = clip(context.location_label, 200);
  if (location) out.location_label = location;
  if (context.day_part === "night" || context.day_part === "day") out.day_part = context.day_part;
  if (typeof context.is_night === "boolean") out.is_night = context.is_night;
  if (context.taken_at) out.taken_at = clip(context.taken_at, 80);
  if (context.source) out.source = clip(context.source, 40);
  if (context.summary) out.summary = clip(context.summary, 400);
  if (context.mood_watermark) out.mood_watermark = clip(context.mood_watermark, 400);
  const weather = copyWeather(context.weather);
  if (weather) out.weather = weather;
  const tags = copyStrings(context.mood_tags, 40, 12);
  if (tags) out.mood_tags = tags;
  const artifacts = copyStrings(context.artifacts, 160, 6);
  if (artifacts) out.artifacts = artifacts;
  if (context.sun && typeof context.sun === "object") {
    const sun = {};
    if (typeof context.sun.is_day === "boolean") sun.is_day = context.sun.is_day;
    for (const key of ["sunrise", "sunset", "description"]) {
      if (context.sun[key]) sun[key] = clip(context.sun[key], 80);
    }
    for (const key of ["uv_index_max", "daylight_hours", "altitude_deg"]) {
      const number = asNumber(context.sun[key]);
      if (number != null) sun[key] = number;
    }
    if (Object.keys(sun).length) out.sun = sun;
  }
  if (context.astro && typeof context.astro === "object") {
    const astro = {};
    if (context.astro.moon_phase) astro.moon_phase = clip(context.astro.moon_phase, 40);
    for (const key of ["moon_illumination", "moon_age_days"]) {
      const number = asNumber(context.astro[key]);
      if (number != null) astro[key] = number;
    }
    const bright = copyStrings(context.astro.bright_objects, 40, 8);
    if (bright) astro.bright_objects = bright;
    if (Object.keys(astro).length) out.astro = astro;
  }
  return out;
}

export function publicPhoto({ stem, meta, origUrl, dreamUrl, fallbackTakenAt }) {
  const context = meta.context && typeof meta.context === "object" ? meta.context : {};
  const taken = meta.taken_at || context.taken_at || fallbackTakenAt || null;
  const style = clip(meta.style_id, 40);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/.test(style)) {
    throw new HttpError(400, "style_id is missing or invalid");
  }
  const photo = {
    id: stem,
    style_id: style,
    taken_at: taken,
    context: publicContext(context),
    files: {
      orig: origUrl,
      dream: dreamUrl,
    },
  };
  const prompt = clip(meta.prompt, 4000);
  if (prompt) photo.prompt = prompt;
  return decoratePhoto(photo);
}

function assertBlobConfigured(env) {
  if (!env.BLOB_READ_WRITE_TOKEN && !env.BLOB_STORE_ID) {
    throw new HttpError(503, "BLOB_READ_WRITE_TOKEN is not configured");
  }
}

function assertUploadAuth(request, env) {
  const expected = env.SOMNIUM_UPLOAD_TOKEN || "";
  if (!expected) throw new HttpError(503, "SOMNIUM_UPLOAD_TOKEN is not configured");
  const header = request.headers.get("x-somnium-token") || "";
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const provided = header || bearer;
  if (!provided || !safeEqual(provided, expected)) throw new HttpError(401, "unauthorized");
}

async function fileBytes(file, label) {
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    throw new HttpError(400, `${label} file is required`);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) throw new HttpError(400, `${label} file is empty`);
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new HttpError(413, `${label} image is too large for the upload function`);
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new HttpError(400, `${label} must be a JPEG`);
  }
  return bytes;
}

async function readMeta(form) {
  const value = form.get("meta");
  if (value == null || value === "") throw new HttpError(400, "meta JSON is required");
  if (typeof value === "string") {
    if (Buffer.byteLength(value) > MAX_META_BYTES) throw new HttpError(413, "meta JSON is too large");
    return { name: "", text: value };
  }
  if (typeof value.arrayBuffer !== "function") throw new HttpError(400, "meta JSON is required");
  const bytes = Buffer.from(await value.arrayBuffer());
  if (bytes.length === 0) throw new HttpError(400, "meta JSON is empty");
  if (bytes.length > MAX_META_BYTES) throw new HttpError(413, "meta JSON is too large");
  return { name: value.name || "", text: bytes.toString("utf8") };
}

function parseMeta(text) {
  try {
    const meta = JSON.parse(text);
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
      throw new HttpError(400, "meta JSON must be an object");
    }
    return meta;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "meta JSON is invalid");
  }
}

async function putBytes(put, pathname, bytes, contentType, cacheControlMaxAge) {
  return put(pathname, bytes, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge,
  });
}

export async function uploadRequest(request, deps) {
  try {
    const env = deps.env || process.env;
    assertBlobConfigured(env);
    assertUploadAuth(request, env);
    const form = await request.formData();
    const orig = await fileBytes(form.get("orig"), "orig");
    const dream = await fileBytes(form.get("dream"), "dream");
    const metaFile = await readMeta(form);
    if (orig.length + dream.length + Buffer.byteLength(metaFile.text) > MAX_TOTAL_BYTES) {
      throw new HttpError(413, "shot is too large for the upload function (about 4.5 MB)");
    }
    const meta = parseMeta(metaFile.text);
    const stem = stemFromUpload(metaFile.name, meta);
    if (!stem) throw new HttpError(400, "could not derive a shot id from the meta filename");
    const fallbackTakenAt = new Date().toISOString();
    publicPhoto({ stem, meta, origUrl: "about:blank", dreamUrl: "about:blank", fallbackTakenAt });
    const origBlob = await putBytes(deps.put, `${SHOT_PREFIX}${stem}/orig.jpg`, orig, "image/jpeg", 60 * 60 * 24 * 30);
    const dreamBlob = await putBytes(deps.put, `${SHOT_PREFIX}${stem}/dream.jpg`, dream, "image/jpeg", 60 * 60 * 24 * 30);
    const photo = publicPhoto({
      stem,
      meta,
      origUrl: origBlob.url,
      dreamUrl: dreamBlob.url,
      fallbackTakenAt,
    });
    await putBytes(
      deps.put,
      `${SHOT_PREFIX}${stem}/meta.json`,
      Buffer.from(JSON.stringify(photo)),
      "application/json",
      60,
    );
    return json({ ok: true, photo });
  } catch (err) {
    return fail(err, "upload failed");
  }
}

async function listMetaBlobs(list) {
  const metas = [];
  let cursor;
  for (let page = 0; page < LIST_PAGE_GUARD; page += 1) {
    const result = await list({ prefix: SHOT_PREFIX, cursor, limit: 1000 });
    for (const blob of result.blobs || []) {
      if (String(blob.pathname || "").endsWith("/meta.json")) metas.push(blob);
    }
    if (!result.hasMore || !result.cursor) break;
    cursor = result.cursor;
  }
  return metas;
}

async function readStoredPhoto(get, blob) {
  const result = await get(blob.pathname, { access: "public", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const text = await new Response(result.stream).text();
  const photo = JSON.parse(text);
  const files = photo && photo.files;
  const dream = files?.dream || photo?.dream;
  const orig = files?.orig || photo?.orig;
  if (!photo || typeof photo !== "object" || !dream || !orig) return null;
  return decoratePhoto(photo);
}

function byNewest(a, b) {
  const left = Date.parse(a.taken_at || "");
  const right = Date.parse(b.taken_at || "");
  const delta = (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
  if (delta) return delta;
  return String(b.id || "").localeCompare(String(a.id || ""));
}

export async function photosRequest(_request, deps) {
  try {
    const env = deps.env || process.env;
    assertBlobConfigured(env);
    const metas = await listMetaBlobs(deps.list);
    const photos = [];
    const batchSize = 20;
    for (let i = 0; i < metas.length; i += batchSize) {
      const batch = metas.slice(i, i + batchSize);
      const rows = await Promise.all(batch.map(async (blob) => {
        try {
          return await readStoredPhoto(deps.get, blob);
        } catch (err) {
          console.error("skipping unreadable shot", blob.pathname, err);
          return null;
        }
      }));
      for (const photo of rows) if (photo) photos.push(photo);
    }
    photos.sort(byNewest);
    return json({ presets: presetList(), photos });
  } catch (err) {
    return fail(err, "could not list photos");
  }
}

function fail(err, fallback) {
  if (err instanceof HttpError) {
    if (err.status >= 500) console.error(err);
    return json({ error: err.message }, err.status);
  }
  console.error(err);
  return json({ error: fallback }, 500);
}
