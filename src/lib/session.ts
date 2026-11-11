export type Role = 'team' | 'host' | 'admin';

export interface StoredSession {
  role: Role;
  id: string;
  token: string;
  stationId?: string;
}

const STORAGE_KEY = 'diya_monopoly_session';

export function getStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.role && parsed.id && parsed.token) return parsed as StoredSession;
    return null;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: StoredSession) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function parseRoute(): { role: Role | null; page: string | null } {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) return { role: null, page: null };
  if (parts[0] === 'team' || parts[0] === 'host' || parts[0] === 'admin') {
    return { role: parts[0] as Role, page: parts[1] ?? null };
  }
  return { role: null, page: null };
}

export function navigate(path: string) {
  window.location.hash = path;
}

const INTRO_KEY = 'diya_monopoly_intro_seen';

export function hasSeenIntro(): boolean {
  return sessionStorage.getItem(INTRO_KEY) === 'true';
}

export function markIntroSeen() {
  sessionStorage.setItem(INTRO_KEY, 'true');
}

export function clearIntroSeen() {
  sessionStorage.removeItem(INTRO_KEY);
}

// A fresh open (new tab, duplicated tab, or a new person at the same device) starts signed out on the home page;
// only a page reload keeps the current person's session.
export function resetForFreshOpen() {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === 'reload') return;
  clearSession();
  clearIntroSeen();
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
