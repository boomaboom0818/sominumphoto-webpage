let presets = [];
let presetById = {};
let presetsLoaded = false;
let photos = [];
let current = "all";

function contextOf(photo) {
  return photo.context && typeof photo.context === "object" ? photo.context : {};
}

function fileUrl(photo, kind) {
  const files = photo.files && typeof photo.files === "object" ? photo.files : {};
  return files[kind] || photo[kind] || "";
}

function emptyState(title, detail) {
  const wrap = document.createElement("div");
  wrap.className = "empty";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const copy = document.createElement("p");
  copy.textContent = detail;
  wrap.append(heading, copy);
  return wrap;
}

function whenLabel(value) {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return "Time unknown";
  return time.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function badgeFor(photo) {
  const preset = presetById[photo.style_id];
  if (preset) return { label: preset.label, keywords: preset.keywords || photo.keywords || "", generic: false };
  if (photo.known === false || presetsLoaded) {
    return { label: photo.style_id || "Dream", keywords: "", generic: true };
  }
  return { label: photo.label || photo.style_id || "Dream", keywords: photo.keywords || "", generic: false };
}

function displayPresetOrder(list) {
  const rest = [];
  const surprise = [];
  for (const preset of list) {
    if (preset.id === "surprise") surprise.push(preset);
    else rest.push(preset);
  }
  return rest.concat(surprise);
}

let questionTileCount = 0;

function questionTile() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "filter-preview placeholder");
  svg.setAttribute("viewBox", "0 0 28 28");
  svg.setAttribute("aria-hidden", "true");
  const gradientId = `surprise-tile-${++questionTileCount}`;
  const defs = document.createElementNS(ns, "defs");
  const gradient = document.createElementNS(ns, "linearGradient");
  gradient.id = gradientId;
  gradient.setAttribute("x1", "0");
  gradient.setAttribute("y1", "0");
  gradient.setAttribute("x2", "1");
  gradient.setAttribute("y2", "1");
  for (const [offset, color] of [["0%", "#fff6c9"], ["46%", "#ffd0e6"], ["100%", "#ff8fb8"]]) {
    const stop = document.createElementNS(ns, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    gradient.append(stop);
  }
  defs.append(gradient);
  const rect = document.createElementNS(ns, "rect");
  rect.setAttribute("width", "28");
  rect.setAttribute("height", "28");
  rect.setAttribute("rx", "8");
  rect.setAttribute("fill", `url(#${gradientId})`);
  const mark = document.createElementNS(ns, "text");
  mark.setAttribute("x", "14");
  mark.setAttribute("y", "20");
  mark.setAttribute("text-anchor", "middle");
  mark.setAttribute("font-family", "Fraunces, Georgia, serif");
  mark.setAttribute("font-size", "18");
  mark.setAttribute("font-weight", "600");
  mark.setAttribute("fill", "#9c1d55");
  mark.textContent = "?";
  svg.append(defs, rect, mark);
  return svg;
}

function previewTile(preset) {
  if (preset.preview) {
    const preview = document.createElement("img");
    preview.className = "filter-preview";
    preview.src = preset.preview;
    preview.alt = "";
    return preview;
  }
  return questionTile();
}

function filterLabel(text) {
  const label = document.createElement("span");
  label.className = "filter-label";
  label.textContent = text;
  return label;
}

function buildFilters() {
  const nav = document.getElementById("filters");
  const all = nav.querySelector('[data-s="all"]');
  nav.replaceChildren(all);
  all.classList.toggle("on", current === "all");
  for (const preset of presets) {
    const button = document.createElement("button");
    button.dataset.s = preset.id;
    button.append(previewTile(preset), filterLabel(preset.label));
    if (preset.keywords) button.title = preset.keywords;
    button.classList.toggle("on", current === preset.id);
    nav.append(button);
  }
}

function render(filter) {
  current = filter;
  const board = document.getElementById("board");
  board.replaceChildren();
  if (!photos.length) {
    board.append(emptyState("No dreams yet", "When the camera takes a shot, it will show up here."));
    return;
  }
  const visible = photos.filter((photo) => filter === "all" || photo.style_id === filter);
  if (!visible.length) {
    const preset = presetById[filter];
    const empty = emptyState("Nothing in this style yet", "Try another filter, or wait for the next shot.");
    if (preset && preset.preview) {
      const preview = document.createElement("img");
      preview.className = "style-preview";
      preview.src = preset.preview;
      preview.alt = `${preset.label} preview`;
      empty.prepend(preview);
    }
    board.append(empty);
    return;
  }
  for (const photo of visible) {
    const badgeInfo = badgeFor(photo);
    const context = contextOf(photo);
    const card = document.createElement("article");
    card.className = "card";
    bindCardToggle(card);

    const pic = document.createElement("div");
    pic.className = "pic";
    const dream = document.createElement("img");
    dream.src = fileUrl(photo, "dream");
    dream.alt = `${badgeInfo.label} dream`;
    dream.loading = "lazy";
    const orig = document.createElement("img");
    orig.className = "orig";
    orig.src = fileUrl(photo, "orig");
    orig.alt = "Original photo";
    const badge = document.createElement("span");
    badge.className = badgeInfo.generic ? "badge generic" : "badge";
    badge.textContent = badgeInfo.label;
    const hint = document.createElement("span");
    hint.className = "view-hint";
    hint.setAttribute("aria-hidden", "true");
    const dreamHint = document.createElement("span");
    dreamHint.className = "when-dream";
    dreamHint.textContent = "Dream";
    const origHint = document.createElement("span");
    origHint.className = "when-orig";
    origHint.textContent = "Original";
    hint.append(dreamHint, origHint);
    pic.append(dream, orig, badge, hint, dreamDownloadButton(photo));

    const cap = document.createElement("div");
    cap.className = "cap";
    const place = document.createElement("b");
    place.textContent = context.location_label || "Somewhere";
    const line = document.createElement("span");
    const weather = context.weather || {};
    const bits = [whenLabel(photo.taken_at || context.taken_at)];
    if (context.day_part === "night") bits.push("🌙");
    else if (context.day_part === "day") bits.push("☀️");
    if (weather.summary) bits.push(weather.summary);
    if (typeof weather.temp_c === "number") bits.push(`${Math.round(weather.temp_c)}°C`);
    line.textContent = bits.join(" · ");
    cap.append(place, document.createElement("br"), line);

    card.append(pic, cap);
    board.append(card);
  }
}

function dreamFilename(id) {
  const safe = String(id || "shot").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "shot";
  return `somnium-${safe}-dream.jpg`;
}

function prefersFileShare() {
  const ua = navigator.userAgent || "";
  const appleMobile = /iPad|iPhone|iPod/.test(ua);
  const ipadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return appleMobile || ipadOs;
}

async function saveDreamFile(url, filename) {
  let blob;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(String(response.status));
    blob = await response.blob();
  } catch {
    window.open(url, "_blank", "noopener");
    return;
  }
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  if (prefersFileShare() && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

function dreamDownloadButton(photo) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "download";
  button.setAttribute("aria-label", "Download dream image");
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  for (const d of ["M12 4v10", "M8 10l4 4 4-4", "M5 19h14"]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    icon.append(path);
  }
  button.append(icon);
  const stop = (event) => event.stopPropagation();
  button.addEventListener("pointerdown", stop);
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
  button.addEventListener("keydown", stop);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (button.dataset.busy === "true") return;
    button.dataset.busy = "true";
    saveDreamFile(fileUrl(photo, "dream"), dreamFilename(photo.id)).finally(() => {
      delete button.dataset.busy;
    });
  });
  return button;
}

function bindCardToggle(card) {
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-pressed", "false");
  card.setAttribute("aria-label", "Toggle between the dream and the original photo");
  let gesture = null;
  let swallowClick = false;
  const toggle = () => {
    const on = !card.classList.contains("show-orig");
    card.classList.toggle("show-orig", on);
    card.setAttribute("aria-pressed", on ? "true" : "false");
  };
  const touchLike = (event) => event.pointerType === "touch" || window.matchMedia("(hover: none)").matches;
  const onDownload = (event) => event.target.closest && event.target.closest(".download");
  card.addEventListener("pointerdown", (event) => {
    if (onDownload(event) || event.button > 0 || !touchLike(event)) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  });
  card.addEventListener("pointermove", (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) gesture.moved = true;
  });
  card.addEventListener("pointerup", (event) => {
    if (onDownload(event)) return;
    if (!gesture || event.pointerId !== gesture.id) return;
    const moved = gesture.moved;
    gesture = null;
    swallowClick = true;
    if (!moved) toggle();
  });
  card.addEventListener("pointercancel", (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    gesture = null;
    swallowClick = true;
  });
  card.addEventListener("click", (event) => {
    if (onDownload(event)) return;
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    if (event.detail === 0 || window.matchMedia("(hover: none)").matches) return;
    toggle();
  });
  card.addEventListener("keydown", (event) => {
    if (onDownload(event)) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  });
}

document.getElementById("filters").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !button.dataset.s) return;
  document.querySelectorAll("#filters button").forEach((item) => item.classList.remove("on"));
  button.classList.add("on");
  render(button.dataset.s);
});

Promise.all([
  fetch("/presets.json", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : { presets: [] }))
    .catch(() => ({ presets: [] })),
  fetch("/api/photos", { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }),
])
  .then(([presetFile, data]) => {
    const fromFile = Array.isArray(presetFile.presets) ? presetFile.presets : [];
    const fromApi = Array.isArray(data.presets) ? data.presets : [];
    presets = displayPresetOrder(fromFile.length ? fromFile : fromApi);
    presetById = Object.fromEntries(presets.map((preset) => [preset.id, preset]));
    presetsLoaded = true;
    photos = (data.photos || []).slice().sort((a, b) => new Date(b.taken_at) - new Date(a.taken_at));
    buildFilters();
    render(current);
  })
  .catch(() => {
    document.getElementById("board").replaceChildren(
      emptyState("The dream board can't reach the photo feed right now.", "Check the connection, then refresh."),
    );
  });
