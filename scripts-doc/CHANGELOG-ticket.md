# CHANGELOG — Page Paiements : Export de la recherche + Reçu/Ticket

Détail des modifications apportées à la page Paiements :
1. Export des résultats de recherche (PDF / Excel)
2. Export et impression de reçus (PDF, Word, Excel, A4, Ticket 80mm)
3. Correction du bug « popup blanc » à l'impression (approche iframe)

---

## [2.0.0] — Export des résultats de recherche (PDF / Excel)

### Ajouté
- **Bouton « Exporter la recherche »** dans le header de la page Paiements,
  à côté de « Export pagination » et « Nouveau paiement ».
  - Affiche un compteur en temps réel du nombre de paiements filtrés
    (ex. « Exporter la recherche 95 »).
  - Désactivé quand `loading` ou `filteredPayments.length === 0`.
  - Ouvre un `DropdownMenu` avec 2 items : « Exporter en PDF » et
    « Exporter en Excel ».

- **Fonction `handleExportList(format)`** dans `payments.tsx` :
  - Vérifie que `filteredPayments` n'est pas vide (sinon toast d'erreur).
  - Construit un `ExportMeta` avec : `institutionName`, `schoolYear`,
    `authorName`, et les filtres actifs (`searchQuery`, `status`, `method`,
    `type`).
  - Appelle `exportPaymentsToPDF(filteredPayments, meta)` ou
    `exportPaymentsToExcel(filteredPayments, meta)`.
  - Toast de succès indiquant le nombre de paiements exportés.
  - Toast d'erreur en cas d'exception.

### Comportement clé
- **Exporte TOUS les paiements filtrés**, pas seulement la page courante.
  `filteredPayments` reflète tous les filtres actifs (statut, méthode, type,
  recherche) et n'est pas limité par la pagination.
- Les filtres appliqués sont récapitulés dans l'en-tête du document exporté
  (via `ExportMeta.filters`).

### Fichiers modifiés
- `src/components/modules/payments.tsx` :
  - Import de `exportPaymentsToPDF`, `exportPaymentsToExcel`, `ExportMeta`
    depuis `@/lib/payments-export`.
  - Fonction `buildExportMeta()` et `handleExportList(format)`.
  - `DropdownMenu` « Exporter la recherche » dans le header.

### Fichiers existants réutilisés (non modifiés)
- `src/lib/payments-export.ts` — Utilitaires d'export PDF/Word/Excel de la
  liste de paiements (déjà présents, juste consommés).

### Vérification end-to-end (Agent Browser)
- **Sans filtre** (143 paiements) : export PDF → Blob `application/pdf`,
  352 KB. Export Excel → Blob `application/vnd.ms-excel`, 131 KB,
  nommé `paiements_2024_2025_2026-07-15_124430.xls`.
- **Avec filtre statut=Complété** (95 paiements) : export PDF → Blob
  `application/pdf`, 236 KB (vs 352 KB sans filtre → confirme que seuls les
  95 paiements filtrés sont exportés).
- VLM confirme : bouton « Exporter la recherche 95 » visible dans le header.

---

## [1.1.0] — Correction robuste du bug « popup blanc » (approche iframe)

### Symptôme
L'impression ticket (et A4) laissait la fenêtre blanche ou ne s'ouvrait pas.

### Cause racine
`window.open('', '_blank')` + `document.write` est fragile :
1. Popup blockers avalent l'appel silencieusement.
2. Timing `load`/`print()` flaky pour les popups about:blank.
3. Fenêtre intermédiaire blanche visible.

### Solution : iframe cachée
Remplacement de `openPrintWindow()` par `printViaIframe()` :
- Crée un `<iframe>` caché dans le document courant.
- Écrit le HTML du reçu via `doc.write()` + `doc.close()`.
- Sur `iframe.onload` : `iframe.contentWindow.focus()` +
  `iframe.contentWindow.print()` depuis le parent.
- Nettoie l'iframe après 1s.

### Fichier modifié
- `src/lib/receipt-export.ts`

---

## [1.0.0] — Export et impression de reçus (PDF, Word, Excel, A4, Ticket 80mm)

### Ajouté
- `src/lib/receipt-export.ts` (NOUVEAU) — 5 fonctions d'export/print d'un
  reçu individuel.
- Dialog détail reçu + `DropdownMenu` 5 items dans `payments.tsx`.
- Route `/api/payments/[id]/receipt` support admin/super_admin.

---

## Résumé des fichiers

| Fichier | État | Rôle |
| --- | --- | --- |
| `src/components/modules/payments.tsx` | MODIFIÉ | Bouton « Exporter la recherche » + dialog reçu + CRUD + pagination |
| `src/lib/payments-export.ts` | EXISTANT (réutilisé) | Export liste → PDF/Word/Excel |
| `src/lib/receipt-export.ts` | CRÉÉ + MODIFIÉ | 5 fonctions reçu + iframe print |
| `src/app/api/payments/[id]/receipt/route.ts` | MODIFIÉ | Support admin/super_admin |
| `src/app/api/payments/route.ts` | (contexte) | Liste + création paiements |
| `src/lib/types.ts` | (support) | Types Payment, ReceiptData, ExportMeta |
| `src/lib/constants.ts` | (support) | Labels/types/méthodes/statuts |
| `src/lib/fetch-utils.ts` | (support) | Helper fetchWithAuth |
| `src/lib/api-auth.ts` | (support) | Résolution institution |
| `src/components/ui/dropdown-menu.tsx` | (UI) | Composant shadcn/ui DropdownMenu |
| `src/components/ui/dialog.tsx` | (UI) | Composant shadcn/ui Dialog |

---

_Généré le $(date +%Y-%m-%d)._
