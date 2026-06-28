# 🖱️ AutoClicker Sandbox — extension Chrome (projet étudiant 42)

Extension **Chrome / Edge (Manifest V3)** qui sert de **bac à sable d'automatisation de clics** :
on **sélectionne des éléments à la pipette** sur n'importe quelle page (ton portfolio, par
exemple), on associe à chacun une **action** et un **délai**, puis on **rejoue la séquence**
avec un **faux curseur animé** qui se déplace et clique tout seul.

> 🎓 **Cadre du projet** — c'est un outil pédagogique d'automatisation du DOM, conçu pour
> piloter **tes propres pages** (ton portfolio de dev, la page de démo fournie). Utilise-le
> sur des sites dont tu es responsable.

---

## ✨ Fonctionnalités

- 🎯 **Pipette visuelle** : survole un élément (surbrillance + sélecteur CSS affiché), clique pour le capturer.
- 🖱️ **Curseur animé** : un faux curseur se déplace jusqu'à la cible, fait un effet « onde » puis clique.
- ⏱️ **Étapes paramétrables** : chaque étape = un élément + une **action** (clic, double-clic, survol, défiler vers) + un **délai d'attente** (ms).
- ⏸️ **Étape « pause » (sleep)** : une étape qui ne clique rien, elle **attend simplement** la durée indiquée (utile entre deux clics, sans cibler d'élément).
- 🔁 **Boucle** : nombre de répétitions, ou **boucle infinie**, et **vitesse du curseur** réglable.
- 🧩 **Mode SVG / pointer events** : émet de vrais `PointerEvent` et cible l'élément réellement sous le point (`elementFromPoint`) — pour les éléments SVG (plans/cartes), `<canvas>` et zones de drag, qui n'écoutent pas un simple `click`.
- ▶️ **Lancer / ■ Stop** depuis le popup, avec **journal de statut** en direct.
- 💾 **Exporter / Importer** un scénario en JSON, **Tester** une étape isolée.
- 🌐 Fonctionne sur **n'importe quelle page** (sauf pages internes `chrome://`).

---

## 🚀 Installation (mode développeur)

1. Ouvre `chrome://extensions` (ou `edge://extensions`).
2. Active **« Mode développeur »** (en haut à droite).
3. Clique **« Charger l'extension non empaquetée »**.
4. Sélectionne le dossier **`extensionolive`** (celui qui contient `manifest.json`).
5. Une icône 🖱️ apparaît dans la barre d'outils → clique dessus pour ouvrir le popup.

> Sur la VM de l'école, si l'épinglage n'apparaît pas : clique sur la pièce de puzzle 🧩
> dans la barre, puis épingle « AutoClicker Sandbox ».

---

## 📖 Utilisation

1. Ouvre la page cible (**ton portfolio**, ou ouvre `demo.html` — voir plus bas).
2. Clique l'icône 🖱️ → **« 🎯 Ajouter une étape (pipette) »**.
3. Le popup se ferme : **clique l'élément** à automatiser sur la page (Échap pour annuler).
4. **Rouvre le popup** : l'étape apparaît. Règle son **action** et son **délai**.
5. Répète pour chaque clic de ton scénario, dans l'ordre. Besoin d'attendre entre deux clics ? Clique **« ⏸️ Ajouter une pause (sleep) »** et règle sa durée.
6. Choisis les **répétitions** / **vitesse**, puis **▶ Lancer**. **■ Stop** interrompt à tout moment.

💡 Le bouton **▷** d'une étape la teste seule (pratique pour vérifier un sélecteur).

---

## 🧩 Cibler un élément SVG ou `<canvas>`

Les éléments d'un SVG (plan de salle, carte interactive) ou d'un `<canvas>` ne réagissent
souvent **pas** à un `click` classique : ils écoutent des **pointer events** et/ou font leur
propre détection par coordonnées.

1. Active **« Mode SVG / pointer events »** dans le popup.
2. Capture l'élément à la pipette (ex. un `<circle>` avec un `id`).
3. Lance — l'extension émet `pointerover → pointerdown → pointerup → click` à la position
   écran de l'élément, sur la cible réelle sous ce point.

⚠️ Beaucoup de plans **génèrent leurs éléments à la volée** (au zoom). Si un élément n'existe
dans le DOM qu'une fois zoomé, ajoute d'abord une étape qui zoome/affiche la zone, sinon le
sélecteur sera « introuvable ». À n'utiliser que sur **tes propres pages / la page de démo**.

## 🧪 Page de démo (entraînement / soutenance)

`demo.html` est une cible de test (compteur, grille de tuiles, formulaire) pour montrer
l'extension sans dépendre de ton portfolio.

- **Si ton portfolio est servi en `http(s)://`** : pas de réglage, tout marche.
- **Si tu ouvres `demo.html` en `file://`** : Chrome bloque par défaut les extensions sur
  les fichiers locaux. Va dans `chrome://extensions` → détails de l'extension → active
  **« Autoriser l'accès aux URL de fichiers »**. (Ou sers le dossier en local :
  `python -m http.server` puis ouvre `http://localhost:8000/demo.html`.)

---

## 📁 Structure du projet

```
extensionolive/
├── manifest.json   ← déclaration MV3 (popup, content script, permissions, icônes)
├── popup.html      ← interface : liste d'étapes + options + Lancer/Stop
├── popup.css       ← styles du popup (thème sombre)
├── popup.js        ← logique du popup (stockage, pipette, lecture, import/export)
├── content.js      ← script injecté dans la page : PIPETTE + FAUX CURSEUR + lecteur
├── content.css     ← styles injectés (curseur, surbrillance, toast)
├── demo.html / demo.js ← page d'entraînement (cible de test)
├── icons/          ← icônes 16 / 48 / 128 px
└── README.md
```

---

## 🧠 Points techniques (pour la soutenance)

- **Manifest V3** : `action.default_popup` (le popup), `content_scripts` (injection sur `<all_urls>`),
  `permissions` (`storage`, `scripting`, `activeTab`) et `host_permissions` (`<all_urls>`).
- **Architecture popup ↔ content script** : ils communiquent par **messages**
  (`chrome.tabs.sendMessage` / `chrome.runtime.onMessage`) et partagent l'état via
  **`chrome.storage.local`** (clé `autoclicker`), seule source de vérité.
- **Pipette** : écoute `mousemove` (surbrillance) et `click` en **phase de capture**
  (`addEventListener(..., true)` + `preventDefault`) pour intercepter le clic avant la page,
  puis génère un **sélecteur CSS unique** (id, classes, `:nth-of-type`).
- **Simulation de souris** : faux curseur déplacé en CSS `transform` + `transition`, puis
  séquence d'événements `mouseover → mousedown → mouseup → click` (`dispatchEvent`) + `.click()`
  pour déclencher l'action par défaut (liens, boutons, submit).
- **Injection robuste** : si le content script n'est pas déjà présent (onglet ouvert avant
  l'install), le popup l'injecte à la demande via **`chrome.scripting.executeScript`**, avec un
  **verrou anti double-injection** (`window.__ACS_LOADED__`).
- **Asynchrone** : `async/await` + `sleep` **interruptible** pour que **Stop** réagisse vite,
  boucle paramétrable avec drapeau `stopRequested`.

---

## 🔧 Pistes d'amélioration (bonus)

- Étape « saisie de texte » (taper dans un champ avant de cliquer).
- Réordonnancement des étapes en glisser-déposer (actuellement ▲ / ▼).
- Condition « cliquer seulement si l'élément existe ».
- Enregistrement de plusieurs scénarios nommés.
