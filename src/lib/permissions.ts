// ============================================================
// Role-Based Access Control (RBAC) - Permissions System
// ============================================================

import type { UserRole, ModuleKey } from './types'

// ---------- Permission Types ----------

export type Permission =
  | 'students.view'
  | 'students.create'
  | 'students.edit'
  | 'students.delete'
  | 'teachers.view'
  | 'teachers.create'
  | 'teachers.edit'
  | 'teachers.delete'
  | 'staff.view'
  | 'staff.create'
  | 'staff.edit'
  | 'staff.delete'
  | 'classes.view'
  | 'classes.create'
  | 'classes.edit'
  | 'classes.delete'
  | 'schedule.view'
  | 'schedule.create'
  | 'schedule.edit'
  | 'schedule.delete'
  | 'grades.view'
  | 'grades.create'
  | 'grades.edit'
  | 'grades.delete'
  | 'attendance.view'
  | 'attendance.create'
  | 'attendance.edit'
  | 'attendance.delete'
  | 'homework.view'
  | 'homework.create'
  | 'homework.edit'
  | 'homework.delete'
  | 'bulletins.view'
  | 'bulletins.create'
  | 'bulletins.edit'
  | 'payments.view'
  | 'payments.create'
  | 'payments.edit'
  | 'payments.delete'
  | 'communication.view'
  | 'communication.create'
  | 'settings.view'
  | 'settings.edit'
  | 'dashboard.view'

// ---------- Role-Permission Matrix ----------

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // Admin has full access to everything
    'dashboard.view',
    'students.view', 'students.create', 'students.edit', 'students.delete',
    'teachers.view', 'teachers.create', 'teachers.edit', 'teachers.delete',
    'staff.view', 'staff.create', 'staff.edit', 'staff.delete',
    'classes.view', 'classes.create', 'classes.edit', 'classes.delete',
    'schedule.view', 'schedule.create', 'schedule.edit', 'schedule.delete',
    'grades.view', 'grades.create', 'grades.edit', 'grades.delete',
    'bulletins.view', 'bulletins.create', 'bulletins.edit',
    'payments.view', 'payments.create', 'payments.edit', 'payments.delete',
    'communication.view', 'communication.create',
    'settings.view', 'settings.edit',
  ],
  teacher: [
    // Teachers can view most things, manage grades, attendance, homework,
    // and students within their own classes (class-ownership is enforced
    // server-side via getTeacherClassIds).
    'dashboard.view',
    'students.view', 'students.create', 'students.edit', 'students.delete',
    'teachers.view',
    'staff.view',
    'classes.view',
    'schedule.view', 'schedule.create', 'schedule.edit',
    'grades.view', 'grades.create', 'grades.edit', 'grades.delete',
    'attendance.view', 'attendance.create', 'attendance.edit',
    'homework.view', 'homework.create', 'homework.edit', 'homework.delete',
    'bulletins.view', 'bulletins.create',
    'payments.view',
    'communication.view', 'communication.create',
    'settings.view',
  ],
  student: [
    // Students can only VIEW their own data - no create/edit/delete
    'dashboard.view',
    'students.view',
    'teachers.view',
    'staff.view',
    'classes.view',
    'schedule.view',
    'grades.view',
    'bulletins.view',
    'payments.view',
    'communication.view',
    'settings.view',
  ],
  parent: [
    // Parents can view their children's data
    'dashboard.view',
    'students.view',
    'teachers.view',
    'staff.view',
    'classes.view',
    'schedule.view',
    'grades.view',
    'bulletins.view',
    'payments.view',
    'communication.view',
    'settings.view',
  ],
  staff: [
    // Staff can view most things, limited create/edit
    'dashboard.view',
    'students.view',
    'teachers.view',
    'staff.view',
    'classes.view',
    'schedule.view',
    'grades.view',
    'bulletins.view',
    'payments.view', 'payments.create',
    'attendance.view',
    'communication.view', 'communication.create',
    'settings.view',
  ],
}

// ---------- Module Visibility by Role ----------

export const MODULE_VISIBILITY: Record<UserRole, ModuleKey[]> = {
  admin: [
    'dashboard',
    'students',
    'teachers',
    'staff',
    'classes',
    'schedule',
    'grades',
    'bulletins',
    'payments',
    'events',
    'communication',
    'settings',
  ],
  teacher: [
    'dashboard',
    'students',
    'teachers',
    'staff',
    'classes',
    'schedule',
    'grades',
    'bulletins',
    'payments',
    'events',
    'communication',
    'settings',
  ],
  student: [
    // Students can VIEW all modules but cannot create/edit/delete
    'dashboard',
    'students',
    'teachers',
    'staff',
    'classes',
    'schedule',
    'grades',
    'bulletins',
    'payments',
    'events',
    'communication',
    'settings',
  ],
  parent: [
    // Parents can VIEW all modules but cannot create/edit/delete
    'dashboard',
    'students',
    'teachers',
    'staff',
    'classes',
    'schedule',
    'grades',
    'bulletins',
    'payments',
    'events',
    'communication',
    'settings',
  ],
  staff: [
    'dashboard',
    'students',
    'teachers',
    'staff',
    'classes',
    'schedule',
    'grades',
    'bulletins',
    'payments',
    'events',
    'communication',
    'settings',
  ],
}

// ---------- Helper Functions ----------

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Check if a role can perform a specific action on a module
 */
export function canCreate(role: UserRole | undefined | null, module: ModuleKey): boolean {
  return hasPermission(role, `${module}.create` as Permission)
}

export function canEdit(role: UserRole | undefined | null, module: ModuleKey): boolean {
  return hasPermission(role, `${module}.edit` as Permission)
}

export function canDelete(role: UserRole | undefined | null, module: ModuleKey): boolean {
  return hasPermission(role, `${module}.delete` as Permission)
}

export function canView(role: UserRole | undefined | null, module: ModuleKey): boolean {
  return hasPermission(role, `${module}.view` as Permission)
}

/**
 * Check if a module is visible for a given role
 */
export function isModuleVisible(role: UserRole | undefined | null, moduleKey: ModuleKey): boolean {
  if (!role) return false
  return MODULE_VISIBILITY[role]?.includes(moduleKey) ?? false
}

/**
 * Get list of visible modules for a role
 */
export function getVisibleModules(role: UserRole | undefined | null): ModuleKey[] {
  if (!role) return []
  return MODULE_VISIBILITY[role] ?? []
}

/**
 * Check if the user is a student
 */
export function isStudent(role: UserRole | undefined | null): boolean {
  return role === 'student'
}

/**
 * Check if the user is an admin
 */
export function isAdmin(role: UserRole | undefined | null): boolean {
  return role === 'admin'
}

/**
 * Check if the user is a teacher
 */
export function isTeacher(role: UserRole | undefined | null): boolean {
  return role === 'teacher'
}

// ---------- API Route Protection ----------

/**
 * Check if a user role is allowed to perform a write operation on a resource
 */
export function canWriteResource(role: UserRole | undefined | null, resource: string, action: 'create' | 'update' | 'delete'): boolean {
  if (!role) return false
  const permission = `${resource}.${action === 'update' ? 'edit' : action}` as Permission
  return hasPermission(role, permission)
}
