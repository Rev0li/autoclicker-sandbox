/* Service worker — gère le clic sur l'icône de l'extension.
   Injecte le content script si nécessaire, puis bascule le panel. */

const CONTENT_FILES = [
  "content-utils.js",
  "content-picker.js",
  "content-cursor.js",
  "content-runner.js",
  "content-panel.js",
  "content.js",
];

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const toggle = () => chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });

  try {
    await toggle();
  } catch {
    // Content script absent (onglet ouvert avant l'installation) : on l'injecte.
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css", "content-panel.css"] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES });
      await toggle();
    } catch {
      // Page restreinte (chrome://, webstore…) — on ne peut pas injecter.
    }
  }
});
