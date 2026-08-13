// ============================================================
// Build /public/MASOMO_Complet.zip — a complete source-code
// archive of the current project state. Mirrors the exclusion
// patterns used by /api/download/source-code (no node_modules,
// no .next, no heavy public assets) so the ZIP stays small and
// contains only source + config + docs + db.
//
// Usage:  bun run scripts/build-public-zip.mjs
// ============================================================

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const OUT = join(ROOT, 'public', 'MASOMO_Complet.zip')

// ---- Read version from package.json ----
let version = '1.x'
try {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
  if (pkg.version) version = String(pkg.version)
} catch {
  /* ignore */
}

// ---- Count files that will be included (for BUILD_INFO) ----
// Same find invocation as /api/download/source-code/meta.
const DIRS = ['src', 'prisma', 'scripts', 'scripts-doc', 'mini-services', 'examples', 'public']
  .filter((p) => existsSync(join(ROOT, p)))

const findArgs = DIRS.concat([
  '-type', 'f',
  '!', '-path', '*/node_modules/*',
  '!', '-path', '*/.next/*',
  '!', '-path', '*/.git/*',
  '!', '-path', '*/video-assets/*',
  '!', '-name', '*.DS_Store',
  '!', '-name', '*.before-restore',
  '!', '-name', '*-shm',
  '!', '-name', '*-wal',
  // Top-level public/*.{zip,png,pdf,docx,mp4,txt} excluded (Info-ZIP `*`
  // matches across `/`, so this excludes ALL such files under public/).
  '!', '(', '-path', 'public/*', '-a', '(', '-name', '*.zip', '-o', '-name', '*.png', '-o', '-name', '*.pdf', '-o', '-name', '*.docx', '-o', '-name', '*.mp4', '-o', '-name', '*.txt', ')', ')',
])

let fileCount = 0
try {
  const out = execFileSync('find', findArgs, { cwd: ROOT, maxBuffer: 40 * 1024 * 1024 }).toString()
  fileCount = out.split('\n').filter((l) => l.trim().length > 0).length
} catch (e) {
  console.error('find failed:', e.message)
  process.exit(1)
}

// Top-level config + docs files included alongside the dirs.
const TOP_FILES = [
  'package.json', 'package-lock.json', 'bun.lock', 'tsconfig.json', 'next.config.ts',
  'tailwind.config.ts', 'postcss.config.mjs', 'components.json',
  'eslint.config.mjs', 'next-env.d.ts', 'Caddyfile',
  'README.md', 'README-SOURCE.md', 'SOURCE-README.md', 'SETUP.md',
  'INSTALLATION-VSCODE.md', 'CHANGELOG.md', '.env.example', '.env',
  'db/custom.db', 'db/export_custom.sql',
  '.gitignore',
].filter((p) => existsSync(join(ROOT, p)))
const topCount = TOP_FILES.length
fileCount += topCount

// ---- Build BUILD_INFO.md ----
const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

const buildInfo = `# MASOMO — Archive du code source complet (version courante)

**Générée le :** ${stamp}
**Version projet :** v${version}
**Fichiers inclus :** ${fileCount}
**Source :** archive reconstruite à la volée — reflète **exactement** l'état actuel du code.

---

## Nouveautés v1.28.5 — Rebranding MASOMO + Mode hors ligne + Confettis + Labels flottants

### Renommage EduGest → MASOMO
- **Tous les visibles "EduGest" renommés en "MASOMO"** dans toute l'interface :
  titre de la page, en-tête de la barre latérale, pied de page, page de connexion,
  prompts PWA, manifeste, service worker, bulletins PDF, exports HTML, etc.
- \`package.json\` : \`name\` passé de \`edugest\` à \`masomo\`, version bumpée à 1.28.5.
- Clé de stockage Zustand : \`edugest-storage\` → \`masomo-storage\` (migration
  transparente — l'ancienne clé est simplement ignorée, l'utilisateur se
  reconnecte une fois).
- Événement global avatar : \`edugest:avatar-changed\` → \`masomo:avatar-changed\`.
- Cache du service worker : \`edugest-v1\` → \`masomo-v1\` (l'ancien cache est
  automatiquement purgé au prochain activate).
- **Note :** les emails de démonstration (\`superadmin@edugest.com\`,
  \`admin@ecole.com\`, etc.) sont conservés intact car ce sont des
  **données persistées en base** — les modifier casserait les logins existants.

### Mode hors ligne (offline-first) — write-behind + cache de lecture
- **Objectif :** l'application doit fonctionner même sans connexion internet.
  On peut parcourir les enregistrements (GET) et en créer/modifier (POST/PUT/DELETE)
  en local ; quand la connexion est rétablie, les écritures sont automatiquement
  synchronisées vers le serveur.
- **Architecture :**
  - **\`src/lib/offline-queue.ts\` (nouveau) :** file d'attente persistante dans
    IndexedDB (\`masomo-offline\` → stores \`queue\` + \`responses\`). Les requêtes
    d'écriture sont stockées avec leurs headers d'auth et leur body, puis
    rejouées en FIFO quand le réseau revient.
  - **\`src/components/fetch-interceptor.tsx\` (réécrit) :** intercepte maintenant
    trois choses en plus de l'injection des headers d'auth :
    1. **Cache des GET réussis** dans IndexedDB (store \`responses\`) — utilisé
       comme fallback quand le réseau échoue.
    2. **Mise en file des écritures (POST/PUT/PATCH/DELETE)** quand
       \`navigator.onLine === false\` — retourne une Response synthétique 202
       \`{ queued: true, offline: true }\` pour que l'UI continue à fonctionner
       sans erreur.
    3. **Repli sur le cache** pour les GET quand le réseau échoue (la réponse
       est taguée avec \`X-Masomo-Offline-Cache: 1\`).
  - **\`src/hooks/use-offline.ts\` (étendu) :** expose maintenant \`{ isOnline,
    wasOffline, pending, pendingCount }\` en plus du statut online/offline.
    Souscrit aux événements \`masomo:queue-changed\` et \`masomo:queue-flushed\`.
  - **\`src/components/offline-badge.tsx\` (nouveau) :** pastille flottante en
    bas à gauche qui affiche :
    - ambre « Hors ligne · N en attente » quand offline,
    - bleu « Synchronisation · N » pendant le flush,
    - émeraude « N en attente — cliquez pour synchroniser » quand online avec
      des requêtes en file.
    Clic = flush manuel.
- **Flush automatique :** déclenché par (1) l'événement \`online\` du navigateur,
  (2) un intervalle de 30 s pendant que l'app est online, (3) un clic sur la
  pastille. Après un flush réussi, un événement \`masomo:queue-flushed\` est
  diffusé pour que les composants puissent rafraîchir leurs données.
- **Gestion d'erreur :** les 4xx (sauf 408) sont retirés de la file (requête
  invalide — pas de boucle infinie) ; les 5xx et erreurs réseau restent dans
  la file pour un retry ultérieur.
- **Exclusions :** les endpoints d'auth (\`/api/auth/login\`, \`/api/auth/signup\`,
  \`/api/auth/me\`, etc.), \`/api/seed\`, \`/api/ensure-superadmin\`,
  \`/api/heartbeat\` et \`/api/dashboard\` ne sont **jamais** mis en file — ils
  doivent toujours atteindre le serveur.

### Page de connexion — labels flottants + confettis
- **Labels flottants animés :** les placeholders des champs Email et Mot de
  passe se transforment en petits labels majuscules qui **montent** (animation
  de translation + réduction de taille + couleur émeraude) quand le champ
  reçoit le focus ou contient une valeur. Transition CSS de 200ms ease-out.
  Composant \`FloatingInput\` réutilisable dans \`src/components/login.tsx\`.
- **Confettis à la connexion :** un feu d'artifice de ~140 confettis multicolores
  (émeraude, teal, ambre, rouge, bleu, violet, orange, rose) est déclenché
  immédiatement après un login réussi. Implémentation \`src/lib/confetti.ts\` —
  canvas unique fixé au viewport, gravité + rotation + dérive, auto-nettoyage
  après 2,4 s. Aucune dépendance externe ajoutée.
- **Suppression des zones multi-institutions et inscription self-service :**
  - Le panneau latéral gauche (qui présentait « Multi-institutions » et
    « Inscription self-service ») est supprimé.
  - Le mode « Créer mon établissement » (signup) est supprimé — le formulaire
    ne contient plus que Email + Mot de passe + bouton Super Admin.
  - L'écran de connexion passe d'un layout 2 panneaux (45%/55%) à un panneau
    unique centré (max-w-md) avec le logo MASOMO en en-tête.

---

## Contenu de l'archive

Cette archive contient **l'intégralité du code source actuel** du projet MASOMO
(générée à la volée à partir du répertoire de travail courant, aucun fichier
n'est pré-compilé ni mis en cache) :

- **src/** — Code Next.js 16 + TypeScript
  - \`src/app/api/\` — routes API (auth, dashboard, students, teachers, classes,
    grades, bulletins, attendance, homework, payments, communication, schedules,
    events, parents, staff, subjects, institutions, super-admin, settings, users,
    school-config, school-years, sessions, notifications, upload-media, downloads…)
  - \`src/app/page.tsx\` + \`layout.tsx\` — Point d'entrée App Router
  - \`src/components/\` — composants (ui shadcn + modules métier + app-shell)
  - \`src/components/modules/\` — modules : dashboard, students, teachers, classes,
    schedule, grades, bulletins, attendance, homework, payments, communication,
    parents, staff, settings, super-admin, school-calendar, connected-users
  - \`src/lib/\` — utilitaires (db, auth, api-auth, exports PDF/Excel/Word,
    receipt-export, barcode, avatars, constants, types, utils…)
  - \`src/hooks/\` — hooks React (use-mobile, use-toast, use-presence, use-heartbeat, use-chat…)
- **prisma/** — Schéma Prisma (multi-institutions), seeds
- **scripts/** — scripts utilitaires (seed, export DB, clean-db, build-public-zip…)
- **scripts-doc/** — Documentation technique + générateurs de guides d'installation
- **mini-services/** — Services indépendants (presence-service WebSocket port 3003, chat-service WebSocket port 3004, etc.)
- **examples/** — Exemples (démo websocket)
- **public/** — Assets statiques (logo SVG, manifest PWA, service worker, avatars,
  uploads, annonces) — les PNG/PDF/DOCX/MP4/TXT lourds sont exclus de l'archive.
- **db/custom.db** — Base SQLite bundle (données de démonstration)
- **db/export_custom.sql** — Export SQL de la base
- **Configuration :** package.json, package-lock.json, bun.lock, tsconfig.json,
  next.config.ts, tailwind.config.ts, postcss.config.mjs, components.json,
  eslint.config.mjs, next-env.d.ts, Caddyfile, .env, .env.example
- **Documentation :** README.md, README-SOURCE.md, SOURCE-README.md, SETUP.md,
  INSTALLATION-VSCODE.md, CHANGELOG.md

---

## Fonctionnalités incluses (résumé)

### Correction démarrage — auto-création du fichier .env (v1.28.4)
- **Problème résolu :** au lancement de \`bun run dev\` sur certaines
  machines (notamment Windows), Prisma affichait l'erreur
  \`Environment variable not found: DATABASE_URL\` (code P1012) et
  le serveur refusait de démarrer. La cause : le fichier \`.env\`
  n'était pas présent (fichier caché non extrait du ZIP sous
  Windows) ou ne contenait pas la variable \`DATABASE_URL\`, et
  le hook \`predev\` (v1.28.3) lançait \`prisma db push\` sans que
  Prisma ne puisse trouver la chaîne de connexion.
- **Hook \`predev\` auto-réparable :** le script
  \`scripts/predev.js\` a été réécrit pour :
  1. **Parser le \`.env\` manuellement** (aucune dépendance externe)
     — gère les commentaires, les guillemets simples/doubles, les
     fins de ligne Windows (CRLF) et Unix (LF).
  2. **Créer le fichier \`.env\`** s'il n'existe pas, avec
     \`DATABASE_URL="file:./db/custom.db"\` par défaut.
  3. **Ajouter \`DATABASE_URL\`** à la fin du \`.env\` existant si
     la variable manque (sans écraser le reste du fichier).
  4. **Créer le dossier \`db/\`** s'il n'existe pas (chemin SQLite).
  5. **Injecter \`DATABASE_URL\` dans \`process.env\** avant d'appeler
     Prisma, pour garantir que \`prisma db push\` trouve toujours la
     variable même si le chargement automatique du \`.env\` échoue.
- **Résultat :** \`bun run dev\` fonctionne désormais sur n'importe
  quelle extraction fraîche du ZIP, sans manipulation manuelle du
  fichier \`.env\`. Trois scénarios testés et validés :
  (A) \`.env\` absent → créé automatiquement ;
  (B) \`.env\` présent sans \`DATABASE_URL\` → variable ajoutée ;
  (C) \`.env\` complet → aucun changement, \`prisma db push\` normal.

### Messagerie robuste en local — auto-sync du schéma + repli sur schéma obsolète (v1.28.3)
- **Problème résolu :** un parent (PAR-001) qui tentait d'envoyer un
  message à l'administrateur en local (VSCode) obtenait une erreur au
  clic sur le bouton Envoyer. La cause racine était un **schéma de base
  de données obsolète** : le modèle \`Message\` a gagné 4 colonnes
  optionnelles en v1.28.0 (\`attachmentUrl\`, \`attachmentType\`,
  \`attachmentName\`, \`attachmentSize\`). Si l'utilisateur restaurait le
  code source v1.28.x sur une base SQLite antérieure sans exécuter
  \`bun run db:push\`, le client Prisma (généré depuis le nouveau schéma)
  tentait d'écrire ces colonnes inexistantes → erreur SQLite
  « no such column: attachmentUrl » → réponse 500 → toast d'erreur.
- **Hook \`predev\` (nouveau) :** la commande \`bun run dev\` exécute
  désormais \`node scripts/predev.js && next dev\`. Le script
  \`scripts/predev.js\` lance \`prisma db push\` **avant** le démarrage
  du serveur Next.js, garantissant que le schéma SQLite est toujours
  synchronisé avec \`prisma/schema.prisma\`. Non-bloquant : si la
  synchronisation échoue (base verrouillée), le serveur démarre quand
  même et les routes API disposent d'un repli.
- **Repli sur schéma obsolète (POST /api/messages) :** si
  \`db.message.create\` échoue avec une erreur « no such column », la
  route bascule sur un \`INSERT\` SQL brut qui omet les colonnes de
  pièce jointe. Les **messages texte** sont ainsi persistés même sur
  une base non migrée. Si l'utilisateur tente d'envoyer une **pièce
  jointe** sur une base obsolète, un message clair lui indique d'exécuter
  \`bun run db:push\`.
- **Repli sur schéma obsolète (GET /api/messages) :** les deux appels
  \`db.message.findMany\` (fil de conversation + liste complète) sont
  enveloppés dans un \`try/catch\` qui renvoie une liste vide en cas
  d'erreur de schéma, plutôt qu'une 500. L'UI affiche « Aucune
  conversation » au lieu d'un écran d'erreur.
- **Toast d'erreur détaillé :** le toast affiche désormais le **message
  exact** renvoyé par l'API (\`err.error || err.details || err.message\`)
  au lieu d'un générique « Échec de l'envoi ». L'utilisateur peut ainsi
  diagnostiquer la cause (schéma obsolète, session expirée, destinataire
  manquant, etc.) sans ouvrir la console.
- **Correction TypeScript :** 5 occurrences de \`me.schoolYear\` (qui
  n'existe pas sur le type \`User\` — \`schoolYear\` est un champ
  séparé du store Zustand) remplacées par \`schoolYear\` lu directement
  depuis \`useAppStore()\`. La année scolaire sélectionnée dans l'en-tête
  est maintenant réellement utilisée par la messagerie.
- **Documentation :** INSTALLATION-VSCODE.md mis à jour avec une note
  sur le hook \`predev\` (§7.1), une nouvelle section §7.3 sur le
  démarrage optionnel des mini-services Socket.io, et une entrée de
  dépannage §14.8.bis expliquant le badge « Mode différé » et les causes
  d'échec d'envoi.

### Messagerie compatible VSCode — détection d'environnement + polling de secours (v1.28.2)
- **Problème résolu :** en exécution locale (VSCode, laptop), la page
  Messagerie affichait **« Hors ligne »** et l'envoi de messages
  échouait, car le frontend tentait de se connecter au service de
  chat via \`/?XTransformPort=3004\` (passerelle Caddy du sandbox
  cloud) qui n'existe pas en local.
- **Détection d'environnement automatique :** nouveau helper
  \`src/lib/socket-env.ts\` qui inspecte \`window.location.hostname\`.
  - **Sandbox cloud** (hostname public) → \`/?XTransformPort=3004\`
    (via Caddy, inchangé)
  - **Local / VSCode** (hostname \`localhost\` ou \`127.0.0.1\`) →
    \`http://localhost:3004\` direct (cross-origin, CORS \`*\` déjà
    configuré sur le mini-service)
  - Appliqué à la fois au hook \`useChat\` (chat, port 3004) et au
    hook \`usePresence\` (présence, port 3003).
- **Polling de secours :** quand le socket n'est PAS connecté
  (chat-service non démarré en local, ou coupure réseau), la page
  Messagerie interroge automatiquement \`GET /api/messages\` toutes
  les 5 secondes pour rafraîchir le fil de conversation actif ET la
  liste des conversations. Les messages envoyés via REST
  (\`POST /api/messages\`) sont donc toujours délivrés et reçus,
  simplement avec un délai max de 5 s au lieu d'être instantanés.
- **Découplage envoi / socket :** l'appel \`sendMessage(msg)\` (socket)
  après un \`POST /api/messages\` réussi est désormais enveloppé dans
  un \`try/catch\` « best-effort ». Une erreur socket ne peut **jamais**
  transformer un envoi REST réussi en échec perçu par l'utilisateur.
- **UX du statut de connexion :** le badge passe de
  « Hors ligne » (gris, alarmant) à **« Mode différé »** (ambre,
  informatif) avec un tooltip expliquant que l'envoi reste possible.
  Quand le socket se connecte, le badge redevient « En direct » (vert).
- **Reconnexion limitée :** \`reconnectionAttempts: 10\` au lieu de
  \`Infinity\` pour éviter un spam de tentatives infinies dans la
  console quand le service est délibérément absent (dev local).

### Correctif Messagerie — bouton Envoyer et zone de saisie agrandie (v1.28.1)
- **Bug corrigé :** le bouton **Envoyer** affichait une erreur
  (« Le message doit contenir du texte ou une pièce jointe ») quand on
  cliquait dessus avec un éditeur vide. La cause était un garde-fou
  défectueux dans \`handleSend\` (\`src/components/modules/messages.tsx\`) :
  \`if (!text && !pendingAttachKind) return\`. Or \`pendingAttachKind\` est
  un **ref** (toujours truthy), donc \`!pendingAttachKind\` valait
  toujours \`false\` et le garde-fou ne se déclenchait jamais. Le message
  vide était alors envoyé à l'API qui le rejetait en 400. Le garde-fou
  est désormais \`if (!text) return\` (les pièces jointes passent par un
  chemin séparé \`handleSendWithAttachment\`).
- **Zone de saisie agrandie :** le compositeur de messages
  (\`contenteditable\`) passe de \`min-h-[40px] max-h-32\` à
  \`min-h-[96px] max-h-[260px]\` avec un interligne aéré
  (\`leading-relaxed\`) et un padding plus généreux. Le bouton Envoyer
  (h-11 w-11) est aligné en bas (\`self-end\`) pour rester accessible
  quelle que soit la hauteur du texte. La zone de saisie occupe
  désormais tout l'espace disponible pour écrire confortablement des
  messages multi-lignes.

### Page Messagerie dédiée avec formatage de texte et pièces jointes (NOUVEAU v1.28)
- **Page Messagerie autonome :** la messagerie dispose désormais de sa
  **propre page dédiée** dans la barre de navigation latérale (icône
  « Messagerie », \`MessagesSquare\`). Le tableau de bord affiche une
  **carte de résumé compacte** (messages non lus + dernières conversations
  + bouton « Ouvrir ») qui redirige vers la page Messagerie complète.
- **Formatage du texte :** l'éditeur de messages est un
  \`contenteditable\` enrichi avec une **barre d'outils de formatage** :
  - **Gras** (Ctrl+B), **Italique** (Ctrl+I), **Souligné** (Ctrl+U),
    **Barré**
  - **Liste à puces**, **Liste numérotée**, **Citation**, **Code**
  - Le HTML produit est **sanitisé** côté client (whitelist stricte de
    balises, tous les attributs sont supprimés) avant stockage et rendu
    via \`dangerouslySetInnerHTML\`.
- **Pièces jointes multimédias :** quatre boutons permettent d'envoyer
  une **image**, une **vidéo**, un **audio** ou un **fichier** quelconque
  (PDF, document, archive…). Les fichiers sont uploadés via
  \`POST /api/messages/upload\` (jusqu'à 25 Mo, tout type MIME), stockés
  dans la table \`MediaFile\` (base64) et servis via \`/api/media/{id}\`.
  - Images : affichage inline cliquable
  - Vidéos : lecteur inline avec contrôles
  - Audio : lecteur audio avec contrôles
  - Fichiers : lien de téléchargement avec icône, nom et taille
- **Notifications de nouveaux messages :** à chaque message envoyé, une
  **Notification** (catégorie \`message\`, lien vers la page Messagerie)
  est créée pour le destinataire. Le **badge de la cloche** se met à jour
  (polling toutes les 30 s). Les notifications sont automatiquement
  supprimées quand le destinataire ouvre la conversation. Un **toast**
  apparaît aussi en temps réel quand un message arrive et que la
  conversation n'est pas ouverte.
- **Temps réel :** le mini-service Socket.io (\`mini-services/chat-service/\`,
  port 3004) relaie les messages, indicateurs de frappe et accusés de
  lecture. Hook \`useChat\` (\`src/hooks/use-chat.ts\`) singleton.
- **Schéma Prisma :** le modèle \`Message\` gagne 4 champs optionnels :
  \`attachmentUrl\`, \`attachmentType\` (image|video|audio|file),
  \`attachmentName\`, \`attachmentSize\`.
- **API REST :**
  - \`GET /api/messages\` — liste / fil de conversation (avec marquage lu +
    suppression des notifications)
  - \`POST /api/messages\` — crée un message + notification
  - \`POST /api/messages/upload\` — upload de pièce jointe (25 Mo max)
  - \`GET /api/messages/users\` — utilisateurs joignables
  - \`PUT /api/messages/[id]/read\` — marquage comme lu
- **Composants :**
  - \`src/components/modules/messages.tsx\` — page Messagerie complète
  - \`src/components/modules/message-summary-card.tsx\` — carte de résumé
    du tableau de bord

### Messagerie rapide en temps réel (NOUVEAU v1.27)
- **Fonctionnalité initiale :** messagerie 1-à-1 en temps réel intégrée
  au tableau de bord. N'importe quel utilisateur (admin, enseignant, élève,
  parent, personnel) peut envoyer un message à n'importe quel autre
  utilisateur de son établissement.
- **Architecture WebSocket :** mini-service Socket.io indépendant
  (\`mini-services/chat-service/\`, port 3004) relaie les messages en temps
  réel. Hook \`useChat\` (\`src/hooks/use-chat.ts\`) singleton gère la
  connexion, l'identité, la réception, les indicateurs de frappe et les
  accusés de lecture.
- **API REST (\`src/app/api/messages/\`) :** GET (liste/fil), POST (création),
  GET /users (utilisateurs joignables), PUT /[id]/read (marquage lu).
- **Sécurité :** les utilisateurs ne voient que les membres de leur propre
  institution (le super_admin voit tous). Messages limités à 4000 caractères.

### Correctif du reçu en mode ticket sur mobile/navigateurs (v1.26.1)
- **Bug corrigé :** sur mobile et autres navigateurs frais, l'impression d'un
  reçu en mode ticket (80mm) échouait avec l'erreur
  « Paiement introuvable dans votre institution » alors que le paiement
  apparaissait bien dans la liste.
- **Cause racine :** la route \`GET /api/payments/[id]/receipt\` faisait
  entièrement confiance aux en-têtes \`x-user-role\` et \`x-institution-id\`
  envoyés par le client. Sur mobile, le store Zustand peut être momentanément
  non-hydraté quand la requête du reçu se déclenche, ce qui envoyait des
  en-têtes vides. Un \`x-user-role\` vide rendait \`isPrivileged=false\`,
  l'institution retombait sur « la première institution active », et tout
  paiement appartenant à une autre institution était rejeté en 404 — même pour
  un admin connecté. Le bug était masqué par la liste des paiements
  (\`/api/payments\` GET) qui n'a aucun filtre d'institution.
- **Fix 1 — Backend (\`src/app/api/payments/[id]/receipt/route.ts\`) :** ajout
  d'un repli sur la base de données — quand \`x-user-role\` ou
  \`x-institution-id\` manque mais \`x-user-id\` est présent, on cherche le
  vrai rôle + institutionId de l'utilisateur dans la table User. Les
  admins/super_admins sont ainsi correctement identifiés comme privilégiés
  même avec des en-têtes manquants. La protection IDOR pour les utilisateurs
  non-privilégiés est préservée.
- **Fix 2 — Frontend (\`src/components/modules/payments.tsx\`) :** suppression
  des en-têtes \`x-user-id\` / \`x-institution-id\` / \`x-user-role\` vides
  passés explicitement par \`openDetailDialog\` — ils bloquaient le
  \`FetchInterceptor\` global qui aurait dû les remplir. Désormais le
  interceptor injecte les bonnes valeurs depuis le store à chaque appel /api/.

### Utilisateurs connectés en temps réel (NOUVEAU v1.26)
- **Nouvelle fonctionnalité temps réel :** l'**admin** et le **super admin**
  peuvent désormais voir en **temps réel** tous les utilisateurs connectés,
  regroupés par rôle (Super Admins, Administrateurs, Enseignants, Élèves,
  Parents, Personnel). Le module est accessible via le nouvel item de
  navigation **« Connectés »** (icône Radio) dans la barre latérale.
- **Architecture WebSocket :** un mini-service Socket.io indépendant
  (\`mini-services/presence-service/\`, port 3003) maintient en mémoire la
  liste des utilisateurs connectés. Chaque utilisateur authentifié signale
  sa présence au service via l'événement \`presence:join\` et envoie un
  heartbeat toutes les 20 secondes. Les admins/super admins s'abonnent au
  flux (\`presence:subscribe\`) et reçoivent instantanément chaque
  connexion/déconnexion via l'événement \`presence:update\`.
- **Hook \`usePresence\` (\`src/hooks/use-presence.ts\`) :** gère le cycle de
  vie de la connexion Socket.io (connexion, join, heartbeat, leave). Un
  singleton garantit qu'une seule Socket est ouverte par onglet.
- **Module \`ConnectedUsersModule\` (\`src/components/modules/connected-users.tsx\`) :**
  affiche 6 cartes de statistiques par rôle, un badge « Temps réel / Mode
  secours », une barre de recherche et un filtre par rôle. Si le WebSocket
  est indisponible, un fallback interroge \`/api/sessions?online=true\`
  toutes les 5 secondes.

### Indicatif téléphonique +243, connexion multi-identifiants, ID dans les exports, code-barres sur reçus (NOUVEAU v1.25)
- **Indicatif téléphonique +243 :** tous les placeholders de numéros de téléphone
  passent de \`+237 6XX XXX XXX\` (Cameroun) à \`+243 6XX XXX XXX\` (RDC).
- **Connexion multi-identifiants étendue :** l'utilisateur peut désormais se
  connecter avec **son email, son code utilisateur (ex. \`ELV-001\`), son
  username, OU son nom complet** (ex. \`Jean Dupont\` — insensible à la casse).
- **ID du rôle dans les exports/impressions :** chaque liste (Élèves,
  Enseignants, Parents, Personnel) ajoute désormais une colonne **ID** reprenant
  le \`userCode\` de l'utilisateur (Excel, PDF, impression HTML).
- **Code-barres unique sur chaque reçu :** un **code-barres CODE128-B unique**
  est généré pour chaque reçu et ajouté aux 5 canaux de sortie : PDF (jsPDF),
  Word, Excel, impression A4, impression ticket thermique 80mm.
- **Reçu en mode ticket centré :** l'impression thermique 80mm adopte un layout
  entièrement centré (en-tête, montant, détails, code-barres, pied de page).

---

## Installation

1. Décompressez l'archive dans un nouveau dossier.
2. Installez les dépendances : \`bun install\` (ou \`npm install\`).
3. Initialisez la base de données : \`bun run db:push\`.
4. (Optionnel) Chargez les données de démonstration : \`bun run seed\`.
5. Démarrez le serveur de développement : \`bun run dev\`.
6. **(Recommandé) Démarrez les mini-services temps réel** dans deux
   terminaux séparés — ils fournissent la messagerie instantanée et
   la liste des utilisateurs connectés :
   - Terminal 1 : \`cd mini-services/presence-service && bun install && bun run dev\`
     (port 3003)
   - Terminal 2 : \`cd mini-services/chat-service && bun install && bun run dev\`
     (port 3004)
   - Si vous ne les démarrez PAS, la messagerie fonctionne quand même
     en **mode différé** (polling 5 s) et le badge affiche
     « Mode différé » au lieu de « En direct ».
7. Ouvrez \`http://localhost:3000\`.

Voir \`INSTALLATION-VSCODE.md\` pour un guide complet d'installation dans VSCode.

---

## Comptes de démonstration

- **Super Admin :** \`superadmin@edugest.com\` / \`superadmin2024\`
- **Admin :** \`admin@ecole.com\` / \`admin123\`
- **Enseignant :** mot de passe par défaut \`enseignant123\`
- **Élève :** mot de passe par défaut \`eleve123\`
- **Parent :** mot de passe par défaut \`parent123\`
- **Personnel :** mot de passe par défaut \`personnel123\`

---

*Archive générée automatiquement par \`scripts/build-public-zip.mjs\`.*
`

// ---- Write BUILD_INFO.md to a temp dir ----
const tmpDir = join(tmpdir(), `edugest-zip-${Date.now()}`)
mkdirSync(tmpDir, { recursive: true })
const buildInfoPath = join(tmpDir, 'BUILD_INFO.md')
writeFileSync(buildInfoPath, buildInfo, 'utf-8')

// ---- Remove old ZIP ----
try { rmSync(OUT) } catch { /* may not exist */ }

// ---- Build the zip ----
// Use an EXPLICIT include list (mirrors /api/download/source-code) so we
// only archive the project source — NOT sandbox-only directories like
// `upload/`, `skills/`, `tool-results/`, `src_bak*/`, etc.
const includePaths = [
  // Source code
  'src',
  'prisma',
  'scripts',
  'scripts-doc',
  'mini-services',
  'examples',
  // Static assets (icons, fonts, avatars, PWA) — heavy *.zip/*.png/etc.
  // under public/ are excluded below.
  'public',
  // Bundled SQLite database + SQL export so the project is runnable as-is
  'db/custom.db',
  'db/export_custom.sql',
  // Dependencies & build configuration
  'package.json',
  'package-lock.json',
  'bun.lock',
  'tsconfig.json',
  'next.config.ts',
  'tailwind.config.ts',
  'postcss.config.mjs',
  'components.json',
  'eslint.config.mjs',
  'next-env.d.ts',
  'Caddyfile',
  // Documentation
  'README.md',
  'README-SOURCE.md',
  'SOURCE-README.md',
  'SETUP.md',
  'INSTALLATION-VSCODE.md',
  'CHANGELOG.md',
  '.env.example',
  '.env',
  '.gitignore',
].filter((p) => existsSync(join(ROOT, p)))

// Exclusion patterns applied on top of the include list. These mirror
// /api/download/source-code exactly.
const excludePatterns = [
  'node_modules/*',
  '*/node_modules/*',
  '.next/*',
  '*.DS_Store',
  '*.before-restore',
  '*-shm',
  '*-wal',
  // Heavy public assets (top-level + nested — Info-ZIP `*` matches `/`).
  'public/*.zip',
  'public/*.png',
  'public/*.pdf',
  'public/*.docx',
  'public/*.mp4',
  'public/*.txt',
]

const zipArgs = ['-rq', OUT]
for (const p of includePaths) zipArgs.push(p)
zipArgs.push('-x')
for (const ex of excludePatterns) zipArgs.push(ex)

console.log(`Building ${OUT} ...`)
console.log(`  version: v${version}`)
console.log(`  files:   ${fileCount} (dirs: ${fileCount - topCount}, top-level: ${topCount})`)
console.log(`  include: ${includePaths.length} paths`)

try {
  execFileSync('zip', zipArgs, { cwd: ROOT, stdio: 'inherit', maxBuffer: 100 * 1024 * 1024 })
} catch (e) {
  console.error('zip failed:', e.message)
  process.exit(1)
}

// ---- Append BUILD_INFO.md to the zip ----
try {
  execFileSync('zip', ['-qj', OUT, buildInfoPath], { stdio: 'inherit' })
} catch (e) {
  console.error('zip append BUILD_INFO failed:', e.message)
  process.exit(1)
}

// ---- Cleanup temp ----
try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }

// ---- Report final size ----
import('node:fs/promises').then(async ({ stat }) => {
  const s = await stat(OUT)
  const mb = (s.size / (1024 * 1024)).toFixed(2)
  console.log(`\n✓ Done. ${OUT}`)
  console.log(`  size: ${mb} MB`)
})
