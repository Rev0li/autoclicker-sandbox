/* ================================================================
   COORDINATEUR — point d'entrée du content script.
   Définit : état partagé, storage, messagerie.
   Chargé en dernier — pose le verrou anti double-injection.
   ================================================================ */

if (window.__ACS_LOADED__) {
  // Déjà injecté : tous les modules ont déjà tourné, on ne fait rien.
} else {
  window.__ACS_LOADED__ = true; // verrou posé immédiatement

  const ACS = window.__ACS = window.__ACS || {};
  const STORAGE_KEY = "autoclicker"; // doit rester cohérent avec popup-storage.js

  // État local partagé avec les modules (sleep, picker, runner).
  ACS.state = { running: false, stopRequested: false, picking: false };

  // ── Stockage ────────────────────────────────────────────────────
  ACS.loadConfig = async function loadConfig() {
    const data = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
    return {
      steps: (data && data.steps) || [],
      options: Object.assign(
        { loops: 1, infinite: false, cursorSpeed: 600, pointerMode: false },
        (data && data.options) || {}
      ),
    };
  };

  ACS.saveConfig = async function saveConfig(cfg) {
    await chrome.storage.local.set({ [STORAGE_KEY]: cfg });
  };

  // ── Messagerie avec le popup ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg && msg.type) {
      case "PING":
        sendResponse({ ok: true });
        break;
      case "START_PICK":
        ACS.startPicking();
        sendResponse({ ok: true });
        break;
      case "RUN":
        ACS.runSequence(msg.steps, msg.options);
        sendResponse({ ok: true });
        break;
      case "TOGGLE_PANEL":
        ACS.togglePanel();
        sendResponse({ ok: true });
        break;
      case "STOP":
        ACS.state.stopRequested = true;
        ACS.stopPicking();
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false });
    }
    return true;
  });
}
