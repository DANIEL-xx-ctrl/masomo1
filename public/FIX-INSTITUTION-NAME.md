# Correction du nom « Mon Établissement »

## Le problème

Vous avez créé un établissement (par exemple « ECOLE PRIMAIRE 1 ») via le
formulaire d'inscription, mais dans la liste du Super Admin et partout dans
l'application, il apparaît avec le nom **« Mon Établissement »**.

### Pourquoi ?

Dans les versions **antérieures à v1.20.0**, le formulaire d'inscription ne
demandait que le **« Nom complet »** de l'administrateur. Le nom de
l'institution était alors codé en dur avec la valeur placeholder
**« Mon Établissement »**.

Donc si vous aviez tapé « ECOLE PRIMAIRE 1 » dans le champ « Nom complet »,
ce nom est allé dans votre **profil admin**, mais l'**institution** a été
créée avec le nom générique « Mon Établissement ».

Depuis la **v1.20.0**, le formulaire demande séparément :
- **Nom de l'établissement** (utilisé pour l'institution)
- **Votre nom complet** (utilisé pour le profil admin)

Mais les établissements créés **avant** cette version conservent leur ancien
nom. Il faut les renommer manuellement.

---

## Solution 1 — Via l'interface (le plus simple)

1. Connectez-vous avec votre compte admin (email + mot de passe).
2. Dans la barre latérale, cliquez sur **Paramètres** (icône engrenage).
3. Onglet **Établissement**.
4. Dans le champ **Nom**, remplacez « Mon Établissement » par le vrai nom
   (ex : « ECOLE PRIMAIRE 1 »).
5. Cliquez **Enregistrer**.

Le nom se met à jour immédiatement partout (Dashboard, Super Admin,
bulletins, paiements, etc.).

---

## Solution 2 — Via le script (pour plusieurs établissements)

Téléchargez le script : [fix-institution-name.ts](./fix-institution-name.ts)

Placez-le dans le dossier `scripts/` de votre projet EduGest, puis :

### a) Voir ce qui serait corrigé (dry-run)

```bash
bun run scripts/fix-institution-name.ts --dry-run
```

### b) Corriger automatiquement toutes les entrées « Mon Établissement »

Le script utilise le nom de l'admin comme nouveau nom d'institution (puisque
c'est là que le nom de l'école avait été tapé) :

```bash
bun run scripts/fix-institution-name.ts
```

### c) Forcer un nom précis pour un email précis

```bash
bun run scripts/fix-institution-name.ts --email=danitresm@gmail.com --name="ECOLE PRIMAIRE 1"
```

---

## Le script est-il sûr ?

- **Idempotent** : vous pouvez le lancer plusieurs fois sans danger.
- **Dry-run** : utilisez `--dry-run` pour voir sans modifier.
- **Synchronise `SchoolConfig`** : met aussi à jour la table d'affichage
  globale pour que le nom soit cohérent partout.
- **Ne supprime aucune donnée** : il ne fait que renommer.
