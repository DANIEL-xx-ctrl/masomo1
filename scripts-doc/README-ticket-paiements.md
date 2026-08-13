# Reçu / Ticket de paiement — Code source focalisé

Cette archive contient **uniquement les fichiers impliqués dans les
fonctionnalités d'export de la page Paiements** :
1. Export des résultats de recherche (PDF / Excel) — toute la liste filtrée
2. Export et impression de reçus individuels (PDF, Word, Excel, A4, Ticket 80mm)

Elle ne contient pas les autres composants du projet (élèves, enseignants,
bulletins, etc.).

---

## Fonctionnalités couvertes

### 1. Export des résultats de recherche (liste filtrée)

Dans le header de la page **Paiements**, un bouton **« Exporter la recherche »**
affiche en temps réel le nombre de paiements filtrés (ex. « 95 ») et propose
2 formats d'export via un `DropdownMenu` :

| # | Canal | Format | Sortie |
| --- | --- | --- | --- |
| 1 | Exporter en PDF | A4 paysage, tableau paginé | Téléchargement `.pdf` (jsPDF + autotable) |
| 2 | Exporter en Excel | Tableur | Téléchargement `.xls` (SpreadsheetML) |

**Comportement clé** : l'export contient TOUS les paiements filtrés (pas
seulement la page courante). Les filtres actifs (statut, méthode, type,
recherche) sont récapitulés dans l'en-tête du document exporté.

### 2. Export et impression de reçus individuels

Quand on visualise le reçu d'un paiement (clic sur l'icône œil "Voir les
détails"), un bouton **« Exporter / Imprimer »** propose 5 canaux :

| # | Canal | Format | Sortie |
| --- | --- | --- | --- |
| 1 | Exporter en PDF | A4 portrait | Téléchargement `.pdf` (jsPDF) |
| 2 | Exporter en Word | A4 | Téléchargement `.doc` (HTML + namespace MS Office) |
| 3 | Exporter en Excel | Tableur | Téléchargement `.xls` (SpreadsheetML) |
| 4 | Imprimer (A4) | A4 portrait | Impression via iframe cachée (`window.print()`) |
| 5 | Imprimer reçu ticket (80mm) | Ticket thermique | Impression via iframe cachée (`window.print()`) |

---

## Fichiers inclus

### Cœur de la fonctionnalité (créés / modifiés)

| Fichier | Lignes | Rôle |
| --- | ---: | --- |
| `src/lib/receipt-export.ts` | 788 | **NOUVEAU** — 5 fonctions d'export/print reçu + `printViaIframe` + `PRINT_TRIGGER_SCRIPT` |
| `src/lib/payments-export.ts` | EXISTANT (réutilisé) | Export liste filtrée → PDF/Word/Excel (`exportPaymentsToPDF`, `exportPaymentsToExcel`) |
| `src/components/modules/payments.tsx` | ~1470 | **MODIFIÉ** — bouton « Exporter la recherche » (PDF/Excel) + dialog détail reçu + `DropdownMenu` 5 items |
| `src/app/api/payments/[id]/receipt/route.ts` | 202 | **MODIFIÉ** — support admin/super_admin (pas de filtre institution), retourne institution+payment+student |

### Fichiers de support (dépendances directes)

| Fichier | Lignes | Rôle |
| --- | ---: | --- |
| `src/app/api/payments/route.ts` | 107 | Liste des paiements (GET) + création (POST) — contexte |
| `src/lib/types.ts` | 609 | Types `Payment`, `ReceiptData`, `ExportMeta`, `CreatePaymentRequest` |
| `src/lib/constants.ts` | 406 | `PAYMENT_TYPES`, `PAYMENT_METHODS`, `PAYMENT_STATUSES`, labels, couleurs |
| `src/lib/fetch-utils.ts` | 33 | Helper `fetchWithAuth()` (headers x-user-id, x-institution-id, x-user-role) |
| `src/lib/api-auth.ts` | 147 | `getInstitutionIdWithFallback()` — résolution institution depuis headers |
| `src/components/ui/dropdown-menu.tsx` | 257 | Composant shadcn/ui DropdownMenu |
| `src/components/ui/dialog.tsx` | 143 | Composant shadcn/ui Dialog (le dialog de détail) |

### Documentation

| Fichier | Rôle |
| --- | --- |
| `README.md` | Ce document |
| `CHANGELOG-ticket.md` | Détail des modifications + correction du bug popup blanc |

### Captures d'écran (vérifications)

| Fichier | Description |
| --- | --- |
| `screenshots/receipt-export-dropdown.png` | Dialog détail avec bouton "Exporter / Imprimer" |
| `screenshots/receipt-export-menu-open.png` | Menu déroulant ouvert avec les 5 options |
| `screenshots/receipt-ticket-print-full.png` | Reçu ticket 80mm rendu dans le popup |
| `screenshots/ticket-popup-fixed.png` | Popup ticket après fix (script embarqué présent) |
| `screenshots/a4-popup-fixed.png` | Popup A4 après fix |

---

## Architecture du reçu

```
┌─────────────────────────────────────────────────────────────┐
│  Page Paiements (payments.tsx)                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Table des paiements (paginée)                        │  │
│  │  clic œil "Voir les détails" → openDetailDialog()     │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Dialog "Détail du paiement"                          │  │
│  │  • fetch GET /api/payments/[id]/receipt               │  │
│  │  • en-tête institution (nom, adresse, tél, email)     │  │
│  │  • spinner pendant le chargement                      │  │
│  │  • bouton "Exporter / Imprimer" → DropdownMenu        │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│              ┌───────────────┼───────────────┐              │
│              ▼               ▼               ▼              │
│      exportReceiptToPDF  exportReceiptToWord  ...           │
│      exportReceiptToExcel  printReceiptA4  printReceiptTicket│
│              │               │               │              │
│              └───────────────┼───────────────┘              │
│                              ▼                              │
│              src/lib/receipt-export.ts                      │
│              (5 fonctions + openPrintWindow)                │
└─────────────────────────────────────────────────────────────┘
```

---

## Flux d'impression (PDF / Word / Excel / A4 / Ticket)

1. **Ouverture du dialog** : `openDetailDialog(payment)` ouvre le dialog et
   fetch `GET /api/payments/[id]/receipt` avec les headers d'auth
   (`x-user-id`, `x-institution-id`, `x-user-role`).

2. **API receipt** (`route.ts`) :
   - Pour admin/super_admin : récupère le paiement par ID seul (pas de filtre
     institution) — cohérent avec `GET /api/payments` qui liste tous les paiements.
   - Pour les autres rôles : conserve le filtre `student.user.institutionId`
     (protection IDOR).
   - Retourne `{ receipt: { receiptNumber, generatedAt, institution, payment, student } }`.

3. **Sélection du canal** : clic sur un item du `DropdownMenu` → appelle la
   fonction correspondante dans `receipt-export.ts` avec `receiptData`.

4. **Sortie** :
   - **PDF** : `jsPDF` génère le PDF, téléchargement via `triggerDownload()`.
   - **Word/Excel** : HTML/SpreadsheetML → Blob → téléchargement.
   - **A4/Ticket** : `openPrintWindow()` ouvre un popup, écrit le HTML autonome,
     le script embarqué `PRINT_TRIGGER_SCRIPT` déclenche `window.print()`.

---

## Correction du bug « popup blanc à l'impression ticket »

### Symptôme
En cliquant sur « Imprimer reçu ticket (80mm) » (ou « Imprimer A4 »), la fenêtre
d'impression ne s'ouvrait pas — parfois une fenêtre popup restait blanche, ou
rien ne se passait (popup bloqué).

### Cause racine
L'approche `window.open('', '_blank')` + `document.write` est fragile :
1. **Popup blockers** (activés par défaut) avalent l'appel silencieusement.
2. Pour les popups `about:blank`, l'opener ne peut pas détecter fiablement
   quand le DOM est prêt → `w.onload`/`w.print()` timing flaky.
3. Certains navigateurs rendent le popup **avant** que le HTML ne soit écrit →
   fenêtre intermédiaire blanche.

### Fix appliqué (`receipt-export.ts`) — Approche iframe cachée

Remplacement de `openPrintWindow()` par `printViaIframe()` :

```js
function printViaIframe(html) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  iframe.onload = () => {
    const win = iframe.contentWindow;
    setTimeout(() => {
      win.focus();
      win.print();              // appelé depuis le parent (fiable)
      setTimeout(cleanup, 1000);
    }, 350);
  };

  const doc = iframe.contentDocument;
  doc.open();
  doc.write(html);              // HTML du reçu + PRINT_TRIGGER_SCRIPT
  doc.close();
}
```

+ `PRINT_TRIGGER_SCRIPT` conservé comme safety net (appel `print()` direct
  depuis l'iframe en plus de l'appel parent, avec fallback 1500ms).

### Avantages
- ❌ **Aucun popup** → impossible à bloquer par un popup-blocker.
- ✅ L'événement `load` de l'iframe fire fiablement après `document.close()`.
- ✅ L'utilisateur ne voit jamais de fenêtre intermédiaire blanche.
- ✅ `window.print()` appelé depuis le contexte parent (plus fiable).

### Vérification end-to-end (Agent Browser)
Spy interceptant `iframe.contentWindow.print()` :
- **Ticket 80mm** : `__iframeCreated === true` + `__iframePrintCalled === true`
  + console "IFRAME PRINT CALLED" × 2 + **aucun popup ouvert**.
- **A4** : mêmes vérifications réussies.

---

## Installation des fichiers

Ces fichiers sont à placer dans un projet Next.js 16 + TypeScript existant.
Dépendances requises (déjà dans `package.json` du projet) :

```json
{
  "jspdf": "^3.0.1",
  "next": "16.1.3",
  "react": "^19",
  "lucide-react": "^0.460.0"
}
```

Les composants `DropdownMenu` et `Dialog` proviennent de **shadcn/ui** (style
New York) et doivent être installés :

```bash
npx shadcn@latest add dropdown-menu dialog
```

---

_Généré le $(date +%Y-%m-%d)._
