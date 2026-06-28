/* Onglet actif + injection du content script à la demande. */

export async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export function isRestricted(url = "") {
  return (
    /^(chrome|edge|brave|about|chrome-extension|edge-extension|view-source|devtools):/i.test(url) ||
    url.includes("chrome.google.com/webstore") ||
    url.includes("chromewebstore.google.com")
  );
}

// Garantit que le content script répond ; sinon l'injecte (tous les fichiers dans l'ordre).
export async function ensureContent(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return true;
  } catch (e) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content-utils.js", "content-picker.js", "content-cursor.js", "content-runner.js", "content.js"],
      });
      return true;
    } catch (e2) {
      return false;
    }
  }
}
