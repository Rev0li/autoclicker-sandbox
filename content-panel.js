/* Panel flottant injecté dans la page cible.
   - Affiché / masqué via ACS.togglePanel() (appelé par content.js sur TOGGLE_PANEL).
   - Draggable par l'en-tête.
   - UI identique à l'ancien popup, mais directement dans le contexte du content script
     (pas de messages pour startPicking / runSequence — appels directs). */

if (!window.__ACS_LOADED__) {
  const ACS = window.__ACS;

  const STORAGE_KEY   = "autoclicker";
  const DEFAULT_OPTS  = { loops: 1, infinite: false, cursorSpeed: 600, pointerMode: false };
  const ACTION_LABELS = { click: "Clic", dblclick: "Double-clic", hover: "Survol", scroll: "Défiler vers" };

  // État miroir du storage — muté en place.
  const CFG = { steps: [], options: { ...DEFAULT_OPTS } };

  let panelEl    = null;
  let statusEl   = null;
  let stepsListEl = null;
  let emptyEl    = null;
  let syncOptsFn = null; // injecté par buildOptions()

  // ── Helpers DOM ───────────────────────────────────────────────────

  const mk = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };

  const iconBtn = (text, title, onClick, extra = "") => {
    const b = mk("button", "acs-icon-btn" + (extra ? " " + extra : ""));
    b.textContent = text;
    b.title = title;
    b.onclick = onClick;
    return b;
  };

  // ── Drag and drop ─────────────────────────────────────────────────

  function makeDraggable(panel, handle) {
    let dragging = false, ox = 0, oy = 0;

    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest(".acs-panel-close")) return;
      dragging = true;
      handle.style.cursor = "grabbing";
      const r = panel.getBoundingClientRect();
      // Convertit right/top CSS initial en left/top pour permettre le déplacement libre.
      panel.style.right = "auto";
      panel.style.left  = r.left + "px";
      panel.style.top   = r.top  + "px";
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const x = Math.max(0, Math.min(e.clientX - ox, window.innerWidth  - panel.offsetWidth));
      const y = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - panel.offsetHeight));
      panel.style.left = x + "px";
      panel.style.top  = y + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      handle.style.cursor = "grab";
    });
  }

  // ── Rendu des étapes ──────────────────────────────────────────────

  function renderSteps() {
    if (!stepsListEl) return;
    stepsListEl.innerHTML = "";
    emptyEl.style.display = CFG.steps.length ? "none" : "block";

    CFG.steps.forEach((step, i) => {
      const isSleep = step.action === "sleep";
      const row = mk("div", "acs-step" + (isSleep ? " acs-step-sleep" : ""));

      const num = mk("div", "acs-step-num");
      num.textContent = i + 1;

      const body = mk("div", "acs-step-body");
      const sel = mk("div", "acs-step-sel");
      sel.textContent = isSleep ? "⏸️ Pause (sleep)" : step.selector;
      if (!isSleep) sel.title = step.selector;

      const controls = mk("div", "acs-step-controls");

      if (!isSleep) {
        const act = mk("select", "acs-select");
        Object.entries(ACTION_LABELS).forEach(([val, label]) => {
          const o = mk("option");
          o.value = val;
          o.textContent = label;
          if (val === step.action) o.selected = true;
          act.appendChild(o);
        });
        act.onchange = async () => { CFG.steps[i].action = act.value; await ACS.saveConfig(CFG); };
        controls.appendChild(act);
      }

      const delay = mk("input", "acs-delay");
      Object.assign(delay, { type: "number", min: "0", step: "100", value: step.delay });
      delay.title = isSleep ? "Durée de la pause (ms)" : "Délai avant cette étape (ms)";
      delay.onchange = async () => {
        CFG.steps[i].delay = Math.max(0, Number(delay.value) || 0);
        await ACS.saveConfig(CFG);
      };
      const unit = mk("span", "acs-unit");
      unit.textContent = "ms";
      controls.append(delay, unit);
      body.append(sel, controls);

      const btns = mk("div", "acs-step-btns");
      if (!isSleep) {
        btns.appendChild(iconBtn("▷", "Tester cette étape", () => {
          ACS.runSequence([Object.assign({}, step, { delay: 0 })], {
            loops: 1, infinite: false,
            cursorSpeed: CFG.options.cursorSpeed,
            pointerMode: CFG.options.pointerMode,
          });
          ACS.setStatus("▷ Test de l'étape en cours…", "info");
        }));
      }
      btns.appendChild(iconBtn("✕", "Supprimer", async () => {
        CFG.steps.splice(i, 1);
        await ACS.saveConfig(CFG);
        renderSteps();
      }, "acs-del"));

      const moves = mk("div", "acs-step-btns");
      moves.append(
        iconBtn("▲", "Monter", async () => {
          if (i === 0) return;
          [CFG.steps[i], CFG.steps[i - 1]] = [CFG.steps[i - 1], CFG.steps[i]];
          await ACS.saveConfig(CFG); renderSteps();
        }),
        iconBtn("▼", "Descendre", async () => {
          if (i >= CFG.steps.length - 1) return;
          [CFG.steps[i], CFG.steps[i + 1]] = [CFG.steps[i + 1], CFG.steps[i]];
          await ACS.saveConfig(CFG); renderSteps();
        })
      );

      const right = mk("div", "acs-step-right");
      right.append(moves, btns);
      row.append(num, body, right);
      stepsListEl.appendChild(row);
    });
  }

  // ── Options ───────────────────────────────────────────────────────

  function buildOptions() {
    const wrap = mk("div", "acs-options");

    // Répétitions
    const loopsWrap = mk("div", "acs-opt");
    const loopsLbl = mk("label", "acs-opt-label");
    loopsLbl.textContent = "Répétitions";
    const loopsInput = mk("input", "acs-opt-input");
    Object.assign(loopsInput, { type: "number", min: "1", value: CFG.options.loops });
    loopsWrap.append(loopsLbl, loopsInput);

    // Boucle infinie
    const infLabel = mk("label", "acs-opt-check");
    const infCheck = mk("input");
    infCheck.type = "checkbox";
    infCheck.checked = CFG.options.infinite;
    infLabel.append(infCheck, document.createTextNode(" Boucle ∞"));

    // Vitesse curseur
    const speedWrap = mk("div", "acs-opt acs-opt-grow");
    const speedLbl  = mk("label", "acs-opt-label");
    const speedVal  = mk("b");
    speedVal.textContent = CFG.options.cursorSpeed;
    speedLbl.append(document.createTextNode("Vitesse curseur : "), speedVal, document.createTextNode(" ms"));
    const speedSlider = mk("input", "acs-speed");
    Object.assign(speedSlider, { type: "range", min: "150", max: "1500", step: "50", value: CFG.options.cursorSpeed });
    speedSlider.oninput = () => { speedVal.textContent = speedSlider.value; };
    speedWrap.append(speedLbl, speedSlider);

    wrap.append(loopsWrap, infLabel, speedWrap);

    // Mode SVG / pointer events
    const ptrLabel = mk("label", "acs-pointer-opt");
    const ptrCheck = mk("input");
    ptrCheck.type = "checkbox";
    ptrCheck.checked = CFG.options.pointerMode;
    const ptrSmall = mk("small");
    ptrSmall.textContent = "(plans de salle, canvas, drag)";
    ptrLabel.append(ptrCheck, document.createTextNode(" Mode SVG / pointer events "), ptrSmall);

    const saveOpts = async () => {
      CFG.options.loops       = Math.max(1, Number(loopsInput.value) || 1);
      CFG.options.infinite    = infCheck.checked;
      CFG.options.cursorSpeed = Number(speedSlider.value) || 600;
      CFG.options.pointerMode = ptrCheck.checked;
      loopsInput.disabled     = CFG.options.infinite;
      await ACS.saveConfig(CFG);
    };
    loopsInput.onchange = infCheck.onchange = speedSlider.onchange = ptrCheck.onchange = saveOpts;

    const syncOpts = () => {
      loopsInput.value      = CFG.options.loops;
      infCheck.checked      = CFG.options.infinite;
      loopsInput.disabled   = CFG.options.infinite;
      speedSlider.value     = CFG.options.cursorSpeed;
      speedVal.textContent  = CFG.options.cursorSpeed;
      ptrCheck.checked      = CFG.options.pointerMode;
    };

    return { wrap, ptrLabel, syncOpts };
  }

  // ── Construction du panel ─────────────────────────────────────────

  function buildPanel() {
    panelEl = mk("div", "acs-panel");
    panelEl.style.display = "none";

    // En-tête
    const header = mk("div", "acs-panel-header");
    const title  = mk("span", "acs-panel-title");
    title.textContent = "🖱️ AutoClicker Sandbox";
    const closeBtn = mk("button", "acs-panel-close");
    closeBtn.textContent = "✕";
    closeBtn.title = "Fermer";
    closeBtn.onclick = () => { panelEl.style.display = "none"; };
    header.append(title, closeBtn);
    makeDraggable(panelEl, header);

    // Corps
    const body = mk("div", "acs-panel-body");

    const pickBtn = mk("button", "acs-btn acs-btn-primary");
    pickBtn.textContent = "🎯 Ajouter une étape (pipette)";
    pickBtn.onclick = () => {
      ACS.startPicking();
      ACS.setStatus("🎯 Pipette active : clique un élément. (Échap pour annuler)", "info");
    };

    const sleepBtn = mk("button", "acs-btn acs-btn-secondary");
    sleepBtn.textContent = "⏸️ Ajouter une pause (sleep)";
    sleepBtn.onclick = async () => {
      CFG.steps.push({ id: "s" + Date.now() + Math.floor(Math.random() * 1000), selector: "", label: "Pause", action: "sleep", delay: 1000 });
      await ACS.saveConfig(CFG);
      renderSteps();
      ACS.setStatus("Pause ajoutée. Règle sa durée puis lance.", "ok");
    };

    const help = mk("p", "acs-help");
    help.textContent = "Clique, puis sélectionne un élément sur la page.";

    stepsListEl = mk("div", "acs-steps");
    emptyEl = mk("p", "acs-empty");
    emptyEl.innerHTML = "Aucune étape.<br>Utilise « Ajouter une étape » pour commencer.";

    const { wrap: optsWrap, ptrLabel, syncOpts } = buildOptions();
    syncOptsFn = syncOpts;

    const runEl = mk("div", "acs-run");
    const playBtn = mk("button", "acs-btn acs-btn-go");
    playBtn.textContent = "▶ Lancer";
    playBtn.onclick = async () => {
      const cfg = await ACS.loadConfig();
      if (!cfg.steps.length) { ACS.setStatus("Ajoute au moins une étape.", "warn"); return; }
      ACS.runSequence(cfg.steps, cfg.options);
      ACS.setStatus("▶ Lecture en cours…", "info");
    };
    const stopBtn = mk("button", "acs-btn acs-btn-stop");
    stopBtn.textContent = "■ Stop";
    stopBtn.onclick = () => { ACS.state.stopRequested = true; ACS.stopPicking(); ACS.setStatus("⏹ Arrêt demandé.", "warn"); };
    runEl.append(playBtn, stopBtn);

    statusEl = mk("div", "acs-panel-status");
    statusEl.textContent = "Prêt.";

    // Pied de page
    const footer = mk("div", "acs-footer");
    const fileInput = mk("input");
    Object.assign(fileInput, { type: "file", accept: "application/json" });
    fileInput.style.display = "none";
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        CFG.steps   = Array.isArray(parsed.steps) ? parsed.steps : [];
        CFG.options = Object.assign({}, DEFAULT_OPTS, parsed.options || {});
        await ACS.saveConfig(CFG);
        syncOptsFn();
        renderSteps();
        ACS.setStatus(`Scénario importé : ${CFG.steps.length} étape(s).`, "ok");
      } catch (err) {
        ACS.setStatus("Fichier invalide : " + err.message, "warn");
      }
      e.target.value = "";
    };

    const exportBtn = mk("button", "acs-link");
    exportBtn.textContent = "Exporter";
    exportBtn.onclick = () => {
      const blob = new Blob([JSON.stringify(CFG, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = mk("a");
      a.href = url; a.download = "autoclicker-scenario.json"; a.click();
      URL.revokeObjectURL(url);
      ACS.setStatus("Scénario exporté.", "ok");
    };
    const importBtn = mk("button", "acs-link");
    importBtn.textContent = "Importer";
    importBtn.onclick = () => fileInput.click();
    const clearBtn = mk("button", "acs-link acs-link-danger");
    clearBtn.textContent = "Tout effacer";
    clearBtn.onclick = async () => {
      CFG.steps = [];
      await ACS.saveConfig(CFG);
      renderSteps();
      ACS.setStatus("Toutes les étapes ont été effacées.", "info");
    };
    footer.append(exportBtn, importBtn, clearBtn, fileInput);

    body.append(pickBtn, sleepBtn, help, stepsListEl, emptyEl, optsWrap, ptrLabel, runEl, statusEl, footer);
    panelEl.append(header, body);
    document.documentElement.appendChild(panelEl);

    // Resync si le storage change (ex: pipette ajoute une étape sans passer par le panel).
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[STORAGE_KEY]) return;
      const nv = changes[STORAGE_KEY].newValue || {};
      CFG.steps   = nv.steps   || [];
      CFG.options = Object.assign({}, DEFAULT_OPTS, nv.options || {});
      renderSteps();
      syncOptsFn();
    });
  }

  // ── API publique ───────────────────────────────────────────────────

  ACS.togglePanel = async function togglePanel() {
    if (!panelEl) {
      buildPanel();
      const cfg = await ACS.loadConfig();
      CFG.steps   = cfg.steps;
      CFG.options = cfg.options;
      renderSteps();
      syncOptsFn();
    }
    panelEl.style.display = (panelEl.style.display === "none" || panelEl.style.display === "")
      ? "flex"
      : "none";
  };

  ACS.setStatus = function setStatus(text, kind = "info") {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className   = "acs-panel-status" + (kind ? " " + kind : "");
  };
}
