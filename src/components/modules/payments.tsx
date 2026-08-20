'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Plus,
  Smartphone,
  Banknote,
  Building2,
  Eye,
  Loader2,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Receipt,
  Download,
  Pencil,
  Trash2,
  FileText,
  FileType2,
  FileSpreadsheet,
  Printer,
  ReceiptText,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/lib/store';
import { withSchoolYear, getImageUrl } from '@/lib/utils';
import { useAvatarChangedListener } from '@/hooks/use-avatar-refresh';
import {
  exportReceiptToPDF,
  exportReceiptToExcel,
  exportReceiptToWord,
  printReceiptA4,
  printReceiptTicket,
  type ReceiptData,
} from '@/lib/receipt-export';
import {
  exportPaymentsToPDF,
  exportPaymentsToExcel,
  type ExportMeta,
} from '@/lib/payments-export';
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from '@/lib/constants';
import type { Payment, Student } from '@/lib/types';

const MOBILE_PROVIDERS = [
  { value: 'orange', label: 'Orange Money' },
  { value: 'mtn', label: 'MTN Money' },
  { value: 'moov', label: 'Moov Money' },
  { value: 'wave', label: 'Wave' },
];

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('fr-FR')}`;
}

function getMethodIcon(method: string) {
  switch (method) {
    case 'mobile_money': return <Smartphone className="w-4 h-4" />;
    case 'cash': return <Banknote className="w-4 h-4" />;
    case 'bank_transfer': return <Building2 className="w-4 h-4" />;
    default: return <CreditCard className="w-4 h-4" />;
  }
}

export default function PaymentsModule() {
  const addToast = useAppStore((s) => s.addToast);
  const currentUser = useAppStore((s) => s.currentUser);
  const schoolYear = useAppStore((s) => s.schoolYear);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Add dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formStudentId, setFormStudentId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formType, setFormType] = useState<'tuition' | 'registration' | 'exam_fee' | 'other'>('tuition');
  const [formMethod, setFormMethod] = useState<'cash' | 'mobile_money' | 'bank_transfer'>('cash');
  const [formReference, setFormReference] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPaymentDate, setFormPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentSearch, setStudentSearch] = useState('');

  // Mobile Money fields
  const [mmPhone, setMmPhone] = useState('');
  const [mmProvider, setMmProvider] = useState('orange');
  const [mmSimulating, setMmSimulating] = useState(false);

  // Detail dialog
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<'tuition' | 'registration' | 'exam_fee' | 'other'>('tuition');
  const [editMethod, setEditMethod] = useState<'cash' | 'mobile_money' | 'bank_transfer'>('cash');
  const [editStatus, setEditStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [editReference, setEditReference] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [deletePaymentLabel, setDeletePaymentLabel] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Receipt (full data fetched from /api/payments/[id]/receipt when the detail dialog opens)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(withSchoolYear('/api/students', schoolYear));
      const data = await res.json();
      setStudents(data.students || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les élèves');
    }
  }, [addToast, schoolYear]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
      const res = await fetch(withSchoolYear(`/api/payments?${params.toString()}`, schoolYear));
      const data = await res.json();
      setPayments(data.payments || []);
    } catch {
      addToast('error', 'Erreur', 'Impossible de charger les paiements');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, schoolYear, addToast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Re-fetch the payments list whenever an avatar changes elsewhere in the app
  // (e.g. a student's photo is updated in the Students module) so the
  // cache-busted avatar URL is used immediately.
  useAvatarChangedListener(() => { fetchPayments(); }, [fetchPayments]);

  // Client-side filtering
  const filteredPayments = payments.filter((payment) => {
    if (filterMethod && filterMethod !== 'all' && payment.method !== filterMethod) return false;
    if (filterType && filterType !== 'all' && payment.type !== filterType) return false;
    if (searchQuery) {
      const name = payment.student
        ? `${payment.student.firstName} ${payment.student.lastName}`.toLowerCase()
        : '';
      const ref = payment.reference?.toLowerCase() || '';
      const q = searchQuery.toLowerCase();
      if (!name.includes(q) && !ref.includes(q)) return false;
    }
    return true;
  });

  // Pagination logic
  const totalCount = filteredPayments.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex);

  // Build the metadata object passed to the list export utilities.
  // `filteredPayments` already reflects ALL active filters (status / method /
  // type / search query) and is NOT limited to the current page, so the
  // exported document contains every matching record.
  const buildExportMeta = (): ExportMeta => ({
    institutionName: currentUser?.institutionName ?? null,
    schoolYear,
    authorName: currentUser?.name ?? null,
    filters: {
      searchQuery: searchQuery.trim() || undefined,
      status: filterStatus,
      method: filterMethod,
      type: filterType,
    },
  });

  // Export the current search results (full filtered list) to PDF or Excel.
  const handleExportList = (format: 'pdf' | 'excel') => {
    if (filteredPayments.length === 0) {
      addToast({
        type: 'error',
        title: 'Aucun paiement à exporter',
        message: 'Modifiez vos filtres pour afficher des paiements.',
      });
      return;
    }
    const meta = buildExportMeta();
    try {
      if (format === 'pdf') {
        exportPaymentsToPDF(filteredPayments, meta);
        addToast({
          type: 'success',
          title: 'Export PDF généré',
          message: `${filteredPayments.length} paiement(s) exporté(s) en PDF.`,
        });
      } else {
        exportPaymentsToExcel(filteredPayments, meta);
        addToast({
          type: 'success',
          title: 'Export Excel généré',
          message: `${filteredPayments.length} paiement(s) exporté(s) en Excel.`,
        });
      }
    } catch (e) {
      addToast({
        type: 'error',
        title: "Erreur lors de l'export",
        message: e instanceof Error ? e.message : 'Erreur inconnue',
      });
    }
  };

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterMethod, filterType, searchQuery, schoolYear]);

  // Generate page numbers with ellipsis (1 2 3 ... 8 9 10)
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [1];
    const left = Math.max(2, safeCurrentPage - 1);
    const right = Math.min(totalPages - 1, safeCurrentPage + 1);
    if (left > 2) pages.push('ellipsis');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  };

  // Stats
  const totalRevenue = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  const pendingCount = payments.filter((p) => p.status === 'pending').length;
  const mmPercent = payments.length > 0
    ? Math.round((payments.filter((p) => p.method === 'mobile_money').length / payments.length) * 100)
    : 0;
  const currentMonth = new Date().getMonth();
  const completedThisMonth = payments.filter((p) => {
    if (p.status !== 'completed') return false;
    const d = new Date(p.paymentDate || p.createdAt);
    return d.getMonth() === currentMonth;
  }).length;

  const handleAddPayment = async () => {
    if (!formStudentId || !formAmount || !formType || !formMethod) {
      addToast('warning', 'Champs requis', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) {
      addToast('warning', 'Montant invalide', 'Le montant doit être supérieur à 0');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: formStudentId,
          amount,
          type: formType,
          method: formMethod,
          reference: formReference || undefined,
          description: formDescription || undefined,
          paymentDate: formPaymentDate || undefined,
          status: formMethod === 'cash' ? 'completed' : 'pending',
          schoolYear,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      addToast('success', 'Paiement enregistré', 'Le paiement a été enregistré avec succès');
      setAddDialogOpen(false);
      resetForm();
      fetchPayments();
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Impossible d\'enregistrer le paiement');
    } finally {
      setSaving(false);
    }
  };

  const simulateMobileMoney = async () => {
    if (!mmPhone) {
      addToast('warning', 'Numéro requis', 'Veuillez entrer un numéro de téléphone');
      return;
    }
    setMmSimulating(true);
    // Simulate a 2-second delay for mobile money
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setMmSimulating(false);
    addToast('success', 'Paiement Mobile Money', `Simulation réussie via ${MOBILE_PROVIDERS.find(p => p.value === mmProvider)?.label} au ${mmPhone}`);
    setFormReference(`MM-${Date.now()}`);
  };

  const resetForm = () => {
    setFormStudentId('');
    setFormAmount('');
    setFormType('tuition');
    setFormMethod('cash');
    setFormReference('');
    setFormDescription('');
    setFormPaymentDate(new Date().toISOString().split('T')[0]);
    setStudentSearch('');
    setMmPhone('');
    setMmProvider('orange');
  };

  // Open edit dialog pre-filled with payment data
  const openEditDialog = (payment: Payment) => {
    setEditPaymentId(payment.id);
    setEditAmount(String(payment.amount));
    setEditType(payment.type);
    setEditMethod(payment.method);
    setEditStatus(payment.status);
    setEditReference(payment.reference || '');
    setEditDescription(payment.description || '');
    setEditPaymentDate(payment.paymentDate || new Date().toISOString().split('T')[0]);
    setEditDialogOpen(true);
  };

  // Open the detail dialog and fetch the full receipt data (institution + student + payment)
  const openDetailDialog = useCallback(async (payment: Payment) => {
    setDetailPayment(payment);
    setDetailDialogOpen(true);
    setReceiptData(null);
    setReceiptError(null);
    setReceiptLoading(true);
    try {
      // NOTE: we intentionally do NOT pass explicit x-user-id / x-institution-id /
      // x-user-role headers here. The global FetchInterceptor (see
      // src/components/fetch-interceptor.tsx) injects them from the Zustand
      // store on every /api/ call. Passing empty-string values manually (as we
      // did before) blocked the interceptor from filling them in, so on mobile
      // / fresh browsers — where the store can be momentarily un-hydrated —
      // the receipt API received empty headers, fell back to the wrong
      // institution, and returned 404 "Paiement introuvable". Letting the
      // interceptor own the headers guarantees the latest store values are
      // used. The backend route also now resolves the role from x-user-id via
      // a DB lookup as a safety net.
      const res = await fetch(`/api/payments/${payment.id}/receipt`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur serveur');
      }
      const data = await res.json();
      setReceiptData(data.receipt as ReceiptData);
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'Impossible de charger le reçu');
    } finally {
      setReceiptLoading(false);
    }
  }, []);

  // Submit edit (PUT /api/payments/[id])
  const handleEditPayment = async () => {
    if (!editPaymentId) return;
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      addToast('warning', 'Montant invalide', 'Le montant doit être supérieur à 0');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/payments/${editPaymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          type: editType,
          method: editMethod,
          status: editStatus,
          reference: editReference || undefined,
          description: editDescription || undefined,
          paymentDate: editPaymentDate || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      addToast('success', 'Paiement modifié', 'Le paiement a été mis à jour avec succès');
      setEditDialogOpen(false);
      setEditPaymentId(null);
      fetchPayments();
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Impossible de modifier le paiement');
    } finally {
      setSaving(false);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (payment: Payment) => {
    setDeletePaymentId(payment.id);
    const studentName = payment.student
      ? `${payment.student.firstName} ${payment.student.lastName}`
      : 'Élève inconnu';
    setDeletePaymentLabel(`${studentName} — ${formatCurrency(payment.amount)} (${PAYMENT_TYPE_LABELS[payment.type] || payment.type})`);
    setDeleteDialogOpen(true);
  };

  // Submit delete (DELETE /api/payments/[id])
  const handleDeletePayment = async () => {
    if (!deletePaymentId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/payments/${deletePaymentId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      addToast('success', 'Paiement supprimé', 'Le paiement a été supprimé avec succès');
      setDeleteDialogOpen(false);
      setDeletePaymentId(null);
      fetchPayments();
    } catch (error) {
      addToast('error', 'Erreur', error instanceof Error ? error.message : 'Impossible de supprimer le paiement');
    } finally {
      setDeleting(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    if (!studentSearch) return true;
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    return name.includes(studentSearch.toLowerCase());
  });

  // Permissions: admin and super_admin can create / edit / delete payments
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Paiements</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestion des paiements et des factures</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export & print the current search results (full filtered list) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={loading || filteredPayments.length === 0}
                title="Exporter / imprimer les résultats de la recherche actuelle (tous les paiements filtrés, pas seulement la page affichée)"
              >
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Exporter la recherche</span>
                <span className="sm:hidden">Exporter</span>
                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {filteredPayments.length}
                </span>
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Résultats : {filteredPayments.length} paiement(s)
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => handleExportList('pdf')}
                className="cursor-pointer"
              >
                <FileType2 className="w-4 h-4 mr-2 text-red-600" />
                <span>Exporter en PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => handleExportList('excel')}
                className="cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                <span>Exporter en Excel</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin && (
            <Button
              onClick={() => { resetForm(); setAddDialogOpen(true); }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau paiement
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Total revenus</p>
              <p className="text-sm sm:text-lg font-bold text-foreground truncate">{formatCurrency(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-950/50 text-yellow-600 shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">En attente</p>
              <p className="text-sm sm:text-lg font-bold text-foreground">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 shrink-0">
              <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Mobile Money</p>
              <p className="text-sm sm:text-lg font-bold text-foreground">{mmPercent}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-green-50 dark:bg-green-950/50 text-green-600 shrink-0">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Complétés ce mois</p>
              <p className="text-sm sm:text-lg font-bold text-foreground">{completedThisMonth}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {PAYMENT_STATUSES.map((ps) => (
                  <SelectItem key={ps.value} value={ps.value}>{ps.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Méthode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les méthodes</SelectItem>
                {PAYMENT_METHODS.map((pm) => (
                  <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {PAYMENT_TYPES.map((pt) => (
                  <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative col-span-2 sm:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table - Desktop */}
      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CreditCard className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun paiement trouvé</p>
            <p className="text-sm text-muted-foreground mt-1">Modifiez les filtres ou ajoutez un nouveau paiement</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden lg:block overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {paginatedPayments.map((payment) => (
                      <motion.tr
                        key={payment.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={getImageUrl(payment.student?.image, payment.student?.updatedAt)} alt={payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : ''} />
                              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-semibold">
                                {payment.student ? `${payment.student.firstName[0]}${payment.student.lastName[0]}` : '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span>{payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{PAYMENT_TYPE_LABELS[payment.type] || payment.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {getMethodIcon(payment.method)}
                            <span className="text-sm">{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={PAYMENT_STATUS_COLORS[payment.status] || ''}>
                            {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.paymentDate || payment.createdAt?.split('T')[0]}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          {payment.reference || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDetailDialog(payment)}
                              title="Voir les détails"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(payment)}
                                  title="Modifier"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDeleteDialog(payment)}
                                  title="Supprimer"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {paginatedPayments.map((payment) => (
              <motion.div
                key={payment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={getImageUrl(payment.student?.image, payment.student?.updatedAt)} alt={payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : ''} />
                          <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-semibold">
                            {payment.student ? `${payment.student.firstName[0]}${payment.student.lastName[0]}` : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground">
                            {payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : '—'}
                          </p>
                          <p className="text-lg font-bold text-foreground mt-1">{formatCurrency(payment.amount)}</p>
                        </div>
                      </div>
                      <Badge className={PAYMENT_STATUS_COLORS[payment.status] || ''}>
                        {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline">{PAYMENT_TYPE_LABELS[payment.type] || payment.type}</Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        {getMethodIcon(payment.method)}
                        {PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground">
                        {payment.paymentDate || payment.createdAt?.split('T')[0]}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailDialog(payment)}
                        >
                          <Eye className="w-4 h-4 mr-1" /> Détails
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(payment)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              title="Modifier"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(payment)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Items per page + summary */}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Lignes par page:</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(v) => {
                          setPageSize(Number(v));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[80px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <span>
                      Affichage de <strong className="text-foreground">{startIndex + 1}</strong> à{' '}
                      <strong className="text-foreground">{endIndex}</strong> sur{' '}
                      <strong className="text-foreground">{totalCount}</strong> paiement{totalCount > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Page navigation */}
                  {totalPages > 1 && (
                    <Pagination className="mx-0 sm:mx-0 w-full sm:w-auto justify-center sm:justify-end">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (safeCurrentPage > 1) setCurrentPage(safeCurrentPage - 1);
                            }}
                            className={safeCurrentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                        {getPageNumbers().map((p, idx) =>
                          p === 'ellipsis' ? (
                            <PaginationItem key={`ellipsis-${idx}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={p}>
                              <PaginationLink
                                href="#"
                                isActive={p === safeCurrentPage}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setCurrentPage(p);
                                }}
                                className="cursor-pointer"
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        )}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (safeCurrentPage < totalPages) setCurrentPage(safeCurrentPage + 1);
                            }}
                            className={safeCurrentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Add Payment Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Nouveau paiement</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[65vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label>Élève *</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Rechercher un élève..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
                <Select value={formStudentId} onValueChange={setFormStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un élève" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.firstName} {student.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Montant ($) *</Label>
              <Input
                type="number"
                min="0"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type *</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as typeof formType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((pt) => (
                      <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Méthode *</Label>
                <Select value={formMethod} onValueChange={(v) => setFormMethod(v as typeof formMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mobile Money Section */}
            {formMethod === 'mobile_money' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 p-4 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800"
              >
                <p className="text-sm font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Informations Mobile Money
                </p>
                <div className="grid gap-2">
                  <Label className="text-teal-700 dark:text-teal-400">Numéro de téléphone</Label>
                  <Input
                    placeholder="Ex: +243 6XX XXX XXX"
                    value={mmPhone}
                    onChange={(e) => setMmPhone(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-teal-700 dark:text-teal-400">Provider</Label>
                  <Select value={mmProvider} onValueChange={setMmProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOBILE_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-teal-300 text-teal-700 dark:text-teal-400 hover:bg-teal-100"
                  onClick={simulateMobileMoney}
                  disabled={mmSimulating}
                >
                  {mmSimulating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Smartphone className="w-4 h-4 mr-2" />
                  )}
                  {mmSimulating ? 'Simulation en cours...' : 'Simuler le paiement'}
                </Button>
              </motion.div>
            )}

            <div className="grid gap-2">
              <Label>Référence</Label>
              <Input
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
                placeholder="Numéro de référence"
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Description optionnelle"
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label>Date de paiement</Label>
              <Input
                type="date"
                value={formPaymentDate}
                onChange={(e) => setFormPaymentDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAddPayment} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Detail Dialog (Receipt view with export & print) */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Détail du paiement
            </DialogTitle>
          </DialogHeader>
          {detailPayment && (
            <div className="space-y-4 py-2">
              {/* Institution header (from receipt data) */}
              {receiptData && (
                <div className="rounded-md bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 px-3 py-2">
                  <p className="text-sm font-bold text-teal-700 dark:text-teal-400">
                    {receiptData.institution.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[
                      receiptData.institution.address,
                      receiptData.institution.phone && `Tél : ${receiptData.institution.phone}`,
                      receiptData.institution.email,
                    ].filter(Boolean).join(' • ')}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                    Reçu N° {receiptData.receiptNumber}
                  </p>
                </div>
              )}

              {/* Loading state */}
              {receiptLoading && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement du reçu...
                </div>
              )}

              {/* Error state */}
              {receiptError && !receiptLoading && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  {receiptError} — l'affichage ci-dessous utilise les données locales.
                </div>
              )}

              {/* Receipt-like format */}
              <div className="text-center border-b pb-4">
                <p className="text-sm text-muted-foreground">REÇU DE PAIEMENT</p>
                <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(detailPayment.amount)}</p>
                <Badge className={PAYMENT_STATUS_COLORS[detailPayment.status] || '' + ' mt-2'}>
                  {PAYMENT_STATUS_LABELS[detailPayment.status] || detailPayment.status}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Élève</span>
                  <span className="font-semibold flex items-center gap-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={getImageUrl(detailPayment.student?.image, detailPayment.student?.updatedAt)} alt={detailPayment.student ? `${detailPayment.student.firstName} ${detailPayment.student.lastName}` : ''} />
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px] font-semibold">
                        {detailPayment.student ? `${detailPayment.student.firstName[0]}${detailPayment.student.lastName[0]}` : '?'}
                      </AvatarFallback>
                    </Avatar>
                    {detailPayment.student ? `${detailPayment.student.firstName} ${detailPayment.student.lastName}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-semibold">{PAYMENT_TYPE_LABELS[detailPayment.type] || detailPayment.type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Méthode</span>
                  <span className="font-semibold flex items-center gap-1.5">
                    {getMethodIcon(detailPayment.method)}
                    {PAYMENT_METHOD_LABELS[detailPayment.method] || detailPayment.method}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-semibold">{detailPayment.paymentDate || '—'}</span>
                </div>
                {detailPayment.reference && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Référence</span>
                    <span className="font-mono text-xs">{detailPayment.reference}</span>
                  </div>
                )}
                {detailPayment.description && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Description</span>
                    <span className="text-right max-w-[200px]">{detailPayment.description}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Année scolaire</span>
                  <span className="font-semibold">{detailPayment.schoolYear}</span>
                </div>
              </div>

              <Separator />
              <p className="text-xs text-muted-foreground text-center">
                Créé le {new Date(detailPayment.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Fermer</Button>
            {isAdmin && detailPayment && (
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setDetailDialogOpen(false);
                  openEditDialog(detailPayment);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            )}

            {/* Export & print dropdown */}
            {detailPayment && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={receiptLoading || !receiptData}
                    title={receiptLoading ? 'Chargement du reçu...' : 'Exporter / Imprimer le reçu'}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exporter / Imprimer
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <ReceiptText className="w-4 h-4 text-emerald-600" />
                    Reçu {receiptData?.receiptNumber || ''}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => receiptData && exportReceiptToPDF(receiptData)}
                    disabled={!receiptData}
                    className="cursor-pointer"
                  >
                    <FileType2 className="w-4 h-4 mr-2 text-red-600" />
                    <span>Exporter en PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => receiptData && exportReceiptToWord(receiptData)}
                    disabled={!receiptData}
                    className="cursor-pointer"
                  >
                    <FileText className="w-4 h-4 mr-2 text-blue-600" />
                    <span>Exporter en Word</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => receiptData && exportReceiptToExcel(receiptData)}
                    disabled={!receiptData}
                    className="cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                    <span>Exporter en Excel</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => receiptData && printReceiptA4(receiptData)}
                    disabled={!receiptData}
                    className="cursor-pointer"
                  >
                    <Printer className="w-4 h-4 mr-2 text-slate-700" />
                    <span>Imprimer (A4)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => receiptData && printReceiptTicket(receiptData)}
                    disabled={!receiptData}
                    className="cursor-pointer"
                  >
                    <ReceiptText className="w-4 h-4 mr-2 text-orange-600" />
                    <span>Imprimer reçu ticket (80mm)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Modifier le paiement
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[65vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label>Montant ($) *</Label>
              <Input
                type="number"
                min="0"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type *</Label>
                <Select value={editType} onValueChange={(v) => setEditType(v as typeof editType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((pt) => (
                      <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Méthode *</Label>
                <Select value={editMethod} onValueChange={(v) => setEditMethod(v as typeof editMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Statut *</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as typeof editStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((ps) => (
                    <SelectItem key={ps.value} value={ps.value}>{ps.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Référence</Label>
              <Input
                value={editReference}
                onChange={(e) => setEditReference(e.target.value)}
                placeholder="Numéro de référence"
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description optionnelle"
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label>Date de paiement</Label>
              <Input
                type="date"
                value={editPaymentDate}
                onChange={(e) => setEditPaymentDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleEditPayment} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Supprimer le paiement
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce paiement ? Cette action est irréversible.
              <br />
              <span className="mt-2 inline-block rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                {deletePaymentLabel}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeletePayment();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer définitivement
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
