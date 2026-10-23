/* Mijn Receptenboek — alles draait in de browser, gegevens staan in IndexedDB op dit toestel. */
(() => {
  "use strict";

  const DB_NAME = "receptenboek";
  const STORE = "kv";
  const STATE_KEY = "state";

  const DEFAULT_CATEGORIES = [
    ["Voorgerechten", "🥗"],
    ["Soepen", "🍲"],
    ["Hoofdgerechten", "🍝"],
    ["Bijgerechten", "🥔"],
    ["Desserts & gebak", "🍮"],
    ["Ontbijt & brunch", "🥐"],
    ["Sauzen & dips", "🫙"],
    ["Dranken", "🍹"],
  ];

  // Vaste recepten die met de app meekomen. Elk recept wordt één keer toegevoegd;
  // wie het daarna aanpast of verwijdert, krijgt het niet opnieuw.
  const BUILTIN_RECIPES = [
    {
      id: "havermout-banaan-pannenkoeken",
      category: "Desserts & gebak",
      title: "Havermout-banaanpannenkoeken",
      description: "Kleine, luchtige pannenkoekjes van havermout en banaan, zo uit de blender.",
      servings: 4,
      prepTime: 5,
      cookTime: 15,
      ingredients: [
        "2 rijpe bananen",
        "4 eieren",
        "2 snufjes zout",
        "1 tl vanille-extract en/of gemalen kaneel",
        "150 g havermout (fijn of grof)",
        "200 ml (plantaardige) melk",
        "2 tl bakpoeder",
        "3,5 el bloem",
        "# Om te bakken",
        "bakboter",
      ],
      steps: [
        "Doe alle ingrediënten (behalve de bakboter) in de blender en mix tot een glad beslag.",
        "Verhit een koekenpan met een klontje bakboter op hoog vuur.",
        "Schep kleine hoopjes beslag in de pan en bak de pannenkoekjes aan beide kanten goudbruin.",
      ],
      notes: "Lekker met Griekse yoghurt, rood fruit en een beetje honing of ahornsiroop. Blijven 2 à 3 dagen goed in de koelkast en kunnen ook in de diepvries.",
      source: "",
    },
    {
      id: "kip-oven-dragonsaus",
      category: "Hoofdgerechten",
      title: "Kip uit de oven met dragonsaus",
      description: "Met tagliatelle en geroosterde pompoen.",
      servings: 4,
      prepTime: 25,
      cookTime: 20,
      ingredients: [
        "1 pakje dragon & rozemarijn",
        "2 sjalotten",
        "300 ml room (20% vet)",
        "3 kl mosterd",
        "4 kipfilets met vel",
        "1 butternutpompoen",
        "2 teentjes knoflook",
        "500 g verse tagliatelle",
        "# Uit je keuken",
        "bakpapier",
        "olijfolie",
        "zout en zwarte peper",
      ],
      steps: [
        "Verwarm de oven voor op 200 °C en bedek een bakplaat met bakpapier.",
        "Pluk de blaadjes dragon en snijd de sjalot in fijne repen. Meng met de room en mosterd. Schik de kip in een ovenschaal en wrijf in met olijfolie, zout en zwarte peper (of kipkruiden). Giet de room erbij en rooster 30-35 min. in de oven.",
        "Snijd de pompoen in halve maantjes (schillen hoeft niet) en pers de knoflook. Hussel op de bakplaat door elkaar met de rozemarijntakjes, een scheutje olijfolie, zout en zwarte peper. Rooster 25 min. bovenaan in de oven.",
        "Breng een ruime pot gezouten water aan de kook voor de pasta. Kook de pasta in zo'n 2 min. al dente.",
        "Haal de kip uit de oven, snijd in plakjes van 2 cm en schik opnieuw in de saus. Serveer met de pasta en geroosterde pompoen. Smakelijk!",
      ],
      notes: "Omdat de oven toch al aanstaat voor de pompoen, gaat de kip ook in de oven. Weinig plaats? Dan kan je de kip ook in de pan maken.",
      source: "",
    },
    {
      id: "puree-parmentier-zoete-aardappel",
      category: "Hoofdgerechten",
      title: "Puree parmentier met zoete aardappel",
      description: "Met gehakt, prei en spinazie.",
      servings: 4,
      prepTime: 35,
      cookTime: 10,
      ingredients: [
        "800 g zoete aardappel",
        "2 preien",
        "350 g stoofselder",
        "2 gele uien",
        "600 g gemengd gehakt (rund/varken)",
        "1,5 zakjes Mexicaanse kruidenmix",
        "200 g spinazie",
        "50 g panko",
        "# Uit je keuken",
        "olijfolie",
        "scheutje melk",
        "snuifje nootmuskaat",
        "zout en zwarte peper",
      ],
      steps: [
        "Schil de zoete aardappel en snijd in stukken van zo'n 3 cm. Zet net onder water met een flinke snuif zout en kook in 15-20 min. gaar.",
        "Halveer de prei in de lengte en snijd vervolgens in reepjes van 0,5 cm. Snijd de selder in stukjes van 1 cm en snipper de ui fijn.",
        "Verhit een scheutje olijfolie in een pan op hoog vuur. Bak het gehakt rul samen met de ui, door met een vork of spatel in stukken te prakken. Kruid met de Mexicaanse mix en zwarte peper. Schep het gehakt in een ovenschaal.",
        "Verwarm intussen de oven voor op 200 °C, bij voorkeur op grillstand.",
        "Verhit opnieuw een scheutje olijfolie in dezelfde pan van het gehakt en stoof de prei en selder 5-7 min. Voeg de spinazie handje per handje toe en laat slinken. Kruid met zout en zwarte peper. Schep de groenten bovenop het gehakt in de ovenschaal.",
        "Giet de aardappelen af en stamp, samen met een scheutje melk, tot een smeuïge puree. Kruid met nootmuskaat, zout en zwarte peper. Schep bovenop de groenten.",
        "Werk de ovenschotel af met de panko en besprenkel royaal met olijfolie. Schuif 5-10 min. in de oven voor een krokant korstje.",
      ],
      notes: "Je kan deze ovenschotel perfect op voorhand klaarmaken. Warm 30 min. op in een oven van 180 °C.",
      source: "",
    },
  ];

  const app = document.getElementById("app");
  const toastEl = document.getElementById("toast");
  let state = null;
  let wakeLock = null;
  let installPrompt = null;

  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

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
    if (!state) state = freshState();
    migrate();
    addBuiltinRecipes();
    await save();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  // Eenmalige aanpassingen aan bestaande receptenboeken
  function migrate() {
    state.migrations = state.migrations || [];
    if (!state.migrations.includes("desserts-gebak")) {
      const desserts = state.categories.find((c) => c.name === "Desserts");
      const gebak = state.categories.find((c) => c.name === "Gebak & taart");
      if (desserts) desserts.name = "Desserts & gebak";
      if (desserts && gebak) {
        state.recipes.forEach((r) => { if (r.categoryId === gebak.id) r.categoryId = desserts.id; });
        state.categories = state.categories.filter((c) => c !== gebak);
      }
      state.migrations.push("desserts-gebak");
    }
    if (!state.migrations.includes("desserts-na-bijgerechten")) {
      const i = state.categories.findIndex((c) => c.name === "Desserts & gebak");
      if (i >= 0) {
        const [desserts] = state.categories.splice(i, 1);
        const j = state.categories.findIndex((c) => c.name === "Bijgerechten");
        state.categories.splice(j >= 0 ? j + 1 : state.categories.length, 0, desserts);
      }
      state.migrations.push("desserts-na-bijgerechten");
    }
  }

  function addBuiltinRecipes() {
    state.builtinAdded = state.builtinAdded || [];
    for (const b of BUILTIN_RECIPES) {
      if (state.builtinAdded.includes(b.id)) continue;
      const { category, ...rest } = b;
      const cat = state.categories.find((c) => c.name.toLowerCase() === category.toLowerCase()) || state.categories[0];
      if (!state.recipes.some((r) => r.id === b.id)) {
        state.recipes.push({ ...rest, categoryId: cat ? cat.id : "", photo: "", favorite: false, createdAt: Date.now(), updatedAt: Date.now() });
      }
      state.builtinAdded.push(b.id);
    }
    // Johan maakt eigen versies: de bron van de pannenkoeken mag weg (ook als het recept al bewaard was)
    const pk = state.recipes.find((r) => r.id === "havermout-banaan-pannenkoeken");
    if (pk && /rutgerbakt\.nl/.test(pk.source || "")) pk.source = "";
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
      case "ontvang": html = `<p class="loading">Recept openen…</p>`; break;
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
    const tile = (c) => {
      const n = recipesIn(c.id).length;
      return `<a class="tile" href="#/categorie/${c.id}">
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
      ${installBanner()}
      <div class="tiles">
        ${state.categories.map(tile).join("")}
      </div>
      ${favorites.length ? `<h2 class="section-title">Favorieten</h2><div class="cards">${favorites.map(recipeCard).join("")}</div>` : ""}
      ${recent.length ? `<h2 class="section-title">Laatst bijgewerkt</h2><div class="cards">${recent.map(recipeCard).join("")}</div>` : ""}
      ${!state.recipes.length ? `<div class="empty" style="margin-top:24px"><span class="big">📖</span>Je receptenboek is nog leeg. Tik op <b>Nieuw recept</b> om te beginnen.</div>` : ""}
      <a class="btn fab" href="#/nieuw">＋ Nieuw recept</a>`;
  }

  function installBanner() {
    if (isStandalone()) return "";
    try { if (localStorage.getItem("installHidden")) return ""; } catch {}
    let how;
    if (installPrompt) how = `<button class="btn small" type="button" id="installBtn">Installeer als app</button>`;
    else if (isIos()) how = `<span>Tik in Safari op het deelicoon <b>⬆︎</b> en kies <b>Zet op beginscherm</b>.</span>`;
    else how = `<span>Open het browsermenu <b>⋮</b> en kies <b>App installeren</b> of <b>Toevoegen aan startscherm</b>.</span>`;
    return `<div class="install">
      <img src="icons/icon-192.png" alt="" width="44" height="44">
      <div class="install-text"><b>Zet het receptenboek op je startscherm</b>${how}</div>
      <button class="iconbtn" type="button" id="installHide" aria-label="Verbergen">✕</button>
    </div>`;
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
    return `
      <div class="crumbs"><a href="#/">Receptenboek</a> › ${cat ? `<a href="#/categorie/${cat.id}">${esc(cat.name)}</a>` : "Zonder categorie"}</div>
      ${recipeArticle(r, cat ? cat.emoji + " " + cat.name : "", `
            <button class="btn small" type="button" id="shareBtn">↗ Delen</button>
            <button class="btn ghost small" type="button" id="favBtn">${r.favorite ? "♥ Favoriet" : "♡ Favoriet"}</button>
            <a class="btn ghost small" href="#/bewerk/${r.id}">✎ Bewerken</a>
            <button class="btn ghost small" type="button" id="printBtn">⎙ Afdrukken</button>
            ${"wakeLock" in navigator ? `<label class="toggle"><input type="checkbox" id="wakeToggle"> Scherm aan houden</label>` : ""}`)}`;
  }

  function recipeArticle(r, kicker, toolbar) {
    const servings = Number(r.servings) || 0;
    const facts = [
      r.prepTime ? [formatMinutes(r.prepTime), "Voorbereiding"] : null,
      r.cookTime ? [formatMinutes(r.cookTime), "Bereiding"] : null,
    ].filter(Boolean);
    return `
      <article class="recipe">
        ${r.photo ? `<img class="photo" src="${r.photo}" alt="">` : ""}
        <div class="inner">
          <div class="kicker">${esc(kicker)}</div>
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
          <div class="toolbar">${toolbar}</div>
          <div id="sharePanel" class="share-panel" hidden></div>
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
        <p class="muted">De volgorde hier is ook de volgorde op de startpagina. Een categorie kan je pas verwijderen als ze leeg is.</p>
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
    bindInstall();
    if (page === "recept") bindRecipe(recipeById(id));
    if (page === "ontvang") showReceived(id);
    if (page === "nieuw" || page === "bewerk") bindForm(id ? recipeById(id) : null);
    if (page === "zoeken") bindSearch();
    if (page === "instellingen") bindSettings();
  }

  function bindRecipe(r) {
    if (!r) return;
    bindCooking(r);
    document.getElementById("shareBtn").addEventListener("click", () => shareRecipe(r));
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

  function bindInstall() {
    const btn = document.getElementById("installBtn");
    if (btn) btn.addEventListener("click", async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice.catch(() => {});
      installPrompt = null;
      render();
    });
    const hide = document.getElementById("installHide");
    if (hide) hide.addEventListener("click", () => {
      try { localStorage.setItem("installHidden", "1"); } catch {}
      hide.closest(".install").remove();
    });
  }

  // Personen herschalen en stappen afvinken (ook in de voorvertoning van een gedeeld recept)
  function bindCooking(r) {
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
  }

  // ---------- Delen ----------
  function shareText(r, link) {
    const out = [`*${r.title}*`];
    if (r.description) out.push(`_${r.description}_`);
    const total = (Number(r.prepTime) || 0) + (Number(r.cookTime) || 0);
    const facts = [r.servings ? `👥 ${r.servings} personen` : "", total ? `⏱ ${formatMinutes(total)}` : ""].filter(Boolean);
    if (facts.length) out.push(facts.join("  ·  "));
    out.push("", "*Ingrediënten*");
    for (const l of r.ingredients) out.push(l.startsWith("#") ? `_${l.replace(/^#+\s*/, "")}_` : `• ${l}`);
    out.push("", "*Bereiding*");
    let n = 0;
    for (const l of r.steps) out.push(l.startsWith("#") ? `_${l.replace(/^#+\s*/, "")}_` : `${++n}. ${l}`);
    if (r.notes) out.push("", `💡 ${r.notes}`);
    if (link) out.push("", "📖 Bewaar dit recept in je eigen receptenboek:", link);
    return out.join("\n");
  }

  // Recept in de link zelf verpakken (gecomprimeerd), zodat er geen server nodig is
  const SHARE_FIELDS = ["title", "description", "servings", "prepTime", "cookTime", "ingredients", "steps", "notes"];
  const toB64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const fromB64url = (str) => Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

  async function encodeRecipe(r) {
    const data = Object.fromEntries(SHARE_FIELDS.map((k) => [k, r[k]]));
    data.id = r.id;
    const cat = catById(r.categoryId);
    if (cat) data.category = cat.name;
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    if (typeof CompressionStream === "undefined") return "j" + toB64url(bytes);
    const zipped = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer();
    return "z" + toB64url(new Uint8Array(zipped));
  }

  async function decodeRecipe(code) {
    const bytes = fromB64url(code.slice(1));
    let text;
    if (code[0] === "z") {
      text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
    } else text = new TextDecoder().decode(bytes);
    const d = JSON.parse(text);
    if (!d.title) throw new Error("leeg recept");
    return {
      id: typeof d.id === "string" ? d.id.slice(0, 64) : "",
      title: String(d.title), description: String(d.description || ""),
      servings: Number(d.servings) || "", prepTime: Number(d.prepTime) || "", cookTime: Number(d.cookTime) || "",
      ingredients: Array.isArray(d.ingredients) ? d.ingredients.map(String) : [],
      steps: Array.isArray(d.steps) ? d.steps.map(String) : [],
      notes: String(d.notes || ""), category: String(d.category || ""),
    };
  }

  async function shareRecipe(r) {
    let link = "";
    try { link = `${location.origin}${location.pathname}#/ontvang/${await encodeRecipe(r)}`; } catch {}
    const text = shareText(r, link);
    if (navigator.share) {
      try { await navigator.share({ title: r.title, text }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    const panel = document.getElementById("sharePanel");
    panel.innerHTML = `
      <b>Recept delen</b>
      <div class="btn-row" style="margin-top:8px">
        <a class="btn small whatsapp" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn ghost small" href="mailto:?subject=${encodeURIComponent(r.title)}&body=${encodeURIComponent(text.replace(/[*_]/g, ""))}">E-mail</a>
        <button class="btn ghost small" type="button" id="copyBtn">Tekst kopiëren</button>
      </div>`;
    panel.hidden = false;
    document.getElementById("copyBtn").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(text); toast("Gekopieerd, plak het waar je wil"); }
      catch { toast("Kopiëren lukt niet in deze browser"); }
    });
  }

  async function showReceived(code) {
    let r;
    try { r = await decodeRecipe(code || ""); }
    catch { app.innerHTML = viewNotFound(); return; }
    const match = state.categories.find((c) => c.name.toLowerCase() === r.category.toLowerCase());
    // Staat dit recept er al in? Zelfde id (bv. een vast recept of eerder ontvangen), of zelfde naam.
    const existing = (r.id && recipeById(r.id)) ||
      state.recipes.find((x) => x.title.trim().toLowerCase() === r.title.trim().toLowerCase());
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Receptenboek</a> › Gedeeld recept</div>
      <div class="panel received">
        ${existing ? `
        <b>Dit recept staat al in je receptenboek.</b>
        <div class="received-row">
          <a class="btn" href="#/recept/${existing.id}">Openen in mijn receptenboek</a>
          <button class="btn ghost" type="button" id="replaceReceived">Vervangen door deze versie</button>
        </div>` : `
        <b>Iemand deelde dit recept met je.</b>
        <div class="received-row">
          <select id="recvCat" aria-label="Categorie">
            ${state.categories.map((c) => `<option value="${c.id}" ${match && match.id === c.id ? "selected" : ""}>${esc(c.emoji)} ${esc(c.name)}</option>`).join("")}
          </select>
          <button class="btn" type="button" id="saveReceived">Bewaren in mijn receptenboek</button>
        </div>`}
      </div>
      ${recipeArticle(r, "Gedeeld recept", "")}`;
    bindCooking(r);
    const replace = document.getElementById("replaceReceived");
    if (replace) replace.addEventListener("click", async () => {
      if (!confirm(`Je eigen versie van “${existing.title}” vervangen door deze?`)) return;
      const { category, id, ...rest } = r;
      Object.assign(existing, rest, { updatedAt: Date.now() });
      await save();
      toast("Recept bijgewerkt");
      location.hash = `#/recept/${existing.id}`;
    });
    const saveBtn = document.getElementById("saveReceived");
    if (saveBtn) saveBtn.addEventListener("click", async () => {
      const { category, id, ...rest } = r;
      const rec = { ...rest, id: id && !recipeById(id) ? id : uid(), categoryId: document.getElementById("recvCat").value, source: "", photo: "", favorite: false, createdAt: Date.now(), updatedAt: Date.now() };
      state.recipes.push(rec);
      await save();
      toast("Recept bewaard");
      location.hash = `#/recept/${rec.id}`;
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

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
    if (state && !parseHash().parts.length) render();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    toast("Het receptenboek staat nu op je startscherm");
    if (state) render();
  });

  load().then(render);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
