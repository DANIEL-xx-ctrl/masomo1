// ============================================================
// School Management Application - Constants (Francophone)
// ============================================================

import type {
  AnnouncementTarget,
  AnnouncementType,
  AttendanceStatus,
  GradeType,
  ModuleKey,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  Trimester,
  UserRole,
} from './types';

// ---------- Navigation Items ----------

export interface NavItem {
  key: ModuleKey;
  label: string;
  icon: string; // Lucide icon name
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard' },
  { key: 'students', label: 'Élèves', icon: 'GraduationCap' },
  { key: 'teachers', label: 'Enseignants', icon: 'Users' },
  { key: 'parents', label: 'Parents', icon: 'Heart' },
  { key: 'staff', label: 'Personnel', icon: 'Briefcase' },
  { key: 'classes', label: 'Classes', icon: 'School' },
  { key: 'schedule', label: 'Emploi du temps', icon: 'CalendarDays' },
  { key: 'grades', label: 'Notes', icon: 'FileText' },
  { key: 'bulletins', label: 'Bulletins', icon: 'ClipboardList' },
  { key: 'attendance', label: 'Présence', icon: 'ClipboardCheck' },
  { key: 'homework', label: 'Devoirs', icon: 'BookOpen' },
  { key: 'payments', label: 'Paiements', icon: 'CreditCard' },
  { key: 'communication', label: 'Communication', icon: 'MessageSquare' },
  { key: 'messages', label: 'Messagerie', icon: 'MessagesSquare' },
  { key: 'school-calendar', label: 'Calendrier scolaire', icon: 'Calendar' },
  { key: 'super-admin', label: 'Super Admin', icon: 'Shield' },
  { key: 'online-users', label: 'Connectés', icon: 'Radio' },
  { key: 'settings', label: 'Paramètres', icon: 'Settings' },
];

// ---------- Role Definitions ----------

export interface RoleDefinition {
  value: UserRole;
  label: string;
  description: string;
}

export const ROLES: RoleDefinition[] = [
  { value: 'super_admin', label: 'Super Admin', description: 'Accès complet à toutes les institutions' },
  { value: 'admin', label: 'Administrateur', description: 'Accès complet à toutes les fonctionnalités' },
  { value: 'teacher', label: 'Enseignant', description: 'Gestion des notes et emplois du temps' },
  { value: 'student', label: 'Élève', description: 'Consultation des notes et emploi du temps' },
  { value: 'parent', label: 'Parent', description: 'Suivi de la scolarité des enfants' },
  { value: 'staff', label: 'Personnel', description: 'Gestion administrative' },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrateur',
  teacher: 'Enseignant',
  student: 'Élève',
  parent: 'Parent',
  staff: 'Personnel',
};

// ---------- Grade Types ----------

export interface GradeTypeDefinition {
  value: GradeType;
  label: string;
}

export const GRADE_TYPES: GradeTypeDefinition[] = [
  { value: 'devoir', label: 'Devoir' },
  { value: 'examen', label: 'Examen' },
  { value: 'controle', label: 'Contrôle' },
];

export const GRADE_TYPE_LABELS: Record<GradeType, string> = {
  devoir: 'Devoir',
  examen: 'Examen',
  controle: 'Contrôle',
};

// ---------- Payment Types ----------

export interface PaymentTypeDefinition {
  value: PaymentType;
  label: string;
}

export const PAYMENT_TYPES: PaymentTypeDefinition[] = [
  { value: 'tuition', label: 'Frais de scolarité' },
  { value: 'registration', label: 'Frais d\'inscription' },
  { value: 'exam_fee', label: 'Frais d\'examen' },
  { value: 'other', label: 'Autres' },
];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  tuition: 'Frais de scolarité',
  registration: "Frais d'inscription",
  exam_fee: "Frais d'examen",
  other: 'Autres',
};

// ---------- Payment Methods ----------

export interface PaymentMethodDefinition {
  value: PaymentMethod;
  label: string;
  icon: string;
}

export const PAYMENT_METHODS: PaymentMethodDefinition[] = [
  { value: 'cash', label: 'Espèces', icon: 'Banknote' },
  { value: 'mobile_money', label: 'Mobile Money', icon: 'Smartphone' },
  { value: 'bank_transfer', label: 'Virement bancaire', icon: 'Building2' },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement bancaire',
};

// ---------- Payment Statuses ----------

export interface PaymentStatusDefinition {
  value: PaymentStatus;
  label: string;
  color: string; // Tailwind color class for badges
}

export const PAYMENT_STATUSES: PaymentStatusDefinition[] = [
  { value: 'pending', label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'completed', label: 'Complété', color: 'bg-green-100 text-green-800' },
  { value: 'failed', label: 'Échoué', color: 'bg-red-100 text-red-800' },
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'En attente',
  completed: 'Complété',
  failed: 'Échoué',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

// ---------- Attendance Statuses ----------

export interface AttendanceStatusDefinition {
  value: AttendanceStatus;
  label: string;
  color: string;
}

export const ATTENDANCE_STATUSES: AttendanceStatusDefinition[] = [
  { value: 'present', label: 'Présent', color: 'bg-green-100 text-green-800' },
  { value: 'absent', label: 'Absent', color: 'bg-red-100 text-red-800' },
  { value: 'late', label: 'En retard', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'excused', label: 'Excusé', color: 'bg-blue-100 text-blue-800' },
];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Présent',
  absent: 'Absent',
  late: 'En retard',
  excused: 'Excusé',
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  late: 'bg-yellow-100 text-yellow-800',
  excused: 'bg-blue-100 text-blue-800',
};

// ---------- Days of the Week (French) ----------

export interface DayDefinition {
  value: number; // 1 = Monday ... 5 = Friday (matches Schedule.dayOfWeek)
  short: string;
  label: string;
}

export const DAYS_OF_WEEK: DayDefinition[] = [
  { value: 1, short: 'Lun', label: 'Lundi' },
  { value: 2, short: 'Mar', label: 'Mardi' },
  { value: 3, short: 'Mer', label: 'Mercredi' },
  { value: 4, short: 'Jeu', label: 'Jeudi' },
  { value: 5, short: 'Ven', label: 'Vendredi' },
];

export const DAY_LABELS: Record<number, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
};

export const DAY_SHORT_LABELS: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
};

// ---------- Trimesters (French) ----------

export interface TrimesterDefinition {
  value: Trimester;
  label: string;
}

export const TRIMESTERS: TrimesterDefinition[] = [
  { value: '1er', label: '1er Trimestre' },
  { value: '2eme', label: '2ème Trimestre' },
  { value: '3eme', label: '3ème Trimestre' },
];

export const TRIMESTER_LABELS: Record<Trimester, string> = {
  '1er': '1er Trimestre',
  '2eme': '2ème Trimestre',
  '3eme': '3ème Trimestre',
};

// ---------- Class Levels (Francophone System) ----------

export interface ClassLevelDefinition {
  value: string;
  label: string;
  cycle: string;
}

export const CLASS_LEVELS: ClassLevelDefinition[] = [
  // Cycle primaire
  { value: 'CP', label: 'Cours Préparatoire (CP)', cycle: 'Primaire' },
  { value: 'CE1', label: 'Cours Élémentaire 1 (CE1)', cycle: 'Primaire' },
  { value: 'CE2', label: 'Cours Élémentaire 2 (CE2)', cycle: 'Primaire' },
  { value: 'CM1', label: 'Cours Moyen 1 (CM1)', cycle: 'Primaire' },
  { value: 'CM2', label: 'Cours Moyen 2 (CM2)', cycle: 'Primaire' },
  // Collège
  { value: '6ème', label: '6ème', cycle: 'Collège' },
  { value: '5ème', label: '5ème', cycle: 'Collège' },
  { value: '4ème', label: '4ème', cycle: 'Collège' },
  { value: '3ème', label: '3ème (Brevet)', cycle: 'Collège' },
  // Lycée
  { value: '2nde', label: '2nde', cycle: 'Lycée' },
  { value: '1ère', label: '1ère', cycle: 'Lycée' },
  { value: 'Terminale', label: 'Terminale (Baccalauréat)', cycle: 'Lycée' },
];

export const CLASS_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  CLASS_LEVELS.map((l) => [l.value, l.label])
);

// ---------- Announcement Types ----------

export interface AnnouncementTypeDefinition {
  value: AnnouncementType;
  label: string;
  color: string;
}

export const ANNOUNCEMENT_TYPES: AnnouncementTypeDefinition[] = [
  { value: 'general', label: 'Général', color: 'bg-gray-100 text-gray-800' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' },
  { value: 'academic', label: 'Académique', color: 'bg-blue-100 text-blue-800' },
  { value: 'event', label: 'Événement', color: 'bg-green-100 text-green-800' },
];

export const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  general: 'Général',
  urgent: 'Urgent',
  academic: 'Académique',
  event: 'Événement',
};

// ---------- Announcement Targets ----------

export interface AnnouncementTargetDefinition {
  value: AnnouncementTarget;
  label: string;
}

export const ANNOUNCEMENT_TARGETS: AnnouncementTargetDefinition[] = [
  { value: 'all', label: 'Tout le monde' },
  { value: 'teachers', label: 'Enseignants' },
  { value: 'students', label: 'Élèves' },
  { value: 'parents', label: 'Parents' },
];

export const ANNOUNCEMENT_TARGET_LABELS: Record<AnnouncementTarget, string> = {
  all: 'Tout le monde',
  teachers: 'Enseignants',
  students: 'Élèves',
  parents: 'Parents',
};

// ---------- Schedule Time Slots ----------

export const TIME_SLOTS: string[] = [
  '07:00', '07:30',
  '08:00', '08:30',
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00', '17:30',
  '18:00', '18:30',
  '19:00', '19:30',
];

// ---------- Default School Year ----------

export const CURRENT_SCHOOL_YEAR = '2024-2025';

// ---------- School Years ----------

export const SCHOOL_YEARS = [
  '2023-2024',
  '2024-2025',
  '2025-2026',
];

// ---------- Pagination Defaults ----------

export const DEFAULT_PAGE_SIZE = 20;

// ---------- Max Grade Value (French system: out of 20) ----------

export const MAX_GRADE_VALUE = 20;

// ---------- Gender Options ----------

export const GENDERS = [
  { value: 'M', label: 'Masculin' },
  { value: 'F', label: 'Féminin' },
];

export const GENDER_LABELS: Record<string, string> = {
  M: 'Masculin',
  F: 'Féminin',
};

// ---------- Person Status (students & teachers) ----------

export const PERSON_STATUSES = [
  { value: 'active', label: 'Actif' },
  { value: 'abandoned', label: 'Abandonné' },
  { value: 'migrated', label: 'Migré' },
  { value: 'deceased', label: 'Décédé' },
] as const;

export const PERSON_STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  abandoned: 'Abandonné',
  migrated: 'Migré',
  deceased: 'Décédé',
};

// Tailwind class fragments per status for badges
export const PERSON_STATUS_BADGE_CLASSES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  abandoned: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  migrated: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800',
  deceased: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
};

// "All" option used by filter dropdowns
export const PERSON_STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Actifs uniquement' },
  { value: 'all', label: 'Tous les statuts' },
  { value: 'abandoned', label: 'Abandonnés' },
  { value: 'migrated', label: 'Migrés' },
  { value: 'deceased', label: 'Décédés' },
] as const;

// Lucide icon name per notification type. Used by the notification bell
// dropdown to pick an icon when a notification has no explicit `icon` field.
// Keep the names in sync with NOTIFICATION_ICON_MAP in notification-dropdown.tsx.
export const NOTIFICATION_TYPE_ICONS: Record<string, string> = {
  info: 'Info',
  warning: 'AlertTriangle',
  success: 'CheckCircle',
  error: 'XCircle',
  payment: 'CreditCard',
  attendance: 'ClipboardCheck',
  announcement: 'Megaphone',
  event: 'Calendar',
  homework: 'BookOpen',
  message: 'MessageSquare',
};
