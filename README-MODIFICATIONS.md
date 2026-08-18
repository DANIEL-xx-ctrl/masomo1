# MASOMO - Modifications (Connexion par ID + Liste des staffs)

Version : 1.29.x
Date : 2025-08-18

## Résumé des fonctionnalités ajoutées

### 1. Connexion par ID (userCode)
Les élèves et le personnel peuvent maintenant ouvrir une session avec leur **ID** (userCode)
au lieu de leur email. La connexion reste aussi possible par email, username ou nom complet.

Exemples d'identifiants générés automatiquement :
- `ELV-001` pour un élève
- `TCH-001` pour un enseignant
- `STF-001` pour un membre du personnel
- `PAR-001` pour un parent
- `ADM-001` pour un administrateur

La connexion est **case-insensitive** (`ELV-001` = `elv-001`).

### 2. Liste des staffs dans les Paramètres
Dans la page **Paramètres** (accessible aux admins et super admins), l'onglet
"Comptes & Mots de passe" liste maintenant tous les utilisateurs avec :
- ID (userCode) — cliquable pour copier
- Email — cliquable pour copier
- Nom complet
- Mot de passe réel (œil pour révéler/cacher + bouton copie)
- Rôle, classe/matière, statut du mot de passe

Deux boutons d'action :
- **Générer les identifiants manquants** : backfill des userCodes pour les utilisateurs existants.
- **Afficher les mots de passe** : révéler/cacher tous les mots de passe d'un clic.

---

## Fichiers inclus dans cette archive

### Nouveaux fichiers
| Fichier | Description |
|---|---|
| `src/lib/user-code.ts` | Utilitaire `generateUserCode(role, institutionId)` pour générer des identifiants séquentiels par rôle et par institution. |
| `src/app/api/users/ensure-codes/route.ts` | Endpoint POST (admin/super_admin) qui backfill les userCodes manquants. Idempotent. Supporte `?all=1` pour le super_admin. |

### Fichiers modifiés
| Fichier | Modification |
|---|---|
| `src/app/api/auth/login/route.ts` | Ajout de `mode: 'insensitive'` sur toutes les requêtes Prisma `contains`/`equals` (username, userCode, name) pour compatibilité PostgreSQL. |
| `src/app/api/students/route.ts` | Auto-génère un userCode à la création de chaque élève. |
| `src/app/api/teachers/route.ts` | Auto-génère un userCode à la création de chaque enseignant. |
| `src/app/api/parents/route.ts` | Auto-génère un userCode à la création de chaque parent. |
| `src/app/api/staff/route.ts` | Auto-génère un userCode à la création de chaque membre du personnel. |
| `src/components/login.tsx` | Ajout d'un indice visible sous le formulaire (connexion par ID, email, username ou nom complet). |
| `src/components/modules/settings.tsx` | Onglet "Mots de passe" renommé "Comptes & Mots de passe". Ajout : badge ID (userCode) cliquable, mot de passe réel avec œil, boutons "Générer les identifiants manquants" et "Afficher les mots de passe". |

---

## Installation

1. Décompressez l'archive à la racine du projet MASOMO :
   ```bash
   unzip masomo-modifications.zip -d /chemin/vers/masomo
   ```
   Les fichiers écraseront les versions existantes (pensez à sauvegarder avant).

2. Si la base de données contient déjà des utilisateurs sans userCode, exécutez
   une fois l'endpoint `ensure-codes` en tant qu'admin ou super admin :
   ```bash
   curl -X POST https://masomo1.vercel.app/api/users/ensure-codes?all=1 \
        -H "Cookie: <votre-session-admin>"
   ```

3. Redémarrez le serveur (ou laissez Vercel redéployer après push GitHub).

---

## Préfixes userCode

| Rôle | Préfixe | Exemple |
|---|---|---|
| Administrateur | `ADM` | `ADM-001` |
| Enseignant | `TCH` | `TCH-001` |
| Élève | `ELV` | `ELV-001` |
| Parent | `PAR` | `PAR-001` |
| Personnel (staff) | `STF` | `STF-001` |

Les préfixes sont alignés avec le seed existant (TCH pour teachers, STF pour staff).

---

## Comptes de test valides (après ensure-codes)

| ID | Mot de passe | Rôle |
|---|---|---|
| `ELV-001` | (mot de passe élève) | Élève |
| `ELV-002` | `student123` | Élève (Adama Traoré) |
| `TCH-001` | (mot de passe enseignant) | Enseignant (Amadou Diallo) |
| `STF-001` | (mot de passe personnel) | Personnel (Jean-Pierre Essomba) |
| `admin@ecole.com` | `biblio008xx` | Admin |
| `superadmin@edugest.com` | `super123` | Super Admin |
