// ============================================================
// School Management Application - Typed API Client
// All requests use relative URLs for Caddy gateway compatibility
// ============================================================

import type {
  ApiResponse,
  Announcement,
  Attendance,
  Bulletin,
  Class,
  CreateAnnouncementRequest,
  CreateClassRequest,
  CreateGradeRequest,
  CreatePaymentRequest,
  CreateScheduleRequest,
  CreateStudentRequest,
  CreateSubjectRequest,
  CreateTeacherRequest,
  DashboardStats,
  GenerateBulletinRequest,
  Grade,
  LoginRequest,
  LoginResponse,
  MarkAttendanceRequest,
  Message,
  PaginatedResponse,
  Payment,
  RegisterRequest,
  SendMessageRequest,
  Student,
  Subject,
  Teacher,
  UpdateClassRequest,
  UpdateGradeRequest,
  UpdatePaymentRequest,
  UpdateScheduleRequest,
  UpdateStudentRequest,
  UpdateTeacherRequest,
  User,
} from './types';

// ---------- Base Fetch Helper ----------

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      errorBody.error ?? errorBody.message ?? `Erreur serveur (${res.status})`
    );
  }

  return res.json();
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ---------- Query Params Helper ----------

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

// ============================================================
// Auth
// ============================================================

export const authApi = {
  login: (data: LoginRequest) =>
    apiFetch<ApiResponse<LoginResponse>>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  register: (data: RegisterRequest) =>
    apiFetch<ApiResponse<LoginResponse>>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () =>
    apiFetch<ApiResponse<Omit<User, 'password'>>>('/api/auth/me'),
};

// ============================================================
// Students
// ============================================================

export interface StudentListParams {
  search?: string;
  classId?: string;
  page?: number;
  limit?: number;
}

export const studentsApi = {
  list: (params?: StudentListParams) =>
    apiFetch<PaginatedResponse<Student>>(
      `/api/students${buildQuery(params ?? {})}`
    ),

  get: (id: string) =>
    apiFetch<ApiResponse<Student>>(`/api/students/${id}`),

  create: (data: CreateStudentRequest) =>
    apiFetch<ApiResponse<Student>>('/api/students', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateStudentRequest) =>
    apiFetch<ApiResponse<Student>>(`/api/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse<{ id: string }>>(`/api/students/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================================
// Teachers
// ============================================================

export interface TeacherListParams {
  search?: string;
  subject?: string;
  page?: number;
  limit?: number;
}

export const teachersApi = {
  list: (params?: TeacherListParams) =>
    apiFetch<PaginatedResponse<Teacher>>(
      `/api/teachers${buildQuery(params ?? {})}`
    ),

  get: (id: string) =>
    apiFetch<ApiResponse<Teacher>>(`/api/teachers/${id}`),

  create: (data: CreateTeacherRequest) =>
    apiFetch<ApiResponse<Teacher>>('/api/teachers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateTeacherRequest) =>
    apiFetch<ApiResponse<Teacher>>(`/api/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse<{ id: string }>>(`/api/teachers/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================================
// Classes
// ============================================================

export interface ClassListParams {
  search?: string;
  level?: string;
  schoolYear?: string;
  page?: number;
  limit?: number;
}

export const classesApi = {
  list: (params?: ClassListParams) =>
    apiFetch<PaginatedResponse<Class>>(
      `/api/classes${buildQuery(params ?? {})}`
    ),

  get: (id: string) =>
    apiFetch<ApiResponse<Class>>(`/api/classes/${id}`),

  create: (data: CreateClassRequest) =>
    apiFetch<ApiResponse<Class>>('/api/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateClassRequest) =>
    apiFetch<ApiResponse<Class>>(`/api/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse<{ id: string }>>(`/api/classes/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================================
// Grades
// ============================================================

export interface GradeListParams {
  studentId?: string;
  classId?: string;
  subjectId?: string;
  trimester?: string;
  type?: string;
  schoolYear?: string;
  page?: number;
  limit?: number;
}

export const gradesApi = {
  list: (params?: GradeListParams) =>
    apiFetch<PaginatedResponse<Grade>>(
      `/api/grades${buildQuery(params ?? {})}`
    ),

  get: (id: string) =>
    apiFetch<ApiResponse<Grade>>(`/api/grades/${id}`),

  create: (data: CreateGradeRequest) =>
    apiFetch<ApiResponse<Grade>>('/api/grades', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateGradeRequest) =>
    apiFetch<ApiResponse<Grade>>(`/api/grades/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse<{ id: string }>>(`/api/grades/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================================
// Schedules
// ============================================================

export interface ScheduleListParams {
  classId?: string;
  teacherId?: string;
  dayOfWeek?: number;
  page?: number;
  limit?: number;
}

export const schedulesApi = {
  list: (params?: ScheduleListParams) =>
    apiFetch<PaginatedResponse<Schedule>>(
      `/api/schedules${buildQuery(params ?? {})}`
    ),

  get: (id: string) =>
    apiFetch<ApiResponse<Schedule>>(`/api/schedules/${id}`),

  create: (data: CreateScheduleRequest) =>
    apiFetch<ApiResponse<Schedule>>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateScheduleRequest) =>
    apiFetch<ApiResponse<Schedule>>(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse<{ id: string }>>(`/api/schedules/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================================
// Payments
// ============================================================

export interface PaymentListParams {
  studentId?: string;
  status?: string;
  type?: string;
  method?: string;
  schoolYear?: string;
  page?: number;
  limit?: number;
}

export const paymentsApi = {
  list: (params?: PaymentListParams) =>
    apiFetch<PaginatedResponse<Payment>>(
      `/api/payments${buildQuery(params ?? {})}`
    ),

  get: (id: string) =>
    apiFetch<ApiResponse<Payment>>(`/api/payments/${id}`),

  create: (data: CreatePaymentRequest) =>
    apiFetch<ApiResponse<Payment>>('/api/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdatePaymentRequest) =>
    apiFetch<ApiResponse<Payment>>(`/api/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse<{ id: string }>>(`/api/payments/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================================
// Bulletins
// ============================================================

export interface BulletinListParams {
  studentId?: string;
  classId?: string;
  trimester?: string;
  schoolYear?: string;
  page?: number;
  limit?: number;
}

export const bulletinsApi = {
  list: (params?: BulletinListParams) =>
    apiFetch<PaginatedResponse<Bulletin>>(
      `/api/bulletins${buildQuery(params ?? {})}`
    ),

  get: (id: string) =>
    apiFetch<ApiResponse<Bulletin>>(`/api/bulletins/${id}`),

  generate: (data: GenerateBulletinRequest) =>
    apiFetch<ApiResponse<Bulletin>>('/api/bulletins/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============================================================
// Announcements
// ============================================================

export interface AnnouncementListParams {
  type?: string;
  target?: string;
  page?: number;
  limit?: number;
}

export const announcementsApi = {
  list: (params?: AnnouncementListParams) =>
    apiFetch<PaginatedResponse<Announcement>>(
      `/api/announcements${buildQuery(params ?? {})}`
    ),

  get: (id: string) =>
    apiFetch<ApiResponse<Announcement>>(`/api/announcements/${id}`),

  create: (data: CreateAnnouncementRequest) =>
    apiFetch<ApiResponse<Announcement>>('/api/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse<{ id: string }>>(`/api/announcements/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================================
// Messages
// ============================================================

export interface MessageListParams {
  senderId?: string;
  receiverId?: string;
  read?: boolean;
  page?: number;
  limit?: number;
}

export const messagesApi = {
  list: (params?: MessageListParams) =>
    apiFetch<PaginatedResponse<Message>>(
      `/api/messages${buildQuery(params ?? {})}`
    ),

  get: (id: string) =>
    apiFetch<ApiResponse<Message>>(`/api/messages/${id}`),

  send: (data: SendMessageRequest) =>
    apiFetch<ApiResponse<Message>>('/api/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  markRead: (id: string) =>
    apiFetch<ApiResponse<Message>>(`/api/messages/${id}/read`, {
      method: 'PUT',
    }),
};

// ============================================================
// Attendance
// ============================================================

export interface AttendanceListParams {
  studentId?: string;
  date?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const attendanceApi = {
  list: (params?: AttendanceListParams) =>
    apiFetch<PaginatedResponse<Attendance>>(
      `/api/attendance${buildQuery(params ?? {})}`
    ),

  mark: (data: MarkAttendanceRequest | MarkAttendanceRequest[]) =>
    apiFetch<ApiResponse<Attendance | Attendance[]>>('/api/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<MarkAttendanceRequest>) =>
    apiFetch<ApiResponse<Attendance>>(`/api/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ============================================================
// Subjects
// ============================================================

export interface SubjectListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export const subjectsApi = {
  list: (params?: SubjectListParams) =>
    apiFetch<PaginatedResponse<Subject>>(
      `/api/subjects${buildQuery(params ?? {})}`
    ),

  get: (id: string) =>
    apiFetch<ApiResponse<Subject>>(`/api/subjects/${id}`),

  create: (data: CreateSubjectRequest) =>
    apiFetch<ApiResponse<Subject>>('/api/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateSubjectRequest>) =>
    apiFetch<ApiResponse<Subject>>(`/api/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse<{ id: string }>>(`/api/subjects/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================================
// Dashboard
// ============================================================

export const dashboardApi = {
  getStats: () =>
    apiFetch<ApiResponse<DashboardStats>>('/api/dashboard/stats'),
};

// ============================================================
// Seed
// ============================================================

export const seedApi = {
  seedDatabase: () =>
    apiFetch<ApiResponse<{ message: string }>>('/api/seed', {
      method: 'POST',
    }),
};
