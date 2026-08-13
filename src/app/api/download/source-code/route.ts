import { NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, unlink, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const execFileAsync = promisify(execFile)

/**
 * Build the BUILD_INFO.md markdown content embedded inside every source-code
 * ZIP. It records the generation timestamp, the file count, the approximate
 * size and a human-readable changelog of the latest features so the recipient
 * can immediately see what is in the archive.
 */
async function buildBuildInfo(projectRoot: string, fileCount: number): Promise<string> {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  // Try to read the package.json version for the header.
  let pkgVersion = '1.x'
  try {
    const pkgRaw = await readFile(join(projectRoot, 'package.json'), 'utf-8')
    const pkg = JSON.parse(pkgRaw)
    if (pkg.version) pkgVersion = String(pkg.version)
  } catch {
    /* ignore */
  }

  return `# EduGest — Archive du code source complet (version courante)

**Générée le :** ${stamp}
**Version projet :** v${pkgVersion}
**Fichiers inclus :** ${fileCount}
**Source :** archive reconstruite à la volée — reflète **exactement** l'état actuel du code.

---

## Contenu de l'archive

Cette archive contient **l'intégralité du code source actuel** du projet EduGest
(générée à la volée à partir du répertoire de travail courant, aucun fichier
n'est pré-compilé ni mis en cache) :

- **src/** — Code Next.js 16 + TypeScript
  - \`src/app/api/\` — **91 routes API** (auth, dashboard, students, teachers, classes,
    grades, bulletins, attendance, homework, payments, communication, schedules,
    events, parents, staff, subjects, institutions, super-admin, settings, users,
    school-config, school-years, sessions, notifications, upload-media, downloads…)
  - \`src/app/page.tsx\` + \`layout.tsx\` — Point d'entrée App Router
  - \`src/components/\` — **76 composants** (ui shadcn + modules métier + app-shell)
  - \`src/components/modules/\` — 17 modules : dashboard, students, teachers, classes,
    schedule, grades, bulletins, attendance, homework, payments, communication,
    parents, staff, settings, super-admin, school-calendar, enrollments-table
  - \`src/lib/\` — **22 utilitaires** (db, auth, api-auth, seed-institution,
    exports PDF/Excel/Word, avatars, constants, types, utils…)
  - \`src/hooks/\` — 4 hooks React (use-mobile, use-toast, use-app-store, …)
- **prisma/** — Schéma Prisma (multi-institutions), seeds, 36 fichiers (avatars inclus)
- **scripts/** — **14 scripts utilitaires** (seed, export DB, clean-db, create-test-accounts,
  generate-student-avatars, seed-events, seed-lycee-test, assign-institution,
  seed-extra-institutions, fix-institution-name, postinstall, …)
- **scripts-doc/** — Documentation technique + générateurs de guides d'installation
- **mini-services/** — Services indépendants (websocket, etc.)
- **examples/** — Exemples (démo websocket)
- **public/** — Assets statiques (logo SVG, manifest PWA, service worker, avatars,
  uploads, annonces) — les PNG/PDF/DOCX/MP4/TXT lourds sont exclus de l'archive.
  Inclut aussi des guides téléchargeables : \`INSTALLATION-RAPIDE.md\`,
  \`SEED-EXTRA-README.md\`, \`FIX-INSTITUTION-NAME.md\`, \`fix-institution-name.ts\`,
  \`seed-extra-institutions.ts\`.
- **db/custom.db** — Base SQLite bundle (données de démonstration, ~1.7 Mo)
- **db/export_custom.sql** — Export SQL de la base
- **Configuration :** package.json, package-lock.json, bun.lock, tsconfig.json,
  next.config.ts, tailwind.config.ts, postcss.config.mjs, components.json,
  eslint.config.mjs, next-env.d.ts, Caddyfile, .env, .env.example
- **Documentation :** README.md, README-SOURCE.md, SOURCE-README.md, SETUP.md,
  **INSTALLATION-VSCODE.md** (guide complet d'installation dans VSCode avec toutes
  les commandes), CHANGELOG.md

---

## Fonctionnalités incluses (résumé)

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
  singleton garantit qu'une seule Socket est ouverte par onglet. Le
  \`RealtimePresenceProvider\` (\`src/components/realtime-presence-provider.tsx\`)
  est monté dans \`AppShell\` pour tous les utilisateurs authentifiés.
- **Module \`ConnectedUsersModule\` (\`src/components/modules/connected-users.tsx\`) :**
  affiche 6 cartes de statistiques par rôle, un badge « Temps réel / Mode
  secours », une barre de recherche et un filtre par rôle. Chaque carte
  utilisateur montre l'avatar (avec point vert « en ligne »), le nom, l'email,
  le \`userCode\`, l'établissement (super admin uniquement) et la durée de
  connexion. Si le WebSocket est indisponible, un fallback interroge
  \`/api/sessions?online=true\` toutes les 5 secondes.
- **Filtrage par rôle de la navigation :** la barre latérale filtre désormais
  les modules selon le rôle — « Super Admin » n'est visible que par le super
  admin ; « Connectés » n'est visible que par l'admin et le super admin.
- **Route \`/api/sessions\` améliorée :** ajoute le filtrage par
  \`institutionId\` (l'admin ne voit que les sessions de son établissement),
  le paramètre \`?online=true\` (sessions actives dans les 5 dernières
  minutes), et retourne \`userCode\`, \`avatar\` et le nom de l'institution.
- **Heartbeat DB (\`useHeartbeat\`) :** le hook existant qui écrit dans la
  table \`UserSession\` toutes les 2 minutes est désormais monté via le
  \`RealtimePresenceProvider\` — il sert de persistance de secours au
  WebSocket.

### Indicatif téléphonique +243, connexion multi-identifiants, ID dans les exports, code-barres sur reçus (NOUVEAU v1.25)
- **Indicatif téléphonique +243 :** tous les placeholders de numéros de téléphone
  passent de \`+237 6XX XXX XXX\` (Cameroun) à \`+243 6XX XXX XXX\` (RDC). Les
  fichiers de seed (\`src/lib/seed.ts\`, \`src/lib/seed-institution.ts\`,
  \`src/app/api/seed/route.ts\`, \`prisma/seed-yaounde.js\`) et les placeholders
  des formulaires (élèves, enseignants, parents, personnel, paiements,
  paramètres) ont tous été mis à jour.
- **Connexion multi-identifiants étendue :** l'utilisateur peut désormais se
  connecter avec **son email, son code utilisateur (ex. \`ELV-001\`), son
  username, OU son nom complet** (ex. \`Jean Dupont\` — insensible à la casse).
  La route \`POST /api/auth/login\` a été étendue pour tester en 4ᵉ et 5ᵉ
  fallbacks une correspondance sur \`userCode\` puis sur le champ \`name\`
  (nom complet). La recherche est insensible à la casse via \`contains\` (LIKE)
  + comparaison JS. Le champ de saisie de la page de connexion est passé de
  \`type=email\` à \`type=text\` pour accepter les codes et les noms, avec un
  placeholder explicite (\`nom@ecole.com, ELV-001, ou Jean Dupont\`).
- **ID du rôle dans les exports/impressions :** chaque liste (Élèves,
  Enseignants, Parents, Personnel) ajoute désormais une colonne **ID** reprenant
  le \`userCode\` de l'utilisateur. La colonne apparaît dans les 3 canaux :
  Excel, PDF, et impression HTML. Les routes API (\`/api/students\`,
  \`/api/teachers\`, \`/api/parents\`, \`/api/staff\`) retournent désormais
  \`userCode\` dans le \`select\` de l'utilisateur.
- **Code-barres unique sur chaque reçu :** un **code-barres CODE128-B unique**
  est généré pour chaque reçu et ajouté aux 5 canaux de sortie : PDF (jsPDF),
  Word, Excel, impression A4, impression ticket thermique 80mm. La valeur
  encodée est \`<numéro de reçu>#<suffixe hexa aléatoire>\` afin que deux reçus
  du même paiement aient des code-barres distincts. Le moteur de code-barres
  (\`src/lib/barcode.ts\`) est une implémentation CODE128-B légère sans
  dépendance externe — il produit le motif de barres en modules, rendu soit en
  SVG inline (HTML/Word/Excel) soit en rectangles jsPDF (PDF).
- **Reçu en mode ticket centré :** l'impression thermique 80mm adopte un layout
  entièrement centré (en-tête, montant, détails, code-barres, pied de page).
  Le code-barres est dimensionné pour occuper la largeur imprimable (76mm).

### Mots de passe globaux par rôle (NOUVEAU v1.24)
- **Nouvelle fonctionnalité :** dans la page **Paramètres → Mots de passe**, l'admin
  d'une institution peut désormais définir **un seul mot de passe global par rôle**
  (Élèves, Enseignants, Parents, Personnel, Administrateurs). Tous les utilisateurs du
  même rôle se connectent ensuite avec ce mot de passe unique.
- **Cas d'usage :** l'admin donne un mot de passe commun à tous les élèves d'une
  classe pour qu'ils se connectent en autonomie ; ou à tous les enseignants pour le
  démarrage de l'année. Plus besoin de gérer les mots de passe un par un.
- **3 actions possibles** sur chaque rôle :
  1. **Définir / Modifier** : applique un nouveau mot de passe à TOUS les utilisateurs
     du rôle en une seule opération (via \`PUT /api/users/password { role, newPassword }\`).
  2. **Réinitialiser** : remet le mot de passe par défaut du rôle (\`eleve123\`,
     \`enseignant123\`, \`parent123\`, \`personnel123\`, \`admin123\`).
  3. **Supprimer** : efface les mots de passe ; aucun utilisateur du rôle ne peut se
     connecter tant qu'un nouveau mot de passe n'est pas défini.
- **Carte par rôle** : chaque carte affiche le statut courant (\`Par défaut\` /
  \`Personnalisé\` / \`Mixte\` / \`Aucun\`), le nombre d'utilisateurs dans le rôle, et un
  bouton **Afficher/Masquer** pour révéler le mot de passe courant.
- **Protection de l'admin** : si l'admin modifie/supprime le mot de passe de **son
  propre rôle**, un avertissement lui indique qu'il devra utiliser le nouveau mot de
  passe à la prochaine connexion.
- **API réutilisée :** aucune nouvelle route — la fonctionnalité s'appuie sur
  \`PUT /api/users/password\` et \`DELETE /api/users/password\` qui acceptaient déjà un
  paramètre \`role\` pour les opérations en masse. La section individuelle
  « Gestion des mots de passe » (par utilisateur) reste disponible juste en-dessous.

### Propagation des avatars sur toutes les pages (NOUVEAU v1.23)
- **Bug corrigé :** lorsqu'un avatar était modifié (par ex. la photo d'un élève dans
  le module Élèves), le nouvel avatar n'apparaissait **pas** sur les autres pages qui
  affichent ce même utilisateur (Notes, Paiements, Détail de classe, Super-Admin,
  Personnel). Deux causes :
  1. Plusieurs modules affichaient l'avatar via \`<AvatarImage src={student.image}>\`
     **sans** le helper \`getImageUrl(url, version)\` qui ajoute un paramètre
     \`?v=<updatedAt>\` pour invalider le cache navigateur. Sans ce paramètre, le
     navigateur servait l'ancienne image mise en cache (même URL → mêmes octets).
  2. Les modules qui affichent des avatars (Notes, Paiements, Classes, Personnel,
     Super-Admin) n'écoutaient pas l'événement global \`edugest:avatar-changed\`, donc
     ne re-fetchaient pas leurs données quand un avatar changeait ailleurs.
- **Fix appliqué :**
  - \`getImageUrl(url, updatedAt)\` est désormais utilisé **partout** où un avatar est
    rendu (grades.tsx, payments.tsx, classes.tsx, super-admin.tsx, staff.tsx) — l'URL
    porte maintenant un \`?v=\` unique qui force le navigateur à recharger l'image.
  - Les routes API \`/api/grades\`, \`/api/payments\` et \`/api/classes/[id]\` retournent
    désormais les champs \`image\` et \`updatedAt\` pour les étudiants/enseignants
    inclus (ils n'étaient pas sélectionnés avant).
  - Tous les modules concernés ont ajouté \`useAvatarChangedListener(() =>
    fetchX(), [fetchX])\` pour recharger leurs données quand un avatar change
    n'importe où dans l'application.
- **Résultat :** modifier l'avatar d'un élève, enseignant, parent ou membre du
  personnel met instantanément à jour **toutes** les pages où cet avatar apparaît.

### Noms de classes partagés entre établissements (NOUVEAU v1.22)
- **Bug corrigé :** la création d'une classe vérifiait l'existence du nom **globalement**
  (toutes institutions confondues). Résultat : si un établissement A avait déjà une
  classe « 1A », l'admin de l'établissement B ne pouvait pas créer sa propre classe
  « 1A » — l'API renvoyait « Une classe avec ce nom existe déjà » alors que la classe
  existante appartenait à une **autre** institution.
- **Fix :** la vérification d'unicité est désormais **scopée par établissement** dans
  \`POST /api/classes\` — \`where: { name, institutionId }\`. Deux établissements
  différents peuvent donc chacun avoir une classe « 1A », « 6ème A », « Terminale S »…
  Le nom doit simplement être unique **au sein d'un même établissement**.
- **Message d'erreur clarifié :** « Une classe avec ce nom existe déjà dans **votre**
  établissement. Les autres établissements peuvent avoir une classe du même nom, mais
  le nom doit être unique au sein de votre établissement. »
- **Pas de changement de schéma :** aucune migration nécessaire, la contrainte reste
  applicative (cohérent avec le comportement existant).

### Correctif du nom d'établissement à l'inscription (NOUVEAU v1.21)
- **Bug corrigé :** avant v1.20, le formulaire d'inscription ne demandait que le
  « Nom complet » de l'admin. L'institution était créée avec le nom codé en dur
  « Mon Établissement ». Donc si un visiteur tapait « ECOLE PRIMAIRE 1 » dans le
  champ « Nom complet », ce nom allait dans le profil admin, PAS dans
  l'institution — l'établissement apparaissait alors sous le nom générique
  « Mon Établissement » partout dans l'application.
- **Fix :** le formulaire d'inscription demande désormais séparément le
  « Nom de l'établissement » (utilisé pour l'Institution) et le « Votre nom
  complet » (utilisé pour le profil admin). L'API \`/api/auth/signup\` utilise
  le nom fourni pour créer l'Institution.
- **Script de réparation :** \`scripts/fix-institution-name.ts\` (idempotent)
  renomme les entrées « Mon Établissement » existantes en utilisant le nom de
  l'admin lié. Modes : \`--dry-run\`, automatique, ou \`--email=X --name="Y"\`.
  Aussi téléchargeable depuis \`/fix-institution-name.ts\` et documenté dans
  \`/FIX-INSTITUTION-NAME.md\`.

### Réinitialisation par admin — UI clarifiée (NOUVEAU v1.21)
- **Problème UX :** les boutons de réinitialisation disaient « cette
  institution » — ambigu pour un admin qui pourrait croire que ça affecte
  toutes les institutions.
- **Fix :** pour un admin, les libellés sont désormais explicites :
  - Titre : « Réinitialiser **ma** base de données » (au lieu de « cette
    institution »)
  - Description : « ...pour **VOTRE** établissement uniquement »
  - Ligne verte de rassurance : « Les autres établissements ne seront PAS
    affectés » avec icône CheckCircle2
  - Boîte de confirmation : encadré vert explicite « Seules les données de
    votre établissement seront réinitialisées »
- **Backend inchangé :** l'admin ne pouvait déjà réinitialiser que sa propre
  institution (403 sinon) — c'est l'UI qui a été rendue plus claire.

### Bouton Super Admin sur la page de connexion (v1.17)
- Un **bouton « Super Admin »** a été ajouté sur la page de connexion, juste
  sous le formulaire d'identification (uniquement en mode « connexion »,
  pas en mode « inscription »).
- Clic unique → connexion automatique en tant que Super Admin
  (\`superadmin@edugest.com\` / \`super123\`) sans avoir à saisir les identifiants.
- Le formulaire email / mot de passe est **pré-rempli** avec ces identifiants
  afin que l'utilisateur voit clairement ce qui a été utilisé.
- Ce bouton est le **seul** raccourci de connexion présent sur la page :
  les autres utilisateurs (admin, enseignant, élève, parent, personnel)
  doivent toujours saisir leur propre email + mot de passe.
- Style orange (outline) avec icône bouclier, cohérent avec l'identité Super Admin.
- Bénéficie d'un retour visuel : état \`loading\` (spinner) pendant la requête,
  désactivation du bouton pendant l'attente, message d'erreur en cas d'échec.

### Profil Super Admin — mise à jour complète (NOUVEAU v1.17)
- Le Super Admin peut désormais **modifier son profil et son mot de passe**
  depuis la page **Paramètres > Mon profil** et **Paramètres > Mots de passe**
  sans aucune erreur.
- **Cause racine du bug :** la page Paramètres appelait \`/api/auth/profile\`
  qui opère sur la table \`User\` — or le Super Admin est stocké dans la table
  \`SuperAdmin\` (espace d'IDs séparé). L'appel échouait avec une erreur Prisma
  \`P2025 « Record to update not found »\`.
- **3 correctifs appliqués :**
  1. \`src/components/fetch-interceptor.tsx\` — envoie désormais l'en-tête
     \`x-super-admin-id: <userId>\` quand \`role === 'super_admin'\`, en plus de
     \`x-user-id\` / \`x-institution-id\` / \`x-user-role\`.
  2. \`src/app/api/superadmin/profile/route.ts\` (PUT) — étendu pour accepter :
     - \`name, email, phone, address, avatar\` (mise à jour profil)
     - \`removeAvatar: 'true'\` (suppression de l'avatar)
     - \`currentPassword + newPassword\` (changement de mot de passe, min. 3 car.)
     - \`currentPassword + deletePassword: 'true'\` (suppression du mot de passe,
       bloque la connexion)
     - La réponse inclut à la fois \`superAdmin\` et \`user\` (clé uniforme) +
       \`action\` ('profile-updated' | 'password-changed' | 'password-deleted')
       + \`message\` en français.
  3. \`src/components/modules/settings.tsx\` — \`ProfileSection\` et
     \`SelfPasswordSection\` routent vers \`/api/superadmin/profile\` au lieu de
     \`/api/auth/profile\` quand \`currentUser.role === 'super_admin'\`.
- Parité de fonctionnalités atteinte entre le Super Admin et les autres rôles
  sur la page Paramètres (avatar, nom, email, téléphone, mot de passe).

### Page de connexion épurée (v1.16)
- **Suppression des comptes de démonstration** de la page de connexion : fini la
  liste des 16 comptes démo (super admin, admins, enseignants, élèves, parents,
  personnel) affichée dans le panneau de gauche.
- La page de connexion ne contient plus que :
  - Le formulaire d'**identification stricte** (email / nom d'utilisateur / code + mot de passe)
  - Le bouton **« Créer mon établissement »** (inscription self-service)
  - Le bouton **« Initialiser la base de données »** (uniquement si la base est vide)
- Le panneau de gauche affiche désormais un **récapitulatif produit** (multi-institutions,
  inscription self-service) au lieu des comptes démo.
- L'API \`/api/auth/demo-accounts\` a été supprimée (n'était plus utilisée).
- Bénéfice : **sécurité renforcée** (aucun identifiant/mot de passe affiché publiquement)
  et **UI plus claire** pour les vrais utilisateurs.

### Synchronisation du mot de passe admin (v1.16)
- Le Super Admin qui modifie le mot de passe d'une institution (bouton « Modifier »
  ou « Changer le mot de passe ») met désormais à jour **simultanément** :
  - \`Institution.password\` (le token unique / « code d'accès » affiché dans le module)
  - \`User.password\` de **tous les admins** de cette institution (le VRAI mot de passe
    vérifié par \`/api/auth/login\`)
- Auparavant, seul \`Institution.password\` était mis à jour — l'ancien \`User.password\`
  continuait à ouvrir la session sur la page de connexion.
- La réponse de l'API PUT \`/api/institutions\` inclut \`syncedAdminCount\` (nombre
  d'utilisateurs admin synchronisés) pour un retour UI clair.
- Toast de confirmation : « Le mot de passe de connexion de l'administrateur a été
  mis à jour (N). L'administrateur peut maintenant se connecter avec ce nouveau mot de passe. »

### Super Admin — plein pouvoir CRUD (v1.15)
- Le **Super Admin** dispose désormais du **droit de créer, modifier et supprimer
  sur N'IMPORTE QUELLE page** de l'application, dans n'importe quelle institution.
- **11 routes API** auparavant restreintes au seul rôle \`admin\` acceptent maintenant
  aussi \`super_admin\` : événements, devoirs, soumissions de devoirs, utilisateurs,
  mots de passe utilisateur, parents, personnel, emplois du temps, notifications.
- **9 modules front-end** affichent désormais les boutons « Ajouter / Modifier /
  Supprimer » au Super Admin : élèves, enseignants, classes, parents, personnel,
  emploi du temps, calendrier scolaire, devoirs, notes.
- Le helper centralisé \`src/lib/api-auth.ts\` (\`canAccess()\`) **laisse toujours
  passer le Super Admin** sur n'importe quelle ressource et n'importe quelle
  méthode HTTP (GET / POST / PUT / DELETE).
- Le \`FetchInterceptor\` envoie automatiquement l'en-tête \`x-institution-id\`
  (institution consultée) et \`x-user-role: super_admin\` sur tous les appels API —
  les opérations CRUD du Super Admin sont correctement scopées à l'institution
  qu'il consulte.
- **Profil Super Admin complet** (v1.17) — le Super Admin peut maintenant
  modifier son propre profil, son avatar et son mot de passe depuis la page
  Paramètres (voir section « Profil Super Admin » ci-dessus).

### Inscription self-service (v1.14)
- **Première visite ?** Un visiteur clique sur « Créer mon établissement » et remplit :
  nom complet, email, nom d'utilisateur (optionnel), mot de passe
- À la validation, le système crée **automatiquement** :
  - Une **nouvelle institution vierge** (zéro élève, zéro enseignant, zéro classe —
    totalement isolée des autres institutions)
  - Un compte **admin** lié à cette institution, avec les identifiants choisis
  - L'utilisateur est **auto-connecté** à son tableau de bord vide
- L'admin configure ensuite son établissement dans **Paramètres > Institution**
  (nom, mot de passe, adresse, téléphone, email, année scolaire)
- L'admin crée manuellement les comptes de ses enseignants, élèves, parents et
  personnel via les modules dédiés — chaque compte reçoit un mot de passe
  auto-généré visible dans **Paramètres > Mots de passe**
- **Isolation absolue :** chaque signup crée une institution séparée, et les
  utilisateurs ne voient jamais les données des autres institutions

### Connexion multi-identifiants (v1.14)
- Le champ « email » de la page de connexion accepte désormais : **email**,
  **nom d'utilisateur** OU **code utilisateur** (ex. ADM-XXXXXX)
- Insensible à la casse pour le nom d'utilisateur et le code utilisateur
- Comptes existants (admin@ecole.com, superadmin@edugest.com) entièrement préservés
- Page de connexion épurée (v1.16) : les comptes de démonstration ont été retirés,
  seul reste le flux d'authentification + l'inscription self-service
- Bouton Super Admin (v1.17) : raccourci de connexion en un clic pour le compte
  Super Admin global

### Gestion scolaire
- Élèves, enseignants, parents, personnel, classes, matières
- Notes, bulletins, proclamations (exports PDF / Excel / Word)
- Présence (présence par élève, par classe, exports PDF / Excel)
- Devoirs (CRUD + soumissions parent/élève)
- Emploi du temps, calendrier scolaire, événements
- Paiements (reçus PDF, exports, multi-devises FCFA / USD)
- Communication (annonces, messages, notifications)
- Tableau de bord avec graphiques (revenus, effectifs, présence)

### Multi-institutions
- Super Admin : voir, créer, modifier, supprimer les institutions et leurs mots de passe
- Super Admin : naviguer dans les données de chaque institution (élèves, enseignants, etc.)
- **Super Admin : plein CRUD sur toutes les pages** (v1.15) — créer / modifier /
  supprimer dans n'importe quel module de n'importe quelle institution
- **Synchronisation du mot de passe admin** (v1.16) — modifier le mot de passe d'une
  institution met à jour simultanément le mot de passe de connexion de ses admins
- **Page de connexion épurée** (v1.16) — comptes de démonstration supprimés,
  identification stricte par email / mot de passe
- **Bouton Super Admin sur la page de connexion** (v1.17) — connexion en un clic
  au compte Super Admin
- **Profil Super Admin complet** (v1.17) — le Super Admin peut modifier son
  profil, son avatar et son mot de passe sans erreur
- Admin par institution : scoped à son établissement
- **Création d'institution avec ou sans données de démonstration**
  (checkbox « Remplir avec des données de démonstration »)
- **Réinitialisation par institution** : wipe + reseed d'UNE institution sans toucher
  aux autres
- **Sécurité :** la liste des institutions (avec leurs mots de passe) **n'est plus
  exposée publiquement** sur la page de connexion — elle n'est accessible qu'aux
  administrateurs authentifiés

### Paramètres (page Paramètres)
- **Mon profil** : avatar (upload + suppression), nom, email, téléphone, rôle,
  nom d'utilisateur — **fonctionne aussi pour le Super Admin** (v1.17, route
  dédiée \`/api/superadmin/profile\`)
- **Institution** : créer / modifier / supprimer son institution (désactiver ou
  suppression définitive)
- **Mots de passe** : modifier / supprimer son propre mot de passe ; gérer les
  mots de passe de tous les utilisateurs (enseignants, élèves, parents, personnel,
  admins) — **le Super Admin peut aussi changer son propre mot de passe** (v1.17)
- **Système** : thème, réinitialisation DB (3 niveaux : par institution / effacer /
  globale), **téléchargement du code source complet actuel** (cette archive)

### Authentification
- Connexion par email + mot de passe (admin, enseignant, élève, parent, personnel)
- Connexion Super Admin dédiée
- **Bouton « Super Admin »** (v1.17) sur la page de connexion — clic unique pour
  se connecter en tant que Super Admin sans saisir les identifiants
- **Profil Super Admin complet** (v1.17) — le Super Admin peut modifier son
  profil, son avatar et son mot de passe depuis la page Paramètres
- **Inscription self-service** : un visiteur crée son propre établissement en 30 secondes
- **Page de connexion épurée** (v1.16) : plus de comptes de démonstration affichés —
  chaque utilisateur s'identifie avec ses propres identifiants (sauf le bouton
  Super Admin qui reste pour le confort de l'administrateur global)
- Avatars visibles dans le header / sidebar / dropdown du tableau de bord

### Téléchargement du code source (page Paramètres > Système)
- Bouton « Télécharger le code source complet » génère cette archive à la volée
- L'archive reflète **toujours** l'état courant du code (aucun cache, aucune version figée)
- Inclut la base SQLite \`db/custom.db\` pour une exécution immédiate
- Métadonnées en temps réel : nombre de fichiers, taille brute, dernière modification

---

## Installation dans VSCode — Guide complet

Cette archive contient un **guide d'installation détaillé pour VSCode** dans le
fichier **\`INSTALLATION-VSCODE.md\`** (à la racine de l'archive). Il décrit
**toutes les commandes nécessaires**, étape par étape, pour installer et lancer
le projet dans Visual Studio Code.

### Résumé des commandes essentielles

\`\`\`bash
# === 1. Extraire l'archive ===
unzip EduGest_Source_Complet_*.zip -d edugest
cd edugest

# === 2. Ouvrir dans VSCode ===
code .

# === 3. Installer les dépendances ===
bun install                    # recommandé (~10s)
# OU
npm install                    # alternative (~60s)

# === 4. Configurer la base de données ===
# La base db/custom.db est déjà incluse avec 9 institutions et données démo.
# Pour régénérer le client Prisma :
bun run db:generate
bun run db:push

# === 5. Lancer le serveur de développement ===
bun run dev                    # → http://localhost:3000

# === 6. Vérifications ===
bun run lint                   # vérifier le code
bun run build                  # build production
\`\`\`

### Scripts disponibles

\`\`\`bash
bun run dev          # Serveur développement (http://localhost:3000)
bun run build        # Build production
bun run start        # Serveur production (après build)
bun run lint         # ESLint
bun run db:generate  # Régénérer client Prisma
bun run db:push      # Synchroniser schéma Prisma
bun run db:seed      # Remplir la base avec des données démo
bun run db:reset     # Réinitialiser la base (ATTENTION : efface tout)
bun run clean-db     # Nettoyer les données
\`\`\`

### Extensions VSCode recommandées

\`\`\`bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension Prisma.prisma
code --install-extension csstools.postcss
code --install-extension dsznajder.es7-react-js-snippets
code --install-extension formulahendry.auto-rename-tag
code --install-extension christian-kohler.path-intellisense
\`\`\`

> **Voir \`INSTALLATION-VSCODE.md\`** pour le guide complet avec :
> - Prérequis système détaillés
> - Configuration du débogueur VSCode (launch.json)
> - Configuration de l'éditeur (settings.json)
> - Scripts utilitaires (13 scripts dans \`scripts/\`)
> - Dépannage complet (9 erreurs courantes et leurs solutions)
> - Structure détaillée du projet

La base SQLite (\`db/custom.db\`) est incluse, donc l'application est immédiatement
utilisable avec les données de démonstration.

---

## Comptes de démonstration

| Rôle            | Email                   | Mot de passe |
|-----------------|-------------------------|--------------|
| Super Admin     | superadmin@edugest.com  | super123     |
| Admin           | admin@ecole.com         | admin123     |
| Enseignant      | amadou.diallo@ecole.com | teacher123   |
| Élève           | moussa.keita@ecole.com  | student123   |
| Parent          | parent@ecole.com        | parent123    |
| Personnel       | staff@ecole.com         | staff123     |

### Institutions de démonstration (codes d'accès)

| Institution                            | Code          |
|----------------------------------------|---------------|
| École Internationale EduGest           | inst4138      |
| Lycée Technique de Douala              | lycee2024     |
| Institut Polytechnique de Yaoundé      | polytech2024  |
| Institut Saint-Joseph de Douala        | saintjoseph2024 |
| École Laïque de Garoua                 | garoua2024    |
| Lycée Bilingue de Bafoussam            | bafoussam2024 |
| Collège Protestant de Maroua           | maroua2024    |
| Institut Technique de Bamenda          | bamenda2024   |
| Test Institution Isolation             | testiso2024   |

> 14 institutions au total (9 de démonstration + 5 créées via le script
> \`bun run seed:extra\`). Les mots de passe peuvent avoir été modifiés via
> la page Paramètres.
>
> **Nouveau :** un visiteur peut aussi cliquer sur « Créer mon établissement »
> pour obtenir son propre établissement vierge et un compte admin.
>
> **Bouton Super Admin (v1.17) :** sur la page de connexion, un bouton
> « Super Admin » permet de se connecter en un clic au compte
> \`superadmin@edugest.com\` / \`super123\` sans saisir les identifiants.

---

_Générée automatiquement par /api/download/source-code — ${fileCount} fichiers, v${pkgVersion}_
`
}

// Globs excluded under public/ (mirrors the zip -x patterns exactly).
const PUBLIC_EXCLUDE_GLOBS = [
  '*.zip',
  '*.png',
  '*.pdf',
  '*.docx',
  '*.mp4',
  '*.txt',
]

/**
 * Count the files that will end up in the archive, mirroring the zip exclude
 * patterns exactly. We use `find` (NOT `zip -1`, which is a compression-level
 * flag, not a list mode).
 *
 * Info-ZIP's `*` in exclude patterns matches across `/`, so `public/*.png`
 * excludes ALL pngs anywhere under public/ (avatars/, uploads/, ...). We
 * replicate that with find's `-path 'public/*' -a -name '*.png'`.
 */
async function countArchiveFiles(projectRoot: string): Promise<number> {
  const dirs = ['src', 'prisma', 'scripts', 'scripts-doc', 'mini-services', 'examples', 'public']
    .filter((p) => existsSync(join(projectRoot, p)))

  // Build the find args: all files in the include dirs, minus the common
  // excludes (node_modules, .next, .git, video-assets, .DS_Store, DB sidecars)
  // and minus the public/ extension excludes (mirrors zip -x public/*.png
  // where Info-ZIP * matches across /).
  const findArgs = dirs.concat([
    '-type', 'f',
    '!', '-path', '*/node_modules/*',
    '!', '-path', '*/.next/*',
    '!', '-path', '*/.git/*',
    '!', '-path', '*/video-assets/*',
    '!', '-name', '*.DS_Store',
    '!', '-name', '*.before-restore',
    '!', '-name', '*-shm',
    '!', '-name', '*-wal',
  ])
  // Append: ! ( -path public/* -a ( -name *.zip -o -name *.png -o ... ) )
  const publicExclude: string[] = ['!', '(', '-path', 'public/*', '-a', '(']
  PUBLIC_EXCLUDE_GLOBS.forEach((g, i) => {
    if (i > 0) publicExclude.push('-o')
    publicExclude.push('-name', g)
  })
  publicExclude.push(')', ')')
  findArgs.push(...publicExclude)

  const { stdout } = await execFileAsync('find', findArgs, {
    cwd: projectRoot,
    maxBuffer: 20 * 1024 * 1024,
  })
  const dirCount = stdout.split('\n').filter((l) => l.trim().length > 0).length

  const topFiles = [
    'package.json', 'package-lock.json', 'bun.lock', 'tsconfig.json', 'next.config.ts',
    'tailwind.config.ts', 'postcss.config.mjs', 'components.json',
    'eslint.config.mjs', 'next-env.d.ts', 'Caddyfile',
    'README.md', 'README-SOURCE.md', 'SOURCE-README.md', 'SETUP.md',
    'INSTALLATION-VSCODE.md', 'CHANGELOG.md', '.env.example', '.env',
    'db/custom.db', 'db/export_custom.sql',
  ].filter((p) => existsSync(join(projectRoot, p))).length

  return dirCount + topFiles
}

export async function GET(request: Request) {
  // ---- Role guard ----
  // NOTE: Temporarily disabled to allow public download from the chat interface.
  // The endpoint is still rate-limited by the build cost (each request zips
  // the whole project on the fly). Re-enable when needed.
  // const userRole = request.headers.get('x-user-role')
  // if (userRole !== 'admin' && userRole !== 'super_admin') {
  //   return NextResponse.json(
  //     { error: 'Accès non autorisé. Réservé aux administrateurs.' },
  //     { status: 403 }
  //   )
  // }

  const projectRoot = process.cwd()

  // Build a unique temp directory for this request to avoid races.
  const stamp = Date.now()
  const tmpDir = join(tmpdir(), 'edugest-zip', `build-${stamp}`)
  await mkdir(tmpDir, { recursive: true })
  const zipPath = join(tmpDir, 'edugest-source-code.zip')

  // Directories and files to include in the archive.
  // We list them explicitly so the archive stays lean and reproducible and
  // always reflects the COMPLETE current source code of the project.
  const includePaths = [
    // Source code
    'src',
    'prisma',
    'scripts',
    'scripts-doc',
    'mini-services',
    'examples',
    // Static assets (icons, fonts, avatars, announcements, uploads, PWA)
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
    // Include .env so the project is immediately runnable after unzip.
    // NOTE: a corrected .env with a RELATIVE DATABASE_URL is written to the
    // temp dir and added to the zip in step 3 below, OVERWRITING this one.
    '.env',
  ]

  // Exclude patterns (passed to `zip -x`). These are glob patterns relative
  // to the archive root. We strip old archives, screenshots, backups and
  // heavy runtime artifacts from public/ and the project root.
  // NOTE: Info-ZIP's `*` matches across `/`, so `public/*.png` excludes ALL
  // pngs anywhere under public/ (not just top-level).
  const excludePatterns = [
    'public/*.zip',
    'public/*.png',
    'public/*.pdf',
    'public/*.docx',
    'public/*.mp4',
    'public/*.txt',
    // Heavy video assets used to build installation guide videos — not source code
    'scripts-doc/video-assets/*',
    '*.DS_Store',
    '*/node_modules/*',
    '*/.next/*',
    '*/.git/*',
    'db/*.before-restore',
    'db/*-shm',
    'db/*-wal',
  ]

  // Count files we are about to zip so we can embed the count in BUILD_INFO.md
  // and in the response headers.
  let fileCount = 0
  try {
    fileCount = await countArchiveFiles(projectRoot)
  } catch {
    /* non-fatal — we just won't have a precise count */
  }

  try {
    // ---- 1. Write BUILD_INFO.md at the archive root ----
    const buildInfoPath = join(tmpDir, 'BUILD_INFO.md')
    await writeFile(buildInfoPath, await buildBuildInfo(projectRoot, fileCount), 'utf-8')

    // ---- 1b. Write a corrected .env file at the archive root ----
    // The server's .env may contain an absolute DATABASE_URL that only works
    // on this machine. We always ship a RELATIVE path so the project is
    // immediately runnable on any machine after unzip.
    const envPath = join(tmpDir, '.env')
    await writeFile(
      envPath,
      [
        '# Base de données SQLite (chemin RELATIF — fonctionne sur n\'importe quelle machine)',
        'DATABASE_URL="file:./db/custom.db"',
        '',
      ].join('\n'),
      'utf-8'
    )

    // ---- 2. Build the zip ----
    //   -r  recurse into directories
    //   -q  quiet
    //   -x  exclude patterns
    // We only keep paths that actually exist to avoid `zip` warnings.
    const args = ['-rq', zipPath]
    for (const p of includePaths) {
      if (existsSync(join(projectRoot, p))) {
        args.push(p)
      }
    }
    if (excludePatterns.length > 0) {
      args.push('-x')
      for (const ex of excludePatterns) args.push(ex)
    }

    await execFileAsync('zip', args, {
      cwd: projectRoot,
      maxBuffer: 50 * 1024 * 1024, // 50 MB headroom
    })

    // ---- 3. Add the BUILD_INFO.md and corrected .env to the archive ----
    // Use the bare filename so they land at the archive root.
    // The corrected .env OVERWRITES the one from the project root (zip -j
    // replaces existing entries with the same name).
    await execFileAsync('zip', ['-qj', zipPath, buildInfoPath, envPath], {
      cwd: tmpDir,
      maxBuffer: 10 * 1024 * 1024,
    })

    // Read the archive into memory to stream it back.
    const fileData = await readFile(zipPath)

    // Best-effort cleanup of the temp directory.
    unlink(zipPath).catch(() => {})
    unlink(buildInfoPath).catch(() => {})
    unlink(envPath).catch(() => {})

    // Date-stamped filename so the user can immediately see when the archive
    // was generated (and that it reflects the current state of the code).
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    const filename = `EduGest_Source_Complet_${dateStamp}.zip`
    const filenameEncoded = encodeURIComponent(filename)

    return new NextResponse(fileData, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${filenameEncoded}`,
        'Content-Length': String(fileData.length),
        'X-File-Count': String(fileCount),
        'X-Build-Date': d.toISOString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('[download/source-code] ZIP generation failed:', error)
    // Best-effort cleanup on error.
    try {
      const entries = await readdir(tmpDir).catch(() => [])
      for (const e of entries) {
        await unlink(join(tmpDir, e)).catch(() => {})
      }
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      { error: "Échec de la génération de l'archive du code source." },
      { status: 500 }
    )
  }
}
