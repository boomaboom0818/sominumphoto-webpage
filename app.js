const icons={comic:"💥",watercolor:"🎨",anime:"🌸",surprise:"🎲"};
let photos=[];
fetch("gallery.json",{cache:"no-store"}).then(r=>r.json()).then(d=>{photos=(d.photos||[]).sort((a,b)=>new Date(b.taken_at)-new Date(a.taken_at));render("all")});
function render(s){const b=document.getElementById("board");b.innerHTML="";
 photos.filter(p=>s==="all"||p.style_id===s).forEach(p=>{const t=new Date(p.taken_at),w=p.weather||{};
  const c=document.createElement("article");c.className="card";c.onclick=()=>c.classList.toggle("flip");
  c.innerHTML=`<div class="pic"><img src="${p.dream}" alt="${p.style_id} dream" loading="lazy"><img class="orig" src="${p.orig}" alt="original"><span class="badge">${icons[p.style_id]||"✨"} ${p.style_id}</span>${p.example?'<span class="badge ex">example</span>':""}</div>
  <div class="cap"><b>${p.location_label||"Somewhere"}</b><br><span>${t.toLocaleString([], {dateStyle:"medium",timeStyle:"short"})} · ${p.day_part==="night"?"🌙":"☀️"} ${w.summary||""}${w.temp_c!=null?` · ${Math.round(w.temp_c)}°C`:""}</span></div>`;b.appendChild(c)})}
document.querySelectorAll("nav button").forEach(x=>x.onclick=()=>{document.querySelector("nav .on").classList.remove("on");x.classList.add("on");render(x.dataset.s)});
