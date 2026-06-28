/* Statut — seul élément UI partagé par popup-actions.js. */

const statusEl = document.getElementById("status");

export function setStatus(text, kind = "info") {
  statusEl.textContent = text;
  statusEl.className = "status " + kind;
}
