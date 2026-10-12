"use strict";
const $ = (id) => document.getElementById(id);
const state = {
  user: null,
  equipments: null,
  editing: null,
  page: "tableau-de-bord",
  query: "",
  status: "",
};
const icons = {
  home: "M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10",
  box: "m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10",
  plus: "M12 7v10M7 12h10M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  folder: "M3 6h7l2 3h9v11H3V6Z",
  pin: "M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  users:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M16 3a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-4-4",
  chart: "M3 3v18h18M7 17v-5M12 17V6M17 17v-8",
  settings:
    "m9 3 1-2h4l1 2 3 2 2 1 2 4-2 2v3l2 2-2 4-3-1-3 2-1 2h-4l-1-2-3-2-3 1-2-4 2-2v-3L1 10l2-4 3-1 3-2ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  search: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M15 15l6 6",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4",
  logout: "M10 3H3v18h7M8 12h13m-5-5 5 5-5 5",
  help: "M3 14v-3a9 9 0 0 1 18 0v3M3 12h3v8H3v-8Zm15 0h3v8h-3v-8ZM18 21l-4 1",
  check: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M7 12l3 3 7-7",
  wrench: "M14 6a6 6 0 0 0-7 7l-5 5 4 4 5-5a6 6 0 0 0 7-7l-4 4-4-4 4-4Z",
  warning: "m12 3 10 18H2L12 3Zm0 6v5m0 3v1",
  refresh: "M20 8a9 9 0 1 0 1 8M20 2v6h-6",
  bot: "M12 2v4M5 7h14l3 4v9H2v-9l3-4ZM7 12v2m10-2v2m-8 4h6",
};
function svg(name) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("viewBox", "0 0 24 24");
  el.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(el.namespaceURI, "path");
  path.setAttribute("d", icons[name] || icons.box);
  el.append(path);
  return el;
}
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => el.append(svg(el.dataset.icon)));
document
  .querySelectorAll(".logo")
  .forEach((el) => el.replaceChildren(svg("box")));
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = String(text);
  return el;
}
function resetSession(message = "") {
  state.user = null;
  state.equipments = null;
  state.editing = null;
  state.query = "";
  state.status = "";
  $("application").hidden = true;
  $("sectionConnexion").hidden = false;
  document.body.classList.remove("light");
  $("messageConnexion").textContent = message;
  $("recherche").value = "";
  $("filtreStatut").value = "";
  document.querySelectorAll("tbody").forEach((el) => el.replaceChildren());
  $("formEquipement").reset();
  $("formUtilisateur").reset();
  $("messageInventaire").textContent = "";
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Le serveur a renvoyé une réponse illisible.");
  }
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/connexion")
      resetSession("Votre session a expiré. Veuillez vous reconnecter.");
    throw new Error(data.erreur || "Impossible de terminer cette opération.");
  }
  return data;
}
const jsonRequest = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
$("formConnexion").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  $("messageConnexion").textContent = "Connexion…";
  try {
    await api(
      "/api/connexion",
      jsonRequest("POST", {
        email: $("email").value.trim(),
        mot_de_passe: $("motDePasse").value,
      }),
    );
    $("motDePasse").value = "";
    await verifierSession();
  } catch (error) {
    $("messageConnexion").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
$("btnDeconnexion").addEventListener("click", async () => {
  try {
    await api("/api/deconnexion", { method: "POST" });
    resetSession("Déconnexion réussie.");
    $("email").value = "";
    $("motDePasse").value = "";
  } catch (error) {
    $("messageInventaire").textContent = error.message;
  }
});
async function verifierSession() {
  try {
    const data = await api("/api/session");
    if (!data.utilisateur) {
      resetSession();
      return;
    }
    state.user = data.utilisateur;
    $("sectionConnexion").hidden = true;
    $("application").hidden = false;
    $("nomUtilisateur").textContent = state.user.nom;
    $("roleUtilisateur").textContent = state.user.role;
    $("initiales").textContent = String(state.user.nom || "")
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    document
      .querySelectorAll("[data-admin]")
      .forEach((el) => (el.hidden = state.user.role !== "Administrateur"));
    $("detailsProfil").replaceChildren();
    for (const [label, value] of [
      ["Nom", state.user.nom],
      ["Courriel", state.user.email],
      ["Rôle", state.user.role],
    ])
      $("detailsProfil").append(
        node("dt", "", label),
        node("dd", "", value || "—"),
      );
    await chargerInventaire();
    afficherPage();
  } catch (error) {
    if (!state.user) $("messageConnexion").textContent = error.message;
    else $("messageInventaire").textContent = error.message;
  }
}
async function chargerInventaire() {
  $("messageInventaire").textContent = "Chargement de l’inventaire…";
  try {
    const data = await api("/api/equipements");
    if (!Array.isArray(data))
      throw new Error("Le format de l’inventaire est incorrect.");
    state.equipments = data;
    $("messageInventaire").textContent = "";
    render();
  } catch (error) {
    state.equipments = null;
    $("messageInventaire").textContent = error.message;
    clearInventory();
  }
}
function clearInventory() {
  for (const id of ["listeEquipements", "equipementsRecents"]) {
    const tr = node("tr");
    const td = node("td", "empty", "Inventaire indisponible.");
    td.colSpan = 7;
    tr.append(td);
    $(id).replaceChildren(tr);
  }
  for (const id of [
    "statistiques",
    "categoriesDashboard",
    "categoriesClaires",
    "barresCategories",
    "barresEmplacements",
    "rapportCategories",
    "rapportEmplacements",
    "alertes",
    "legendeStatuts",
  ])
    $(id).replaceChildren(node("p", "empty", "Données indisponibles."));
  $("totalAnneau").textContent = "—";
  $("anneauStatuts").style.background = "var(--line)";
  $("badgeAlertes").hidden = true;
  $("nombreResultats").textContent = "";
}
const colors = [
  "#24cf7b",
  "#39aaf4",
  "#ffbd24",
  "#ff9035",
  "#9384e8",
  "#32b4be",
  "#e9699b",
];
function statusColor(status) {
  return (
    {
      Disponible: "#24cf7b",
      Attribué: "#39aaf4",
      "En réparation": "#ffbd24",
      "À remplacer / Hors service": "#ff9035",
      "En attente de validation": "#9384e8",
      "En attente de retour": "#32b4be",
      "Perdu / Volé": "#e9699b",
    }[status] || "#8b9cae"
  );
}
function group(field) {
  const counts = new Map();
  for (const e of state.equipments || []) {
    const key = String(e[field] || "Non renseigné");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}
function isLow(e) {
  return (
    e.quantite !== null &&
    e.quantite !== undefined &&
    e.seuil_minimum !== null &&
    e.seuil_minimum !== undefined &&
    Number.isFinite(Number(e.quantite)) &&
    Number.isFinite(Number(e.seuil_minimum)) &&
    Number(e.quantite) < Number(e.seuil_minimum)
  );
}
function render() {
  if (!state.equipments) return;
  renderStats();
  renderCategories();
  renderAlerts();
  renderStatus();
  renderTables();
  for (const [id, field] of [
    ["barresCategories", "categorie"],
    ["barresEmplacements", "emplacement"],
    ["rapportCategories", "categorie"],
    ["rapportEmplacements", "emplacement"],
  ])
    renderBars(id, field);
  const selected = state.status;
  $("filtreStatut").replaceChildren(node("option", "", "Tous les statuts"));
  $("filtreStatut").firstChild.value = "";
  for (const [status] of group("etat")) {
    const option = node("option", "", status);
    option.value = status;
    $("filtreStatut").append(option);
  }
  $("filtreStatut").value = selected;
}
function renderStats() {
  const e = state.equipments;
  const stats = [
    ["Équipements totaux", e.length, "box", "#3eb1f7"],
    [
      "Disponibles",
      e.filter((x) => x.etat === "Disponible").length,
      "check",
      "#37ef99",
    ],
    [
      "En réparation",
      e.filter((x) => x.etat === "En réparation").length,
      "wrench",
      "#ff464d",
    ],
    ["Sous le seuil", e.filter(isLow).length, "warning", "#ffbd24"],
  ];
  $("statistiques").replaceChildren();
  for (const [label, value, icon, color] of stats) {
    const card = node("article", "stat");
    card.style.setProperty("--accent", color);
    const top = node("div", "stat-top"),
      symbol = node("span", "stat-icon");
    symbol.append(svg(icon));
    const copy = node("div");
    copy.append(node("strong", "", value), node("small", "", label));
    top.append(symbol, copy);
    card.append(top, node("p", "stat-note", "Inventaire actuel"));
    $("statistiques").append(card);
  }
}
const categoriesIllustrated = [
  ["Cartes graphiques", /graphique|gpu/i, 0],
  ["Processeurs", /processeur|cpu/i, 1],
  ["Mémoire (RAM)", /mémoire|memoire|ram/i, 2],
  ["Stockage (SSD/HDD)", /stockage|ssd|hdd/i, 3],
  ["Cartes mères", /mère|mere/i, 4],
  ["Périphériques", /périph|periph|souris|clavier/i, 5],
  ["Réseautiques", /réseau|reseau|routeur/i, 6],
];
function categoryImage(name) {
  return categoriesIllustrated.find((item) => item[1].test(name))?.[2] ?? 7;
}
function renderCategories() {
  const actual = group("categorie");
  for (const id of ["categoriesDashboard", "categoriesClaires"]) {
    const container = $(id);
    container.replaceChildren();
    if (!actual.length) {
      container.append(
        node("p", "empty", "Aucune catégorie dans l’inventaire."),
      );
      continue;
    }
    for (const [label, count] of actual) {
      const tile = node("button", "category-tile");
      tile.type = "button";
      const picture = node("span", "category-picture");
      picture.setAttribute("aria-hidden", "true");
      const index = categoryImage(label);
      picture.style.backgroundPosition = `${-223 - index * 84}px -459px`;
      tile.append(
        picture,
        node("small", "", label),
        node("small", "count", `${count} équipement${count > 1 ? "s" : ""}`),
      );
      tile.addEventListener("click", () => {
        state.query = label;
        state.status = "";
        $("recherche").value = label;
        location.hash = "inventaire";
        renderTables();
      });
      container.append(tile);
    }
  }
}
function renderAlerts() {
  const low = state.equipments.filter(isLow),
    repair = state.equipments.filter((e) => e.etat === "En réparation"),
    replace = state.equipments.filter(
      (e) => e.etat === "À remplacer / Hors service",
    );
  $("alertes").replaceChildren();
  for (const [text, icon, color, status] of [
    [
      `${low.length} équipement${low.length > 1 ? "s" : ""} sous le seuil minimal`,
      "warning",
      "#ffbd24",
      "low",
    ],
    [
      `${repair.length} équipement${repair.length > 1 ? "s" : ""} en réparation`,
      "wrench",
      "#ff9035",
      "En réparation",
    ],
    [
      `${replace.length} équipement${replace.length > 1 ? "s" : ""} à remplacer`,
      "refresh",
      "#3eb1f7",
      "À remplacer / Hors service",
    ],
  ]) {
    const row = node("button", "alert-row");
    row.type = "button";
    row.style.setProperty("--accent", color);
    const symbol = node("span");
    symbol.append(svg(icon));
    row.append(symbol, node("span", "", text), node("span", "arrow", "›"));
    row.addEventListener("click", () => {
      state.status = status;
      state.query = "";
      $("recherche").value = "";
      location.hash = "inventaire";
      renderTables();
    });
    $("alertes").append(row);
  }
  $("alertes").append(
    node(
      "p",
      "empty",
      "Garanties et durée des réparations : données non disponibles.",
    ),
  );
  const count = low.length + repair.length + replace.length;
  $("badgeAlertes").textContent = count;
  $("badgeAlertes").hidden = count === 0;
}
function renderStatus() {
  const entries = group("etat");
  const total = state.equipments.length;
  let offset = 0;
  const segments = [];
  $("legendeStatuts").replaceChildren();
  for (const [status, count] of entries) {
    const color = statusColor(status);
    const percent = total ? (count / total) * 100 : 0;
    segments.push(`${color} ${offset}% ${offset + percent}%`);
    offset += percent;
    const row = node("div", "legend-row"),
      dot = node("span", "legend-dot");
    dot.style.background = color;
    row.append(
      dot,
      node("span", "", status),
      node("strong", "", `${count} (${Math.round(percent)}%)`),
    );
    $("legendeStatuts").append(row);
  }
  $("totalAnneau").textContent = total;
  $("anneauStatuts").style.background = segments.length
    ? `conic-gradient(${segments.join(",")})`
    : "var(--line)";
  if (!total)
    $("legendeStatuts").append(node("p", "empty", "Aucun équipement."));
}
function renderBars(id, field) {
  const container = $(id);
  container.replaceChildren();
  const entries = group(field),
    max = Math.max(1, ...entries.map((x) => x[1]));
  if (!entries.length) {
    container.append(node("p", "empty", "Aucun équipement."));
    return;
  }
  entries.forEach(([label, count], i) => {
    const row = node("div", "bar-row"),
      track = node("div", "bar-track"),
      fill = node("div", "bar-fill");
    fill.style.width = `${(count / max) * 100}%`;
    fill.style.setProperty("--bar", colors[i % colors.length]);
    track.append(fill);
    row.append(node("span", "", label), track, node("span", "", count));
    container.append(row);
  });
}
function matching() {
  return (state.equipments || []).filter(
    (e) =>
      (!state.status ||
        (state.status === "low" ? isLow(e) : e.etat === state.status)) &&
      [e.nom, e.categorie, e.emplacement, e.numero_serie].some((value) =>
        String(value || "")
          .toLocaleLowerCase("fr")
          .includes(state.query.toLocaleLowerCase("fr")),
      ),
  );
}
function dateValue(e) {
  return e.date_ajout || e.date_creation || null;
}
function formattedDate(e) {
  const value = dateValue(e);
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value)))
    return String(value).slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-CA");
}
function renderTables() {
  const data = matching();
  $("nombreResultats").textContent =
    `${data.length} équipement${data.length > 1 ? "s" : ""}`;
  drawTable("listeEquipements", data, false);
  const recent = [...(state.equipments || [])]
    .sort((a, b) => {
      const da = Date.parse(dateValue(a)),
        db = Date.parse(dateValue(b));
      if (Number.isFinite(da) && Number.isFinite(db)) return db - da;
      if (Number.isFinite(da)) return -1;
      if (Number.isFinite(db)) return 1;
      return Number(b.id || 0) - Number(a.id || 0);
    })
    .slice(0, 5);
  drawTable("equipementsRecents", recent, true);
}
function drawTable(id, equipments, recent) {
  const body = $(id);
  body.replaceChildren();
  if (!equipments.length) {
    const row = node("tr"),
      cell = node("td", "empty", "Aucun équipement à afficher.");
    cell.colSpan = recent ? 6 : 7;
    row.append(cell);
    body.append(row);
    return;
  }
  for (const e of equipments) {
    const row = node("tr");
    for (const value of [e.nom, e.categorie, e.numero_serie, e.emplacement])
      row.append(node("td", "", value ?? "—"));
    const status = node("td"),
      badge = node("span", "badge", e.etat || "Non renseigné");
    badge.style.setProperty("--badge", statusColor(e.etat));
    status.append(badge);
    row.append(
      status,
      node("td", "", recent ? formattedDate(e) : (e.quantite ?? "—")),
    );
    if (!recent) {
      const actions = node("td"),
        button = node("button", "action-button", "Modifier");
      button.type = "button";
      button.addEventListener("click", () => {
        state.editing = e;
        location.hash = "ajouter";
        if (state.page === "ajouter") prepareEquipmentForm();
      });
      actions.append(button);
      row.append(actions);
    }
    body.append(row);
  }
}
const pages = {
  "tableau-de-bord": "pageDashboard",
  inventaire: "sectionInventaire",
  ajouter: "pageAjouter",
  categories: "pageCategories",
  emplacements: "pageEmplacements",
  utilisateurs: "pageUtilisateurs",
  rapports: "pageRapports",
  parametres: "pageParametres",
};
function afficherPage() {
  if (!state.user) return;
  let page = location.hash.slice(1) || "tableau-de-bord";
  if (
    !pages[page] ||
    (page === "utilisateurs" && state.user.role !== "Administrateur")
  )
    page = "tableau-de-bord";
  if (state.page === "ajouter" && page !== "ajouter") state.editing = null;
  state.page = page;
  document.body.classList.toggle("light", page !== "tableau-de-bord");
  document
    .querySelectorAll(".page")
    .forEach((el) => (el.hidden = el.id !== pages[page]));
  document.querySelectorAll("[data-page]").forEach((el) => {
    const active = el.dataset.page === page;
    el.classList.toggle("active", active);
    if (active) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  $("bannierePages").hidden = page === "tableau-de-bord";
  if (page === "ajouter") prepareEquipmentForm();
  if (page === "utilisateurs") chargerUtilisateurs();
  if (page === "inventaire") renderTables();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", afficherPage);
$("recherche").addEventListener("input", () => {
  state.query = $("recherche").value.trim();
  if (state.page !== "inventaire") location.hash = "inventaire";
  renderTables();
});
$("filtreStatut").addEventListener("change", () => {
  state.status = $("filtreStatut").value;
  renderTables();
});
$("notifications").addEventListener("click", () => {
  location.hash = "tableau-de-bord";
  afficherPage();
  $("carteAlertes").scrollIntoView({ behavior: "smooth", block: "center" });
});
function prepareEquipmentForm() {
  const form = $("formEquipement");
  form.reset();
  $("messageEquipement").textContent = "";
  $("titreFormulaire").textContent = state.editing
    ? "Modifier un équipement"
    : "Ajouter un équipement";
  $("infoAjout").textContent =
    state.user.role === "Administrateur"
      ? "Les nouveaux équipements seront disponibles."
      : "Les nouveaux équipements seront en attente de validation par un administrateur.";
  for (const [field, label] of [
    ["categorie_id", "categorie"],
    ["emplacement_id", "emplacement"],
  ]) {
    const select = form.elements[field];
    select.replaceChildren();
    const placeholder = node("option", "", "Sélectionner…");
    placeholder.value = "";
    select.append(placeholder);
    const refs = new Map();
    for (const e of state.equipments || [])
      if (e[field] != null)
        refs.set(String(e[field]), String(e[label] || e[field]));
    for (const [id, name] of refs) {
      const option = node("option", "", name);
      option.value = id;
      select.append(option);
    }
  }
  const available =
    form.elements.categorie_id.options.length > 1 &&
    form.elements.emplacement_id.options.length > 1;
  form.querySelector('[type="submit"]').disabled = !available;
  $("infoReferentiels").textContent = available
    ? "Les catégories et emplacements sont ceux des équipements existants."
    : "Ajout indisponible : aucun référentiel de catégories ou d’emplacements n’est accessible. Le backend ne propose pas de route pour les charger séparément.";
  if (state.editing)
    for (const key of [
      "nom",
      "description",
      "numero_serie",
      "categorie_id",
      "quantite",
      "prix",
      "emplacement_id",
      "seuil_minimum",
    ])
      form.elements[key].value = state.editing[key] ?? "";
}
$("formEquipement").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  for (const key of [
    "categorie_id",
    "emplacement_id",
    "quantite",
    "prix",
    "seuil_minimum",
  ])
    data[key] = Number(data[key]);
  const edit = state.editing;
  try {
    const result = await api(
      edit
        ? `/api/equipements/${encodeURIComponent(edit.id)}`
        : "/api/equipements",
      jsonRequest(edit ? "PUT" : "POST", data),
    );
    state.editing = null;
    await chargerInventaire();
    if (!state.user) return;
    location.hash = "inventaire";
    $("messageInventaire").textContent = result.message;
  } catch (error) {
    $("messageEquipement").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
async function chargerUtilisateurs() {
  if (state.user?.role !== "Administrateur") return;
  $("messageUtilisateurs").textContent = "Chargement…";
  $("listeUtilisateurs").replaceChildren();
  try {
    const users = await api("/api/utilisateurs");
    if (!Array.isArray(users))
      throw new Error("Le format des utilisateurs est incorrect.");
    for (const user of users) {
      const row = node("tr");
      for (const value of [
        user.nom,
        user.email,
        user.role,
        user.actif ? "Actif" : "Inactif",
      ])
        row.append(node("td", "", value ?? "—"));
      $("listeUtilisateurs").append(row);
    }
    $("messageUtilisateurs").textContent = users.length
      ? ""
      : "Aucun utilisateur.";
  } catch (error) {
    $("messageUtilisateurs").textContent = error.message;
  }
}
$("formUtilisateur").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.user?.role !== "Administrateur") return;
  const button = event.submitter;
  button.disabled = true;
  try {
    const result = await api(
      "/api/utilisateurs",
      jsonRequest(
        "POST",
        Object.fromEntries(new FormData(event.currentTarget)),
      ),
    );
    $("formUtilisateur").reset();
    await chargerUtilisateurs();
    $("messageUtilisateurs").textContent = result.message;
  } catch (error) {
    $("messageUtilisateurs").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
verifierSession();
