/* Actions utilisateur : mutation du CFG, gestion onglet, import/export.
   Ne touche pas au rendu — popup.js reste responsable de render(). */

import { CFG, STORAGE_KEY, DEFAULTS, saveConfig } from "./popup-storage.js";
import { activeTab, isRestricted, ensureContent } from "./popup-tab.js";
import { setStatus } from "./popup-ui.js";

// ── Opérations sur les étapes ────────────────────────────────────────────────

export async function removeStep(i) {
  CFG.steps.splice(i, 1);
  await saveConfig(CFG);
}

export async function moveStep(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= CFG.steps.length) return;
  [CFG.steps[i], CFG.steps[j]] = [CFG.steps[j], CFG.steps[i]];
  await saveConfig(CFG);
}

export async function testStep(step) {
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
    options: { loops: 1, infinite: false, cursorSpeed: CFG.options.cursorSpeed, pointerMode: CFG.options.pointerMode },
  });
  setStatus("▷ Test de l'étape en cours…", "info");
}

// ── Actions principales ──────────────────────────────────────────────────────

export async function startPick() {
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
  setStatus("🎯 Pipette active sur la page. Le popup va se fermer : clique un élément, puis rouvre-le.", "info");
}

export async function addSleep() {
  CFG.steps.push({
    id: "s" + Date.now() + Math.floor(Math.random() * 1000),
    selector: "",
    label: "Pause",
    action: "sleep",
    delay: 1000,
  });
  await saveConfig(CFG);
  setStatus("Pause ajoutée. Règle sa durée (ms) puis lance la séquence.", "ok");
}

export async function play() {
  if (!CFG.steps.length) {
    setStatus("Ajoute au moins une étape avant de lancer.", "warn");
    return;
  }
  const tab = await activeTab();
  if (!tab || isRestricted(tab.url)) {
    setStatus("Ouvre une vraie page web pour lancer la séquence.", "warn");
    return;
  }
  if (!(await ensureContent(tab.id))) {
    setStatus("Injection impossible sur cette page.", "warn");
    return;
  }
  await chrome.tabs.sendMessage(tab.id, { type: "RUN", steps: CFG.steps, options: CFG.options });
  setStatus("▶ Lecture en cours… (garde ce popup ouvert pour suivre)", "info");
}

export async function stop() {
  const tab = await activeTab();
  if (tab) {
    try { await chrome.tabs.sendMessage(tab.id, { type: "STOP" }); } catch (e) {}
  }
  setStatus("⏹ Arrêt demandé.", "warn");
}

// ── Import / Export / Effacer ────────────────────────────────────────────────

export function exportConfig() {
  const blob = new Blob([JSON.stringify(CFG, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "autoclicker-scenario.json";
  a.click();
  URL.revokeObjectURL(url);
  setStatus("Scénario exporté.", "ok");
}

export async function clearAll() {
  CFG.steps = [];
  await saveConfig(CFG);
  setStatus("Toutes les étapes ont été effacées.", "info");
}
