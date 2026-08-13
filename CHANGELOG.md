# CHANGELOG — Modifications récentes du projet EduGest

Ce document récapitule toutes les modifications apportées au projet EduGest
sur la page **Paiements** et les fonctionnalités d'export/impression de reçus.

---

## 1. Pagination de la page Paiements

**Objectif** : Ajouter la pagination côté client sur la liste des paiements
(144 paiements → 15 pages de 10 par défaut).

### Fichiers modifiés
- `src/components/modules/payments.tsx`
- `src/components/ui/pagination.tsx` (composant shadcn/ui)

### Détails techniques
- État de pagination : `currentPage`, `pageSize` (10/20/50/100).
- Logique de découpage : `safeCurrentPage` + `paginatedPayments = filteredPayments.slice(start, end)`.
- Génération des numéros de page avec ellipsis (`…`) pour les grandes plages.
- Réinitialisation automatique de `currentPage` quand les filtres changent
  (année scolaire, statut, méthode, type, recherche).
- UI : boutons Précédent/Suivant, sélecteur de taille de page, indicateurs
  "Affichage X à Y sur Z".
- Bouton "Export pagination" (téléchargement ZIP de la documentation pagination).

---

## 2. CRUD paiements pour admin / super_admin

**Objectif** : Permettre aux administrateurs de créer, modifier et supprimer
des paiements.

### Fichiers modifiés
- `src/components/modules/payments.tsx`
- `src/app/api/payments/route.ts` (POST — création)
- `src/app/api/payments/[id]/route.ts` (GET/PUT/DELETE — lecture/modif/suppression)
- `src/lib/types.ts` (types CreatePaymentRequest, UpdatePaymentRequest)

### Détails techniques
- Détection du rôle : variable `isAdmin` (admin ou super_admin) contrôle la
  visibilité des boutons "Nouveau paiement", "Modifier", "Supprimer".
- Dialog "Nouveau paiement" : formulaire avec élève, montant, type, méthode,
  statut, référence, description, date, année scolaire.
- Dialog "Modifier" : pré-rempli avec les valeurs existantes, PUT vers l'API.
- Dialog "Supprimer" : confirmation avec affichage du montant + élève.
- Gestion des erreurs avec toasts (sonner).
- Rafraîchissement de la liste après chaque opération CRUD.

---

## 3. Export et impression de reçus (PDF, Word, Excel, A4, Ticket 80mm)

**Objectif** : Dans le dialog de visualisation d'un reçu, permettre
l'export/impression en 5 formats.

### Fichiers créés
- `src/lib/receipt-export.ts` (NOUVEAU — ~760 lignes, 5 fonctions d'export/print)

### Fichiers modifiés
- `src/components/modules/payments.tsx` (dialog détail + DropdownMenu)
- `src/app/api/payments/[id]/receipt/route.ts` (support admin/super_admin)

### Détails techniques
- **`exportReceiptToPDF(receipt)`** : PDF A4 portrait via jsPDF
  (en-tête teal institution, montant encadré, tableau détails, signature,
  pied de page).
- **`exportReceiptToWord(receipt)`** : fichier `.doc` via HTML + namespace
  Microsoft Office.
- **`exportReceiptToExcel(receipt)`** : fichier `.xls` via SpreadsheetML.
- **`printReceiptA4(receipt)`** : ouvre une fenêtre d'impression A4
  (HTML autonome + `window.print()`).
- **`printReceiptTicket(receipt)`** : ouvre une fenêtre d'impression 80mm
  pour imprimante thermique (police monospace, séparateurs pointillés,
  layout compact).
- Type `ReceiptData` (institution + payment + student).
- API receipt : pour admin/super_admin, récupère le paiement par ID seul
  (pas de filtre institution) — cohérent avec GET /api/payments.
- Dialog détail : en-tête institution, spinner pendant le fetch, message
  d'erreur si fetch échoue, bouton "Exporter / Imprimer" avec DropdownMenu
  de 5 items.

---

## 4. Correction du bug d'impression ticket (popup blanc)

**Objectif** : Corriger le bug où l'impression en mode ticket (et A4)
laissait la fenêtre popup apparemment blanche / n'imprimait pas.

### Fichier modifié
- `src/lib/receipt-export.ts`

### Cause racine
Pattern buggé dans `printReceiptTicket` et `printReceiptA4` :

```js
const w = window.open('', '_blank', ...);  // popup about:blank
w.document.write(html);
w.document.close();
w.onload = () => { w.print(); };  // ← JAMAIS APPELÉ
```

Le popup `about:blank` est déjà à l'état "loaded". Après `document.close()`,
l'événement `load` **ne se redéclenche pas** → `w.onload` (assigné trop tard)
ne fire jamais → `window.print()` n'est jamais appelé → l'utilisateur voit la
fenêtre sans dialogue d'impression, parfois blanche.

### Fix appliqué
- Ajout d'un helper `openPrintWindow(html, width, height)` :
  - Gère le popup bloqué (alert utilisateur au lieu d'échec silencieux).
  - Gère `SecurityError` via fallback blob URL.
- Ajout de la constante `PRINT_TRIGGER_SCRIPT` : un `<script>` inline
  **embarqué DANS le HTML du popup**. Ce script :
  - Vérifie `document.readyState === 'complete'` → appelle `go()` immédiatement,
    sinon attend l'événement `load` du popup.
  - `go()` fait `window.focus()` puis `setTimeout(() => window.print(), 350)`.
  - Définit `window.onafterprint` pour auto-fermer le popup après impression.
- Injection de `${PRINT_TRIGGER_SCRIPT}` avant `</body>` dans
  `buildA4PrintHtml` et `buildTicketPrintHtml`.
- Simplification de `printReceiptA4` et `printReceiptTicket` : une seule ligne
  `openPrintWindow(buildXxxPrintHtml(r), w, h)`.

### Pourquoi le script embarqué est robuste
Il s'exécute dans le contexte du popup lui-même, pas depuis l'opener. Il ne
dépend pas du timing de `w.onload` (flaky pour les popups about:blank).
L'événement `load` DU POPUP fire toujours quand son propre document est chargé.

### Vérification end-to-end (Agent Browser + VLM)
- **Ticket 80mm** : popup ouvert, `eval` confirme `SCRIPT PRESENT ✓` +
  `typeof window.onafterprint === "function"`. VLM confirme reçu rendu.
- **A4** : `A4 SCRIPT PRESENT ✓` + onafterprint=function. VLM confirme
  en-tête teal + montant + tableau + signature.

---

## 5. ZIP du code source complet

**Objectif** : Fournir une archive ZIP du code source complet du projet,
en excluant les dossiers volumineux (node_modules, .next, .git, db, etc.).

### Fichiers créés
- `scripts/build-source-zip.sh` (script réutilisable de génération du ZIP)
- `SOURCE-README.md` (documentation du contenu du ZIP)

### Archive générée
- `public/EduGest_Source_Complet_v3.zip` (5.6 Mo, ~326 fichiers)
- Inclut : `src/` (192 fichiers), `prisma/`, `mini-services/`, `examples/`,
  `scripts/`, `public/` (assets app), config, docs, CHANGELOG.
- Exclut : `node_modules/`, `.next/`, `.git/`, `db/*.db*`, `skills/` (73 Mo),
  `scripts-doc/` (17 Mo), captures d'écran, ZIPs existants, contenu utilisateur.

---

## Résumé des fichiers clés modifiés/créés

| Fichier | État | Rôle |
| --- | --- | --- |
| `src/components/modules/payments.tsx` | MODIFIÉ | Pagination + CRUD + dialog reçu + dropdown export |
| `src/lib/receipt-export.ts` | CRÉÉ puis MODIFIÉ | 5 fonctions export/print + fix popup blanc |
| `src/app/api/payments/route.ts` | MODIFIÉ | POST création paiement |
| `src/app/api/payments/[id]/route.ts` | MODIFIÉ | PUT/DELETE pour modif/suppression |
| `src/app/api/payments/[id]/receipt/route.ts` | MODIFIÉ | Support admin/super_admin |
| `src/lib/types.ts` | MODIFIÉ | Types Create/UpdatePaymentRequest |
| `src/components/ui/pagination.tsx` | EXISTANT | Composant pagination shadcn/ui |
| `src/components/ui/dropdown-menu.tsx` | EXISTANT | Composant dropdown shadcn/ui |
| `scripts/build-source-zip.sh` | CRÉÉ | Script génération ZIP source |
| `SOURCE-README.md` | CRÉÉ | Doc contenu ZIP |
| `CHANGELOG.md` | CRÉÉ | Ce document |

---

_Généré le $(date +%Y-%m-%d)._
