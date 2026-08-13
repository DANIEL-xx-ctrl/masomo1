// ============================================================
// School Management Application - TypeScript Types
// Aligned with Prisma schema models
// ============================================================

// ---------- Base / Utility Types ----------

export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent' | 'staff';

export type Gender = 'M' | 'F' | string;

// Status for students and teachers (active = currently enrolled/employed)
export type PersonStatus = 'active' | 'abandoned' | 'migrated' | 'deceased';

export type GradeType = 'devoir' | 'examen' | 'controle';

export type Trimester = '1er' | '2eme' | '3eme';

export type PaymentType = 'tuition' | 'registration' | 'exam_fee' | 'other';

export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer';

export type PaymentStatus = 'pending' | 'completed' | 'failed';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type AnnouncementType = 'general' | 'urgent' | 'academic' | 'event';

export type AnnouncementTarget = 'all' | 'teachers' | 'students' | 'parents';

export type ModuleKey =
  | 'dashboard'
  | 'students'
  | 'teachers'
  | 'parents'
  | 'staff'
  | 'classes'
  | 'schedule'
  | 'grades'
  | 'bulletins'
  | 'attendance'
  | 'homework'
  | 'payments'
  | 'communication'
  | 'messages'
  | 'school-calendar'
  | 'super-admin'
  | 'online-users'
  | 'settings';

// Attachment kind stored on a Message row.
export type MessageAttachmentType = 'image' | 'video' | 'audio' | 'file';

// ---------- Core Domain Models ----------

export interface SuperAdmin {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
}

export interface Institution {
  id: string;
  name: string;
  password: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  currentYear: string;
  active: boolean;
}

export interface User {
  id: string;
  email: string;
  username: string | null;
  password: string;
  name: string;
  role: UserRole;
  avatar: string | null;
  phone: string | null;
  userCode: string | null;
  institutionId: string | null;
  institutionName?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  // Optional profile relations — populated by the /api/auth/login
  // endpoint (which includes student/teacher/parent/staff). Present at
  // runtime on the currentUser stored in Zustand; declared optional so
  // modules can read e.g. currentUser.teacher?.id safely.
  student?: Student;
  teacher?: Teacher;
  parent?: Parent;
  staff?: Staff;
}

export interface Student {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  enrollmentDate: string;
  parentContact: string | null;
  classId: string | null;
  parentPhone: string | null;
  image: string | null;
  status: PersonStatus;
  statusDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations (optional when populated)
  user?: User;
  class?: Class;
  grades?: Grade[];
  payments?: Payment[];
  attendances?: Attendance[];
  bulletins?: Bulletin[];
}

export interface Teacher {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  subject: string;
  phone: string | null;
  qualification: string | null;
  hireDate: string;
  image: string | null;
  status: PersonStatus;
  statusDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  user?: User;
  schedules?: Schedule[];
  classes?: ClassTeacher[];
}

export interface Parent {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  user?: User;
}

export interface Staff {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  fonction: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  user?: User;
}

export interface Class {
  id: string;
  name: string;
  level: string;
  section: string | null;
  capacity: number;
  schoolYear: string;
  room: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  students?: Student[];
  teachers?: ClassTeacher[];
  schedules?: Schedule[];
}

export interface ClassTeacher {
  id: string;
  classId: string;
  teacherId: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  class?: Class;
  teacher?: Teacher;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
  createdAt: string;
  updatedAt: string;
  // Relations
  grades?: Grade[];
}

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  classId: string | null;
  teacherId: string | null;
  value: number;
  maxValue: number;
  type: GradeType;
  trimester: Trimester;
  schoolYear: string;
  comment: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  student?: Student;
  subject?: Subject;
}

export interface Schedule {
  id: string;
  classId: string;
  teacherId: string | null;
  subject: string;
  dayOfWeek: number; // 1=Monday ... 5=Friday
  startTime: string;
  endTime: string;
  room: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  class?: Class;
  teacher?: Teacher;
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  type: PaymentType;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  description: string | null;
  schoolYear: string;
  paymentDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  student?: Student;
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  student?: Student;
}

export interface Bulletin {
  id: string;
  studentId: string;
  classId: string | null;
  trimester: Trimester;
  schoolYear: string;
  average: number | null;
  rank: number | null;
  appreciation: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  student?: Student;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  target: AnnouncementTarget;
  authorId: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
  // Relations
  author?: User;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  schoolYear: string;
  attachmentUrl?: string | null;
  attachmentType?: MessageAttachmentType | string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  sender?: User;
  receiver?: User;
}

export interface SchoolConfig {
  id: string;
  schoolName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  currentYear: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Dashboard Stats ----------

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalRevenue: number;
  pendingPayments: number;
  attendanceRate: number;
  averageGrade: number;
  recentActivity: RecentActivity[];
  revenueByMonth: RevenueByMonth[];
  gradeDistribution: GradeDistribution[];
  attendanceByDay: AttendanceByDay[];
}

export interface RecentActivity {
  id: string;
  type: 'enrollment' | 'payment' | 'grade' | 'announcement' | 'attendance';
  description: string;
  timestamp: string;
}

export interface RevenueByMonth {
  month: string;
  amount: number;
}

export interface GradeDistribution {
  range: string;
  count: number;
}

export interface AttendanceByDay {
  day: string;
  present: number;
  absent: number;
  late: number;
}

// ---------- API Request/Response Types ----------

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password'>;
  token?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface CreateStudentRequest {
  userId?: string;
  email?: string;
  password?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  enrollmentDate?: string;
  parentContact?: string;
  classId?: string;
  parentPhone?: string;
  image?: string;
}

export interface UpdateStudentRequest {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  parentContact?: string;
  classId?: string | null;
  parentPhone?: string;
  image?: string | null;
}

export interface CreateTeacherRequest {
  userId?: string;
  email?: string;
  password?: string;
  firstName: string;
  lastName: string;
  subject: string;
  phone?: string;
  qualification?: string;
  hireDate?: string;
  classIds?: string[];
  image?: string;
}

export interface UpdateTeacherRequest {
  firstName?: string;
  lastName?: string;
  subject?: string;
  phone?: string;
  qualification?: string;
  classIds?: string[];
  image?: string | null;
}

export interface CreateClassRequest {
  name: string;
  level: string;
  section?: string;
  capacity?: number;
  schoolYear?: string;
  room?: string;
}

export interface UpdateClassRequest {
  name?: string;
  level?: string;
  section?: string;
  capacity?: number;
  room?: string;
}

export interface CreateGradeRequest {
  studentId: string;
  subjectId: string;
  classId?: string;
  teacherId?: string;
  value: number;
  maxValue?: number;
  type: GradeType;
  trimester: Trimester;
  schoolYear?: string;
  comment?: string;
  date: string;
}

export interface UpdateGradeRequest {
  value?: number;
  maxValue?: number;
  type?: GradeType;
  comment?: string;
  date?: string;
}

export interface CreateScheduleRequest {
  classId: string;
  teacherId?: string;
  subject: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
}

export interface UpdateScheduleRequest {
  teacherId?: string;
  subject?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  room?: string;
}

export interface CreatePaymentRequest {
  studentId: string;
  amount: number;
  type: PaymentType;
  method: PaymentMethod;
  status?: PaymentStatus;
  reference?: string;
  description?: string;
  schoolYear?: string;
  paymentDate?: string;
}

export interface UpdatePaymentRequest {
  amount?: number;
  type?: PaymentType;
  method?: PaymentMethod;
  status?: PaymentStatus;
  reference?: string;
  description?: string;
  paymentDate?: string;
}

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  type?: AnnouncementType;
  target?: AnnouncementTarget;
  priority?: number;
}

export interface SendMessageRequest {
  receiverId: string;
  content: string;
  attachmentUrl?: string;
  attachmentType?: MessageAttachmentType;
  attachmentName?: string;
  attachmentSize?: number;
}

export interface MarkAttendanceRequest {
  studentId: string;
  date: string;
  status: AttendanceStatus;
  comment?: string;
}

export interface CreateSubjectRequest {
  name: string;
  code: string;
  coefficient?: number;
}

export interface GenerateBulletinRequest {
  studentId: string;
  classId?: string;
  trimester: Trimester;
  schoolYear?: string;
}

// ---------- Toast / Notification ----------

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

// Notification types mirror the `type` column of the Notification model.
// They drive the icon + color used in the notification bell dropdown.
export type NotificationType =
  | 'info'
  | 'warning'
  | 'success'
  | 'error'
  | 'payment'
  | 'attendance'
  | 'announcement'
  | 'event'
  | 'homework'
  | 'message';

export interface Notification {
  id: string;
  userId?: string | null;
  title: string;
  message: string;
  type: NotificationType | string;
  category: string;
  link?: string | null; // ModuleKey used to navigate when the notification is clicked
  linkParams?: string | null; // e.g. homework.id for deep linking
  icon?: string | null; // Lucide icon name override
  read: boolean;
  institutionId: string;
  schoolYear: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  createdAt: string;
  updatedAt: string;
}
