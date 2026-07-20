// Same-origin default → HttpOnly cookies work (Vite/nginx proxy /api → backend).
const API_URL = import.meta.env.PUBLIC_API_URL ?? "/api/v1";

export type ApiEnvelope<T> = {
  data: T;
  message: string;
  error: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  memberId?: string;
  role?: string;
  periodId?: string;
};

export type LoginResult = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn: string;
  user: AuthUser;
};

export const PENGURUS_ROLES = [
  "KETUA",
  "WAKIL_KETUA",
  "SEKRETARIS",
  "BENDAHARA",
  "KEPALA_DIVISI",
] as const;

export function isPengurus(role?: string | null) {
  return !!role && (PENGURUS_ROLES as readonly string[]).includes(role);
}

const USER_KEY = "clubit_user";

function clearLegacyTokens() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("accessToken");
  }
}

/** Tokens live in HttpOnly cookies — JS only stores non-secret profile. */
export function setSession(data: LoginResult) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  clearLegacyTokens();
}

export function clearSession() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(USER_KEY);
  }
  clearLegacyTokens();
}

export function getUser(): AuthUser | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY) ?? localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function requireAuth(): AuthUser {
  const u = getUser();
  if (!u) {
    if (typeof window !== "undefined") {
      window.location.href = "/auth/sign-in";
    }
    throw new Error("Unauthorized");
  }
  return u;
}

/** Sync profile from cookie session (role never stale). */
export async function hydrateSession(): Promise<AuthUser | null> {
  try {
    const user = await api<AuthUser>("/auth/me");
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    return user;
  } catch {
    clearSession();
    return null;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiEnvelope<LoginResult>;
      if (json.data?.user) setSession(json.data);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function forceLogin() {
  clearSession();
  if (
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/auth")
  ) {
    window.location.href = "/auth/sign-in";
  }
}

/** Binary fetch with cookies (PDF, ICS). */
export async function fetchAuthed(
  path: string,
  options: RequestInit = {},
  _retried = false,
): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
  });
  if (res.status === 401 && !_retried) {
    const ok = await tryRefresh();
    if (ok) return fetchAuthed(path, options, true);
    forceLogin();
  }
  return res;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  _retried = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      const isAuthPath =
        path.startsWith("/auth/login") ||
        path.startsWith("/auth/register") ||
        path.startsWith("/auth/refresh") ||
        path.startsWith("/auth/forgot") ||
        path.startsWith("/auth/reset") ||
        path.startsWith("/auth/verify") ||
        path.startsWith("/auth/logout");
      if (!isAuthPath && !_retried) {
        const ok = await tryRefresh();
        if (ok) return api<T>(path, options, true);
      }
      if (!isAuthPath) forceLogin();
    }
    throw new Error(json.message || "Request failed");
  }
  return json.data;
}

export const authApi = {
  login: async (
    identifier: string,
    password: string,
    turnstileToken?: string,
  ) => {
    const data = await api<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password, turnstileToken }),
    });
    setSession(data);
    return data;
  },
  register: (payload: {
    email: string;
    username: string;
    password: string;
    fullName: string;
    className?: string;
    turnstileToken?: string;
  }) =>
    api("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  forgotPassword: (email: string, turnstileToken?: string) =>
    api<{ message: string; devCode?: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email, turnstileToken }),
    }),
  verifyCode: (email: string, code: string) =>
    api<{ valid: boolean }>("/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),
  resetPassword: (
    email: string,
    code: string,
    password: string,
    turnstileToken?: string,
  ) =>
    api<{ success: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, code, password, turnstileToken }),
    }),
  logout: async () => {
    try {
      await api("/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      try {
        await api("/auth/logout-cookie", {
          method: "POST",
          body: JSON.stringify({}),
        });
      } catch {
        /* ignore */
      }
    }
    clearSession();
  },
  me: () => api<AuthUser>("/auth/me"),
};

export type Member = {
  id: string;
  fullName: string;
  className?: string | null;
  batchYear?: number | null;
  interests?: string[];
  status: string;
  approvalStatus: string;
  user?: { id: string; email: string; username: string };
  periods?: Array<{
    id: string;
    role: string;
    periodId: string;
    divisionId?: string | null;
    division?: { id: string; name: string } | null;
    period?: { id: string; name: string; isActive: boolean };
  }>;
};

export type Division = { id: string; name: string; description?: string | null };
export type Period = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export type Activity = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadiusM?: number | null;
  qrToken: string;
  qrTokenExpiresAt?: string | null;
  startTime: string;
  endTime: string;
  _count?: { attendances: number };
};

export type Attendance = {
  id: string;
  activityId: string;
  memberId: string;
  checkedInAt: string;
  method: string;
  latitude?: number | null;
  longitude?: number | null;
  member?: { id: string; fullName: string; className?: string | null };
  activity?: Activity;
};

export type AttendanceReport = {
  member: { id: string; fullName: string; className?: string | null };
  totalPastActivities: number;
  present: number;
  absent: number;
  attendanceRatePercent: number;
  attendances: Attendance[];
};

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  _count?: { tasks: number };
  tasks?: Array<{ status: string }>;
};

export type TaskSubmission = {
  id: string;
  taskId: string;
  memberId: string;
  repoUrl?: string | null;
  fileUrl?: string | null;
  demoUrl?: string | null;
  submittedAt: string;
  githubCommitCount?: number | null;
  member?: { id: string; fullName: string };
  feedback?: Array<{
    id: string;
    content: string;
    createdAt: string;
    reviewer?: { id: string; fullName: string };
  }>;
  _count?: { feedback: number };
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  assigneeId?: string | null;
  assignee?: { id: string; fullName: string } | null;
  dueDate?: string | null;
  project?: { id: string; name: string };
  submissions?: TaskSubmission[];
  _count?: { submissions: number };
};

export type MentorPair = {
  id: string;
  mentorId: string;
  menteeId: string;
  mentor?: { id: string; fullName: string };
  mentee?: { id: string; fullName: string };
};

export const membersApi = {
  list: (q?: { status?: string; divisionId?: string; periodId?: string }) => {
    const params = new URLSearchParams();
    if (q?.status) params.set("status", q.status);
    if (q?.divisionId) params.set("divisionId", q.divisionId);
    if (q?.periodId) params.set("periodId", q.periodId);
    const qs = params.toString();
    return api<Member[]>(`/members${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api<Member>(`/members/${id}`),
  approve: (id: string) => api(`/members/${id}/approve`, { method: "POST" }),
  reject: (id: string) => api(`/members/${id}/reject`, { method: "POST" }),
  assign: (id: string, body: { periodId: string; divisionId?: string; role: string }) =>
    api(`/members/${id}/assign-division`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const orgApi = {
  divisions: () => api<Division[]>("/divisions"),
  periods: () => api<Period[]>("/periods"),
};

export const activitiesApi = {
  list: () => api<Activity[]>("/activities"),
  get: (id: string) => api<Activity>(`/activities/${id}`),
  create: (body: {
    title: string;
    description?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    geofenceRadiusM?: number;
    startTime: string;
    endTime: string;
  }) =>
    api<Activity>("/activities", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  rotateQr: (id: string, ttlMinutes?: number) =>
    api<Activity>(`/activities/${id}/rotate-qr`, {
      method: "POST",
      body: JSON.stringify({ ttlMinutes }),
    }),
  checkIn: (body: {
    activityId: string;
    qrToken?: string;
    method?: string;
    latitude?: number;
    longitude?: number;
  }) =>
    api("/attendances/check-in", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  mine: () => api<Attendance[]>("/attendances/me"),
  byActivity: (id: string) =>
    api<Attendance[]>(`/activities/${id}/attendances`),
  report: (memberId?: string) =>
    api<AttendanceReport>(
      `/attendances/report${memberId ? `?memberId=${encodeURIComponent(memberId)}` : ""}`,
    ),
  runReminders: () =>
    api<{ sent: number; activities: number }>(
      "/activities/reminders/run",
      { method: "POST" },
    ),
};

/** Browser geolocation helper */
export function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation tidak didukung browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => reject(new Error(err.message || "Gagal ambil lokasi")),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}

export const projectsApi = {
  list: () => api<Project[]>("/projects"),
  get: (id: string) => api<Project>(`/projects/${id}`),
  create: (body: { name: string; description?: string }) =>
    api<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  tasks: (
    projectId: string,
    q?: { assigneeId?: string; status?: Task["status"] },
  ) => {
    const p = new URLSearchParams();
    if (q?.assigneeId) p.set("assigneeId", q.assigneeId);
    if (q?.status) p.set("status", q.status);
    const qs = p.toString();
    return api<Task[]>(
      `/projects/${projectId}/tasks${qs ? `?${qs}` : ""}`,
    );
  },
  myTasks: () => api<Task[]>("/tasks/me"),
  createTask: (body: {
    projectId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    dueDate?: string;
  }) =>
    api<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateStatus: (id: string, status: Task["status"]) =>
    api<Task>(`/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  assign: (id: string, assigneeId: string) =>
    api(`/tasks/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ assigneeId }),
    }),
  submit: (
    taskId: string,
    body: { repoUrl?: string; fileUrl?: string; demoUrl?: string },
  ) =>
    api<TaskSubmission>(`/tasks/${taskId}/submissions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  taskSubmissions: (taskId: string) =>
    api<TaskSubmission[]>(`/tasks/${taskId}/submissions`),
  getSubmission: (id: string) => api<TaskSubmission>(`/submissions/${id}`),
  feedback: (submissionId: string, content: string) =>
    api(`/submissions/${submissionId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  assignMentor: (mentorId: string, menteeId: string) =>
    api<MentorPair>("/mentor-assignments", {
      method: "POST",
      body: JSON.stringify({ mentorId, menteeId }),
    }),
  myMentors: () => api<MentorPair[]>("/mentor-assignments/me"),
  runDeadlineReminders: () =>
    api<{ sent: number; tasks: number }>("/tasks/reminders/deadlines", {
      method: "POST",
    }),
};

export type ClubEvent = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  location?: string | null;
  capacity?: number | null;
  registrationOpen?: boolean;
  startDate: string;
  endDate?: string | null;
  _count?: {
    registrations: number;
    achievements: number;
    galleries: number;
  };
  achievements?: EventAchievement[];
  galleries?: GalleryItem[];
};

export type EventRegistration = {
  id: string;
  eventId: string;
  memberId: string;
  status: string;
  member?: {
    id: string;
    fullName: string;
    className?: string | null;
    user?: { email: string };
  };
  event?: ClubEvent;
};

export type EventAchievement = {
  id: string;
  title: string;
  rank?: string | null;
  description?: string | null;
  memberId?: string | null;
  member?: { id: string; fullName: string } | null;
  event?: { id: string; title: string; type?: string } | null;
};

export type GalleryItem = {
  id: string;
  imageUrl: string;
  caption?: string | null;
  eventId?: string | null;
  event?: { id: string; title: string } | null;
  createdAt?: string;
};

export type Transaction = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: string | number;
  description: string;
  category?: string | null;
  periodId?: string | null;
  occurredAt: string;
  voidedAt?: string | null;
  recordedBy?: { id: string; fullName: string };
};

export type FinanceReport = {
  periodId: string | null;
  periodName?: string | null;
  income: number;
  expense: number;
  balance: number;
  count: number;
  voidedCount?: number;
  byCategory?: Array<{
    category: string;
    income: number;
    expense: number;
    net: number;
    count: number;
  }>;
  transactions: Transaction[];
  generatedAt?: string;
};

export type FinanceSnapshot = {
  id: string;
  periodId?: string | null;
  income: string | number;
  expense: string | number;
  balance: string | number;
  txCount: number;
  note?: string | null;
  createdAt: string;
  period?: { id: string; name: string } | null;
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export type RecruitmentApp = {
  id: string;
  fullName: string;
  email: string;
  className?: string | null;
  interestNotes?: string | null;
  divisionPreference?: string | null;
  stage: "FORM" | "TEST" | "INTERVIEW" | "ANNOUNCEMENT";
  status: string;
  onboarding?: Record<string, boolean> | null;
  notes?: string | null;
  appliedAt: string;
  updatedAt?: string;
};

export const eventsApi = {
  list: (q?: { type?: string; upcoming?: boolean }) => {
    const p = new URLSearchParams();
    if (q?.type) p.set("type", q.type);
    if (q?.upcoming === true) p.set("upcoming", "true");
    if (q?.upcoming === false) p.set("upcoming", "false");
    const qs = p.toString();
    return api<ClubEvent[]>(`/events${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api<ClubEvent>(`/events/${id}`),
  create: (body: {
    title: string;
    description?: string;
    type: string;
    location?: string;
    capacity?: number;
    registrationOpen?: boolean;
    startDate: string;
    endDate?: string;
  }) =>
    api<ClubEvent>("/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  register: (id: string) =>
    api(`/events/${id}/register`, { method: "POST" }),
  cancelRegister: (id: string) =>
    api(`/events/${id}/register`, { method: "DELETE" }),
  myRegistrations: () =>
    api<EventRegistration[]>("/events/me/registrations"),
  registrations: (id: string) =>
    api<EventRegistration[]>(`/events/${id}/registrations`),
  setRegistrationStatus: (
    eventId: string,
    regId: string,
    status: "APPROVED" | "REJECTED",
  ) =>
    api(`/events/${eventId}/registrations/${regId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  addAchievement: (
    id: string,
    body: {
      title: string;
      rank?: string;
      description?: string;
      memberId?: string;
    },
  ) =>
    api<EventAchievement>(`/events/${id}/achievements`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  achievements: (q?: { memberId?: string; eventId?: string }) => {
    const p = new URLSearchParams();
    if (q?.memberId) p.set("memberId", q.memberId);
    if (q?.eventId) p.set("eventId", q.eventId);
    const qs = p.toString();
    return api<EventAchievement[]>(`/achievements${qs ? `?${qs}` : ""}`);
  },
  addGallery: (id: string, body: { imageUrl: string; caption?: string }) =>
    api<GalleryItem>(`/events/${id}/gallery`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  gallery: (eventId?: string) =>
    api<GalleryItem[]>(
      `/gallery${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`,
    ),
  runReminders: () =>
    api<{ sent: number; events: number }>("/events/reminders/run", {
      method: "POST",
    }),
};

export const financeApi = {
  list: (periodId?: string, includeVoided?: boolean) => {
    const p = new URLSearchParams();
    if (periodId) p.set("periodId", periodId);
    if (includeVoided) p.set("includeVoided", "true");
    const qs = p.toString();
    return api<Transaction[]>(`/transactions${qs ? `?${qs}` : ""}`);
  },
  create: (body: {
    type: "INCOME" | "EXPENSE";
    amount: number;
    description: string;
    category?: string;
    periodId?: string;
    occurredAt?: string;
  }) =>
    api<Transaction>("/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  voidTx: (id: string) =>
    api(`/transactions/${id}/void`, { method: "POST" }),
  report: (periodId?: string) =>
    api<FinanceReport>(
      `/transactions/report${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ""}`,
    ),
  snapshot: (periodId?: string, note?: string) =>
    api<FinanceSnapshot>(
      `/transactions/report/snapshot${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ""}`,
      { method: "POST", body: JSON.stringify({ note }) },
    ),
  snapshots: (periodId?: string) =>
    api<FinanceSnapshot[]>(
      `/transactions/report/snapshots${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ""}`,
    ),
  fetchReportPdfBlob: async (periodId?: string) => {
    const qs = periodId ? `?periodId=${encodeURIComponent(periodId)}` : "";
    const res = await fetchAuthed(`/transactions/report.pdf${qs}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Gagal load PDF");
    }
    return res.blob();
  },
  downloadReportCsv: async (periodId?: string) => {
    const qs = periodId ? `?periodId=${encodeURIComponent(periodId)}` : "";
    const res = await fetchAuthed(`/transactions/report.csv${qs}`);
    if (!res.ok) throw new Error("Gagal export CSV");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-keuangan-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  previewReportPdf: async (periodId?: string) => {
    const blob = await financeApi.fetchReportPdfBlob(periodId);
    return URL.createObjectURL(blob);
  },
  downloadReportPdf: async (periodId?: string) => {
    const blob = await financeApi.fetchReportPdfBlob(periodId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-keuangan-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const communicationApi = {
  announcements: () => api<Announcement[]>("/announcements"),
  createAnnouncement: (body: { title: string; content: string }) =>
    api<Announcement>("/announcements", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  notifications: () => api<AppNotification[]>("/notifications/me"),
  markRead: (id: string) =>
    api(`/notifications/${id}/read`, { method: "PATCH" }),
};

export const recruitmentApi = {
  apply: (body: {
    fullName: string;
    email: string;
    className?: string;
    interestNotes?: string;
    divisionPreference?: string;
    turnstileToken?: string;
  }) =>
    api("/recruitment/apply", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  list: (q?: { status?: string; stage?: string }) => {
    const p = new URLSearchParams();
    if (q?.status) p.set("status", q.status);
    if (q?.stage) p.set("stage", q.stage);
    const qs = p.toString();
    return api<RecruitmentApp[]>(`/recruitment${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api<RecruitmentApp>(`/recruitment/${id}`),
  stats: () =>
    api<Array<{ status: string; stage: string; count: number }>>(
      "/recruitment/stats",
    ),
  setStage: (id: string, stage: string, notes?: string) =>
    api(`/recruitment/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage, notes }),
    }),
  advance: (id: string) =>
    api(`/recruitment/${id}/advance`, { method: "POST" }),
  onboarding: (id: string, checklist: Record<string, boolean>) =>
    api(`/recruitment/${id}/onboarding`, {
      method: "PATCH",
      body: JSON.stringify({ checklist }),
    }),
  approve: (id: string) =>
    api(`/recruitment/${id}/approve`, { method: "POST" }),
  reject: (id: string, notes?: string) =>
    api(`/recruitment/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),
};

export type LearningPath = {
  id: string;
  name: string;
  level: string;
  description?: string | null;
  divisionId?: string | null;
  division?: { id: string; name: string } | null;
  resources?: LearningResource[];
  _count?: { resources: number };
  progress?: { total: number; completed: number; percent: number };
};

export type LearningResource = {
  id: string;
  title: string;
  type: string;
  url: string;
  description?: string | null;
  sortOrder?: number;
  divisionId?: string | null;
  learningPathId?: string | null;
  division?: { id: string; name: string } | null;
  learningPath?: { id: string; name: string } | null;
  completed?: boolean;
};

export type LearningPathSummary = {
  pathId: string;
  name: string;
  level: string;
  total: number;
  completed: number;
  percent: number;
};

export type Election = {
  id: string;
  title: string;
  description?: string | null;
  status: "DRAFT" | "OPEN" | "CLOSED";
  periodId: string;
  endsAt?: string | null;
  period?: { id: string; name: string };
  candidates: Array<{
    id: string;
    memberId: string;
    member?: { id: string; fullName: string };
    _count?: { votes: number };
  }>;
  _count?: { votes: number; candidates?: number };
  totalVotes?: number;
};

export type Poll = {
  id: string;
  question: string;
  closed?: boolean;
  endsAt?: string | null;
  createdAt: string;
  options: Array<{ id: string; label: string; votesCount: number }>;
  _count?: { votes: number };
};

export type Badge = {
  id: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
};

export type LeaderboardRow = {
  memberId: string;
  fullName: string;
  points: number;
  badges: number;
  attendances: number;
  submissions: number;
  achievements: number;
};

export type Certificate = {
  id: string;
  memberId: string;
  title: string;
  fileUrl?: string | null;
  issuedAt: string;
};

export type MyGamification = LeaderboardRow & {
  rank: number | null;
  totalOnBoard: number;
  badgesDetail: Array<{ id: string; name: string; awardedAt: string }>;
  certificates: Certificate[];
  weights: {
    badge: number;
    attendance: number;
    submission: number;
    achievement: number;
  };
};

export const learningApi = {
  paths: (divisionId?: string) =>
    api<LearningPath[]>(
      `/learning-paths${divisionId ? `?divisionId=${encodeURIComponent(divisionId)}` : ""}`,
    ),
  getPath: (id: string) => api<LearningPath>(`/learning-paths/${id}`),
  createPath: (body: {
    name: string;
    level: string;
    description?: string;
    divisionId?: string;
  }) =>
    api<LearningPath>("/learning-paths", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  resources: (q?: { divisionId?: string; pathId?: string }) => {
    const params = new URLSearchParams();
    if (q?.divisionId) params.set("divisionId", q.divisionId);
    if (q?.pathId) params.set("pathId", q.pathId);
    const qs = params.toString();
    return api<LearningResource[]>(`/learning-resources${qs ? `?${qs}` : ""}`);
  },
  createResource: (body: {
    title: string;
    type: string;
    url: string;
    description?: string;
    divisionId?: string;
    learningPathId?: string;
  }) =>
    api<LearningResource>("/learning-resources", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  download: (id: string) =>
    api<{ url: string; title?: string; expiresIn: number }>(
      `/learning-resources/${id}/download`,
    ),
  complete: (id: string) =>
    api(`/learning-resources/${id}/complete`, { method: "POST" }),
  uncomplete: (id: string) =>
    api(`/learning-resources/${id}/complete`, { method: "DELETE" }),
  myProgress: () => api("/learning/progress/me"),
  progressSummary: () =>
    api<LearningPathSummary[]>("/learning/progress/summary"),
};

export const electionsApi = {
  list: () => api<Election[]>("/elections"),
  get: (id: string) => api<Election>(`/elections/${id}`),
  create: (body: {
    periodId: string;
    title: string;
    description?: string;
    endsAt?: string;
  }) =>
    api<Election>("/elections", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  setStatus: (id: string, status: Election["status"]) =>
    api<Election>(`/elections/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  addCandidate: (id: string, memberId: string) =>
    api(`/elections/${id}/candidates`, {
      method: "POST",
      body: JSON.stringify({ memberId }),
    }),
  vote: (id: string, candidateId: string) =>
    api(`/elections/${id}/vote`, {
      method: "POST",
      body: JSON.stringify({ candidateId }),
    }),
  hasVoted: (id: string) =>
    api<{ voted: boolean }>(`/elections/${id}/voted`),
  results: (id: string) => api<Election>(`/elections/${id}/results`),
  polls: () => api<Poll[]>("/polls"),
  createPoll: (body: {
    question: string;
    options: string[];
    endsAt?: string;
  }) =>
    api<Poll>("/polls", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  closePoll: (id: string) =>
    api<Poll>(`/polls/${id}/close`, { method: "POST" }),
  pollDetail: (id: string) => api<Poll>(`/polls/${id}`),
  pollVote: (id: string, optionId: string) =>
    api(`/polls/${id}/vote`, {
      method: "POST",
      body: JSON.stringify({ optionId }),
    }),
};

export const gamificationApi = {
  badges: () => api<Badge[]>("/badges"),
  createBadge: (body: { name: string; description?: string; iconUrl?: string }) =>
    api<Badge>("/badges", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  awardBadge: (memberId: string, badgeId: string) =>
    api(`/members/${memberId}/badges`, {
      method: "POST",
      body: JSON.stringify({ badgeId }),
    }),
  leaderboard: (limit?: number) =>
    api<LeaderboardRow[]>(
      `/leaderboard${limit ? `?limit=${limit}` : ""}`,
    ),
  me: () => api<MyGamification>("/gamification/me"),
  evaluateMe: () =>
    api<{ awarded: string[] }>("/gamification/evaluate/me", {
      method: "POST",
    }),
  evaluate: (memberId: string) =>
    api<{ awarded: string[] }>(`/gamification/evaluate/${memberId}`, {
      method: "POST",
    }),
  generateCertificate: (body: {
    memberId: string;
    title: string;
    fileUrl?: string;
  }) =>
    api<Certificate>("/certificates/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  downloadCertificatePdf: async (id: string) => {
    const res = await fetchAuthed(`/certificates/${id}/pdf`);
    if (!res.ok) throw new Error("Gagal unduh sertifikat");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sertifikat-${id.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  memberCertificates: (memberId: string) =>
    api<Certificate[]>(`/members/${memberId}/certificates`),
};

export type EvaluationSummary = {
  periodId: string;
  totalResponses: number;
  byRole: Array<{ role: string; average: number; count: number }>;
};

export type PeerReview = {
  id: string;
  projectId?: string | null;
  reviewerId: string;
  revieweeId: string;
  score: number;
  comment?: string | null;
  createdAt: string;
  reviewer?: { id: string; fullName: string };
  project?: { id: string; name: string } | null;
};

export type PortfolioMember = {
  id: string;
  fullName: string;
  className?: string | null;
  batchYear?: number | null;
  interests: string[];
  status: string;
  submissions: Array<{
    id: string;
    repoUrl?: string | null;
    demoUrl?: string | null;
    task?: { title: string; project?: { name: string } | null };
  }>;
  achievements: Array<{
    id: string;
    title: string;
    rank?: string | null;
    description?: string | null;
  }>;
  badges: Array<{ badge: { id: string; name: string; description?: string | null } }>;
  certificates: Array<{ id: string; title: string; issuedAt: string }>;
};

export type ShowcaseData = {
  members: Array<{
    id: string;
    fullName: string;
    interests: string[];
    badges: Array<{ badge: { name: string } }>;
  }>;
  achievements: Array<{
    id: string;
    title: string;
    rank?: string | null;
    event?: { id: string; title: string } | null;
  }>;
  events: Array<{
    id: string;
    title: string;
    type: string;
    startDate: string;
  }>;
};

export const evaluationApi = {
  create: (body: {
    periodId: string;
    targetRole: string;
    score: number;
    comment?: string;
  }) =>
    api("/evaluations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  summary: (periodId: string) =>
    api<EvaluationSummary>(
      `/evaluations/summary?periodId=${encodeURIComponent(periodId)}`,
    ),
  peerReview: (body: {
    revieweeId: string;
    projectId?: string;
    score: number;
    comment?: string;
  }) =>
    api("/peer-reviews", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  peerReviewsFor: (memberId: string) =>
    api<PeerReview[]>(`/peer-reviews/${memberId}`),
};

export const portfolioApi = {
  showcase: () => api<ShowcaseData>("/portfolio/showcase"),
  member: (memberId: string) =>
    api<PortfolioMember>(`/portfolio/${memberId}`),
};

export type InventoryItem = {
  id: string;
  name: string;
  condition?: string | null;
  quantity?: number;
  serialNumber?: string | null;
  notes?: string | null;
  loans: Array<{
    id: string;
    status: string;
    memberId: string;
    dueDate?: string | null;
    borrowedAt?: string | null;
    returnedAt?: string | null;
    member?: { id: string; fullName: string };
  }>;
  _count?: { loans: number };
};

export type InventoryLoan = {
  id: string;
  itemId: string;
  memberId: string;
  status: "REQUESTED" | "APPROVED" | "BORROWED" | "RETURNED" | "REJECTED";
  notes?: string | null;
  dueDate?: string | null;
  borrowedAt?: string | null;
  returnedAt?: string | null;
  item?: { id: string; name: string; condition?: string | null };
  member?: { id: string; fullName: string };
};

export const inventoryApi = {
  list: () => api<InventoryItem[]>("/inventory"),
  create: (body: {
    name: string;
    condition?: string;
    quantity?: number;
    serialNumber?: string;
    notes?: string;
  }) =>
    api<InventoryItem>("/inventory", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  requestLoan: (
    itemId: string,
    body?: { dueDate?: string; notes?: string },
  ) =>
    api<InventoryLoan>(`/inventory/${itemId}/loan-request`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  loans: (status?: string) =>
    api<InventoryLoan[]>(
      `/inventory-loans${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  myLoans: () => api<InventoryLoan[]>("/inventory-loans/me"),
  overdue: () => api<InventoryLoan[]>("/inventory-loans/overdue"),
  notifyOverdue: () =>
    api<{ sent: number; overdue: number }>(
      "/inventory-loans/overdue/notify",
      { method: "POST" },
    ),
  approve: (loanId: string) =>
    api(`/inventory-loans/${loanId}/approve`, { method: "POST" }),
  reject: (loanId: string) =>
    api(`/inventory-loans/${loanId}/reject`, { method: "POST" }),
  return: (loanId: string) =>
    api(`/inventory-loans/${loanId}/return`, { method: "POST" }),
};

export const integrationsApi = {
  status: () =>
    api<{
      github: { configured: boolean; webhookPath: string };
      discord: { configured: boolean };
      calendar: { icsPath: string; googleCalendar: { supported: boolean; note: string } };
      whatsapp: { supported: boolean; note: string };
    }>("/integrations/status"),
  discordNotify: (body: { message: string; title?: string }) =>
    api("/integrations/discord/notify", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  downloadIcs: async () => {
    const res = await fetchAuthed("/integrations/calendar/sync.ics");
    if (!res.ok) throw new Error("Gagal unduh kalender");
    return res.blob();
  },
};
