/* Page de demo : interactions simples a piloter avec l'autoclicker.
   Script externe (pas d'inline) pour fonctionner aussi en file://. */

const $ = (id) => document.getElementById(id);
const logEl = $("log");
function log(msg) {
  const line = document.createElement("div");
  line.textContent = new Date().toLocaleTimeString() + "  " + msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

// 1 · Compteur
let count = 0;
function show() { $("count").textContent = count; }
$("inc").addEventListener("click", () => { count++; show(); log("incrementer -> " + count); });
$("dec").addEventListener("click", () => { count--; show(); log("decrementer -> " + count); });
$("reset").addEventListener("click", () => { count = 0; show(); log("reset"); });

// 2 · Grille de tuiles
const grid = $("grid");
for (let i = 1; i <= 24; i++) {
  const t = document.createElement("div");
  t.className = "tile";
  t.id = "tile-" + i;
  t.textContent = i;
  t.addEventListener("click", () => {
    t.classList.toggle("on");
    $("active").textContent = grid.querySelectorAll(".tile.on").length;
    log("tuile " + i + (t.classList.contains("on") ? " activee" : " desactivee"));
  });
  grid.appendChild(t);
}

// 3 · Formulaire
$("submit").addEventListener("click", () => {
  const v = $("name").value.trim();
  $("result").textContent = v ? `Bonjour ${v} !` : "Bouton clique (champ vide)";
  log("formulaire valide");
});

log("Page de demo prete.");
