/* Utilitaires partagés : sleep, status, toast, buildSelector.
   Premier fichier injecté — initialise le namespace window.__ACS. */

if (!window.__ACS_LOADED__) {
  window.__ACS = window.__ACS || {};
  const ACS = window.__ACS;

  // Pause interruptible : se réveille tôt si Stop est demandé.
  ACS.sleep = function sleep(ms) {
    return new Promise((resolve) => {
      if (ms <= 0) return resolve();
      const tick = 40;
      let waited = 0;
      const id = setInterval(() => {
        waited += tick;
        if ((ACS.state && ACS.state.stopRequested) || waited >= ms) {
          clearInterval(id);
          resolve();
        }
      }, tick);
    });
  };

  // Envoie un statut au popup (ignoré si le popup est fermé).
  ACS.status = function status(text, kind = "info") {
    try { chrome.runtime.sendMessage({ type: "STATUS", text, kind }).catch(() => {}); }
    catch (e) {}
  };

  // Toast d'information en bas de la page cible.
  let toastEl = null;
  let toastTimer = null;
  ACS.toast = function toast(text, ms = 2600) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "acs-toast";
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = text;
    void toastEl.offsetWidth; // reflow pour rejouer la transition
    toastEl.classList.add("acs-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("acs-show"), ms);
  };

  // Génère un sélecteur CSS robuste et le plus court possible.
  ACS.buildSelector = function buildSelector(el) {
    if (!(el instanceof Element)) return "";
    if (el.id && document.querySelectorAll("#" + CSS.escape(el.id)).length === 1)
      return "#" + CSS.escape(el.id);

    const path = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      if (node.id && document.querySelectorAll("#" + CSS.escape(node.id)).length === 1) {
        path.unshift("#" + CSS.escape(node.id));
        break;
      }
      let part = node.nodeName.toLowerCase();
      const cls = (node.getAttribute("class") || "")
        .trim().split(/\s+/).filter(Boolean)
        .filter((c) => !/^acs-/.test(c));
      if (cls.length) part += "." + CSS.escape(cls[0]);
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(c => c.nodeName === node.nodeName);
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
      path.unshift(part);
      node = parent;
    }
    return path.join(" > ");
  };
}
