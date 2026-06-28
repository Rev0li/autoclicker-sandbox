# AutoClicker Sandbox — extension Chrome (MV3)

## Fichiers clés

### Popup (ES modules)
| Fichier | Rôle |
|---|---|
| `popup.js` | Coordinateur : rendu de la liste d'étapes, options, init, événements |
| `popup-storage.js` | Données partagées : `STORAGE_KEY`, `DEFAULTS`, `CFG` (mutable), `loadConfig`, `saveConfig` |
| `popup-tab.js` | Onglet actif, détection page restreinte, injection du content script |
| `popup-ui.js` | `setStatus` — seul helper UI importé par popup-actions |
| `popup-actions.js` | Actions utilisateur : `removeStep`, `moveStep`, `testStep`, `startPick`, `addSleep`, `play`, `stop`, `exportConfig`, `clearAll` |
| `popup.html/css` | Interface du popup (thème sombre, 360 px) |

### Content script (namespace `window.__ACS`, ordre d'injection obligatoire)
| Fichier | Rôle |
|---|---|
| `content-utils.js` | `sleep`, `status`, `toast`, `buildSelector` — initialise `window.__ACS` |
| `content-picker.js` | Pipette : surbrillance + capture de sélecteur CSS |
| `content-cursor.js` | Faux curseur animé + effet ripple |
| `content-runner.js` | Simulation d'événements souris + lecteur de séquence |
| `content.js` | Coordinateur : état partagé (`ACS.state`), storage, listener de messages — pose le verrou `__ACS_LOADED__` |
| `content.css` | Styles injectés dans la page (curseur, ripple, surbrillance, toast) |

### Autres
| Fichier | Rôle |
|---|---|
| `manifest.json` | Déclaration MV3 : permissions, popup, liste des content scripts, icônes |
| `demo.html/js` | Page de test autonome (compteur, grille, formulaire) |

## Règles d'architecture

- **Modifier l'UI du popup** → `popup.js` (rendu) ou `popup-actions.js` (logique)
- **Modifier ce qui se passe sur la page cible** → le fichier `content-*.js` concerné
- **Source de vérité partagée** → `chrome.storage.local`, clé `"autoclicker"`, objet `{ steps[], options{} }`
- **`CFG`** dans popup-storage.js est un objet muté en place — ne jamais le réassigner, utiliser `CFG.steps = ...`
- **Ordre d'injection** des content scripts : utils → picker → cursor → runner → content.js (verrou en dernier)

## Contrat de messages (popup → content script)

| Type | Payload | Effet |
|---|---|---|
| `PING` | — | Vérifie que le content script répond (sinon le popup injecte les 5 fichiers) |
| `START_PICK` | — | Active la pipette |
| `RUN` | `{ steps, options }` | Lance la séquence de clics |
| `STOP` | — | Interrompt la séquence |

## Message retour (content script → popup)

| Type | Payload | Effet |
|---|---|---|
| `STATUS` | `{ text, kind }` | Met à jour la zone de statut (`kind` = `info` / `ok` / `warn`) |
