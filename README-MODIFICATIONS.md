# MASOMO — Archive complète des modifications

Version : 1.31.x
Date : 2025-08-18

Cette archive contient **l'intégralité des modifications** apportées au projet
MASOMO lors des dernières sessions de travail. Elle regroupe cinq grands
chantiers :

1. **Connexion par ID (userCode)** — les élèves et le personnel peuvent se
   connecter avec un identifiant court (`ELV-001`, `TCH-001`, `STF-001`…).
2. **Liste des staffs & comptes** — onglet « Comptes & Mots de passe » dans
   les Paramètres.
3. **Filtrage de la sidebar par rôle** — chaque rôle ne voit que ses modules.
4. **Fix bouton « Connecter » (erreur 500 Prisma)** — le shell écrasait
   `DATABASE_URL` du `.env`.
5. **Fix logout/login : l'ancien utilisateur restait affiché** — causé par le
   cache du Service Worker. Corrigé par : (a) SW ne cache plus AUCUN endpoint
   `/api/`, (b) `clearAllCaches()` vide le Cache API directement depuis la
   fenêtre, (c) **hard reload** après login et logout pour un état 100% propre.

---

## Résumé des fonctionnalités et fixes

### 1. Connexion par ID (userCode)

Connexion avec un ID court (`ELV-001`, `TCH-001`, `STF-001`, `PAR-001`,
`ADM-001`) au lieu de l'email. Case-insensitive.

### 2. Liste des staffs dans les Paramètres

Onglet « Comptes & Mots de passe » listant tous les utilisateurs avec ID,
email, mot de passe réel, rôle, etc.

### 3. Filtrage de la sidebar par rôle

| Rôle          | Modules |
|---------------|---------|
| `super_admin` | 18      |
| `admin`       | 17      |
| `teacher`     | 12      |
| `student`     | 9       |
| `parent`      | 6       |
| `staff`       | 11      |

### 4. Fix bouton « Connecter » (erreur 500 Prisma)

**Cause :** Le shell exportait `DATABASE_URL=file:/.../custom.db` (SQLite) qui
écrasait le `.env` (PostgreSQL). Prisma refusait la connexion → 500.

**Fix :** `scripts/predev.js` force maintenant la valeur du `.env` pour
`DATABASE_URL`.

### 5. Fix logout/login : l'ancien utilisateur restait affiché

**Scénario bug :** élève se connecte → se déconnecte → admin se connecte →
le dashboard de l'élève s'affiche au lieu de celui de l'admin.

**Cause racine :** Le Service Worker (`public/sw.js`) mettait en cache les
réponses API GET par URL seule (stale-while-revalidate). Les endpoints
user-spécifiques (`/api/auth/profile`, `/api/dashboard`, `/api/messages`…)
retournaient la réponse cachée du précédent utilisateur, écrasant le store.

**Fix (3 couches + hard reload) :**

1. **`public/sw.js`** — Le SW ne cache **PLUS AUCUN** endpoint `/api/`.
   Tous les `/api/*` sont maintenant en pass-through (fetch direct réseau,
   fallback 504 si hors ligne). Fini le stale-while-revalidate qui causait
   les fuites entre utilisateurs.

2. **`src/lib/clear-caches.ts`** — `clearAllCaches()` vide maintenant le
   Cache API **directement depuis la fenêtre** (`caches.keys()` +
   `caches.delete()`) au lieu de juste envoyer un `postMessage` au SW
   (qui est fire-and-forget). Les caches sont donc détruits de façon
   synchrone avant que `login()` ne retourne.

3. **`src/components/login.tsx`** — Après `login(newUser)`, un **hard reload**
   (`window.location.href = '/'`) est déclenché après 350 ms (le temps de
   laisser le confetti démarrer). Ce reload garantit un état 100% propre :
   - Tout l'état React en mémoire est détruit
   - Le Service Worker est forcé de se mettre à jour (nouvelle version)
   - Le navigateur re-fetche tout depuis le réseau
   - L'app reboote depuis l'état Zustand persisté (qui a le nouvel user)

4. **`src/components/app-shell.tsx`** — `handleLogout` fait de même :
   `await clearAllCaches()` → `logout()` → `window.location.href = '/'`.

**Pourquoi le hard reload est nécessaire :** Même après avoir vidé les caches,
un **vieux Service Worker** (sur production, où le nouveau SW n'a pas encore
activé) peut encore servir des réponses cachées du précédent utilisateur. Le
hard reload force le navigateur à tout re-fetcher depuis le réseau et active
le nouveau SW en attente.

---

## Fichiers inclus dans cette archive

### Nouveaux fichiers

| Fichier                                      | Description                                                       |
|----------------------------------------------|-------------------------------------------------------------------|
| `src/lib/user-code.ts`                       | Génère des userCodes séquentiels par rôle.                        |
| `src/lib/clear-caches.ts`                    | `clearAllCaches()` : vide SW Cache API + IndexedDB + in-flight.   |
| `src/app/api/users/ensure-codes/route.ts`    | Endpoint POST pour backfiller les userCodes manquants.            |

### Fichiers modifiés

| Fichier                                      | Modification                                                                                    |
|----------------------------------------------|-------------------------------------------------------------------------------------------------|
| `src/app/api/auth/login/route.ts`            | `mode: 'insensitive'` + connexion par email/userCode/username/nom.                              |
| `src/app/api/{students,teachers,parents,staff}/route.ts` | Auto-génération du userCode à la création.                                           |
| `src/components/login.tsx`                   | `clearAllCaches()` + **hard reload** après chaque login (3 chemins).                            |
| `src/components/modules/settings.tsx`        | Onglet « Comptes & Mots de passe ».                                                             |
| `src/components/app-shell.tsx`               | Sidebar filtrée par rôle + `handleLogout` avec `clearAllCaches()` + **hard reload**.            |
| `src/lib/permissions.ts`                     | `MODULE_VISIBILITY` par rôle + `isModuleVisible()`.                                             |
| `src/lib/offline-queue.ts`                   | Ajout de `clearOfflineCache()` (vide IndexedDB).                                                |
| `public/sw.js`                               | **Aucun endpoint `/api/` n'est plus caché** (pass-through). Handler `CLEAR_CACHES`.             |
| `scripts/predev.js` *(en `scripts-predev.js`)* | `DATABASE_URL` du `.env` prioritaire sur le shell.                                            |

**Total : 15 fichiers** (3 nouveaux + 12 modifiés).

---

## Installation

1. Décompressez l'archive à la racine du projet :

   ```bash
   unzip masomo-modifications.zip -d /chemin/vers/masomo
   ```

   - Les fichiers `src/...` vont dans `src/...`
   - `public/sw.js` va dans `public/sw.js`
   - `scripts-predev.js` doit être renommé :

   ```bash
   mv scripts-predev.js scripts/predev.js
   ```

2. Si la base contient des utilisateurs sans userCode :

   ```bash
   curl -X POST https://masomo1.vercel.app/api/users/ensure-codes?all=1 \
        -H "Cookie: <votre-session-admin>"
   ```

3. Redémarrez le serveur (ou laissez Vercel redéployer).

4. **Important pour le SW :** Les utilisateurs existants doivent fermer tous
   les onglets et rouvrir l'app pour que le nouveau Service Worker prenne
   effet. Le hard reload après login/logout force aussi cette mise à jour.

---

## Préfixes userCode

| Rôle               | Préfixe | Exemple   |
|--------------------|---------|-----------|
| Administrateur     | `ADM`   | `ADM-001` |
| Enseignant         | `TCH`   | `TCH-001` |
| Élève              | `ELV`   | `ELV-001` |
| Parent             | `PAR`   | `PAR-001` |
| Personnel (staff)  | `STF`   | `STF-001` |

---

## Comptes de test

| ID / Email              | Mot de passe   | Rôle        |
|-------------------------|----------------|-------------|
| `ELV-002`               | `student123`   | Élève (Adama Traoré)  |
| `TCH-001`               | `teacher123`   | Enseignant (Amadou Diallo) |
| `admin@ecole.com`       | `biblio008xx`  | Admin        |
| `superadmin@edugest.com`| `super123`     | Super Admin  |

---

## Vérification post-installation

- **Bouton « Connecter »** : doit fonctionner (plus d'erreur 500).
- **Login par ID** : `ELV-002` / `student123` connecte l'élève.
- **Sidebar par rôle** : élève = 9 modules, enseignant = 12, admin = 17.
- **Logout → Login avec un autre rôle** : le nouvel utilisateur doit être
  affiché (nom, avatar, modules). La page fait un hard reload après login
  et logout.
- **Switch de rôles** : testez élève → logout → admin → logout → enseignant.
  Chaque login doit afficher le bon utilisateur avec les bons modules.

---

## Historique des chantiers

| Task ID | Description                                                                          |
|---------|--------------------------------------------------------------------------------------|
| 12      | Connexion par ID (userCode) + liste des staffs.                                      |
| 13      | Création du zip initial.                                                             |
| 14      | Filtrage de la sidebar par rôle.                                                     |
| 15      | Zip consolidé.                                                                       |
| 16      | Fix bouton « Connecter » (erreur 500) + logout garde l'ancien login (cache SW).      |
| 17      | Fix définitif : SW ne cache plus /api/, clearAllCaches depuis la fenêtre, hard reload. |
