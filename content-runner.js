/* Simulation d'événements souris et lecteur de séquence.
   Dépend de : ACS.sleep, ACS.status, ACS.ensureCursor, ACS.moveCursorTo, ACS.ripple. */

if (!window.__ACS_LOADED__) {
  const ACS = window.__ACS;

  function fireMouse(el, type, x, y) {
    el.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, button: 0,
    }));
  }

  function firePointer(el, type, x, y) {
    const opts = {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, button: 0,
      pointerId: 1, pointerType: "mouse", isPrimary: true,
    };
    let ev;
    try { ev = new PointerEvent(type, opts); }
    catch (e) { ev = new MouseEvent(type, opts); }
    el.dispatchEvent(ev);
  }

  // action: click | dblclick | hover | scroll — pointer: mode SVG (PointerEvent + cible réelle)
  function performAction(el, action, x, y, pointer) {
    const target = pointer ? (document.elementFromPoint(x, y) || el) : el;

    if (pointer) firePointer(target, "pointerover", x, y);
    fireMouse(target, "mouseover", x, y);
    if (pointer) firePointer(target, "pointermove", x, y);
    fireMouse(target, "mousemove", x, y);

    if (action === "hover") return;
    if (action === "scroll") { el.scrollIntoView({ behavior: "smooth", block: "center" }); return; }

    if (typeof target.focus === "function") {
      try { target.focus({ preventScroll: true }); } catch (e) {}
    }
    if (pointer) firePointer(target, "pointerdown", x, y);
    fireMouse(target, "mousedown", x, y);
    if (pointer) firePointer(target, "pointerup", x, y);
    fireMouse(target, "mouseup", x, y);

    if (pointer) {
      fireMouse(target, "click", x, y);
    } else {
      el.click();
    }
    if (action === "dblclick") {
      if (pointer) { fireMouse(target, "click", x, y); fireMouse(target, "dblclick", x, y); }
      else { el.click(); fireMouse(el, "dblclick", x, y); }
    }
  }

  function labelAction(a) {
    return { click: "Clic", dblclick: "Double-clic", hover: "Survol", scroll: "Défilement", sleep: "Pause" }[a] || "Clic";
  }

  ACS.runSequence = async function runSequence(steps, options) {
    if (ACS.state.running) return;
    if (!steps || !steps.length) { ACS.status("Aucune étape à jouer.", "warn"); return; }

    ACS.state.running = true;
    ACS.state.stopRequested = false;

    const opts = Object.assign({ loops: 1, infinite: false, cursorSpeed: 600, pointerMode: false }, options || {});
    const moveDur = Math.max(120, Number(opts.cursorSpeed) || 600);
    const loops   = opts.infinite ? Infinity : Math.max(1, Number(opts.loops) || 1);

    const cursor = ACS.ensureCursor();
    cursor.classList.add("acs-visible");

    try {
      for (let tour = 0; tour < loops && !ACS.state.stopRequested; tour++) {
        ACS.status(opts.infinite ? `Tour ${tour + 1} (boucle ∞)` : `Tour ${tour + 1}/${loops}`, "info");

        for (let i = 0; i < steps.length; i++) {
          if (ACS.state.stopRequested) break;
          const step = steps[i];

          if ((step.action || "click") === "sleep") {
            ACS.status(`⏸️ Pause de ${step.delay} ms — étape ${i + 1}/${steps.length}`, "info");
            await ACS.sleep(Number(step.delay) || 0);
            continue;
          }

          ACS.status(`Étape ${i + 1}/${steps.length} — attente ${step.delay} ms`, "info");
          await ACS.sleep(Number(step.delay) || 0);
          if (ACS.state.stopRequested) break;

          const el = document.querySelector(step.selector);
          if (!el) { ACS.status(`⚠️ Introuvable : ${step.selector}`, "warn"); continue; }

          let r = el.getBoundingClientRect();
          if (r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            await ACS.sleep(450);
            r = el.getBoundingClientRect();
          }
          const x = r.left + r.width  / 2;
          const y = r.top  + r.height / 2;

          await ACS.moveCursorTo(x, y, moveDur);
          if (ACS.state.stopRequested) break;

          ACS.ripple(x, y);
          performAction(el, step.action || "click", x, y, opts.pointerMode);
          ACS.status(`✓ ${labelAction(step.action)} — étape ${i + 1}`, "ok");
          await ACS.sleep(180);
        }
      }
    } catch (e) {
      ACS.status("Erreur : " + e.message, "warn");
    } finally {
      cursor.classList.remove("acs-visible");
      const stopped = ACS.state.stopRequested;
      ACS.state.running = false;
      ACS.state.stopRequested = false;
      ACS.status(stopped ? "⏹ Arrêté." : "✓ Séquence terminée.", stopped ? "warn" : "ok");
    }
  };
}
