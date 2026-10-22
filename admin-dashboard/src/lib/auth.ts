// Session handling: one shared admin password (ADMIN_PASSWORD) → signed,
// httpOnly cookie valid for 12 hours. Swap for Supabase Auth with per-user
// roles when the backend is deployed.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "rs_admin_dash";
const TTL_MS = 12 * 60 * 60 * 1000;

export const configured = () => Boolean(process.env.ADMIN_PASSWORD);

const secret = () =>
  createHash("sha256").update(`roadster-admin-dashboard:${process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ""}`).digest();
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");
const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function checkPassword(candidate: string) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const h = (s: string) => createHash("sha256").update(s).digest("hex");
  return same(h(candidate), h(real));
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

export async function isSignedIn() {
  if (!configured()) return false;
  const [exp, sig] = ((await cookies()).get(COOKIE)?.value ?? "").split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, sign(exp));
}
