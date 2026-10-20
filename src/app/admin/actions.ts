"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NETWORKS, SAMPLE_WALLETS, isTxHash, validateAddress, type Network } from "@/lib/commerce/crypto";
import { getRepo, recompute } from "@/lib/server/repo";
import { checkPassword, endSession, isAdmin, startSession } from "@/lib/server/admin-auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (path: string, msg: string, kind: "error" | "ok" = "error"): never =>
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

// ── session ────────────────────────────────────────────────────────────────
export async function login(form: FormData) {
  if (!checkPassword(str(form, "password"))) back("/admin/login", "Incorrect password.");
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

// ── receiving wallets (watch-only addresses) ───────────────────────────────
export async function addWallet(form: FormData) {
  await requireAdmin();
  const network = str(form, "network") as Network;
  if (!(network in NETWORKS)) back("/admin/payments", "Choose a network.");
  const v = validateAddress(network, str(form, "address"));
  if (!v.ok) back("/admin/payments", v.error);
  const repo = getRepo();
  const address = (v as { ok: true; address: string }).address;
  if ((await repo.listWallets()).some((w) => w.address.toLowerCase() === address.toLowerCase())) {
    back("/admin/payments", "That address is already added.");
  }
  await repo.saveWallet({
    id: randomUUID(), network, address, label: str(form, "label").slice(0, 60) || NETWORKS[network].label,
    active: true, createdAt: new Date().toISOString(),
  });
  revalidatePath("/admin/payments");
  back("/admin/payments", "Receiving address added.", "ok");
}

export async function toggleWallet(form: FormData) {
  await requireAdmin();
  const repo = getRepo();
  const w = (await repo.listWallets()).find((x) => x.id === str(form, "id"));
  if (w) await repo.saveWallet({ ...w, active: !w.active });
  revalidatePath("/admin/payments");
}

export async function addSampleWallets() {
  await requireAdmin();
  const repo = getRepo();
  const have = await repo.listWallets();
  for (const s of SAMPLE_WALLETS) {
    if (have.some((w) => w.address === s.address)) continue;
    await repo.saveWallet({ id: randomUUID(), ...s, active: true, createdAt: new Date().toISOString() });
  }
  revalidatePath("/admin/payments");
  back("/admin/payments", "Sample testnet addresses added — replace them with your own.", "ok");
}

// ── bank accounts ──────────────────────────────────────────────────────────
export async function addBank(form: FormData) {
  await requireAdmin();
  const bankName = str(form, "bankName"), accountName = str(form, "accountName"), accountNumber = str(form, "accountNumber");
  const currency = str(form, "currency") === "USD" ? "USD" : "NGN";
  if (bankName.length < 2 || accountName.length < 2) back("/admin/payments", "Enter the bank and account name.");
  if (!/^[0-9A-Z -]{6,34}$/i.test(accountNumber)) back("/admin/payments", "Enter a valid account number / IBAN.");
  await getRepo().saveBank({
    id: randomUUID(), bankName: bankName.slice(0, 60), accountName: accountName.slice(0, 80), accountNumber,
    currency, active: true, createdAt: new Date().toISOString(),
  });
  revalidatePath("/admin/payments");
  back("/admin/payments", "Bank account added.", "ok");
}

export async function toggleBank(form: FormData) {
  await requireAdmin();
  const repo = getRepo();
  const b = (await repo.listBanks()).find((x) => x.id === str(form, "id"));
  if (b) await repo.saveBank({ ...b, active: !b.active });
  revalidatePath("/admin/payments");
}

// ── rates ──────────────────────────────────────────────────────────────────
export async function saveRates(form: FormData) {
  await requireAdmin();
  const n = (k: string) => Number(str(form, k).replace(/,/g, ""));
  const btcUsd = n("btcUsd"), ethUsd = n("ethUsd"), ngnPerUsd = n("ngnPerUsd");
  if (![btcUsd, ethUsd, ngnPerUsd].every((x) => Number.isFinite(x) && x > 0)) back("/admin/payments", "Rates must be positive numbers.");
  await getRepo().saveSettings({ btcUsd, ethUsd, ngnPerUsd, updatedAt: new Date().toISOString() });
  revalidatePath("/admin/payments");
  back("/admin/payments", "Rates saved. New reservations lock these rates.", "ok");
}

// ── order processing ───────────────────────────────────────────────────────
export async function confirmInstallment(form: FormData) {
  await requireAdmin();
  const id = str(form, "orderId"), n = Number(str(form, "n")), tx = str(form, "txHash");
  const path = `/admin/orders/${id}`;
  const repo = getRepo();
  const order = await repo.getOrder(id);
  if (!order) back("/admin/orders", "Order not found.");
  const dest = order!.destination;
  if (dest?.kind === "wallet" && tx && !isTxHash(dest.network, tx)) back(path, "That transaction hash doesn't match the network.");
  await repo.updateOrder(id, (o) => {
    const inst = o.schedule.find((s) => s.n === n);
    if (!inst || inst.status === "paid") return;
    inst.status = "paid";
    inst.paidAt = new Date().toISOString();
    if (tx) inst.txHash = tx;
    o.events.push({ at: inst.paidAt, type: "payment_confirmed", note: `Installment ${n} confirmed${tx ? ` · tx ${tx.slice(0, 12)}…` : ""}`, by: "admin" });
    recompute(o);
    if (o.status === "paid") o.events.push({ at: inst.paidAt, type: "fully_paid", note: "Reservation fully paid", by: "system" });
  });
  revalidatePath(path);
  revalidatePath("/admin");
  back(path, `Installment ${n} confirmed.`, "ok");
}

export async function rejectSubmission(form: FormData) {
  await requireAdmin();
  const id = str(form, "orderId"), n = Number(str(form, "n"));
  await getRepo().updateOrder(id, (o) => {
    const inst = o.schedule.find((s) => s.n === n);
    if (!inst || inst.status !== "submitted") return;
    inst.status = "due";
    o.events.push({ at: new Date().toISOString(), type: "payment_rejected", note: `Installment ${n}: payment not found — customer asked to resend`, by: "admin" });
  });
  revalidatePath(`/admin/orders/${id}`);
  back(`/admin/orders/${id}`, `Installment ${n} returned to due.`, "ok");
}

export async function cancelOrder(form: FormData) {
  await requireAdmin();
  const id = str(form, "orderId");
  await getRepo().updateOrder(id, (o) => {
    o.status = "cancelled";
    o.events.push({ at: new Date().toISOString(), type: "cancelled", note: str(form, "reason") || "Cancelled by admin", by: "admin" });
  });
  revalidatePath(`/admin/orders/${id}`);
  back(`/admin/orders/${id}`, "Reservation cancelled.", "ok");
}
