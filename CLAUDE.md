# AutoClicker Sandbox — extension Chrome (MV3)

## Architecture globale

```
Clic icône → background.js → TOGGLE_PANEL → content.js → ACS.togglePanel()
```

Le panel flottant **vit dans la page cible** (content script). Il n'y a pas de popup.

## Fichiers clés

### Background
| Fichier | Rôle |
|---|---|
| `background.js` | `chrome.action.onClicked` → injecte les content scripts si besoin, envoie `TOGGLE_PANEL` |

### Content scripts (ordre d'injection obligatoire)
| Fichier | Rôle |
|---|---|
| `content-utils.js` | `sleep`, `status`, `toast`, `buildSelector` — initialise `window.__ACS` |
| `content-picker.js` | Pipette : surbrillance + capture de sélecteur CSS |
| `content-cursor.js` | Faux curseur animé + effet ripple |
| `content-runner.js` | Simulation d'événements souris + lecteur de séquence |
| `content-panel.js` | Panel flottant : UI complète, drag-and-drop, `ACS.togglePanel`, `ACS.setStatus` |
| `content.js` | Coordinateur : état partagé (`ACS.state`), storage, listener de messages — pose le verrou `__ACS_LOADED__` |
| `content.css` | Styles curseur, ripple, surbrillance pipette, toast |
| `content-panel.css` | Styles du panel flottant (scoped `.acs-panel`) |

### Démo
| Fichier | Rôle |
|---|---|
| `demo.html/js` | Page de test autonome (compteur, grille, formulaire) |

## Règles d'architecture

- **Modifier l'UI du panel** → `content-panel.js` + `content-panel.css`
- **Modifier les actions sur la page** (curseur, clic simulé, pipette) → le `content-*.js` concerné
- **Source de vérité** → `chrome.storage.local`, clé `"autoclicker"`, objet `{ steps[], options{} }`
- **`ACS.status(text, kind)`** appelle directement `ACS.setStatus` (défini dans `content-panel.js`) — pas de message runtime
- **Ordre d'injection** : utils → picker → cursor → runner → panel → content.js (verrou en dernier)
- Les fonctions `content-panel.js` accèdent à `ACS.loadConfig` / `ACS.saveConfig` (définis dans `content.js`) de façon **lazy** (au moment de l'appel, pas à la définition)

## Contrat de messages (background.js → content.js)

| Type | Effet |
|---|---|
| `TOGGLE_PANEL` | Affiche ou masque le panel flottant |
| `PING` | Vérifie que le content script répond |
| `RUN` | Lance la séquence (non utilisé depuis background — conservé pour tests) |
| `STOP` | Interrompt la séquence |
