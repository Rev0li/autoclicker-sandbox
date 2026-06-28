/* Faux curseur animé et effet ripple.
   Indépendant — aucune dépendance sur les autres modules ACS. */

if (!window.__ACS_LOADED__) {
  const ACS = window.__ACS;

  let cursorEl = null;
  let curX = window.innerWidth  / 2;
  let curY = window.innerHeight / 2;

  ACS.ensureCursor = function ensureCursor() {
    if (cursorEl) return cursorEl;
    cursorEl = document.createElement("div");
    cursorEl.className = "acs-cursor";
    cursorEl.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M3 2 L3 21 L8.5 15.5 L12 23 L15.5 21.4 L12 14 L19 14 Z" ' +
      'fill="#ffffff" stroke="#1b1d2e" stroke-width="1.3" stroke-linejoin="round"/>' +
      "</svg>";
    document.documentElement.appendChild(cursorEl);
    cursorEl.style.transform = `translate(${curX}px, ${curY}px)`;
    return cursorEl;
  };

  // Déplace le curseur jusqu'à (x, y) en `dur` ms.
  ACS.moveCursorTo = function moveCursorTo(x, y, dur) {
    return new Promise((resolve) => {
      const c = ACS.ensureCursor();
      c.style.transition = `transform ${dur}ms cubic-bezier(.22,.61,.36,1), opacity .2s ease`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { c.style.transform = `translate(${x}px, ${y}px)`; });
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
      setTimeout(finish, dur + 150); // filet de sécurité
    });
  };

  // Onde de choc visuelle au moment du clic.
  ACS.ripple = function ripple(x, y) {
    const r = document.createElement("div");
    r.className = "acs-ripple";
    r.style.left = x + "px";
    r.style.top  = y + "px";
    document.documentElement.appendChild(r);
    setTimeout(() => r.remove(), 600);
  };
}
