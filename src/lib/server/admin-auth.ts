// Server-side module: admin session handling for the dashboard.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Single shared admin password (ADMIN_PASSWORD) → signed, httpOnly session
// cookie valid for 12 hours. Good enough for a demo dashboard; swap for
// Supabase Auth (email + roles) when the backend is deployed.

const COOKIE = "rs_admin";
const TTL_MS = 12 * 60 * 60 * 1000;

export const adminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
  return createHash("sha256").update(`roadster-admin:${s}`).digest();
}
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function checkPassword(candidate: string) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  // compare digests so length differences don't leak through timing
  return safeEqual(createHash("sha256").update(candidate).digest("hex"), createHash("sha256").update(real).digest("hex"));
}

export async function startSession() {
  const exp = String(Date.now() + TTL_MS);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  if (!adminConfigured()) return false;
  const raw = (await cookies()).get(COOKIE)?.value ?? "";
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}
