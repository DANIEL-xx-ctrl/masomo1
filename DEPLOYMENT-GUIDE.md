# 🚀 Déploiement MASOMO sur Vercel

Guide pas à pas pour déployer MASOMO en ligne avec une base de données PostgreSQL persistante (Neon).

---

## 📋 Pourquoi PostgreSQL et pas SQLite ?

**SQLite ne fonctionne PAS sur Vercel** : le système de fichiers est éphémère (remis à zéro à chaque déploiement). Toutes les données seraient perdues.

**Solution** : Utiliser **Neon** — PostgreSQL serverless gratuit (0,1 GB suffisant largement pour MASOMO), avec reprise automatique après inactivité.

---

## 🎯 Vue d'ensemble des étapes

1. Créer une base PostgreSQL sur Neon
2. Exporter les données SQLite actuelles
3. Basculer le schéma Prisma vers PostgreSQL
4. Créer les tables sur Postgres + importer les données
5. Pousser le code sur GitHub
6. Connecter Vercel + déployer
7. Configurer les variables d'environnement sur Vercel

---

## Étape 1 — Créer une base PostgreSQL sur Neon

1. Allez sur **https://neon.tech** → "Sign up" (ou "Continue with GitHub")
2. Une fois connecté, cliquez **"New Project"**
3. Configurez :
   - **Name** : `masomo`
   - **Postgres version** : 16 (default)
   - **Region** : `AWS US East` (ou la plus proche de vous)
4. Cliquez **"Create project"**
5. Sur la page qui s'affiche, copiez la **"Connection string"** — elle ressemble à :
   ```
   postgresql://masomo_owner:AbCdEf123456@ep-cool-name-123456.us-east-1.aws.neon.tech/masomo?sslmode=require
   ```
   **Gardez cette URL précieusement** — vous en aurez besoin plusieurs fois.

---

## Étape 2 — Exporter les données SQLite actuelles

Dans VSCode, dans le terminal :

```bash
bun run migrate:export
```

✅ Cela produit 26 fichiers JSON dans `db/migration-data/` (SuperAdmin, Institution, User, Student, Grade, Payment, etc.).

Vérifiez que vous obtenez bien ~7700 lignes exportées.

---

## Étape 3 — Basculer le schéma Prisma vers PostgreSQL

```bash
bun run migrate:switch-to-postgres
```

✅ Cela :
- Sauvegarde `prisma/schema.prisma` dans `prisma/schema.prisma.sqlite.bak`
- Change `provider = "sqlite"` → `provider = "postgresql"` dans `schema.prisma`

---

## Étape 4 — Configurer le `.env` local + créer les tables + importer les données

### 4a. Mettez à jour votre fichier `.env`

Remplacez le contenu de `.env` par :

```env
DATABASE_URL="postgresql://masomo_owner:VOTRE_VRAIE_URL_NEON_ICI"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="masomo-local-dev-secret-7f3a9c5e1b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4"
PORT=3000
```

**Remplacez** `VOTRE_VRAIE_URL_NEON_ICI` par l'URL complète copiée à l'étape 1 (avec `?sslmode=require` à la fin).

### 4b. Créez les tables sur Postgres

```bash
bun run db:push
```

✅ Cela crée les 26 tables vides sur Neon.

### 4c. Importez les données SQLite vers Postgres

```bash
bun run migrate:import
```

✅ Cela réinjecte les ~7700 lignes dans Postgres (avec contraintes FK temporairement désactivées pour l'import).

### 4d. Vérifiez en local

```bash
bun run dev
```

Puis ouvrez http://localhost:3000 et connectez-vous avec `admin@ecole.com` / `admin123` — vos données doivent être là !

---

## Étape 5 — Pousser le code sur GitHub

Si vous n'avez pas encore de dépôt GitHub :

```bash
# Initialisez git (si pas déjà fait)
git init
git add .
git commit -m "MASOMO v1.29.0 - Prêt pour Vercel (PostgreSQL)"

# Créez un dépôt sur https://github.com/new (nommez-le "masomo")
# Puis poussez :
git remote add origin https://github.com/VOTRE_USERNAME/masomo.git
git branch -M main
git push -u origin main
```

⚠️ **Important** : Vérifiez que `.env` est bien dans `.gitignore` (il y est par défaut). Ne poussez JAMAIS votre `.env` sur GitHub.

---

## Étape 6 — Connecter Vercel et déployer

1. Allez sur **https://vercel.com** → "Sign up" → "Continue with GitHub"
2. Autorisez Vercel à accéder à vos dépôts GitHub
3. Cliquez **"Add New..."** → **"Project"**
4. Importez votre dépôt `masomo`
5. Dans la page de configuration :
   - **Framework Preset** : Next.js (auto-détecté)
   - **Build Command** : laissez par défaut (`bun run vercel-build` est défini dans `vercel.json`)
   - **Install Command** : `bun install` (auto-détecté)
6. **NE CLIQUEZ PAS TOUT DE SUITE sur "Deploy"** — d'abord configurez les variables d'environnement (étape 7).

---

## Étape 7 — Configurer les variables d'environnement sur Vercel

Dans la page de configuration du projet Vercel, descendez jusqu'à **"Environment Variables"** et ajoutez ces 3 variables :

| Name | Value |
|------|-------|
| `DATABASE_URL` | `postgresql://masomo_owner:...@ep-xxx.neon.tech/masomo?sslmode=require` (votre vraie URL Neon) |
| `NEXTAUTH_URL` | `https://VOTRE_PROJET.vercel.app` (l'URL que Vercel va vous donner — vous pourrez la mettre à jour après le 1er déploiement) |
| `NEXTAUTH_SECRET` | une chaîne aléatoire de 64 caractères — générez-la avec : `openssl rand -base64 32` |

Pour `NEXTAUTH_URL`, vous pouvez mettre d'abord `https://masomo.vercel.app` (ou le nom que Vercel propose) et le corriger après le premier déploiement si l'URL réelle est différente.

Cliquez maintenant sur **"Deploy"** 🎉

---

## Étape 8 — Vérifier le déploiement

1. Vercel va construire l'app (~2-3 minutes)
2. Une fois terminé, cliquez sur l'URL `https://masomo-xxx.vercel.app`
3. Connectez-vous avec `admin@ecole.com` / `admin123`
4. Vérifiez que vos données sont bien là (élèves, notes, etc.)

---

## 🔧 En cas de problème

### Erreur "Environment variable not found: DATABASE_URL"

→ Le `prisma.config.ts` a été corrigé pour charger `.env` explicitement avec `dotenv.config()`. Sur Vercel, les variables sont injectées automatiquement, pas besoin de `.env`.

### Erreur "P1001: Can't reach database server"

→ Votre `DATABASE_URL` sur Vercel est incorrecte. Vérifiez que vous avez copié la **vraie** URL Neon (pas le placeholder `ep-xxx` du template).

### Les données ne s'affichent pas après déploiement

→ Vous avez oublié l'étape 4c (`bun run migrate:import`). Refaites-la en local avec `DATABASE_URL` pointant vers Neon.

### Je veux re-basculer vers SQLite (local only)

```bash
cp prisma/schema.prisma.sqlite.bak prisma/schema.prisma
# Remettez DATABASE_URL="file:./db/custom.db" dans .env
bun run db:push
```

---

## 📁 Fichiers créés pour le déploiement

| Fichier | Rôle |
|---------|------|
| `vercel.json` | Config Vercel (framework Next.js, build command) |
| `prisma.config.ts` | Charge `.env` explicitement pour Prisma 6.19+ |
| `.env.vercel.example` | Template des variables à mettre sur Vercel |
| `scripts/migrate-export.ts` | Export SQLite → JSON |
| `scripts/migrate-import.ts` | Import JSON → PostgreSQL |
| `scripts/migrate-switch-to-postgres.ts` | Bascule schema.prisma sqlite → postgresql |
| `package.json` (scripts ajoutés) | `migrate:export`, `migrate:import`, `migrate:switch-to-postgres`, `vercel-build` |

---

## ✅ Checklist finale

- [ ] Base Neon créée + URL copiée
- [ ] `bun run migrate:export` → ~7700 lignes exportées
- [ ] `bun run migrate:switch-to-postgres` → schema basculé
- [ ] `.env` mis à jour avec URL Neon
- [ ] `bun run db:push` → tables créées sur Postgres
- [ ] `bun run migrate:import` → données réinjectées
- [ ] `bun run dev` → vérification locale OK
- [ ] Code poussé sur GitHub
- [ ] Projet importé sur Vercel
- [ ] Variables d'environnement configurées sur Vercel (DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET)
- [ ] Déploiement lancé + vérifié sur l'URL Vercel

Une fois toutes les cases cochées, MASOMO est en ligne ! 🎉
