---
type: audit-forme
scope: extensionolive
date: 2026-06-28
readiness: { navigation: ⚠️, fragmentation: ⚠️ }
---

# Audit forme — extensionolive — 2026-06-28

## Synthèse

Projet étudiant propre, bien commenté, cohérent. La doc (README.md) colle au code réel : tous
les fichiers listés existent, les fonctionnalités décrites sont implémentées, pas de lien mort,
pas de fichier fantôme. Le blocage principal pour une IA qui entre dans le repo : absence de
CLAUDE.md — il faut lire tout le README avant de trouver le bon fichier à toucher.
Pour l'humain (réflexe 42), content.js et popup.js sont des fichiers fourre-tout (5 et 8
responsabilités mélangées) qui restent modifiables grâce aux blocs de commentaires, mais
tout changement ciblé exige de parcourir ~400-500 lignes.

| Axe | Note | En une phrase |
|---|---|---|
| Navigabilité & doc (IA) | ⚠️ | README fidèle au code, mais pas de CLAUDE.md ni de docs/ structurés pour orienter une IA rapidement. |
| Fragmentation (humain)  | ⚠️ | content.js et popup.js concentrent chacun de multiples responsabilités ; STORAGE_KEY et defaults options dupliqués entre les deux fichiers. |

---

## Axe A — Navigabilité & doc

### Point d'entrée

- **README.md** existe et est bien rédigé : fonctionnalités, installation, utilisation, structure,
  points techniques, pistes d'amélioration. Une IO froide peut s'orienter dedans.
- **Pas de CLAUDE.md** : une IA doit lire le README en entier avant de savoir par où commencer.
  Pour un projet de cette taille c'est faisable, mais un CLAUDE.md de 10 lignes (« modifie
  popup.js pour l'UI, content.js pour les actions sur la page ») accélérerait le démarrage.

### Sommaire / index docs

- Pas de dossier `docs/` (créé par cet audit). Le README fait office de doc unique — acceptable
  pour un projet à 12 fichiers, mais rien n'est indexé.

### Plan d'architecture

- README section "Points techniques" décrit correctement le flux :
  popup ↔ chrome.storage.local ↔ content script via messages.
- Pas de schéma/diagramme, mais la description textuelle est suffisante.
- **Pas d'écart détecté** entre l'archi décrite et l'archi réelle.

### Doc ↔ code

**Structure des fichiers documentée vs réelle** : correspondance parfaite.

```
README.md liste         Fichier existe ?
────────────────────────────────────────
manifest.json           ✅
popup.html              ✅
popup.css               ✅
popup.js                ✅
content.js              ✅
content.css             ✅
demo.html / demo.js     ✅
icons/                  ✅
README.md               ✅
```

**Variables d'environnement** : aucune (extension Chrome, pas de backend). Sans objet.

**Protocole de messages (popup ↔ content script)** :
Les messages PING / START_PICK / RUN / STOP / STATUS sont le vrai contrat d'interface entre
les deux contextes. Ils sont mentionnés en passing dans le README ("communiquent par messages")
mais ne sont nulle part listés explicitement comme interface. Pas de divergence constatée entre
les `sendMessage` de popup.js et les `case` du `onMessage` de content.js — cohérent à 100 %.
Simplement non documenté en tant que contrat.

**Fonctionnalités README vs implémentation** :
- Pipette ✅, curseur animé ✅, étape sleep ✅, mode SVG/pointer ✅, boucle infinie ✅,
  export/import JSON ✅, tester une étape isolée ✅ — tout est là.
- "Pistes d'amélioration" (4 items en bas du README) : correctement signalées comme bonus
  non implémentés. Pas d'écart.

**Liens Markdown** : le README ne contient pas de liens internes vers des fichiers — rien
à vérifier, pas de lien mort.

---

## Axe B — Fragmentation & modularité

### Taille des fichiers

| Fichier | Lignes | Seuil ~300-400 |
|---|---|---|
| content.js | 479 | ❌ au-dessus |
| popup.js | 399 | ⚠️ à la limite |
| popup.css | 148 | ✅ |
| popup.html | 72 | ✅ |
| demo.html | 71 | ✅ |
| content.css | 95 | ✅ |
| demo.js | 43 | ✅ |
| manifest.json | 30 | ✅ |

### Responsabilités mélangées

**content.js** (~479 lignes) cumule 5 blocs conceptuels distincts :
1. Utilitaires (`sleep`, `status`, `toast`, `buildSelector`) — `content.js:37-115`
2. Stockage (`loadConfig`, `saveConfig`) — `content.js:120-130`
3. Pipette (UI highlight + capture click) — `content.js:137-229`
4. Faux curseur + ripple (`ensureCursor`, `moveCursorTo`, `ripple`) — `content.js:233-287`
5. Simulation d'événements + lecteur de séquence (`fireMouse`, `firePointer`, `performAction`, `runSequence`) — `content.js:292-449`
6. Messagerie (`onMessage`) — `content.js:454-476`

Les blocs sont délimités par des bandeaux de commentaires `// ====` — navigables à la lecture,
mais toute modification d'un bloc exige de parcourir le fichier entier.

**popup.js** (~399 lignes) cumule 8 blocs :
1. Stockage (`loadConfig`, `saveConfig`) — `popup.js:31-40`
2. Gestion onglet + injection (`activeTab`, `isRestricted`, `ensureContent`) — `popup.js:45-73`
3. Rendu UI (`render`, `iconBtn`) — `popup.js:88-188`
4. Opérations sur les étapes (`removeStep`, `moveStep`, `testStep`) — `popup.js:193-228`
5. Actions principales (`startPick`, `addSleep`, `play`, `stop`) — `popup.js:233-291`
6. Import / Export / Effacer — `popup.js:296-335`
7. Options globales (`syncOptionInputs`, `onOptionChange`) — `popup.js:340-357`
8. Initialisation (`init`) — `popup.js:362-398`

### Couplage et duplication

**STORAGE_KEY dupliqué** :
- `popup.js:8` → `const STORAGE_KEY = "autoclicker";`
- `content.js:25` → `const STORAGE_KEY = "autoclicker";`

Si la clé change dans un fichier et pas l'autre, les données de l'un écrasent silencieusement
celles de l'autre. Risque faible aujourd'hui (clé stable), mais fragile.

**Valeurs par défaut des options dupliquées** :
- `popup.js:10-12` → `{ loops: 1, infinite: false, cursorSpeed: 600, pointerMode: false }`
- `content.js:125` → `Object.assign({ loops: 1, infinite: false, cursorSpeed: 600 }, ...)`
  (pointerMode absent ici — sera `undefined` si le popup ne le passe pas)

### Bruit de navigation

Aucun fichier mort, aucun import inutilisé, aucune fonction commentée « pour référence ». Le
projet est propre à ce niveau.

---

## Plan d'amélioration

### P1 — à faire d'abord

- **Constat** : pas de CLAUDE.md — `extensionolive/` (racine)
  **Gêne** : IA (orientation initiale lente)
  **Action** : créer un `CLAUDE.md` de 10-15 lignes : rôle de chaque fichier en une phrase,
  règle « popup.js = UI / chrome.storage ; content.js = DOM de la page cible », et le contrat
  de messages (PING/RUN/STOP/START_PICK/STATUS).
  **Effort** : S

- **Constat** : `STORAGE_KEY` dupliqué — `popup.js:8` et `content.js:25`
  **Gêne** : humain (risque de désynchronisation silencieuse)
  **Action** : dans un projet MV3 sans background service worker partageable, la solution
  pragmatique est d'ajouter un commentaire `// doit correspondre à popup.js` sur chaque
  occurrence, ou d'extraire dans un fichier `constants.js` importé via un module ES si le
  manifest est mis à jour pour le permettre.
  **Effort** : S

### P2 — ensuite

- **Constat** : `content.js` fourre-tout (479 lignes, 6 responsabilités) — `content.js`
  **Gêne** : humain (modification d'un bloc = relire 500 lignes)
  **Action** : découper en modules conceptuels :
  `content-utils.js` (sleep/status/toast/buildSelector),
  `content-picker.js` (pipette),
  `content-cursor.js` (faux curseur + ripple),
  `content-runner.js` (simulation événements + lecteur de séquence).
  Garder `content.js` comme point d'entrée léger (messagerie + coordination).
  Nécessite de mettre à jour `manifest.json` (liste des `js` du content_script) et d'exporter
  les fonctions nécessaires (ou de les garder dans le même scope IIFE via bundler).
  **Effort** : M

- **Constat** : `popup.js` fourre-tout (399 lignes, 8 responsabilités) — `popup.js`
  **Gêne** : humain (idem)
  **Action** : découper en `popup-storage.js`, `popup-render.js`, `popup-actions.js`,
  `popup-options.js`. Garder `popup.js` comme init + orchestration.
  **Effort** : M

- **Constat** : defaults options dupliqués avec légère divergence — `popup.js:10-12` vs `content.js:125`
  **Gêne** : humain + IA (pointerMode absent dans content.js, peut causer `undefined`)
  **Action** : harmoniser les deux objets de defaults. En attendant le split, ajouter
  `pointerMode: false` dans le `Object.assign` de `content.js:125`.
  **Effort** : S

### P3 — confort

- **Constat** : le contrat de messages entre popup et content n'est documenté nulle part.
  **Gêne** : IA (doit lire les deux fichiers pour reconstruire l'interface)
  **Action** : documenter les 5 messages (type + payload + direction) dans le CLAUDE.md
  ou dans un commentaire d'en-tête partagé.
  **Effort** : S

- **Constat** : pas de schéma visuel du flux popup ↔ storage ↔ content.
  **Gêne** : IA (orientation initiale)
  **Action** : ajouter un diagramme ASCII de 10 lignes dans `docs/architecture.md` ou dans
  le CLAUDE.md.
  **Effort** : S

---

## Pour la suite

Tickets à créer par ordre de valeur :
1. `[P1]` CLAUDE.md minimal + contrat de messages documenté (S — 30 min)
2. `[P1]` Harmoniser STORAGE_KEY + defaults options (S — 15 min)
3. `[P2]` Split content.js en modules (M — 1-2h, attention au manifest)
4. `[P2]` Split popup.js en modules (M — 1h)

Les P2 (splits) sont indépendants et peuvent être faits dans n'importe quel ordre.
Le P1 CLAUDE.md doit passer en premier pour que l'IA retrouve ses marques dans les sessions
suivantes.
