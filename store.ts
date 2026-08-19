import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModuleKey, ToastMessage, ToastType, User } from './types';

// ---------- Store State Interface ----------

interface AppState {
  // Navigation
  activeModule: ModuleKey;
  setActiveModule: (module: ModuleKey) => void;

  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;

  // Super Admin profile extra fields (User type doesn't have 'address')
  superAdminAddress: string | null;
  updateSuperAdmin: (fields: Partial<{ name: string; email: string; phone: string | null; address: string | null; avatar: string | null }>) => void;

  // Active Institution Context (used by Super Admin to browse an institution's data)
  activeInstitutionId: string | null;
  activeInstitutionName: string | null;
  activeInstitutionPassword: string | null;
  setInstitution: (id: string, name: string, password: string) => void;
  clearInstitution: () => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // School Year
  schoolYear: string;
  setSchoolYear: (year: string) => void;
  availableSchoolYears: string[];
  setAvailableSchoolYears: (years: string[]) => void;

  // Notifications / Toast
  toasts: ToastMessage[];
  addToast: (type: ToastType, title: string, description?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

// ---------- Helper ----------

let toastCounter = 0;

function generateToastId(): string {
  toastCounter += 1;
  return `toast-${Date.now()}-${toastCounter}`;
}

// ---------- Store ----------

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Navigation
      activeModule: 'dashboard',
      setActiveModule: (module) => set({ activeModule: module }),

      // Auth
      currentUser: null,
      isAuthenticated: false,
      login: (user) =>
        set({
          currentUser: user,
          isAuthenticated: true,
          // Clear any stale institution browsing context from a previous
          // session. This is critical when a super admin signs up as a new
          // institution admin (or switches accounts) — the old
          // activeInstitutionId could point to a deleted/invalid institution,
          // causing all subsequent API calls to 404 silently.
          activeInstitutionId: null,
          activeInstitutionName: null,
          activeInstitutionPassword: null,
        }),
      logout: () =>
        set({
          currentUser: null,
          isAuthenticated: false,
          activeModule: 'dashboard',
          superAdminAddress: null,
          activeInstitutionId: null,
          activeInstitutionName: null,
          activeInstitutionPassword: null,
        }),

      // Super Admin profile extra fields
      superAdminAddress: null,
      updateSuperAdmin: (fields) =>
        set((state) => {
          if (!state.currentUser) return {};
          const updates: Partial<User> = {};
          if (fields.name !== undefined) updates.name = fields.name;
          if (fields.email !== undefined) updates.email = fields.email;
          if (fields.phone !== undefined) updates.phone = fields.phone;
          if (fields.avatar !== undefined) updates.avatar = fields.avatar;
          const extraUpdates: Partial<AppState> = {};
          if (fields.address !== undefined) extraUpdates.superAdminAddress = fields.address;
          return {
            currentUser: { ...state.currentUser, ...updates },
            ...extraUpdates,
          };
        }),

      // Active Institution Context
      activeInstitutionId: null,
      activeInstitutionName: null,
      activeInstitutionPassword: null,
      setInstitution: (id, name, password) =>
        set({
          activeInstitutionId: id,
          activeInstitutionName: name,
          activeInstitutionPassword: password,
        }),
      clearInstitution: () =>
        set({
          activeInstitutionId: null,
          activeInstitutionName: null,
          activeInstitutionPassword: null,
        }),

      // UI
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // School Year
      schoolYear: '2024-2025',
      setSchoolYear: (year) => set({ schoolYear: year }),
      availableSchoolYears: ['2024-2025'],
      setAvailableSchoolYears: (years) => set({ availableSchoolYears: years }),

      // Notifications / Toast
      toasts: [],
      addToast: (type, title, description, duration) => {
        const id = generateToastId();
        const toast: ToastMessage = { id, type, title, description, duration };
        set((state) => ({ toasts: [...state.toasts, toast] }));

        // Auto-remove after duration (default 5 seconds)
        const timeout = duration ?? 5000;
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
        }, timeout);
      },
      removeToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
      clearToasts: () => set({ toasts: [] }),
    }),
    {
      name: 'masomo-storage',
      // Only persist auth state and sidebar preference (not toasts)
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
        activeModule: state.activeModule,
        sidebarOpen: state.sidebarOpen,
        schoolYear: state.schoolYear,
        availableSchoolYears: state.availableSchoolYears,
        superAdminAddress: state.superAdminAddress,
        activeInstitutionId: state.activeInstitutionId,
        activeInstitutionName: state.activeInstitutionName,
        activeInstitutionPassword: state.activeInstitutionPassword,
      }),
    }
  )
);
