/* Pipette : sélection visuelle d'un élément de la page.
   Dépend de : ACS.buildSelector, ACS.toast, ACS.loadConfig, ACS.saveConfig. */

if (!window.__ACS_LOADED__) {
  const ACS = window.__ACS;

  let pickBox = null;
  let pickTag = null;

  function ensurePickUI() {
    if (!pickBox) {
      pickBox = document.createElement("div");
      pickBox.className = "acs-pick-box";
      document.documentElement.appendChild(pickBox);
    }
    if (!pickTag) {
      pickTag = document.createElement("div");
      pickTag.className = "acs-pick-tag";
      document.documentElement.appendChild(pickTag);
    }
    pickBox.style.display = "block";
    pickTag.style.display = "block";
  }

  function hidePickUI() {
    if (pickBox) pickBox.style.display = "none";
    if (pickTag) pickTag.style.display = "none";
  }

  function onPickMove(e) {
    const el = e.target;
    if (!(el instanceof Element) || el === pickBox || el === pickTag) return;
    if (el.closest && el.closest(".acs-panel")) return; // ne pas surligner le panel lui-même
    const r = el.getBoundingClientRect();
    pickBox.style.left   = r.left   + "px";
    pickBox.style.top    = r.top    + "px";
    pickBox.style.width  = r.width  + "px";
    pickBox.style.height = r.height + "px";
    const sel = ACS.buildSelector(el);
    pickTag.textContent = sel;
    const tagTop = r.top - 22 < 4 ? r.bottom + 4 : r.top - 22;
    pickTag.style.left = r.left + "px";
    pickTag.style.top  = tagTop + "px";
  }

  async function onPickClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    if (el.closest && el.closest(".acs-panel")) { ACS.stopPicking(); return; } // clic sur le panel = annulation
    const selector = ACS.buildSelector(el);
    if (!selector) { ACS.toast("Élément non ciblable, réessaie."); return; }

    const label = (el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40)
      || el.tagName.toLowerCase();
    const cfg = await ACS.loadConfig();
    cfg.steps.push({
      id: "s" + Date.now() + Math.floor(Math.random() * 1000),
      selector,
      label,
      action: "click",
      delay: 800,
    });
    await ACS.saveConfig(cfg);
    ACS.stopPicking();
    ACS.toast(`Étape ajoutée : « ${label} ». Rouvre le popup pour continuer.`);
  }

  function onPickKey(e) {
    if (e.key === "Escape") { ACS.stopPicking(); ACS.toast("Pipette annulée."); }
  }

  ACS.startPicking = function startPicking() {
    if (ACS.state.picking) return;
    ACS.state.picking = true;
    ensurePickUI();
    document.addEventListener("mousemove", onPickMove, true);
    document.addEventListener("click",     onPickClick, true);
    document.addEventListener("keydown",   onPickKey,   true);
    document.documentElement.style.cursor = "crosshair";
    ACS.toast("Pipette active : clique un élément. (Échap pour annuler)");
  };

  ACS.stopPicking = function stopPicking() {
    if (!ACS.state.picking) return;
    ACS.state.picking = false;
    document.removeEventListener("mousemove", onPickMove, true);
    document.removeEventListener("click",     onPickClick, true);
    document.removeEventListener("keydown",   onPickKey,   true);
    document.documentElement.style.cursor = "";
    hidePickUI();
  };
}
