/* ================================================================
   LOGIQUE DU POPUP
   - lit / ecrit la config dans chrome.storage.local ("autoclicker")
   - declenche la pipette et la lecture dans l'onglet actif
   - injecte le content script a la demande si besoin (chrome.scripting)
   ================================================================ */

const STORAGE_KEY = "autoclicker";
const DEFAULTS = {
  steps: [],
  options: { loops: 1, infinite: false, cursorSpeed: 600, pointerMode: false },
};

// Libelles des types d'action proposes par etape.
const ACTIONS = {
  click: "Clic",
  dblclick: "Double-clic",
  hover: "Survol",
  scroll: "Defiler vers",
};

// ----- Raccourcis DOM -----
const $ = (id) => document.getElementById(id);
const stepsEl = $("steps");
const emptyEl = $("empty");
const statusEl = $("status");

// ============================================================
//  Stockage
// ============================================================
async function loadConfig() {
  const data = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  return {
    steps: (data && data.steps) || [],
    options: Object.assign({}, DEFAULTS.options, (data && data.options) || {}),
  };
}
async function saveConfig(cfg) {
  await chrome.storage.local.set({ [STORAGE_KEY]: cfg });
}

// ============================================================
//  Onglet actif + injection du content script
// ============================================================
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Page sur laquelle on ne peut pas injecter de script.
function isRestricted(url = "") {
  return (
    /^(chrome|edge|brave|about|chrome-extension|edge-extension|view-source|devtools):/i.test(url) ||
    url.includes("chrome.google.com/webstore") ||
    url.includes("chromewebstore.google.com")
  );
}

// Garantit que content.js repond ; sinon l'injecte.
async function ensureContent(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return true;
  } catch (e) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      return true;
    } catch (e2) {
      return false;
    }
  }
}

// ============================================================
//  Statut
// ============================================================
function setStatus(text, kind = "info") {
  statusEl.textContent = text;
  statusEl.className = "status " + kind;
}

// ============================================================
//  Rendu de la liste d'etapes
// ============================================================
let CFG = DEFAULTS;

function render() {
  stepsEl.innerHTML = "";
  emptyEl.style.display = CFG.steps.length ? "none" : "block";

  CFG.steps.forEach((step, i) => {
    const isSleep = step.action === "sleep";

    const row = document.createElement("div");
    row.className = "step" + (isSleep ? " step-sleep" : "");

    // Numero
    const num = document.createElement("div");
    num.className = "num";
    num.textContent = i + 1;

    // Corps : selecteur (ou libelle "Pause") + controles
    const body = document.createElement("div");
    body.className = "body";

    const sel = document.createElement("div");
    sel.className = "sel";
    if (isSleep) {
      sel.textContent = "⏸️ Pause (sleep)";
    } else {
      sel.textContent = step.selector;
      sel.title = step.selector;
    }

    const controls = document.createElement("div");
    controls.className = "controls";

    // Selecteur d'action : seulement pour les etapes de clic.
    if (!isSleep) {
      const act = document.createElement("select");
      Object.entries(ACTIONS).forEach(([val, label]) => {
        const o = document.createElement("option");
        o.value = val;
        o.textContent = label;
        if (val === step.action) o.selected = true;
        act.appendChild(o);
      });
      act.onchange = async () => {
        CFG.steps[i].action = act.value;
        await saveConfig(CFG);
      };
      controls.appendChild(act);
    }

    // Champ "delai" : duree d'attente (= duree de la pause pour un sleep).
    const delay = document.createElement("input");
    delay.type = "number";
    delay.className = "delay";
    delay.min = "0";
    delay.step = "100";
    delay.value = step.delay;
    delay.title = isSleep
      ? "Duree de la pause (ms)"
      : "Delai d'attente avant cette etape (ms)";
    delay.onchange = async () => {
      CFG.steps[i].delay = Math.max(0, Number(delay.value) || 0);
      await saveConfig(CFG);
    };
    const unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = "ms";

    controls.append(delay, unit);
    body.append(sel, controls);

    // Actions : tester (clic seulement), monter, descendre, supprimer
    const actions = document.createElement("div");
    actions.className = "actions";
    if (!isSleep) {
      actions.appendChild(iconBtn("▷", "Tester cette etape", () => testStep(step)));
    }
    actions.appendChild(iconBtn("✕", "Supprimer", () => removeStep(i), "del"));
    const moves = document.createElement("div");
    moves.className = "actions";
    moves.append(
      iconBtn("▲", "Monter", () => moveStep(i, -1)),
      iconBtn("▼", "Descendre", () => moveStep(i, 1))
    );

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "4px";
    right.append(moves, actions);

    row.append(num, body, right);
    stepsEl.appendChild(row);
  });
}

function iconBtn(txt, title, onClick, extra = "") {
  const b = document.createElement("button");
  b.className = "icon-btn " + extra;
  b.textContent = txt;
  b.title = title;
  b.onclick = onClick;
  return b;
}

// ============================================================
//  Operations sur les etapes
// ============================================================
async function removeStep(i) {
  CFG.steps.splice(i, 1);
  await saveConfig(CFG);
  render();
}
async function moveStep(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= CFG.steps.length) return;
  [CFG.steps[i], CFG.steps[j]] = [CFG.steps[j], CFG.steps[i]];
  await saveConfig(CFG);
  render();
}

// Joue une seule etape (pour verifier un selecteur).
async function testStep(step) {
  const tab = await activeTab();
  if (!tab || isRestricted(tab.url)) {
    setStatus("Ouvre une vraie page web pour tester.", "warn");
    return;
  }
  if (!(await ensureContent(tab.id))) {
    setStatus("Injection impossible sur cette page.", "warn");
    return;
  }
  await chrome.tabs.sendMessage(tab.id, {
    type: "RUN",
    steps: [Object.assign({}, step, { delay: 0 })],
    options: {
      loops: 1,
      infinite: false,
      cursorSpeed: CFG.options.cursorSpeed,
      pointerMode: CFG.options.pointerMode,
    },
  });
  setStatus("▷ Test de l'etape en cours…", "info");
}

// ============================================================
//  Actions principales
// ============================================================
async function startPick() {
  const tab = await activeTab();
  if (!tab || isRestricted(tab.url)) {
    setStatus("Ouvre une vraie page web (pas une page chrome://) pour la pipette.", "warn");
    return;
  }
  if (!(await ensureContent(tab.id))) {
    setStatus("Impossible d'injecter le script sur cette page.", "warn");
    return;
  }
  await chrome.tabs.sendMessage(tab.id, { type: "START_PICK" });
  setStatus("🎯 Pipette active sur la page. Le popup va se fermer : clique un element, puis rouvre-le.", "info");
}

// Ajoute une etape "pause" (sleep) : aucune cible, juste une attente.
async function addSleep() {
  CFG = await loadConfig();
  CFG.steps.push({
    id: "s" + Date.now() + Math.floor(Math.random() * 1000),
    selector: "",
    label: "Pause",
    action: "sleep",
    delay: 1000,
  });
  await saveConfig(CFG);
  render();
  setStatus("Pause ajoutee. Regle sa duree (ms) puis lance la sequence.", "ok");
}

async function play() {
  CFG = await loadConfig();
  if (!CFG.steps.length) {
    setStatus("Ajoute au moins une etape avant de lancer.", "warn");
    return;
  }
  const tab = await activeTab();
  if (!tab || isRestricted(tab.url)) {
    setStatus("Ouvre une vraie page web pour lancer la sequence.", "warn");
    return;
  }
  if (!(await ensureContent(tab.id))) {
    setStatus("Injection impossible sur cette page.", "warn");
    return;
  }
  await chrome.tabs.sendMessage(tab.id, {
    type: "RUN",
    steps: CFG.steps,
    options: CFG.options,
  });
  setStatus("▶ Lecture en cours… (garde ce popup ouvert pour suivre)", "info");
}

async function stop() {
  const tab = await activeTab();
  if (tab) {
    try { await chrome.tabs.sendMessage(tab.id, { type: "STOP" }); } catch (e) {}
  }
  setStatus("⏹ Arret demande.", "warn");
}

// ============================================================
//  Import / Export / Effacer
// ============================================================
function exportConfig() {
  const blob = new Blob([JSON.stringify(CFG, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "autoclicker-scenario.json";
  a.click();
  URL.revokeObjectURL(url);
  setStatus("Scenario exporte.", "ok");
}

function importConfig() {
  $("file").click();
}
async function onFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    CFG = {
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      options: Object.assign({}, DEFAULTS.options, parsed.options || {}),
    };
    await saveConfig(CFG);
    syncOptionInputs();
    render();
    setStatus(`Scenario importe : ${CFG.steps.length} etape(s).`, "ok");
  } catch (err) {
    setStatus("Fichier invalide : " + err.message, "warn");
  }
  e.target.value = "";
}

async function clearAll() {
  CFG = { steps: [], options: CFG.options };
  await saveConfig(CFG);
  render();
  setStatus("Toutes les etapes ont ete effacees.", "info");
}

// ============================================================
//  Options globales (champs <-> storage)
// ============================================================
function syncOptionInputs() {
  $("loops").value = CFG.options.loops;
  $("infinite").checked = CFG.options.infinite;
  $("loops").disabled = CFG.options.infinite;
  $("speed").value = CFG.options.cursorSpeed;
  $("speedval").textContent = CFG.options.cursorSpeed;
  $("pointer").checked = CFG.options.pointerMode;
}

async function onOptionChange() {
  CFG.options.loops = Math.max(1, Number($("loops").value) || 1);
  CFG.options.infinite = $("infinite").checked;
  CFG.options.cursorSpeed = Number($("speed").value) || 600;
  CFG.options.pointerMode = $("pointer").checked;
  $("loops").disabled = CFG.options.infinite;
  $("speedval").textContent = CFG.options.cursorSpeed;
  await saveConfig(CFG);
}

// ============================================================
//  Initialisation
// ============================================================
async function init() {
  CFG = await loadConfig();
  syncOptionInputs();
  render();

  $("pick").onclick = startPick;
  $("addSleep").onclick = addSleep;
  $("play").onclick = play;
  $("stop").onclick = stop;
  $("export").onclick = exportConfig;
  $("import").onclick = importConfig;
  $("file").onchange = onFile;
  $("clear").onclick = clearAll;

  $("loops").onchange = onOptionChange;
  $("infinite").onchange = onOptionChange;
  $("speed").oninput = onOptionChange;
  $("pointer").onchange = onOptionChange;

  // Recharge la liste si le content script a ajoute une etape (pipette).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      CFG = {
        steps: changes[STORAGE_KEY].newValue.steps || [],
        options: Object.assign({}, DEFAULTS.options, changes[STORAGE_KEY].newValue.options || {}),
      };
      render();
    }
  });

  // Statuts envoyes par le content script pendant la lecture.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "STATUS") setStatus(msg.text, msg.kind || "info");
  });
}

init();
