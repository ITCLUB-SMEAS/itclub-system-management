const API_URL = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

type Envelope<T> = { data: T; message: string; error: string | null };

async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  const json = (await res.json()) as Envelope<T>;
  return json.data;
}

export type PublicPortfolio = {
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

export type PublicShowcase = {
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

export function fetchShowcase() {
  return publicGet<PublicShowcase>("/portfolio/showcase");
}

export function fetchMemberPortfolio(memberId: string) {
  return publicGet<PublicPortfolio>(`/portfolio/${memberId}`);
}
