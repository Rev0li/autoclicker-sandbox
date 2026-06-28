/* Couche données : clé de stockage, defaults, état partagé, lecture/écriture. */

export const STORAGE_KEY = "autoclicker";

export const DEFAULTS = {
  steps: [],
  options: { loops: 1, infinite: false, cursorSpeed: 600, pointerMode: false },
};

// Référence constante, mutée en place — tous les modules voient le même objet.
export const CFG = { steps: [], options: { ...DEFAULTS.options } };

export async function loadConfig() {
  const data = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  return {
    steps: (data && data.steps) || [],
    options: Object.assign({}, DEFAULTS.options, (data && data.options) || {}),
  };
}

export async function saveConfig(cfg) {
  await chrome.storage.local.set({ [STORAGE_KEY]: cfg });
}
