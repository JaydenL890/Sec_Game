import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/game-action`;

async function callAction(action: string, body: Record<string, unknown>) {
  const res = await fetch(`${FUNCTION_URL}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const gameApi = {
  teamRegister: (name: string, pin: string, color: string, memberNames: string[]) =>
    callAction('team-register', { name, pin, color, memberNames }),
  teamLogin: (name: string, pin: string) =>
    callAction('team-login', { name, pin }),
  hostLogin: (name: string, pin: string) =>
    callAction('host-login', { name, pin }),
  adminLogin: (username: string, pin: string) =>
    callAction('admin-login', { username, pin }),
  resetPin: (teamId: string, newPin: string) =>
    callAction('reset-pin', { teamId, newPin }),
  roll: (teamId: string, sessionToken?: string) => callAction('roll', { teamId, sessionToken }),
  scan: (token: string, hostId: string, reward: number) =>
    callAction('scan', { token, hostId, reward }),
  pinVerify: (pin: string, hostId: string, reward: number) =>
    callAction('pin-verify', { pin, hostId, reward }),
  purchase: (teamId: string, shopItemId: string, sessionToken?: string) =>
    callAction('purchase', { teamId, shopItemId, sessionToken }),
  adjust: (teamId: string, amount: number, reason: string) =>
    callAction('adjust', { teamId, amount, reason }),
  skipRest: (teamId: string, sessionToken?: string) => callAction('skip-rest', { teamId, sessionToken }),
  clearRest: (teamId: string, sessionToken?: string) => callAction('clear-rest', { teamId, sessionToken }),
};

export { supabase };
