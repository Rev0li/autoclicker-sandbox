/* Coordinateur : rendu de la liste d'étapes, options, initialisation. */

import { CFG, DEFAULTS, STORAGE_KEY, loadConfig, saveConfig } from "./popup-storage.js";
import { setStatus } from "./popup-ui.js";
import { removeStep, moveStep, testStep, startPick, addSleep, play, stop, exportConfig, clearAll } from "./popup-actions.js";

const ACTIONS = { click: "Clic", dblclick: "Double-clic", hover: "Survol", scroll: "Défiler vers" };

const $ = (id) => document.getElementById(id);
const stepsEl = $("steps");
const emptyEl  = $("empty");

// ── Rendu ────────────────────────────────────────────────────────────────────

function iconBtn(txt, title, onClick, extra = "") {
  const b = document.createElement("button");
  b.className = "icon-btn " + extra;
  b.textContent = txt;
  b.title = title;
  b.onclick = onClick;
  return b;
}

function render() {
  stepsEl.innerHTML = "";
  emptyEl.style.display = CFG.steps.length ? "none" : "block";

  CFG.steps.forEach((step, i) => {
    const isSleep = step.action === "sleep";
    const row = document.createElement("div");
    row.className = "step" + (isSleep ? " step-sleep" : "");

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = i + 1;

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

    if (!isSleep) {
      const act = document.createElement("select");
      Object.entries(ACTIONS).forEach(([val, label]) => {
        const o = document.createElement("option");
        o.value = val;
        o.textContent = label;
        if (val === step.action) o.selected = true;
        act.appendChild(o);
      });
      act.onchange = async () => { CFG.steps[i].action = act.value; await saveConfig(CFG); };
      controls.appendChild(act);
    }

    const delay = document.createElement("input");
    delay.type = "number";
    delay.className = "delay";
    delay.min = "0";
    delay.step = "100";
    delay.value = step.delay;
    delay.title = isSleep ? "Durée de la pause (ms)" : "Délai d'attente avant cette étape (ms)";
    delay.onchange = async () => { CFG.steps[i].delay = Math.max(0, Number(delay.value) || 0); await saveConfig(CFG); };
    const unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = "ms";
    controls.append(delay, unit);
    body.append(sel, controls);

    const actions = document.createElement("div");
    actions.className = "actions";
    if (!isSleep) actions.appendChild(iconBtn("▷", "Tester cette étape", () => testStep(step)));
    actions.appendChild(iconBtn("✕", "Supprimer", async () => { await removeStep(i); render(); }, "del"));

    const moves = document.createElement("div");
    moves.className = "actions";
    moves.append(
      iconBtn("▲", "Monter",    async () => { await moveStep(i, -1); render(); }),
      iconBtn("▼", "Descendre", async () => { await moveStep(i, +1); render(); })
    );

    const right = document.createElement("div");
    right.style.cssText = "display:flex;gap:4px";
    right.append(moves, actions);
    row.append(num, body, right);
    stepsEl.appendChild(row);
  });
}

// ── Options ──────────────────────────────────────────────────────────────────

function syncOptionInputs() {
  $("loops").value             = CFG.options.loops;
  $("infinite").checked        = CFG.options.infinite;
  $("loops").disabled          = CFG.options.infinite;
  $("speed").value             = CFG.options.cursorSpeed;
  $("speedval").textContent    = CFG.options.cursorSpeed;
  $("pointer").checked         = CFG.options.pointerMode;
}

async function onOptionChange() {
  CFG.options.loops       = Math.max(1, Number($("loops").value) || 1);
  CFG.options.infinite    = $("infinite").checked;
  CFG.options.cursorSpeed = Number($("speed").value) || 600;
  CFG.options.pointerMode = $("pointer").checked;
  $("loops").disabled          = CFG.options.infinite;
  $("speedval").textContent    = CFG.options.cursorSpeed;
  await saveConfig(CFG);
}

// ── Import fichier ────────────────────────────────────────────────────────────

async function onFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    CFG.steps   = Array.isArray(parsed.steps) ? parsed.steps : [];
    CFG.options = Object.assign({}, DEFAULTS.options, parsed.options || {});
    await saveConfig(CFG);
    syncOptionInputs();
    render();
    setStatus(`Scénario importé : ${CFG.steps.length} étape(s).`, "ok");
  } catch (err) {
    setStatus("Fichier invalide : " + err.message, "warn");
  }
  e.target.value = "";
}

// ── Initialisation ────────────────────────────────────────────────────────────

async function init() {
  const loaded = await loadConfig();
  CFG.steps   = loaded.steps;
  CFG.options = loaded.options;
  syncOptionInputs();
  render();

  $("pick").onclick    = startPick;
  $("addSleep").onclick = addSleep;
  $("play").onclick    = play;
  $("stop").onclick    = stop;
  $("export").onclick  = exportConfig;
  $("import").onclick  = () => $("file").click();
  $("file").onchange   = onFile;
  $("clear").onclick   = clearAll;

  $("loops").onchange   = onOptionChange;
  $("infinite").onchange = onOptionChange;
  $("speed").oninput    = onOptionChange;
  $("pointer").onchange = onOptionChange;

  // Resync si le content script ajoute une étape via la pipette.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      const nv = changes[STORAGE_KEY].newValue;
      CFG.steps   = nv.steps || [];
      CFG.options = Object.assign({}, DEFAULTS.options, nv.options || {});
      render();
    }
  });

  // Statuts envoyés par le content script pendant la lecture.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "STATUS") setStatus(msg.text, msg.kind || "info");
  });
}

init();
