const API_URL = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

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
  accessToken: string;
  refreshToken: string;
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

export function requireAuth(): AuthUser {
  const u = getUser();
  if (!u || !getToken()) {
    if (typeof window !== "undefined") {
      window.location.href = "/auth/sign-in";
    }
    throw new Error("Unauthorized");
  }
  return u;
}

function getToken() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("accessToken");
}

export function setSession(data: LoginResult) {
  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem("user", JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

export function getUser(): AuthUser | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      clearSession();
      if (!window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth/sign-in";
      }
    }
    throw new Error(json.message || "Request failed");
  }
  return json.data;
}

export const authApi = {
  login: (identifier: string, password: string, turnstileToken?: string) =>
    api<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password, turnstileToken }),
    }),
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
  qrToken: string;
  startTime: string;
  endTime: string;
};

export type Attendance = {
  id: string;
  activityId: string;
  memberId: string;
  checkedInAt: string;
  method: string;
  member?: { id: string; fullName: string };
  activity?: Activity;
};

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  _count?: { tasks: number };
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
  create: (body: {
    title: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
  }) =>
    api<Activity>("/activities", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  checkIn: (body: { activityId: string; qrToken?: string; method?: string }) =>
    api("/attendances/check-in", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  mine: () => api<Attendance[]>("/attendances/me"),
  byActivity: (id: string) => api<Attendance[]>(`/activities/${id}/attendances`),
};

export const projectsApi = {
  list: () => api<Project[]>("/projects"),
  create: (body: { name: string; description?: string }) =>
    api<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  tasks: (projectId: string) => api<Task[]>(`/projects/${projectId}/tasks`),
  createTask: (body: {
    projectId: string;
    title: string;
    description?: string;
    assigneeId?: string;
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
};

export type ClubEvent = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  startDate: string;
  endDate?: string | null;
};

export type EventRegistration = {
  id: string;
  eventId: string;
  memberId: string;
  status: string;
  member?: { id: string; fullName: string; user?: { email: string } };
};

export type Transaction = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: string | number;
  description: string;
  periodId?: string | null;
  occurredAt: string;
  recordedBy?: { id: string; fullName: string };
};

export type FinanceReport = {
  periodId: string | null;
  income: number;
  expense: number;
  balance: number;
  count: number;
  transactions: Transaction[];
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
  status: string;
  appliedAt: string;
};

export const eventsApi = {
  list: () => api<ClubEvent[]>("/events"),
  create: (body: {
    title: string;
    description?: string;
    type: string;
    startDate: string;
    endDate?: string;
  }) =>
    api<ClubEvent>("/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  register: (id: string) =>
    api(`/events/${id}/register`, { method: "POST" }),
  registrations: (id: string) =>
    api<EventRegistration[]>(`/events/${id}/registrations`),
  addAchievement: (
    id: string,
    body: { title: string; rank?: string; description?: string; memberId?: string },
  ) =>
    api(`/events/${id}/achievements`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  gallery: () =>
    api<Array<{ id: string; imageUrl: string; caption?: string | null }>>("/gallery"),
};

export const financeApi = {
  list: (periodId?: string) =>
    api<Transaction[]>(
      `/transactions${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ""}`,
    ),
  create: (body: {
    type: "INCOME" | "EXPENSE";
    amount: number;
    description: string;
    periodId?: string;
    occurredAt?: string;
  }) =>
    api<Transaction>("/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  report: (periodId?: string) =>
    api<FinanceReport>(
      `/transactions/report${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ""}`,
    ),
  fetchReportPdfBlob: async (periodId?: string) => {
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("accessToken")
        : null;
    const qs = periodId ? `?periodId=${encodeURIComponent(periodId)}` : "";
    const res = await fetch(`${API_URL}/transactions/report.pdf${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Gagal load PDF");
    }
    return res.blob();
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
    turnstileToken?: string;
  }) =>
    api("/recruitment/apply", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  list: () => api<RecruitmentApp[]>("/recruitment"),
  approve: (id: string) =>
    api(`/recruitment/${id}/approve`, { method: "POST" }),
  reject: (id: string) =>
    api(`/recruitment/${id}/reject`, { method: "POST" }),
};

export type LearningPath = {
  id: string;
  name: string;
  level: string;
  divisionId?: string | null;
  division?: { id: string; name: string } | null;
  resources?: LearningResource[];
};

export type LearningResource = {
  id: string;
  title: string;
  type: string;
  url: string;
  divisionId?: string | null;
  learningPathId?: string | null;
  division?: { id: string; name: string } | null;
  learningPath?: { id: string; name: string } | null;
};

export type Election = {
  id: string;
  title: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  periodId: string;
  period?: { id: string; name: string };
  candidates: Array<{
    id: string;
    memberId: string;
    member?: { id: string; fullName: string };
    _count?: { votes: number };
  }>;
};

export type Poll = {
  id: string;
  question: string;
  createdAt: string;
  options: Array<{ id: string; label: string; votesCount: number }>;
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

export const learningApi = {
  paths: () => api<LearningPath[]>("/learning-paths"),
  createPath: (body: { name: string; level: string; divisionId?: string }) =>
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
    divisionId?: string;
    learningPathId?: string;
  }) =>
    api<LearningResource>("/learning-resources", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  download: (id: string) =>
    api<{ url: string; expiresIn: number }>(`/learning-resources/${id}/download`),
};

export const electionsApi = {
  list: () => api<Election[]>("/elections"),
  create: (body: { periodId: string; title: string }) =>
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
  results: (id: string) => api<Election>(`/elections/${id}/results`),
  polls: () => api<Poll[]>("/polls"),
  createPoll: (body: { question: string; options: string[] }) =>
    api<Poll>("/polls", {
      method: "POST",
      body: JSON.stringify(body),
    }),
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
  leaderboard: () => api<LeaderboardRow[]>("/leaderboard"),
  generateCertificate: (body: {
    memberId: string;
    title: string;
    fileUrl?: string;
  }) =>
    api<Certificate>("/certificates/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
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
  loans: Array<{
    id: string;
    status: string;
    memberId: string;
    borrowedAt?: string | null;
    returnedAt?: string | null;
    member?: { id: string; fullName: string };
  }>;
};

export type InventoryLoan = {
  id: string;
  itemId: string;
  memberId: string;
  status: "REQUESTED" | "APPROVED" | "BORROWED" | "RETURNED" | "REJECTED";
  borrowedAt?: string | null;
  returnedAt?: string | null;
  item?: { id: string; name: string; condition?: string | null };
  member?: { id: string; fullName: string };
};

export const inventoryApi = {
  list: () => api<InventoryItem[]>("/inventory"),
  create: (body: { name: string; condition?: string }) =>
    api<InventoryItem>("/inventory", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  requestLoan: (itemId: string) =>
    api<InventoryLoan>(`/inventory/${itemId}/loan-request`, { method: "POST" }),
  loans: (status?: string) =>
    api<InventoryLoan[]>(
      `/inventory-loans${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  myLoans: () => api<InventoryLoan[]>("/inventory-loans/me"),
  approve: (loanId: string) =>
    api(`/inventory-loans/${loanId}/approve`, { method: "POST" }),
  reject: (loanId: string) =>
    api(`/inventory-loans/${loanId}/reject`, { method: "POST" }),
  return: (loanId: string) =>
    api(`/inventory-loans/${loanId}/return`, { method: "POST" }),
};
