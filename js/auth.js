import { verifyAdminLogin } from "./database.js";

const SESSION_KEY = "alumni1976AdminSession";

export function getAdminSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    if (!session?.email || !session?.id) return null;
    return session;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return Boolean(getAdminSession());
}

export async function login(email, password) {
  const admin = await verifyAdminLogin(email, password);
  if (!admin) return null;

  const session = {
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    login_at: new Date().toISOString()
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}
