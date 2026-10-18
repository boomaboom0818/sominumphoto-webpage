const STYLES = {
  popcomic: { label: "COMIC", keywords: "cel-shaded color grade, soft outlines, flat pastel tones" },
  watercolor: { label: "WATERCOLOR", keywords: "soft watercolor wash, paper tooth, pigment blooms" },
  anime: { label: "ANIME", keywords: "anime cel shade, expressive eyes, clean linework, soft screen-tone, vibrant palette" },
  surprise: { label: "SURPRISE", keywords: "unexpected style twist, mood-led grade, playful reinterpretation" },
};

let photos = [];

function preset(photo) {
  return STYLES[photo.style_id] || {};
}

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

function render(filter) {
  const board = document.getElementById("board");
  board.replaceChildren();
  if (!photos.length) {
    board.append(emptyState("No dreams yet", "When the camera takes a shot, it will show up here."));
    return;
  }
  const visible = photos.filter((photo) => filter === "all" || photo.style_id === filter);
  if (!visible.length) {
    board.append(emptyState("Nothing in this style yet", "Try another filter, or wait for the next shot."));
    return;
  }
  for (const photo of visible) {
    const style = preset(photo);
    const context = contextOf(photo);
    const label = photo.label || style.label || photo.style_id || "Dream";
    const keywords = photo.keywords || style.keywords || "";
    const card = document.createElement("article");
    card.className = "card";
    card.addEventListener("click", () => card.classList.toggle("flip"));

    const pic = document.createElement("div");
    pic.className = "pic";
    const dream = document.createElement("img");
    dream.src = fileUrl(photo, "dream");
    dream.alt = `${label} dream`;
    dream.loading = "lazy";
    const orig = document.createElement("img");
    orig.className = "orig";
    orig.src = fileUrl(photo, "orig");
    orig.alt = "Original photo";
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = label;
    pic.append(dream, orig, badge);

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
    if (keywords) {
      const desc = document.createElement("span");
      desc.className = "desc";
      desc.textContent = keywords;
      cap.append(desc);
    }

    card.append(pic, cap);
    board.append(card);
  }
}

document.querySelectorAll("nav button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("nav .on").classList.remove("on");
    button.classList.add("on");
    render(button.dataset.s);
  });
});

fetch("/api/photos", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  })
  .then((data) => {
    photos = (data.photos || []).slice().sort((a, b) => new Date(b.taken_at) - new Date(a.taken_at));
    render("all");
  })
  .catch(() => {
    document.getElementById("board").replaceChildren(
      emptyState("The dream board can't reach the photo feed right now.", "Check the connection, then refresh."),
    );
  });
