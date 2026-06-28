/* ================================================================
   CONTENT SCRIPT  (injecte dans la page cible)
   AutoClicker Sandbox - projet etudiant 42

   Roles :
   1) PIPETTE : on survole/clique un element de la page, on capture
      son selecteur CSS et on l'ajoute comme nouvelle etape.
   2) LECTEUR : on rejoue une sequence d'etapes (selecteur + delai +
      action) avec un FAUX CURSEUR anime qui se deplace puis clique.

   La source de verite (les etapes) vit dans chrome.storage.local
   sous la cle "autoclicker", partagee avec le popup.
   ================================================================ */

// Garde anti double-injection : le content script peut etre present
// via le manifest ET re-injecte par le popup (chrome.scripting).
if (window.__ACS_LOADED__) {
  // deja charge : on ne refait rien
} else {
  window.__ACS_LOADED__ = true;

  (function () {
    "use strict";

    const STORAGE_KEY = "autoclicker";

    // ----- Etat local du content script -----
    const state = {
      running: false,        // une sequence est en cours de lecture
      stopRequested: false,  // l'utilisateur a clique sur Stop
      picking: false,        // mode pipette actif
    };

    // ============================================================
    //  Utilitaires
    // ============================================================

    // Envoie un message de statut au popup (ignore si le popup est ferme).
    function status(text, kind = "info") {
      try {
        chrome.runtime.sendMessage({ type: "STATUS", text, kind }).catch(() => {});
      } catch (e) { /* contexte invalide : on ignore */ }
    }

    // Pause "interruptible" : se reveille tot si Stop est demande.
    function sleep(ms) {
      return new Promise((resolve) => {
        if (ms <= 0) return resolve();
        const tick = 40;
        let waited = 0;
        const id = setInterval(() => {
          waited += tick;
          if (state.stopRequested || waited >= ms) {
            clearInterval(id);
            resolve();
          }
        }, tick);
      });
    }

    // Construit un selecteur CSS robuste et le plus court possible.
    function buildSelector(el) {
      if (!(el instanceof Element)) return "";
      // Cas ideal : un id unique.
      if (el.id && document.querySelectorAll("#" + CSS.escape(el.id)).length === 1) {
        return "#" + CSS.escape(el.id);
      }
      const path = [];
      let node = el;
      while (node && node.nodeType === 1 && node !== document.documentElement) {
        // Si un ancetre a un id unique, on s'y accroche et on s'arrete.
        if (node.id && document.querySelectorAll("#" + CSS.escape(node.id)).length === 1) {
          path.unshift("#" + CSS.escape(node.id));
          break;
        }
        let part = node.nodeName.toLowerCase();
        // On ajoute la 1re classe "stable" pour lisibilite (optionnel).
        const cls = (node.getAttribute("class") || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .filter((c) => !/^acs-/.test(c));        // on ignore nos propres classes
        if (cls.length) part += "." + CSS.escape(cls[0]);
        // Index parmi les freres de meme balise, pour garantir l'unicite.
        const parent = node.parentElement;
        if (parent) {
          const sameTag = Array.from(parent.children).filter(
            (c) => c.nodeName === node.nodeName
          );
          if (sameTag.length > 1) {
            part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
          }
        }
        path.unshift(part);
        node = parent;
      }
      return path.join(" > ");
    }

    // Petit toast d'information sur la page.
    let toastEl = null;
    let toastTimer = null;
    function toast(text, ms = 2600) {
      if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.className = "acs-toast";
        document.documentElement.appendChild(toastEl);
      }
      toastEl.textContent = text;
      // reflow pour rejouer la transition
      void toastEl.offsetWidth;
      toastEl.classList.add("acs-show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("acs-show"), ms);
    }

    // ============================================================
    //  Stockage des etapes (partage avec le popup)
    // ============================================================
    async function loadConfig() {
      const data = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
      return {
        steps: (data && data.steps) || [],
        options: Object.assign(
          { loops: 1, infinite: false, cursorSpeed: 600 },
          (data && data.options) || {}
        ),
      };
    }
    async function saveConfig(cfg) {
      await chrome.storage.local.set({ [STORAGE_KEY]: cfg });
    }

    // ============================================================
    //  PIPETTE  (selection visuelle d'un element)
    // ============================================================
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
      const r = el.getBoundingClientRect();
      pickBox.style.left = r.left + "px";
      pickBox.style.top = r.top + "px";
      pickBox.style.width = r.width + "px";
      pickBox.style.height = r.height + "px";

      const sel = buildSelector(el);
      pickTag.textContent = sel;
      // Place l'etiquette au-dessus, ou en dessous si pas de place.
      const tagTop = r.top - 22 < 4 ? r.bottom + 4 : r.top - 22;
      pickTag.style.left = r.left + "px";
      pickTag.style.top = tagTop + "px";
    }

    async function onPickClick(e) {
      // On capture le clic AVANT que la page ne le recoive.
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      const selector = buildSelector(el);
      if (!selector) {
        toast("Element non ciblable, reessaie.");
        return;
      }
      const label = (el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40)
        || el.tagName.toLowerCase();

      const cfg = await loadConfig();
      cfg.steps.push({
        id: "s" + Date.now() + Math.floor(Math.random() * 1000),
        selector,
        label,
        action: "click",
        delay: 800,
      });
      await saveConfig(cfg);
      stopPicking();
      toast(`Etape ajoutee : « ${label} ». Rouvre le popup pour continuer.`);
    }

    function onPickKey(e) {
      if (e.key === "Escape") {
        stopPicking();
        toast("Pipette annulee.");
      }
    }

    function startPicking() {
      if (state.picking) return;
      state.picking = true;
      ensurePickUI();
      // capture:true → on intercepte avant les handlers de la page
      document.addEventListener("mousemove", onPickMove, true);
      document.addEventListener("click", onPickClick, true);
      document.addEventListener("keydown", onPickKey, true);
      document.documentElement.style.cursor = "crosshair";
      toast("Pipette active : clique un element. (Echap pour annuler)");
    }

    function stopPicking() {
      if (!state.picking) return;
      state.picking = false;
      document.removeEventListener("mousemove", onPickMove, true);
      document.removeEventListener("click", onPickClick, true);
      document.removeEventListener("keydown", onPickKey, true);
      document.documentElement.style.cursor = "";
      hidePickUI();
    }

    // ============================================================
    //  FAUX CURSEUR anime
    // ============================================================
    let cursorEl = null;
    let curX = window.innerWidth / 2;
    let curY = window.innerHeight / 2;

    function ensureCursor() {
      if (cursorEl) return cursorEl;
      cursorEl = document.createElement("div");
      cursorEl.className = "acs-cursor";
      // Fleche de curseur, pointe en haut-a-gauche (0,0).
      cursorEl.innerHTML =
        '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M3 2 L3 21 L8.5 15.5 L12 23 L15.5 21.4 L12 14 L19 14 Z" ' +
        'fill="#ffffff" stroke="#1b1d2e" stroke-width="1.3" stroke-linejoin="round"/>' +
        "</svg>";
      document.documentElement.appendChild(cursorEl);
      // position initiale (sans animation)
      cursorEl.style.transform = `translate(${curX}px, ${curY}px)`;
      return cursorEl;
    }

    // Deplace le curseur jusqu'a (x, y) en `dur` ms ; resout a la fin.
    function moveCursorTo(x, y, dur) {
      return new Promise((resolve) => {
        const c = ensureCursor();
        c.style.transition =
          `transform ${dur}ms cubic-bezier(.22,.61,.36,1), opacity .2s ease`;
        // double rAF pour s'assurer que la transition demarre
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            c.style.transform = `translate(${x}px, ${y}px)`;
          });
        });
        curX = x; curY = y;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          c.removeEventListener("transitionend", finish);
          resolve();
        };
        c.addEventListener("transitionend", finish);
        setTimeout(finish, dur + 150); // filet de securite
      });
    }

    // Onde de choc visuelle a la position du curseur.
    function ripple(x, y) {
      const r = document.createElement("div");
      r.className = "acs-ripple";
      r.style.left = x + "px";
      r.style.top = y + "px";
      document.documentElement.appendChild(r);
      setTimeout(() => r.remove(), 600);
    }

    // ============================================================
    //  Simulation d'evenements souris
    // ============================================================
    function fireMouse(el, type, x, y) {
      el.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          button: 0,
        })
      );
    }

    // Emet un PointerEvent (retombe sur MouseEvent si non supporte).
    function firePointer(el, type, x, y) {
      const opts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      };
      let ev;
      try { ev = new PointerEvent(type, opts); }
      catch (e) { ev = new MouseEvent(type, opts); }
      el.dispatchEvent(ev);
    }

    // action: click | dblclick | hover | scroll
    // pointer: true => mode SVG (PointerEvent + cible reelle sous le point)
    function performAction(el, action, x, y, pointer) {
      // En mode pointer, on vise l'element reellement sous le point :
      // utile quand un calque invisible recouvre la cible (plans de salle, etc.).
      const target = pointer ? (document.elementFromPoint(x, y) || el) : el;

      if (pointer) firePointer(target, "pointerover", x, y);
      fireMouse(target, "mouseover", x, y);
      if (pointer) firePointer(target, "pointermove", x, y);
      fireMouse(target, "mousemove", x, y);

      if (action === "hover") return;
      if (action === "scroll") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      // Donne le focus (utile pour les champs/boutons) sans re-scroller.
      if (typeof target.focus === "function") {
        try { target.focus({ preventScroll: true }); } catch (e) {}
      }

      if (pointer) firePointer(target, "pointerdown", x, y);
      fireMouse(target, "mousedown", x, y);
      if (pointer) firePointer(target, "pointerup", x, y);
      fireMouse(target, "mouseup", x, y);

      if (pointer) {
        // Clic avec coordonnees (indispensable pour le hit-testing SVG).
        fireMouse(target, "click", x, y);
      } else {
        // .click() declenche l'action par defaut (lien, bouton, submit...).
        el.click();
      }

      if (action === "dblclick") {
        if (pointer) { fireMouse(target, "click", x, y); fireMouse(target, "dblclick", x, y); }
        else { el.click(); fireMouse(el, "dblclick", x, y); }
      }
    }

    // ============================================================
    //  LECTEUR de sequence
    // ============================================================
    async function runSequence(steps, options) {
      if (state.running) return;
      if (!steps || !steps.length) {
        status("Aucune etape a jouer.", "warn");
        return;
      }
      state.running = true;
      state.stopRequested = false;

      const opts = Object.assign(
        { loops: 1, infinite: false, cursorSpeed: 600, pointerMode: false },
        options || {}
      );
      const moveDur = Math.max(120, Number(opts.cursorSpeed) || 600);
      const loops = opts.infinite ? Infinity : Math.max(1, Number(opts.loops) || 1);

      const cursor = ensureCursor();
      cursor.classList.add("acs-visible");

      try {
        for (let tour = 0; tour < loops && !state.stopRequested; tour++) {
          status(
            opts.infinite ? `Tour ${tour + 1} (boucle ∞)` : `Tour ${tour + 1}/${loops}`,
            "info"
          );
          for (let i = 0; i < steps.length; i++) {
            if (state.stopRequested) break;
            const step = steps[i];

            // Etape "pause" (sleep) : on attend simplement, sans cibler d'element.
            if ((step.action || "click") === "sleep") {
              status(`⏸️ Pause de ${step.delay} ms — etape ${i + 1}/${steps.length}`, "info");
              await sleep(Number(step.delay) || 0);
              continue;
            }

            status(`Etape ${i + 1}/${steps.length} — attente ${step.delay} ms`, "info");
            await sleep(Number(step.delay) || 0);
            if (state.stopRequested) break;

            const el = document.querySelector(step.selector);
            if (!el) {
              status(`⚠️ Introuvable : ${step.selector}`, "warn");
              continue;
            }

            // S'assure que l'element est visible a l'ecran.
            let r = el.getBoundingClientRect();
            if (r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              await sleep(450);
              r = el.getBoundingClientRect();
            }
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;

            await moveCursorTo(x, y, moveDur);
            if (state.stopRequested) break;

            ripple(x, y);
            performAction(el, step.action || "click", x, y, opts.pointerMode);
            status(`✓ ${labelAction(step.action)} — etape ${i + 1}`, "ok");
            await sleep(180);
          }
        }
      } catch (e) {
        status("Erreur : " + e.message, "warn");
      } finally {
        cursor.classList.remove("acs-visible");
        const stopped = state.stopRequested;
        state.running = false;
        state.stopRequested = false;
        status(stopped ? "⏹ Arrete." : "✓ Sequence terminee.", stopped ? "warn" : "ok");
      }
    }

    function labelAction(a) {
      return (
        { click: "Clic", dblclick: "Double-clic", hover: "Survol", scroll: "Defilement", sleep: "Pause" }[a] ||
        "Clic"
      );
    }

    // ============================================================
    //  Messagerie avec le popup
    // ============================================================
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      switch (msg && msg.type) {
        case "PING":
          sendResponse({ ok: true });
          break;
        case "START_PICK":
          startPicking();
          sendResponse({ ok: true });
          break;
        case "RUN":
          runSequence(msg.steps, msg.options);
          sendResponse({ ok: true });
          break;
        case "STOP":
          state.stopRequested = true;
          stopPicking();
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false });
      }
      return true; // reponse synchrone deja envoyee
    });
  })();
}
