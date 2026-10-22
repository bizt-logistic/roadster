"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { checkPassword, endSession, isSignedIn, startSession } from "@/lib/auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (path: string, msg: string, kind: "ok" | "error"): never => redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);

async function requireSession() {
  if (!(await isSignedIn())) redirect("/login");
}

/** Run an admin operation on the site and come back with a flash message. */
async function run(path: string, action: string, payload: Record<string, unknown>) {
  await requireSession();
  let res: { ok: boolean; message?: string; error?: string };
  try {
    res = await api.act(action, payload);
  } catch (e) {
    return back(path, e instanceof ApiError ? e.message : "Request failed.", "error");
  }
  revalidatePath("/", "layout");
  return res.ok ? back(path, res.message ?? "Done.", "ok") : back(path, res.error ?? "Something went wrong.", "error");
}

/**
 * Generic form action: hidden fields `_action` (site operation) and `_back`
 * (where to return); every other field is sent as the payload. Repeated
 * fields (checkbox groups) become arrays.
 */
export async function adminAction(form: FormData) {
  const action = str(form, "_action");
  const path = str(form, "_back").startsWith("/") ? str(form, "_back") : "/";
  if (!/^[a-zA-Z]+$/.test(action)) back(path, "Unknown action.", "error");
  const payload: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    if (key.startsWith("_") || key.startsWith("$")) continue;
    const all = form.getAll(key).map((v) => String(v));
    payload[key] = all.length > 1 ? all : all[0];
  }
  await run(path, action, payload);
}

// ── session ────────────────────────────────────────────────────────────────
export async function login(form: FormData) {
  if (!checkPassword(str(form, "password"))) back("/login", "Incorrect password.", "error");
  await startSession();
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

// ── payments setup ─────────────────────────────────────────────────────────
export async function addWallet(form: FormData) {
  await run("/payments", "addWallet", { network: str(form, "network"), address: str(form, "address"), label: str(form, "label") });
}
export async function toggleWallet(form: FormData) {
  await run("/payments", "toggleWallet", { id: str(form, "id") });
}
export async function addSampleWallets() {
  await run("/payments", "addSampleWallets", {});
}
export async function addBank(form: FormData) {
  await run("/payments", "addBank", {
    bankName: str(form, "bankName"), accountName: str(form, "accountName"),
    accountNumber: str(form, "accountNumber"), currency: str(form, "currency"),
  });
}
export async function toggleBank(form: FormData) {
  await run("/payments", "toggleBank", { id: str(form, "id") });
}
export async function saveRates(form: FormData) {
  await run("/payments", "saveRates", { btcUsd: str(form, "btcUsd"), ethUsd: str(form, "ethUsd") });
}

// ── reservations ───────────────────────────────────────────────────────────
export async function confirmInstallment(form: FormData) {
  const id = str(form, "orderId");
  await run(`/orders/${id}`, "confirmInstallment", { orderId: id, n: Number(str(form, "n")), txHash: str(form, "txHash") });
}
export async function rejectSubmission(form: FormData) {
  const id = str(form, "orderId");
  await run(`/orders/${id}`, "rejectSubmission", { orderId: id, n: Number(str(form, "n")) });
}
export async function cancelOrder(form: FormData) {
  const id = str(form, "orderId");
  await run(`/orders/${id}`, "cancelOrder", { orderId: id, reason: str(form, "reason") });
}
