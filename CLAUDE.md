# AutoClicker Sandbox — extension Chrome (MV3)

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `manifest.json` | Déclaration MV3 : permissions, popup, content script, icônes |
| `popup.js` | UI + chrome.storage : liste d'étapes, options, pipette, lecture, import/export |
| `popup.html/css` | Interface du popup (thème sombre, 360 px) |
| `content.js` | Injecté dans la page cible : pipette, faux curseur, simulation d'événements, lecteur de séquence |
| `content.css` | Styles injectés dans la page (curseur, ripple, surbrillance pipette, toast) |
| `demo.html/js` | Page de test autonome (compteur, grille, formulaire) |

## Règle d'architecture

- **Toucher l'UI du popup** → `popup.js`
- **Toucher ce qui se passe sur la page cible** (curseur, clic simulé, pipette) → `content.js`
- **Source de vérité partagée** → `chrome.storage.local`, clé `"autoclicker"`, objet `{ steps[], options{} }`

## Contrat de messages (popup → content script)

| Type | Payload | Effet |
|---|---|---|
| `PING` | — | Vérifie que le content script répond (sinon le popup l'injecte via `chrome.scripting`) |
| `START_PICK` | — | Active la pipette sur la page |
| `RUN` | `{ steps, options }` | Lance la séquence de clics |
| `STOP` | — | Interrompt la séquence en cours |

## Message retour (content script → popup)

| Type | Payload | Effet |
|---|---|---|
| `STATUS` | `{ text, kind }` | Affiche un statut dans le popup (`kind` = `info` / `ok` / `warn`) |
