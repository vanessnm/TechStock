"use strict";
const $ = (id) => document.getElementById(id);
const state = {
  user: null,
  signalements: [],
  validationsEquipements: [],
  notificationsReparation: [],
  etatsNotifications: {},
  equipments: null,
  referentiels: {categories:[],emplacements:[]},
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
  state.signalements = [];
  state.validationsEquipements = [];
  state.notificationsReparation = [];
  state.etatsNotifications = {};
  if (fenetreNotifications?.isConnected) fenetreNotifications.close();
  $("listeSignalements").replaceChildren();
  $("messageSignalements").textContent = "";
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
    await chargerSignalements();
    afficherPage();
  } catch (error) {
    if (!state.user) $("messageConnexion").textContent = error.message;
    else $("messageInventaire").textContent = error.message;
  }
}
async function chargerInventaire() {
  $("messageInventaire").textContent = "Chargement de l’inventaire…";
  try {
    const [data,referentiels] = await Promise.all([api("/api/equipements"),api("/api/referentiels")]);
    state.referentiels=referentiels;
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
function isDisponible(e) { return e.etat === "Disponible" && e.attribue_a_id == null && e.date_attribution == null; }
function sousSeuil(units) { const map=new Map(); for(const u of units || []) if(isLow(u)) map.set(u.modele_id,u); return [...map.values()]; }
function isLow(e) {
  const units=(state.equipments || []).filter((u)=>u.modele_id===e.modele_id);
  const available=units.filter(isDisponible).length;
  const threshold=Math.max(0,...units.map((u)=>Number(u.seuil_minimum)||0));
  return available<threshold;
}

function render() {
  if (!state.equipments) return;
  renderStats();
  renderCategories();
  actualiserBadgeSignalements();
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
  if(selected==="low"){const option=node("option","","Sous le seuil minimum");option.value="low";$("filtreStatut").append(option);}
  $("filtreStatut").value = selected;
}
function renderStats() {
  const e = state.equipments;
  const stats = [
    ["Équipements totaux", e.length, "box", "#3eb1f7"],
    [
      "Disponibles",
      e.filter(isDisponible).length,
      "check",
      "#37ef99",
    ],
    [
      "En réparation",
      e.filter((x) => x.etat === "En réparation").length,
      "wrench",
      "#ff464d",
    ],
    ["Sous le seuil", sousSeuil(e).length, "warning", "#ffbd24"],
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
      [e.nom, e.categorie, e.emplacement, e.numero_serie, e.code_interne].some((value) =>
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
function regrouperUnites(units) {
  const groups=new Map();
  for(const unit of units){
    const key=unit.modele_id+"|"+unit.etat;
    if(!groups.has(key))groups.set(key,{...unit,id:"g-"+key,unites:[],quantite:0});
    const group=groups.get(key);group.unites.push(unit);group.quantite++;
  }
  return [...groups.values()].map((group)=>({...group,
    numero_serie:group.unites.length===1 ? group.unites[0].numero_serie || group.unites[0].code_interne : group.unites.length+" unités — choisir pour agir",
    emplacement:new Set(group.unites.map((u)=>u.emplacement)).size>1 ? "Emplacements multiples" : group.emplacement,
  }));
}
function afficherNumerosSerie(group) {
  const dialog = node("dialog", "assignment-dialog");
  dialog.setAttribute("aria-label", "Numéros de série — " + group.nom);
  const title = node("h2", "", "Numéros de série — " + group.nom);
  const list = node("ul");
  for (const unit of group.unites) {
    list.append(node("li", "", (unit.numero_serie || "N° de série non renseigné") + " — " + unit.code_interne));
  }
  const close = node("button", "action-button", "Fermer");
  close.type = "button";
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.append(title, list, close);
  document.body.append(dialog);
  dialog.showModal();
}

function choisirUnite(group, run) {
  const user=state.user;
  const dialog=node("dialog","assignment-dialog");
  const title=node("h2","",group.nom+" · choisir l’unité");title.id="titreChoixUnite";
  dialog.setAttribute("aria-labelledby",title.id);
  const label=node("label","","Unité concernée");
  const select=node("select");select.required=true;
  const empty=node("option","","Sélectionner une unité…");empty.value="";select.append(empty);
  for(const unit of group.unites){
    const option=node("option","",(unit.numero_serie || "N° de série non renseigné")+" · "+unit.code_interne+" · "+unit.etat);
    option.value=unit.id;select.append(option);
  }
  label.append(select);
  const actions=node("div","form-actions");
  const next=node("button","action-button","Continuer");next.type="button";next.disabled=true;
  const history=node("button","action-button","Historique de l’unité");history.type="button";history.disabled=true;
  const cancel=node("button","action-button","Annuler");cancel.type="button";
  const message=node("p");message.setAttribute("role","status");
  select.addEventListener("change",()=>{next.disabled=history.disabled=!select.value;});
  next.addEventListener("click",()=>{
    if(state.user!==user){dialog.close();return;}
    const unit=state.equipments?.find((u)=>u.id===Number(select.value));
    if(!unit){message.textContent="Unité indisponible. Actualisez l’inventaire.";return;}
    dialog.close();run(unit);
  });
  history.addEventListener("click",()=>{if(select.value)ouvrirHistoriqueUnite(Number(select.value));});
  cancel.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>dialog.remove(),{once:true});
  actions.append(next,history,cancel);dialog.append(title,label,message,actions);document.body.append(dialog);dialog.showModal();
}
async function ouvrirHistoriqueUnite(id){
  const user=state.user;const dialog=node("dialog","assignment-dialog");
  dialog.setAttribute("aria-label","Historique de l’unité");
  const title=node("h2","","Historique de l’unité");const content=node("div");content.append(node("p","","Chargement…"));
  const close=node("button","action-button","Fermer");close.type="button";close.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>dialog.remove(),{once:true});dialog.append(title,content,close);document.body.append(dialog);dialog.showModal();
  try{const rows=await api(`/api/equipements/${id}/historique`);if(state.user!==user){dialog.close();return;}if(!dialog.isConnected)return;content.replaceChildren();
    for(const [label,list] of [["Mouvements de cette unité",rows.unite],["Historique antérieur de la fiche — non réparti entre les unités",rows.ancienne_fiche]]){
      content.append(node("h3","",label));if(!list.length)content.append(node("p","empty","Aucun mouvement."));
      for(const m of list)content.append(node("p","report-description",new Date(m.date_mouvement).toLocaleString("fr-CA")+" · "+m.auteur+" · "+m.type_mouvement+(m.note?" · "+m.note:"")));
    }
  }catch(error){content.replaceChildren(node("p","",error.message));}
}

function renderTables() {
  const data = matching();
  $("nombreResultats").textContent =
    `${data.length} unité${data.length > 1 ? "s" : ""} · ${regrouperUnites(data).length} groupe(s)`;
  drawTable("listeEquipements", regrouperUnites(data), false);
  const recent = regrouperUnites(state.equipments || [])
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
    row.append(node("td", "", e.nom ?? "—"), node("td", "", e.categorie ?? "—"));
    const serialCell = node("td");
    if (e.unites?.length > 1) {
      const link = node("a", "serial-numbers-link", "Voir les numéros de série");
      link.href = "#";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        afficherNumerosSerie(e);
      });
      serialCell.append(link);
    } else serialCell.textContent = e.numero_serie ?? "—";
    row.append(serialCell, node("td", "", e.emplacement ?? "—"));
    const status = node("td"),
      badge = node("span", "badge", e.etat || "Non renseigné");
    badge.style.setProperty("--badge", statusColor(e.etat));
    status.append(badge);
    row.append(
      status,
      node("td", "", recent ? formattedDate(e) : (e.quantite ?? "—")),
    );
    if (!recent) {
      const actions = node("td");
      const menu = node("select", "action-button equipment-actions");
      menu.setAttribute("aria-label", `Actions pour ${e.nom} — ${e.etat}`);
      const placeholder = node("option", "", "Select");
      placeholder.value = "";
      placeholder.hidden = true;
      placeholder.disabled = true;
      placeholder.selected = true;
      menu.append(placeholder);
      const available = equipmentActions(e);
      for (const action of available) {
        const option = node("option", "", action.label);
        option.value = action.id;
        menu.append(option);
      }
      menu.addEventListener("change", () => {
        const action = available.find((item) => item.id === menu.value);
        menu.value = "";
        try { action?.run(); }
        catch (error) { $("messageInventaire").textContent = error.message; }
      });
      actions.append(menu);
      row.append(actions);
    }
    body.append(row);
  }
}
// Les mêmes choix restent visibles; chaque exécution contrôle les permissions.
function equipmentActions(e) {
  if (e.unites) return equipmentActions(e.unites[0]).map((action) => ({...action,
    run: () => choisirUnite(e, (unit) => {
      const current = equipmentActions(unit).find((item) => item.id === action.id);
      if (current) current.run(); else afficherMessageAction("Cette action ne s’applique plus à l’unité sélectionnée.");
    }),
  }));
  const actions = [
    { id: "modifier", label: "Modifier", run: () => {
      state.editing = e;
      location.hash = "ajouter";
      afficherPage();
    } },
    { id: "attribuer", label: "Attribuer à un employé", run: () => executerActionStatut(e, "Attribué") },
    { id: "disponible", label: "Disponible", run: () => executerActionStatut(e, "Disponible") },
    { id: "reparation", label: "En réparation", run: () => executerActionStatut(e, "En réparation") },
    { id: "perdu-vole", label: "Perdu / Volé", run: () => executerActionStatut(e, "Perdu / Volé") },
    { id: "hors-service", label: "À remplacer / Hors service", run: () => executerActionStatut(e, "À remplacer / Hors service") },
  ];
  if (state.user?.role === "Administrateur") {
    const decision = state.validationsEquipements.find((v) => v.equipement_id === e.id);
    if (e.etat === "En attente de validation" && decision?.statut !== "Refusée") {
      actions.push({id:"valider",label:"Valider",run:()=>ouvrirDecisionValidation(e,"Acceptée")},
        {id:"refuser-ajout",label:"Refuser",run:()=>ouvrirDecisionValidation(e,"Refusée")});
    }
    return actions;
  }
  if (state.user?.role === "Employé") return actions
    .filter((action) => ["modifier", "disponible", "reparation", "perdu-vole", "hors-service"].includes(action.id))
    .map((action) => ({ ...action, label: {
      reparation: "En réparation",
      "perdu-vole": "Signaler Perdu / Volé",
      "hors-service": "Signaler À remplacer / Hors service",
    }[action.id] || action.label }));
  return [];
}
function afficherMessageAction(text) {
  const message = $(state.page === "ajouter" ? "messageEquipement" : "messageInventaire");
  message.textContent = text;
  message.setAttribute("role", "alert");
  message.scrollIntoView?.({behavior:"smooth",block:"center"});
}
function raisonRefusDisponible(e) {
  if (e.etat === "À remplacer / Hors service")
    return "Cet équipement est « À remplacer / Hors service ». Seul un administrateur peut le remettre en service au statut Disponible. Aucun changement enregistré.";
  if (e.etat === "En attente de validation")
    return "Cet équipement attend sa validation par un administrateur. Un employé ne peut pas le rendre Disponible. Aucun changement enregistré.";
  if (state.signalements.some((s) => (s.equipement_id === e.id || (s.unite_id == null && s.equipement_origine_id === e.equipement_origine_id)) && s.statut === "En attente"))
    return "Un signalement est en attente. Un administrateur doit le traiter avant le retour à Disponible. Aucun changement enregistré.";
  if (e.attribue_a_id != null && e.attribue_a_id !== state.user?.id)
    return "Cet équipement est attribué à un autre employé. Son détenteur ou un administrateur doit confirmer le retour. Aucun changement enregistré.";
  if (e.attribue_a_id != null || e.date_attribution != null)
    return "Une attribution active empêche ce changement. Un administrateur doit vérifier l’équipement. Aucun changement enregistré.";
  return "Le retour à Disponible n’est pas autorisé depuis ce statut pour votre rôle. Aucun changement enregistré.";
}
function informerHorsService() {
  const dialog = node("dialog", "assignment-dialog");
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-label", "Équipement hors service");
  dialog.setAttribute("aria-describedby", "messageHorsService");
  const message = node("p", "", "Cet équipement est déclaré hors service. Seul un administrateur peut le remettre au statut Disponible.");
  message.id = "messageHorsService";
  const button = node("button", "action-button", "OK");
  button.type = "button";
  button.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove(), {once:true});
  dialog.append(message, button);
  document.body.append(dialog);
  dialog.showModal();
  button.focus();
}
function executerActionStatut(e, status) {
  if (state.user?.role === "Employé" && status === "Disponible" && e.etat === "À remplacer / Hors service") {
    informerHorsService();
    return;
  }
  const message = $(state.page === "ajouter" ? "messageEquipement" : "messageInventaire");
  if (state.user?.role === "Employé" && ["Perdu / Volé", "À remplacer / Hors service"].includes(status)) {
    ouvrirSignalement(e, status);
    return;
  }
  if (state.user?.role !== "Administrateur" && !(state.user?.role === "Employé" && ["Disponible", "En réparation"].includes(status))) {
    afficherMessageAction("Cette action est réservée à l’administrateur.");
    return;
  }
  if (e.etat === status) {
    afficherMessageAction(`Cet équipement est déjà au statut « ${status} ».`);
    return;
  }
  const transition = statusTransitions(e).find((t) => t.status === status);
  if (!transition) {
    afficherMessageAction(state.user?.role === "Employé" && status === "Disponible"
      ? raisonRefusDisponible(e)
      : `Le passage de « ${e.etat} » à « ${status} » n’est pas pris en charge pour votre rôle. Aucun changement enregistré.`);
    return;
  }
  message.textContent = "";
  if (status === "Attribué") return ouvrirAttribution(e);
  ouvrirActionStatut(e, transition);
}
function ouvrirActionStatut(e, transition) {
  const sessionUser = state.user;
  const dialog = node("dialog", "assignment-dialog");
  const title = node("h2", "", transition.status);
  title.id = "titreActionStatut";
  dialog.setAttribute("aria-labelledby", title.id);
  const form = node("form");
  let input;
  if (transition.field) {
    const label = node("label", "", transition.label);
    input = node("input");
    input.required = state.user?.role === "Employé" && transition.status === "En réparation";
    label.append(input);
    form.append(label);
  }
  let retour;
  if (transition.returnRequired || transition.reactivationRequired) {
    const label = node("label", "", "Je confirme vouloir changer le statut de cet équipement à « Disponible ».");
    retour = node("input"); retour.type = "checkbox"; retour.required = true; retour.style.width = "auto"; retour.style.justifySelf = "start";
    label.append(retour); form.append(label);
  }
  const message = node("p");
  message.setAttribute("role", "status");
  const buttons = node("div", "form-actions");
  const submit = node("button", "action-button", "Confirmer");
  submit.type = "submit";
  submit.disabled = !!retour;
  if (retour) retour.addEventListener("change", () => { submit.disabled = sending || !retour.checked; });
  const cancel = node("button", "action-button", "Annuler");
  cancel.type = "button";
  cancel.addEventListener("click", () => dialog.close());
  buttons.append(submit, cancel);
  form.append(message, buttons);
  dialog.append(title, node("p", "", e.nom), form);
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  let sending = false;
  dialog.addEventListener("cancel", (event) => { if (sending) event.preventDefault(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    if (state.user !== sessionUser) { dialog.close(); return; }
    if (!statusTransitions(e).some((t) => t.route === transition.route)) {
      message.textContent = "Cette transition n’est plus autorisée.";
      return;
    }
    const body = transition.adminStatus ? {etat:transition.status} : {};
    if (retour) { if (!retour.checked) { message.textContent = "Je confirme vouloir changer le statut de cet équipement à « Disponible »."; return; } body[transition.reactivationRequired ? "confirmer_remise_service" : "confirmer_retour"] = true; }
    if (transition.field) {
      const value = input.value.trim();
      if (input.required && !value) { message.textContent = "La description du problème est obligatoire."; return; }
      body[transition.field] = value;
    }
    sending = true;
    submit.disabled = cancel.disabled = true;
    if (input) input.disabled = true;
    message.textContent = "Enregistrement…";
    try {
      const result = await api(
        `/api/equipements/${encodeURIComponent(e.id)}/${transition.route}`,
        jsonRequest("PUT", body),
      );
      dialog.close();
      await chargerInventaire();
      await chargerSignalements();
      if (state.user === sessionUser) {
        synchroniserStatutEdition(state.equipments ? result.message || "Opération enregistrée." : "Opération enregistrée ; actualisation indisponible.");
        $("messageInventaire").textContent = state.equipments
          ? result.message || "Statut mis à jour."
          : "Statut enregistré. Actualisation impossible : " + $("messageInventaire").textContent;
      }
    } catch (error) {
      if (state.user !== sessionUser) dialog.close();
      else message.textContent = error.message;
    } finally {
      sending = false;
      cancel.disabled = false;
      submit.disabled = !!retour && !retour.checked;
      if (input) input.disabled = false;
    }
  });
  dialog.showModal();
}
async function ouvrirAttribution(e) {
  if (state.user?.role !== "Administrateur") return;
  const sessionUser = state.user;
  const dialog = node("dialog", "assignment-dialog");
  dialog.setAttribute("aria-labelledby", "titreAttribution");
  const title = node("h2", "", "Attribuer à un employé");
  title.id = "titreAttribution";
  const form = node("form");
  const label = node("label", "", "Employé actif");
  const select = node("select");
  select.required = true;
  select.disabled = true;
  label.append(select);
  const message = node("p", "", "Chargement des employés…");
  message.setAttribute("role", "status");
  const buttons = node("div", "form-actions");
  const submit = node("button", "action-button", "Confirmer l’attribution");
  submit.type = "submit";
  submit.disabled = true;
  const cancel = node("button", "action-button", "Annuler");
  cancel.type = "button";
  cancel.addEventListener("click", () => dialog.close());
  buttons.append(submit, cancel);
  form.append(label, message, buttons);
  dialog.append(title, node("p", "", e.nom), form);
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  let sending = false;
  dialog.addEventListener("cancel", (event) => {
    if (sending) event.preventDefault();
  });
  dialog.showModal();
  let employees = [];
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || state.user !== sessionUser) return;
    const id = Number(select.value);
    const employee = employees.find((user) => Number(user.id) === id);
    if (!Number.isInteger(id) || id <= 0 || !employee) {
      message.textContent = "Sélectionnez un employé actif.";
      return;
    }
    if (!window.confirm(`Attribuer « ${e.nom} » à ${employee.nom} ?`)) return;
    sending = true;
    submit.disabled = select.disabled = cancel.disabled = true;
    message.textContent = "Attribution en cours…";
    try {
      const result = await api(
        `/api/equipements/${encodeURIComponent(e.id)}/statut-administrateur`,
        jsonRequest("PUT", { etat:"Attribué", utilisateur_id: id }),
      );
      dialog.close();
      await chargerInventaire();
      if (state.user === sessionUser) {
        $("messageInventaire").textContent = state.equipments
          ? result.message || "Équipement attribué avec succès."
          : "Attribution réussie. Actualisation impossible : " + $("messageInventaire").textContent;
      }
    } catch (error) {
      if (state.user !== sessionUser) dialog.close();
      else message.textContent = error.message;
    } finally {
      sending = false;
      submit.disabled = select.disabled = cancel.disabled = false;
    }
  });
  try {
    const users = await api("/api/utilisateurs");
    if (!dialog.isConnected) return;
    if (state.user !== sessionUser) { dialog.close(); return; }
    if (!Array.isArray(users)) throw new Error("Le format des utilisateurs est incorrect.");
    employees = users.filter((user) => user.role === "Employé" &&
      (user.actif === true || user.actif === 1) &&
      Number.isInteger(Number(user.id)) && Number(user.id) > 0);
    const placeholder = node("option", "", "Sélectionner un employé…");
    placeholder.value = "";
    select.append(placeholder);
    for (const employee of employees) {
      const option = node("option", "", `${employee.nom} (${employee.email})`);
      option.value = employee.id;
      select.append(option);
    }
    message.textContent = employees.length ? "" : "Aucun employé actif disponible.";
    select.disabled = submit.disabled = !employees.length;
    if (employees.length) select.focus();
  } catch (error) {
    if (state.user !== sessionUser) dialog.close();
    else message.textContent = error.message;
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
window.addEventListener("hashchange", () => {
  if ((location.hash.slice(1) || "tableau-de-bord") !== state.page) afficherPage();
});
document.querySelectorAll('[data-page="inventaire"]').forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    state.query = ""; state.status = "";
    $("recherche").value = ""; $("filtreStatut").value = "";
    location.hash = "inventaire";
    afficherPage();
    await chargerInventaire();
    await chargerSignalements();
  });
});
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

  chargerSignalements();
  ouvrirToutesNotifications();
});
// Transitions exposées par les routes métier actuelles de app.js.
function statusTransitions(e) {
  if (state.user?.role === "Employé") {
    const transitions = [];
    const pending = state.signalements.some((s) => (s.equipement_id === e.id || (s.unite_id == null && s.equipement_origine_id === e.equipement_origine_id)) && s.statut === "En attente");
    const retour = ["Attribué","En attente de retour"].includes(e.etat);
    if (!pending && e.etat === "En réparation" && (e.attribue_a_id == null || e.attribue_a_id === state.user.id))
      transitions.push({status:"Disponible",route:"reparation/fin",field:"resolution",label:"Commentaire (facultatif)",returnRequired:true});
    if (!pending && ((retour && e.attribue_a_id === state.user.id) ||
      (e.etat === "Perdu / Volé" && e.attribue_a_id == null && e.date_attribution == null)))
      transitions.push({status:"Disponible",route:"disponibilite",field:"commentaire",label:"Commentaire (facultatif)",returnRequired:true});
    if (!pending && ["Disponible","Attribué"].includes(e.etat) && (e.attribue_a_id == null || e.attribue_a_id === state.user.id))
      transitions.push({status:"En réparation",route:"reparation",field:"raison",label:"Description du problème (obligatoire)",required:true});
    if (["Disponible","Attribué","En réparation","En attente de retour"].includes(e.etat))
      for (const status of ["Perdu / Volé","À remplacer / Hors service"])
        transitions.push({status,signalement:true,field:"description",label:"Description du problème (obligatoire)",required:true});
    return transitions;
  }
  if (state.user?.role !== "Administrateur") return [];
  return equipmentStatuses.map((status) => ({
    status,route:"statut-administrateur",adminStatus:true,
    field:["Attribué","En attente de retour"].includes(status)?"utilisateur_id":"commentaire",
    label:["Attribué","En attente de retour"].includes(status)?"Employé actif":{
      "En réparation":"Raison de la réparation / Commentaire (facultatif)",
      "Perdu / Volé":"Raison de la perte ou du vol / Commentaire (facultatif)",
      "À remplacer / Hors service":"Raison du remplacement ou de la mise hors service / Commentaire (facultatif)",
    }[status] || "Commentaire (facultatif)",
  }));
}
const equipmentStatuses = [
  "Disponible", "Attribué", "En réparation", "En attente de retour",
  "En attente de validation", "Perdu / Volé", "À remplacer / Hors service",
];
let statusDetailVersion = 0;
let statusEmployees = [];
function prepareStatusField() {
  const edit = state.editing;
  const select = $("statutEquipement");
  $("champStatut").hidden = !edit;
  select.replaceChildren();
  select.disabled = !edit || !["Administrateur","Employé"].includes(state.user?.role);
  if (edit) {
    const transitions = statusTransitions(edit);
    const statuses = state.user?.role === "Administrateur" ? equipmentStatuses : [...new Set([edit.etat,"Disponible","En réparation","Perdu / Volé","À remplacer / Hors service"])];
    for (const status of statuses) {
      const supported = status === edit.etat || transitions.some((t) => t.status === status);
      const option = node("option", "", (supported || state.user?.role === "Employé") ? (state.user?.role === "Employé" && ["Perdu / Volé","À remplacer / Hors service"].includes(status) && status !== edit.etat ? "Signaler " + status : status) : status + " (indisponible)");
      option.value = status;
      option.disabled = state.user?.role === "Employé" ? false : !supported;
      if (!supported) option.title = "Transition non prise en charge par les routes métier pour cet équipement et ce rôle.";
      select.append(option);
    }
    select.value = edit.etat;
  }
  updateStatusDetail();
}
async function updateStatusDetail() {
  const version = ++statusDetailVersion;
  const edit = state.editing;
  const user = state.user;
  const label = $("champDetailStatut");
  label.replaceChildren();
  label.hidden = true;
  statusEmployees = [];
  const transition = edit && statusTransitions(edit).find((t) => t.status === $("statutEquipement").value);
  if (!transition?.field) return;
  label.hidden = false;
  label.append(document.createTextNode(transition.label));
  const input = node(transition.field === "utilisateur_id" ? "select" : "input");
  input.id = "detailStatut";
  input.required = transition.field === "utilisateur_id" || !!transition.required;
  label.append(input);
  if (transition.field !== "utilisateur_id") return;
  const placeholder = node("option", "", "Chargement des employés…");
  placeholder.value = "";
  input.append(placeholder);
  try {
    const users = await api("/api/utilisateurs");
    if (version !== statusDetailVersion || state.editing !== edit || state.user !== user) return;
    if (!Array.isArray(users)) throw new Error("Le format des utilisateurs est incorrect.");
    statusEmployees = users.filter((u) => u.role === "Employé" &&
      (u.actif === true || u.actif === 1) && Number.isInteger(Number(u.id)) && Number(u.id) > 0);
    placeholder.textContent = statusEmployees.length ? "Sélectionner un employé…" : "Aucun employé actif disponible.";
    for (const employee of statusEmployees) {
      const option = node("option", "", `${employee.nom} (${employee.email})`);
      option.value = employee.id;
      input.append(option);
    }
  } catch (error) {
    if (version !== statusDetailVersion) return;
    placeholder.textContent = "Employés indisponibles";
    $("messageEquipement").textContent = error.message;
  }
}
$("statutEquipement").addEventListener("change", () => {
  if (state.user?.role !== "Employé" || !state.editing) { updateStatusDetail(); return; }
  const requested = $("statutEquipement").value;
  const equipment = state.editing;
  // Le choix déclenche exactement la même fenêtre que la colonne Actions.
  // Le statut affiché reste celui enregistré tant que l'action n'est pas confirmée.
  $("statutEquipement").value = equipment.etat;
  updateStatusDetail();
  $("messageEquipement").textContent = "";
  if (requested !== equipment.etat) executerActionStatut(equipment, requested);
});
function synchroniserStatutEdition(message = "") {
  if (!state.editing || state.page !== "ajouter") return;
  const equipment = state.equipments?.find((e) => e.id === state.editing.id);
  if (equipment) {
    state.editing = equipment;
    prepareStatusField();
  }
  $("messageEquipement").textContent = message;
}
function selectedStatusChange(edit) {
  if (!edit || $("statutEquipement").value === edit.etat) return null;
  const transition = statusTransitions(edit).find((t) => t.status === $("statutEquipement").value);
  if (!transition) throw new Error("Cette transition n’est pas prise en charge pour cet équipement et ce rôle. Le statut n’a pas été enregistré.");
  const body = transition.adminStatus ? {etat:transition.status} : {};
  if (transition.field) {
    const value = $("detailStatut").value.trim();
    if (transition.required && !value) throw new Error(transition.label);
    if (transition.field === "utilisateur_id") {
      const id = Number(value);
      if (!Number.isInteger(id) || id <= 0 || !statusEmployees.some((u) => Number(u.id) === id))
        throw new Error("Sélectionnez un employé actif.");
      body.utilisateur_id = id;
    } else {
      body[transition.field] = value;
    }
  }
  return { ...transition, body };
}
function prepareEquipmentForm() {
  const form = $("formEquipement");
  form.reset();
  form.elements.quantite.readOnly=!!state.editing;
  $("champSeriesUnites").hidden=!!state.editing;
  prepareStatusField();
  $("messageEquipement").textContent = "";
  $("titreFormulaire").textContent = state.editing
    ? "Modifier un équipement"
    : "Ajouter un équipement";
  $("infoAjout").textContent = state.editing
    ? (state.user.role === "Administrateur"
      ? "Tous les statuts sont accessibles à l’administrateur. Une attribution exige un employé actif."
      : "Disponible et réparation : changements directs autorisés. Perte/vol et hors service : signalements soumis à approbation.")
    : state.user.role === "Administrateur"
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
    for(const ref of (field==="categorie_id"?state.referentiels.categories:state.referentiels.emplacements))refs.set(String(ref.id),ref.nom);
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
    ? "Les catégories et emplacements disponibles sont chargés depuis les référentiels."
    : "Ajout indisponible : aucune catégorie ou aucun emplacement actif n’est disponible.";
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
  let detailsSaved = false;
  try {
    const statusChange = selectedStatusChange(edit);
    if (statusChange && !window.confirm(statusChange.status === "Disponible" ? "Je confirme vouloir changer le statut de cet équipement à « Disponible »." : statusChange.signalement ? "Soumettre ce signalement à l’administrateur ? Le statut reste inchangé." : `Confirmer le passage de « ${edit.etat} » à « ${statusChange.status} » ?`)) return;
    if (statusChange?.returnRequired) statusChange.body.confirmer_retour = true;
    if (statusChange?.reactivationRequired) statusChange.body.confirmer_remise_service = true;
    const result = await api(
      edit
        ? `/api/equipements/${encodeURIComponent(edit.id)}`
        : "/api/equipements",
      jsonRequest(edit ? "PUT" : "POST", data),
    );
    detailsSaved = true;
    if (statusChange) {
      const statusResult = await api(
        statusChange.signalement ? "/api/signalements" : `/api/equipements/${encodeURIComponent(edit.id)}/${statusChange.route}`,
        statusChange.signalement ? jsonRequest("POST", {equipement_id:Number(edit.id),type_signalement:statusChange.status,description:statusChange.body.description}) : jsonRequest("PUT", statusChange.body),
      );
      result.message = statusResult.message;
    }
    state.editing = null;
    await chargerInventaire();
    await chargerSignalements();
    if (!state.user) return;
    location.hash = "inventaire";
    if (state.equipments) $("messageInventaire").textContent = result.message;
  } catch (error) {
    if (detailsSaved && state.user) await chargerInventaire();
    $("messageEquipement").textContent = (detailsSaved ? "Les informations ont été enregistrées, mais le statut n’a pas pu être changé : " : "") + error.message;
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

function cleNotification(source, report) {
  const code = {"En attente":"P", "Acceptée":"A", "Refusée":"R"}[report.statut];
  return source === "i" ? "i:" + report.id : source + ":" + report.id + ":" + code + (source === "v" ? ":" + (report.decision_id || 0) : "");
}
function toutesNotifications() {
  const entries = [
    ...state.notificationsReparation.map(report=>({source:"i",report,date:report.date_mouvement})),
    ...state.signalements.map(report=>({source:"s",report,date:report.date_decision || report.date_signalement})),
    ...state.validationsEquipements.map(report=>({source:"v",report,date:report.date_decision || report.date_signalement})),
  ];
  return entries.map(item=>({...item,cle:cleNotification(item.source,item.report)})).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)||b.cle.localeCompare(a.cle));
}
function actualiserBadgeSignalements() {
  const unread=toutesNotifications().filter(n=>{const e=state.etatsNotifications[n.cle] || {};return !e.lue&&!e.archivee&&!e.retiree;}).length;
  $("badgeAlertes").textContent=unread;
  $("badgeAlertes").hidden=unread===0;
  $("notifications").title=unread+" notification(s) non lue(s)";
}
let chargementSignalements = false;
async function chargerSignalements() {
  if (!state.user || chargementSignalements) return;
  const user = state.user;
  chargementSignalements = true;
  try {
    const [rows, informations, validations, etats] = await Promise.all([
      api("/api/signalements"), user.role === "Administrateur" ? api("/api/notifications/reparations") : Promise.resolve([]),
      api("/api/validations-equipements"), api("/api/notifications/etats"),
    ]);
    if (state.user !== user) return;
    if (!Array.isArray(rows)) throw new Error("Le format des signalements est incorrect.");
    if (!Array.isArray(informations)) throw new Error("Le format des notifications est incorrect.");
    if (!Array.isArray(validations)) throw new Error("Le format des validations est incorrect.");
    state.validationsEquipements = validations.map((v) => ({...v,validationEquipement:true}));
    state.signalements = rows;
    state.notificationsReparation = informations;
    state.etatsNotifications = etats;
    $("messageSignalements").textContent = "";
    afficherSignalements();
    actualiserBadgeSignalements();
    if (state.page === "inventaire") renderTables();
  } catch (error) {
    if (state.user === user) $("messageSignalements").textContent = error.message;
  } finally { chargementSignalements = false; }
}
let fenetreNotifications = null;
async function changerEtatNotification(item, action, button, message) {
  const user=state.user;button.disabled=true;
  try {
    const result=await api("/api/notifications/etat",jsonRequest("PUT",{cle:item.cle,action}));
    if(state.user!==user)return;
    state.etatsNotifications[result.cle]=result.etat;
    afficherSignalements();actualiserBadgeSignalements();
  } catch(error) { if(state.user===user)message.textContent=error.message; }
  finally {button.disabled=false;}
}
function carteNotification(item) {
  const report=item.report, etat=state.etatsNotifications[item.cle] || {};
  const article=node("article","report-item");
  article.append(node("h3","",report.equipement_nom));
  article.append(node("p","",etat.retiree?"Retirée de l’affichage":etat.archivee?"Archivée":etat.lue?"Lue":"Non lue"));
  if(item.source==="i") {
    article.append(node("p","",report.employe_nom+" · "+new Date(item.date).toLocaleString("fr-CA")),node("p","report-description",report.note),node("p","",(report.type_mouvement || "Mise en réparation")+" — aucune approbation requise."));
  } else {
    article.append(node("p","",report.employe_nom+" · "+report.type_signalement),node("p","","Signalé le "+new Date(report.date_signalement).toLocaleString("fr-CA")+" · "+report.statut),node("p","report-description",report.description));
    if(report.statut!=="En attente") {
      article.append(node("p","","Décision : "+report.statut+(report.administrateur_nom?" · "+report.administrateur_nom:"")));
      if(report.commentaire)article.append(node("p","report-description",report.commentaire));
    }
    if(state.user?.role==="Administrateur"&&report.statut==="En attente") {
      const decisions=node("div","form-actions");
      for(const [label,decision]of [["Accepter","Acceptée"],["Refuser","Refusée"]]) {
        const button=node("button","action-button",label);button.type="button";
        button.addEventListener("click",()=>report.validationEquipement?ouvrirDecisionValidation(report,decision):ouvrirDecisionSignalement(report,decision));decisions.append(button);
      }
      article.append(decisions);
    }
  }
  const actions=node("div","form-actions"),message=node("p");message.setAttribute("role","status");
  const options=etat.archivee||etat.retiree?[["Réafficher","restaurer"]]:[["Marquer comme lue","lire"],["Archiver","archiver"],["Retirer de l’affichage","retirer"]];
  for(const [label,action]of options) {
    const button=node("button","action-button",label);button.type="button";button.disabled=action==="lire"&&!!etat.lue;
    button.addEventListener("click",()=>changerEtatNotification(item,action,button,message));actions.append(button);
  }
  article.append(actions,message);return article;
}
function afficherSignalements() {
  const entries=toutesNotifications(),container=$("listeSignalements");container.replaceChildren();
  const pending=[...state.signalements,...state.validationsEquipements].filter(s=>s.statut==="En attente").length;
  $("nombreSignalements").textContent=pending?"· "+pending+" en attente":"";
  const visible=entries.filter(item=>{const e=state.etatsNotifications[item.cle] || {};return !e.archivee&&!e.retiree;}).slice(0,3);
  for(const item of visible)container.append(carteNotification(item));
  if(!visible.length)container.append(node("p","empty","Aucune notification à afficher."));
  if(fenetreNotifications?.isConnected)rafraichirToutesNotifications();
}
function rafraichirToutesNotifications() {
  const dialog=fenetreNotifications,select=dialog.querySelector("select"),container=dialog.querySelector(".notifications-list");container.replaceChildren();
  const entries=toutesNotifications().filter(item=>{const e=state.etatsNotifications[item.cle] || {};return select.value==="toutes"||select.value==="attente"&&item.source!=="i"&&item.report.statut==="En attente"||select.value==="archivees"&&e.archivee||select.value==="retirees"&&e.retiree||select.value==="actives"&&!e.archivee&&!e.retiree;});
  for(const item of entries)container.append(carteNotification(item));
  if(!entries.length)container.append(node("p","empty","Aucune notification dans cette liste."));
}
function ouvrirToutesNotifications(filtre="toutes") {
  if(!state.user)return;
  if(fenetreNotifications?.isConnected){fenetreNotifications.querySelector("select").value=filtre;rafraichirToutesNotifications();return;}
  const dialog=node("dialog","assignment-dialog notifications-dialog");fenetreNotifications=dialog;
  dialog.setAttribute("aria-label","Toutes les notifications");
  const label=node("label","","Afficher"),select=node("select");
  for(const [value,text]of [["toutes","Toutes"],["actives","Actives"],["archivees","Archivées"],["retirees","Retirées"]]){const option=node("option","",text);option.value=value;select.append(option);}
  const pendingOption=node("option","",state.user.role==="Administrateur"?"Demandes à traiter":"Mes demandes en attente");pendingOption.value="attente";select.append(pendingOption);select.value=filtre;
  select.addEventListener("change",rafraichirToutesNotifications);label.append(select);
  const content=node("div","notifications-list");
  dialog.addEventListener("close",()=>{dialog.remove();if(fenetreNotifications===dialog)fenetreNotifications=null;},{once:true});
  const header=node("div","notifications-dialog-header"),cross=node("button","action-button notifications-close","×");
  cross.type="button";cross.setAttribute("aria-label","Fermer les notifications");cross.title="Fermer";
  cross.addEventListener("click",()=>dialog.close());
  header.append(node("h2","","Toutes les notifications"),cross);
  dialog.addEventListener("cancel",event=>{event.preventDefault();dialog.close();});
  dialog.addEventListener("click",event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
  });
  dialog.append(header,label,content);document.body.append(dialog);rafraichirToutesNotifications();dialog.showModal();
}
$("voirToutesNotifications").addEventListener("click",event=>{event.preventDefault();ouvrirToutesNotifications();});
function fenetreSignalement(titleText, labelText, required, confirmText, save) {
  const user = state.user;
  const dialog = node("dialog", "assignment-dialog");
  const title = node("h2", "", titleText);
  title.id = "titreSignalement";
  dialog.setAttribute("aria-labelledby", title.id);
  const form = node("form");
  const label = node("label", "", labelText);
  const input = node("textarea");
  input.rows = 3;
  input.maxLength = 500;
  input.required = required;
  label.append(input);
  const message = node("p");
  message.setAttribute("role", "status");
  const buttons = node("div", "form-actions");
  const confirm = node("button", "action-button", confirmText);
  confirm.type = "submit";
  confirm.disabled = required;
  const cancel = node("button", "action-button", "Annuler");
  cancel.type = "button";
  let sending = false;
  input.addEventListener("input", () => { confirm.disabled = sending || (required && !input.value.trim()); });
  cancel.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => { if (sending) event.preventDefault(); });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    if (state.user !== user) { dialog.close(); return; }
    const value = input.value.trim();
    if (required && !value) { message.textContent = labelText; return; }
    sending = true;
    confirm.disabled = cancel.disabled = input.disabled = true;
    message.textContent = "Enregistrement…";
    try {
      const result = await save(value);
      dialog.close();
      await chargerInventaire();
      await chargerSignalements();
      if (state.user === user) {
        $("messageSignalements").textContent = result.message;
        synchroniserStatutEdition(result.message);
      }
    } catch (error) {
      if (state.user !== user) dialog.close();
      else message.textContent = error.message;
    } finally {
      sending = false;
      cancel.disabled = input.disabled = false;
      confirm.disabled = required && !input.value.trim();
    }
  });
  buttons.append(confirm, cancel);
  form.append(label, message, buttons);
  dialog.append(title, form);
  document.body.append(dialog);
  dialog.showModal();
}
function ouvrirSignalement(e, type) {
  if (state.user?.role !== "Employé") return;
  const allowed = type === "En réparation" ? ["Disponible", "Attribué"]
    : ["Disponible", "Attribué", "En réparation", "En attente de retour"];
  if (!allowed.includes(e.etat)) {
    $(state.page === "ajouter" ? "messageEquipement" : "messageInventaire").textContent = "Cet équipement ne peut pas être signalé dans son état actuel. Aucun changement enregistré.";
    return;
  }
  fenetreSignalement("Signaler : " + type + " · " + e.nom, "Description du problème (obligatoire)", true, "Soumettre",
    (description) => api("/api/signalements", jsonRequest("POST", {
      equipement_id: Number(e.id), type_signalement: type, description,
    })));
}
function ouvrirDecisionValidation(e, decision) {
  if (state.user?.role !== "Administrateur") return;
  fenetreSignalement((decision === "Acceptée" ? "Valider" : "Refuser") + " · " + (e.equipement_nom || e.nom),
    decision === "Refusée" ? "Motif du refus (obligatoire)" : "Commentaire (facultatif)",
    decision === "Refusée", "Confirmer",
    (commentaire) => api(`/api/equipements/${e.equipement_id || e.id}/validation${decision === "Refusée" ? "/refus" : ""}`,jsonRequest("PUT",{commentaire})));
}
function ouvrirDecisionSignalement(report, decision) {
  if (state.user?.role !== "Administrateur") return;
  if (decision === "Acceptée" && report.unite_id == null) {
    const units=(state.equipments || []).filter((u)=>u.equipement_origine_id===report.equipement_origine_id);
    if(!units.length){afficherMessageAction("Les unités de cette ancienne demande sont indisponibles.");return;}
    choisirUnite({nom:report.equipement_nom,unites:units},async(unit)=>{
      try{await api(`/api/signalements/${report.id}/unite`,jsonRequest("PUT",{unite_id:unit.id}));
        ouvrirDecisionSignalement({...report,unite_id:unit.id,equipement_id:unit.id},decision);
      }catch(error){afficherMessageAction(error.message);}
    });return;
  }
  fenetreSignalement((decision === "Acceptée" ? "Accepter" : "Refuser") + " · " + report.equipement_nom,
    decision === "Refusée" ? "Motif du refus (obligatoire)" : "Commentaire (facultatif)",
    decision === "Refusée", "Confirmer",
    (commentaire) => api(`/api/signalements/${report.id}/decision`, jsonRequest("PUT", {decision, commentaire})));
}
// Les sessions expirées restent gérées par api(); la cloche se met à jour sans rechargement manuel.
window.setInterval(() => { if (state.user) chargerSignalements(); }, 20000);

verifierSession();
