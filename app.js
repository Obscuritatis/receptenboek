/* Mijn Receptenboek — alles draait in de browser, gegevens staan in IndexedDB op dit toestel. */
(() => {
  "use strict";

  const DB_NAME = "receptenboek";
  const STORE = "kv";
  const STATE_KEY = "state";

  const DEFAULT_CATEGORIES = [
    ["Desserts", "🍮"],
    ["Voorgerechten", "🥗"],
    ["Soepen", "🍲"],
    ["Hoofdgerechten", "🍝"],
    ["Bijgerechten", "🥔"],
    ["Gebak & taart", "🥧"],
    ["Ontbijt & brunch", "🥐"],
    ["Sauzen & dips", "🫙"],
    ["Dranken", "🍹"],
  ];

  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  let state = null;
  let wakeLock = null;

  // ---------- Opslag ----------
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbSet(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function freshState() {
    return {
      version: 1,
      categories: DEFAULT_CATEGORIES.map(([name, emoji]) => ({ id: uid(), name, emoji })),
      recipes: [],
    };
  }

  async function load() {
    try {
      state = (await dbGet(STATE_KEY)) || null;
    } catch (e) {
      console.warn("IndexedDB niet beschikbaar", e);
    }
    if (!state) {
      state = freshState();
      await save();
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  async function save() {
    try {
      await dbSet(STATE_KEY, state);
    } catch (e) {
      console.error(e);
      toast("Opslaan mislukt: " + (e && e.message ? e.message : e));
    }
  }

  // ---------- Hulpjes ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (toastEl.hidden = true), 2600);
  }

  const catById = (id) => state.categories.find((c) => c.id === id);
  const recipeById = (id) => state.recipes.find((r) => r.id === id);
  const recipesIn = (catId) =>
    state.recipes.filter((r) => r.categoryId === catId).sort((a, b) => a.title.localeCompare(b.title, "nl"));

  function lines(text) {
    return String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  }

  function formatMinutes(min) {
    min = Number(min) || 0;
    if (!min) return "";
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${m} min`;
    return m ? `${h} u ${m} min` : `${h} u`;
  }

  // Hoeveelheden aan het begin van een ingrediënt herschalen ("200 g", "1,5 dl", "1/2 citroen", "½ tl")
  const FRACTIONS = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
  function scaleLine(line, factor) {
    if (factor === 1) return esc(line);
    const m = line.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])(\s*-\s*(\d+(?:[.,]\d+)?))?/);
    if (!m) return esc(line);
    const toNum = (s) => {
      if (FRACTIONS[s] !== undefined) return FRACTIONS[s];
      if (/^\d+\s+\d+\/\d+$/.test(s)) { const [w, f] = s.split(/\s+/); const [a, b] = f.split("/"); return +w + a / b; }
      if (s.includes("/")) { const [a, b] = s.split("/"); return a / b; }
      return parseFloat(s.replace(",", "."));
    };
    const fmt = (n) => {
      const r = Math.round(n * 100) / 100;
      return String(r).replace(".", ",");
    };
    let out = fmt(toNum(m[1]) * factor);
    if (m[3]) out += " - " + fmt(toNum(m[3]) * factor);
    return `<strong>${out}</strong>${esc(line.slice(m[0].length))}`;
  }

  async function resizeImage(file, max = 1400) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.82);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------- Router ----------
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, query] = h.split("?");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    return { parts, params: new URLSearchParams(query || "") };
  }

  function render() {
    releaseWakeLock();
    const { parts, params } = parseHash();
    const [page, id] = parts;
    let html;
    switch (page) {
      case undefined: html = viewHome(); break;
      case "categorie": html = viewCategory(id); break;
      case "recept": html = viewRecipe(id); break;
      case "nieuw": html = viewForm(null, params.get("cat")); break;
      case "bewerk": html = viewForm(id); break;
      case "zoeken": html = viewSearch(params.get("q") || ""); break;
      case "instellingen": html = viewSettings(); break;
      default: html = viewNotFound();
    }
    app.innerHTML = html;
    window.scrollTo(0, 0);
    bind(page, id);
  }

  // ---------- Weergaven ----------
  function recipeCard(r) {
    const cat = catById(r.categoryId);
    const thumb = r.photo
      ? `<div class="thumb" style="background-image:url('${r.photo}')"></div>`
      : `<div class="thumb nophoto">${esc(cat ? cat.emoji : "🍽️")}</div>`;
    const total = (Number(r.prepTime) || 0) + (Number(r.cookTime) || 0);
    return `<a class="card" href="#/recept/${r.id}">
      ${thumb}
      <div class="body">
        <div class="title">${r.favorite ? "♥ " : ""}${esc(r.title)}</div>
        <div class="meta">
          ${total ? `<span>⏱ ${formatMinutes(total)}</span>` : ""}
          ${r.servings ? `<span>🍽 ${esc(r.servings)} pers.</span>` : ""}
        </div>
      </div>
    </a>`;
  }

  function viewHome() {
    const [first, ...rest] = state.categories;
    const tile = (c, featured) => {
      const n = recipesIn(c.id).length;
      return `<a class="tile${featured ? " featured" : ""}" href="#/categorie/${c.id}">
        <span class="emoji" aria-hidden="true">${esc(c.emoji)}</span>
        <span class="name">${esc(c.name)}</span>
        <span class="count">${n === 1 ? "1 recept" : `${n} recepten`}</span>
      </a>`;
    };
    const favorites = state.recipes.filter((r) => r.favorite);
    const recent = [...state.recipes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4);
    return `
      <section class="hero">
        <h1>Mijn Receptenboek</h1>
        <p>Lievelingsrecepten, netjes bij elkaar.</p>
        <div class="ornament" aria-hidden="true">✻</div>
      </section>
      <div class="tiles">
        ${first ? tile(first, true) : ""}
        ${rest.map((c) => tile(c, false)).join("")}
      </div>
      ${favorites.length ? `<h2 class="section-title">Favorieten</h2><div class="cards">${favorites.map(recipeCard).join("")}</div>` : ""}
      ${recent.length ? `<h2 class="section-title">Laatst bijgewerkt</h2><div class="cards">${recent.map(recipeCard).join("")}</div>` : ""}
      ${!state.recipes.length ? `<div class="empty" style="margin-top:24px"><span class="big">📖</span>Je receptenboek is nog leeg. Tik op <b>Nieuw recept</b> om te beginnen.</div>` : ""}
      <a class="btn fab" href="#/nieuw">＋ Nieuw recept</a>`;
  }

  function viewCategory(id) {
    const cat = catById(id);
    if (!cat) return viewNotFound();
    const list = recipesIn(id);
    return `
      <div class="crumbs"><a href="#/">Receptenboek</a> › ${esc(cat.name)}</div>
      <h1>${esc(cat.emoji)} ${esc(cat.name)}</h1>
      <p class="muted">${list.length === 1 ? "1 recept" : `${list.length} recepten`}</p>
      ${list.length
        ? `<div class="cards">${list.map(recipeCard).join("")}</div>`
        : `<div class="empty"><span class="big">${esc(cat.emoji)}</span>Nog geen recepten in ${esc(cat.name.toLowerCase())}.<div class="btn-row" style="justify-content:center"><a class="btn" href="#/nieuw?cat=${cat.id}">Eerste recept toevoegen</a></div></div>`}
      <a class="btn fab" href="#/nieuw?cat=${cat.id}">＋ Nieuw recept</a>`;
  }

  function viewRecipe(id) {
    const r = recipeById(id);
    if (!r) return viewNotFound();
    const cat = catById(r.categoryId);
    const servings = Number(r.servings) || 0;
    const facts = [
      r.prepTime ? [formatMinutes(r.prepTime), "Voorbereiding"] : null,
      r.cookTime ? [formatMinutes(r.cookTime), "Bereiding"] : null,
    ].filter(Boolean);
    return `
      <div class="crumbs"><a href="#/">Receptenboek</a> › ${cat ? `<a href="#/categorie/${cat.id}">${esc(cat.name)}</a>` : "Zonder categorie"}</div>
      <article class="recipe">
        ${r.photo ? `<img class="photo" src="${r.photo}" alt="">` : ""}
        <div class="inner">
          <div class="kicker">${cat ? esc(cat.emoji + " " + cat.name) : ""}</div>
          <h1>${esc(r.title)}</h1>
          ${r.description ? `<p class="intro">${esc(r.description)}</p>` : ""}
          <div class="facts">
            ${servings ? `<div class="fact"><b class="servings">
                <button type="button" data-serv="-1" aria-label="Minder personen">−</button>
                <span id="servCount">${servings}</span>
                <button type="button" data-serv="1" aria-label="Meer personen">+</button></b>
                <small>Personen</small></div>` : ""}
            ${facts.map(([v, l]) => `<div class="fact"><b>${v}</b><small>${l}</small></div>`).join("")}
          </div>
          <div class="toolbar">
            <button class="btn ghost small" type="button" id="favBtn">${r.favorite ? "♥ Favoriet" : "♡ Favoriet"}</button>
            <a class="btn ghost small" href="#/bewerk/${r.id}">✎ Bewerken</a>
            <button class="btn ghost small" type="button" id="printBtn">⎙ Afdrukken</button>
            ${"wakeLock" in navigator ? `<label class="toggle"><input type="checkbox" id="wakeToggle"> Scherm aan houden</label>` : ""}
          </div>
          <div class="recipe-cols">
            <section>
              <h2>Ingrediënten</h2>
              <ul class="ingredients" id="ingredients"></ul>
            </section>
            <section>
              <h2>Bereiding</h2>
              <ol class="steps">
                ${r.steps.map((s) => (s.startsWith("#")
                  ? `<li class="sub">${esc(s.replace(/^#+\s*/, ""))}</li>`
                  : `<li tabindex="0">${esc(s)}</li>`)).join("")}
              </ol>
            </section>
          </div>
          ${r.notes ? `<div class="notes"><b>Tip:</b> ${esc(r.notes)}</div>` : ""}
          ${r.source ? `<p class="source">Bron: ${/^https?:\/\//.test(r.source) ? `<a href="${esc(r.source)}" target="_blank" rel="noopener">${esc(r.source)}</a>` : esc(r.source)}</p>` : ""}
        </div>
      </article>`;
  }

  function renderIngredients(r, factor) {
    const ul = document.getElementById("ingredients");
    if (!ul) return;
    const checked = new Set([...ul.querySelectorAll("input:checked")].map((i) => i.dataset.i));
    ul.innerHTML = r.ingredients.map((line, i) => (line.startsWith("#")
      ? `<li class="sub">${esc(line.replace(/^#+\s*/, ""))}</li>`
      : `<li><label><input type="checkbox" data-i="${i}" ${checked.has(String(i)) ? "checked" : ""}><span>${scaleLine(line, factor)}</span></label></li>`)).join("");
  }

  function viewForm(id, presetCat) {
    const r = id ? recipeById(id) : null;
    if (id && !r) return viewNotFound();
    const v = r || { title: "", categoryId: presetCat || state.categories[0]?.id, description: "", servings: 4, prepTime: "", cookTime: "", ingredients: [], steps: [], notes: "", source: "", photo: "" };
    return `
      <div class="crumbs"><a href="#/">Receptenboek</a> › ${r ? `<a href="#/recept/${r.id}">${esc(r.title)}</a> › Bewerken` : "Nieuw recept"}</div>
      <h1>${r ? "Recept bewerken" : "Nieuw recept"}</h1>
      <form class="form" id="recipeForm" autocomplete="off">
        <div class="field">
          <label for="f-title">Naam van het gerecht</label>
          <input type="text" id="f-title" name="title" required value="${esc(v.title)}" placeholder="bv. Chocolademousse van oma">
        </div>
        <div class="field">
          <label for="f-cat">Categorie</label>
          <select id="f-cat" name="categoryId">
            ${state.categories.map((c) => `<option value="${c.id}" ${c.id === v.categoryId ? "selected" : ""}>${esc(c.emoji)} ${esc(c.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="f-desc">Korte omschrijving <span class="hint">(optioneel)</span></label>
          <input type="text" id="f-desc" name="description" value="${esc(v.description)}" placeholder="Luchtig, rijk en klaar in een kwartier">
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="f-serv">Personen</label>
            <input type="number" id="f-serv" name="servings" min="0" step="1" inputmode="numeric" value="${esc(v.servings)}">
          </div>
          <div class="field">
            <label for="f-prep">Voorbereiding <span class="hint">(min)</span></label>
            <input type="number" id="f-prep" name="prepTime" min="0" step="1" inputmode="numeric" value="${esc(v.prepTime)}">
          </div>
          <div class="field">
            <label for="f-cook">Bereiding <span class="hint">(min)</span></label>
            <input type="number" id="f-cook" name="cookTime" min="0" step="1" inputmode="numeric" value="${esc(v.cookTime)}">
          </div>
        </div>
        <div class="field">
          <label for="f-ingr">Ingrediënten <span class="hint">— één per regel. Begin een regel met # voor een tussenkop, bv. “# Voor de saus”.</span></label>
          <textarea id="f-ingr" name="ingredients" placeholder="200 g pure chocolade&#10;4 eieren&#10;50 g suiker">${esc(v.ingredients.join("\n"))}</textarea>
        </div>
        <div class="field">
          <label for="f-steps">Bereiding <span class="hint">— één stap per regel, ook hier kan # voor een tussenkop.</span></label>
          <textarea id="f-steps" name="steps" placeholder="Smelt de chocolade au bain-marie.&#10;Splits de eieren…">${esc(v.steps.join("\n"))}</textarea>
        </div>
        <div class="field">
          <label for="f-notes">Tips of notities <span class="hint">(optioneel)</span></label>
          <textarea id="f-notes" name="notes" style="min-height:80px">${esc(v.notes)}</textarea>
        </div>
        <div class="field">
          <label for="f-src">Bron <span class="hint">(optioneel: boek, website of persoon)</span></label>
          <input type="text" id="f-src" name="source" value="${esc(v.source)}">
        </div>
        <div class="field">
          <span class="label">Foto <span class="hint">(optioneel)</span></span>
          <input type="file" id="f-photo" accept="image/*">
          <img id="photoPreview" class="photo-preview" ${v.photo ? `src="${v.photo}"` : "hidden"} alt="">
          <button type="button" class="btn ghost small" id="removePhoto" style="margin-top:8px" ${v.photo ? "" : "hidden"}>Foto verwijderen</button>
        </div>
        <div class="btn-row">
          <button class="btn" type="submit">Opslaan</button>
          <a class="btn ghost" href="${r ? `#/recept/${r.id}` : "#/"}">Annuleren</a>
          ${r ? `<button class="btn danger" type="button" id="deleteBtn" style="margin-left:auto">Verwijderen</button>` : ""}
        </div>
      </form>`;
  }

  function viewSearch(q) {
    return `
      <h1>Zoeken</h1>
      <div class="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" id="q" value="${esc(q)}" placeholder="Zoek op naam of ingrediënt…" aria-label="Zoeken" autofocus>
      </div>
      <div id="results"></div>`;
  }

  function searchResults(q) {
    const term = q.trim().toLowerCase();
    if (!term) return `<p class="muted">Typ een gerecht of ingrediënt, bv. “chocolade”.</p>`;
    const hits = state.recipes.filter((r) =>
      [r.title, r.description, r.notes, ...r.ingredients].join(" ").toLowerCase().includes(term));
    return hits.length
      ? `<div class="cards">${hits.map(recipeCard).join("")}</div>`
      : `<div class="empty"><span class="big">🔍</span>Niets gevonden voor “${esc(q)}”.</div>`;
  }

  function viewSettings() {
    return `
      <div class="crumbs"><a href="#/">Receptenboek</a> › Instellingen</div>
      <h1>Instellingen</h1>
      <section class="panel">
        <h2>Categorieën</h2>
        <p class="muted">De bovenste categorie staat groot op de startpagina. Een categorie kan je pas verwijderen als ze leeg is.</p>
        <ul class="cat-list" id="catList">
          ${state.categories.map((c, i) => `<li data-id="${c.id}">
            <input class="emoji-in" type="text" value="${esc(c.emoji)}" aria-label="Icoon" maxlength="4">
            <input class="name-in" type="text" value="${esc(c.name)}" aria-label="Naam">
            <button class="iconbtn" type="button" data-move="-1" aria-label="Omhoog" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="iconbtn" type="button" data-move="1" aria-label="Omlaag" ${i === state.categories.length - 1 ? "disabled" : ""}>↓</button>
            <button class="iconbtn" type="button" data-del aria-label="Verwijderen" title="${recipesIn(c.id).length ? "Bevat nog recepten" : "Verwijderen"}" ${recipesIn(c.id).length ? "disabled" : ""}>✕</button>
          </li>`).join("")}
        </ul>
        <div class="btn-row"><button class="btn ghost" type="button" id="addCat">＋ Categorie toevoegen</button></div>
      </section>
      <section class="panel">
        <h2>Back-up</h2>
        <p class="muted">Je recepten worden alleen op dit toestel bewaard. Maak af en toe een back-up, of gebruik die om je recepten naar een ander toestel over te zetten.</p>
        <div class="btn-row">
          <button class="btn" type="button" id="exportBtn">Back-up downloaden</button>
          <label class="btn ghost" for="importFile" style="cursor:pointer">Back-up terugzetten</label>
          <input type="file" id="importFile" accept="application/json,.json" hidden>
        </div>
      </section>
      <p class="muted" style="text-align:center">${state.recipes.length} recepten in ${state.categories.length} categorieën</p>`;
  }

  function viewNotFound() {
    return `<div class="empty"><span class="big">🍳</span>Deze pagina bestaat niet (meer).<div class="btn-row" style="justify-content:center"><a class="btn" href="#/">Naar het overzicht</a></div></div>`;
  }

  // ---------- Interactie ----------
  function bind(page, id) {
    if (page === "recept") bindRecipe(recipeById(id));
    if (page === "nieuw" || page === "bewerk") bindForm(id ? recipeById(id) : null);
    if (page === "zoeken") bindSearch();
    if (page === "instellingen") bindSettings();
  }

  function bindRecipe(r) {
    if (!r) return;
    const base = Number(r.servings) || 0;
    let current = base;
    renderIngredients(r, 1);
    app.querySelectorAll("[data-serv]").forEach((b) => b.addEventListener("click", () => {
      current = Math.max(1, current + Number(b.dataset.serv));
      document.getElementById("servCount").textContent = current;
      renderIngredients(r, base ? current / base : 1);
    }));
    app.querySelectorAll(".steps li:not(.sub)").forEach((li) => {
      const toggle = () => li.classList.toggle("done");
      li.addEventListener("click", toggle);
      li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
    document.getElementById("favBtn").addEventListener("click", async (e) => {
      r.favorite = !r.favorite;
      e.currentTarget.textContent = r.favorite ? "♥ Favoriet" : "♡ Favoriet";
      await save();
    });
    document.getElementById("printBtn").addEventListener("click", () => window.print());
    const wake = document.getElementById("wakeToggle");
    if (wake) wake.addEventListener("change", async () => {
      if (wake.checked) {
        try {
          wakeLock = await navigator.wakeLock.request("screen");
          toast("Het scherm blijft aan zolang dit recept open staat");
        } catch { wake.checked = false; toast("Scherm aan houden lukt niet op dit toestel"); }
      } else releaseWakeLock();
    });
  }

  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  function bindForm(r) {
    const form = document.getElementById("recipeForm");
    let photo = r ? r.photo || "" : "";
    const preview = document.getElementById("photoPreview");
    const removeBtn = document.getElementById("removePhoto");

    document.getElementById("f-photo").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        photo = await resizeImage(file);
        preview.src = photo; preview.hidden = false; removeBtn.hidden = false;
      } catch { toast("Deze foto kon niet gelezen worden"); }
    });
    removeBtn.addEventListener("click", () => {
      photo = ""; preview.hidden = true; removeBtn.hidden = true;
      document.getElementById("f-photo").value = "";
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const data = {
        title: String(f.get("title")).trim(),
        categoryId: f.get("categoryId"),
        description: String(f.get("description")).trim(),
        servings: f.get("servings") ? Number(f.get("servings")) : "",
        prepTime: f.get("prepTime") ? Number(f.get("prepTime")) : "",
        cookTime: f.get("cookTime") ? Number(f.get("cookTime")) : "",
        ingredients: lines(f.get("ingredients")),
        steps: lines(f.get("steps")),
        notes: String(f.get("notes")).trim(),
        source: String(f.get("source")).trim(),
        photo,
        updatedAt: Date.now(),
      };
      if (!data.title) return;
      let target = r;
      if (target) Object.assign(target, data);
      else {
        target = { id: uid(), favorite: false, createdAt: Date.now(), ...data };
        state.recipes.push(target);
      }
      await save();
      toast("Recept bewaard");
      location.hash = `#/recept/${target.id}`;
    });

    const del = document.getElementById("deleteBtn");
    if (del) del.addEventListener("click", async () => {
      if (!confirm(`“${r.title}” definitief verwijderen?`)) return;
      state.recipes = state.recipes.filter((x) => x.id !== r.id);
      await save();
      toast("Recept verwijderd");
      location.hash = `#/categorie/${r.categoryId}`;
    });
  }

  function bindSearch() {
    const input = document.getElementById("q");
    const results = document.getElementById("results");
    const run = () => {
      results.innerHTML = searchResults(input.value);
      history.replaceState(null, "", `#/zoeken${input.value ? "?q=" + encodeURIComponent(input.value) : ""}`);
    };
    input.addEventListener("input", run);
    results.innerHTML = searchResults(input.value);
    input.focus();
  }

  function bindSettings() {
    const list = document.getElementById("catList");
    list.addEventListener("change", async (e) => {
      const li = e.target.closest("li");
      const cat = catById(li.dataset.id);
      if (e.target.classList.contains("name-in")) cat.name = e.target.value.trim() || cat.name;
      if (e.target.classList.contains("emoji-in")) cat.emoji = e.target.value.trim() || "🍽️";
      await save();
      toast("Categorie bijgewerkt");
    });
    list.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = btn.closest("li").dataset.id;
      const i = state.categories.findIndex((c) => c.id === id);
      if (btn.dataset.move) {
        const j = i + Number(btn.dataset.move);
        if (j < 0 || j >= state.categories.length) return;
        [state.categories[i], state.categories[j]] = [state.categories[j], state.categories[i]];
      } else if (btn.hasAttribute("data-del")) {
        if (recipesIn(id).length) return;
        if (!confirm(`Categorie “${state.categories[i].name}” verwijderen?`)) return;
        state.categories.splice(i, 1);
      }
      await save();
      render();
    });
    document.getElementById("addCat").addEventListener("click", async () => {
      const name = prompt("Naam van de nieuwe categorie:");
      if (!name || !name.trim()) return;
      state.categories.push({ id: uid(), name: name.trim(), emoji: "🍽️" });
      await save();
      render();
    });

    document.getElementById("exportBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({ app: "receptenboek", exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `recepten-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    document.getElementById("importFile").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.recipes) || !Array.isArray(data.categories)) throw new Error("geen geldig back-upbestand");
        const added = mergeBackup(data);
        await save();
        toast(`${added} recepten toegevoegd`);
        render();
      } catch (err) {
        toast("Terugzetten mislukt: " + err.message);
      }
    });
  }

  // Back-up samenvoegen: bestaande recepten (zelfde id) worden overschreven, nieuwe toegevoegd.
  function mergeBackup(data) {
    const catMap = {};
    for (const c of data.categories) {
      const existing = state.categories.find((x) => x.id === c.id) ||
        state.categories.find((x) => x.name.toLowerCase() === String(c.name).toLowerCase());
      if (existing) catMap[c.id] = existing.id;
      else { state.categories.push({ id: c.id || uid(), name: c.name, emoji: c.emoji || "🍽️" }); catMap[c.id] = c.id; }
    }
    let added = 0;
    for (const r of data.recipes) {
      const rec = { ingredients: [], steps: [], ...r, categoryId: catMap[r.categoryId] || r.categoryId };
      const i = state.recipes.findIndex((x) => x.id === rec.id);
      if (i >= 0) state.recipes[i] = rec;
      else { state.recipes.push({ ...rec, id: rec.id || uid() }); added++; }
    }
    return added;
  }

  // ---------- Start ----------
  document.addEventListener("visibilitychange", () => {
    const wake = document.getElementById("wakeToggle");
    if (document.visibilityState === "visible" && wake && wake.checked && "wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((l) => (wakeLock = l)).catch(() => {});
    }
  });

  window.addEventListener("hashchange", render);

  load().then(render);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
