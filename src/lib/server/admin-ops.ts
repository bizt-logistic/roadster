// Server-side module: admin operations exposed to the separate admin app
// (admin-dashboard/) through POST /api/admin. Every operation is demo-only:
// receiving addresses must be on test networks (see validateAddress).
import { randomUUID } from "node:crypto";
import { NETWORKS, SAMPLE_WALLETS, cryptoAmount, isTxHash, validateAddress, type Network } from "@/lib/commerce/crypto";
import { getRepo, paymentState, recompute, type BookingStatus, type Destination } from "@/lib/server/repo";
import { EUROPE_TIME_ZONES, driveDates, slotKey, type Applies, type Catalog } from "@/lib/commerce/offers";
import { slotLoad } from "@/lib/server/slots";
import { sendMeetingEmail } from "@/lib/server/mail";

/**
 * Email the meeting point for a paid, scheduled test drive and note it on the
 * booking. Returns a short status for the admin's flash message.
 */
export async function emailMeetingPoint(orderId: string, update = false): Promise<string> {
  const repo = getRepo();
  const o = await repo.getOrder(orderId);
  if (!o || o.kind !== "test_drive" || !o.booking || o.status !== "paid" || o.booking.status !== "scheduled") return "";
  const mail = await sendMeetingEmail(o, update);
  await repo.updateOrder(orderId, (x) => {
    if (x.booking && mail.status !== "failed") x.booking.emailedAt = mail.createdAt;
    x.events.push({
      at: mail.createdAt,
      type: "email",
      note:
        mail.status === "sent"
          ? `Meeting point emailed to ${mail.to}`
          : mail.status === "logged"
            ? `Meeting point email prepared for ${mail.to} (no email provider set, see Emails)`
            : `Meeting point email to ${mail.to} failed: ${mail.error ?? "provider error"}`,
      by: "system",
    });
  });
  return mail.status === "sent" ? " Meeting point emailed." : mail.status === "logged" ? " Meeting point email saved to the outbox." : " The meeting point email failed, see Emails.";
}

export type OpResult = { ok: true; message: string } | { ok: false; error: string };
type Payload = Record<string, unknown>;

const str = (p: Payload, k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");
const ok = (message: string): OpResult => ({ ok: true, message });
const fail = (error: string): OpResult => ({ ok: false, error });

async function addWallet(p: Payload): Promise<OpResult> {
  const network = str(p, "network") as Network;
  if (!(network in NETWORKS)) return fail("Choose a network.");
  const v = validateAddress(network, str(p, "address"));
  if (!v.ok) return fail(v.error);
  const repo = getRepo();
  if ((await repo.listWallets()).some((w) => w.address.toLowerCase() === v.address.toLowerCase())) return fail("That address is already added.");
  await repo.saveWallet({
    id: randomUUID(), network, address: v.address, label: str(p, "label").slice(0, 60) || NETWORKS[network].label,
    active: true, createdAt: new Date().toISOString(),
  });
  return ok("Receiving address added.");
}

async function toggleWallet(p: Payload): Promise<OpResult> {
  const repo = getRepo();
  const w = (await repo.listWallets()).find((x) => x.id === str(p, "id"));
  if (!w) return fail("Address not found.");
  await repo.saveWallet({ ...w, active: !w.active });
  return ok(w.active ? "Address paused." : "Address activated.");
}

async function addSampleWallets(): Promise<OpResult> {
  const repo = getRepo();
  const have = await repo.listWallets();
  for (const s of SAMPLE_WALLETS) {
    if (have.some((w) => w.address === s.address)) continue;
    await repo.saveWallet({ id: randomUUID(), ...s, active: true, createdAt: new Date().toISOString() });
  }
  return ok("Sample testnet addresses added. Replace them with your own.");
}

async function addBank(p: Payload): Promise<OpResult> {
  const bankName = str(p, "bankName"), accountName = str(p, "accountName"), accountNumber = str(p, "accountNumber");
  if (bankName.length < 2 || accountName.length < 2) return fail("Enter the bank and account name.");
  if (!/^[0-9A-Z -]{6,34}$/i.test(accountNumber)) return fail("Enter a valid account number / IBAN.");
  await getRepo().saveBank({
    id: randomUUID(), bankName: bankName.slice(0, 60), accountName: accountName.slice(0, 80), accountNumber,
    currency: "USD", active: true, createdAt: new Date().toISOString(),
  });
  return ok("Bank account added.");
}

async function toggleBank(p: Payload): Promise<OpResult> {
  const repo = getRepo();
  const b = (await repo.listBanks()).find((x) => x.id === str(p, "id"));
  if (!b) return fail("Account not found.");
  await repo.saveBank({ ...b, active: !b.active });
  return ok(b.active ? "Account paused." : "Account activated.");
}

async function saveRates(p: Payload): Promise<OpResult> {
  const n = (k: string) => Number(String(p[k] ?? "").replace(/,/g, ""));
  const btcUsd = n("btcUsd"), ethUsd = n("ethUsd");
  if (![btcUsd, ethUsd].every((x) => Number.isFinite(x) && x > 0)) return fail("Rates must be positive numbers.");
  await getRepo().saveSettings({ btcUsd, ethUsd, updatedAt: new Date().toISOString() });
  return ok("Rates saved. Payment details you issue from now on lock these rates.");
}

async function confirmInstallment(p: Payload): Promise<OpResult> {
  const id = str(p, "orderId"), n = Number(p.n), tx = str(p, "txHash");
  const repo = getRepo();
  const order = await repo.getOrder(id);
  if (!order) return fail("Reservation not found.");
  const dest = order.destination;
  if (dest?.kind === "wallet" && tx && !isTxHash(dest.network, tx)) return fail("That transaction hash doesn't match the network.");
  let changed = false;
  await repo.updateOrder(id, (o) => {
    const inst = o.schedule.find((s) => s.n === n);
    if (!inst || inst.status === "paid" || o.status === "cancelled") return;
    changed = true;
    inst.status = "paid";
    inst.paidAt = new Date().toISOString();
    if (tx) inst.txHash = tx;
    if (o.window?.n === n) o.window = null;
    if (o.request?.n === n) o.request = null;
    o.events.push({ at: inst.paidAt, type: "payment_confirmed", note: `Installment ${n} confirmed${tx ? ` · tx ${tx.slice(0, 12)}…` : ""}`, by: "admin" });
    recompute(o);
    if (o.status === "paid") o.events.push({ at: inst.paidAt, type: "fully_paid", note: "Reservation fully paid", by: "system" });
  });
  if (!changed) return fail("Nothing to confirm for that installment.");
  return ok(`Installment ${n} confirmed.${await emailMeetingPoint(id)}`);
}

async function rejectSubmission(p: Payload): Promise<OpResult> {
  const id = str(p, "orderId"), n = Number(p.n);
  let changed = false;
  await getRepo().updateOrder(id, (o) => {
    const inst = o.schedule.find((s) => s.n === n);
    if (!inst || inst.status !== "submitted") return;
    changed = true;
    inst.status = "due";
    o.events.push({ at: new Date().toISOString(), type: "payment_rejected", note: `Installment ${n}: payment not found, customer asked to resend`, by: "admin" });
  });
  return changed ? ok(`Installment ${n} returned to due.`) : fail("That installment isn't awaiting verification.");
}

async function cancelOrder(p: Payload): Promise<OpResult> {
  const id = str(p, "orderId");
  const o = await getRepo().updateOrder(id, (x) => {
    x.status = "cancelled";
    x.window = null;
    x.request = null;
    x.events.push({ at: new Date().toISOString(), type: "cancelled", note: str(p, "reason").slice(0, 200) || "Cancelled by admin", by: "admin" });
  });
  return o ? ok(o.kind === "test_drive" ? "Booking cancelled. The slot is free again." : "Reservation cancelled.") : fail("Reservation not found.");
}

// ── catalogue: prices, test drives, add-ons, promo codes ──────────────────
const list = (p: Payload, k: string) => {
  const v = p[k];
  return (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(",") : []).map((x) => String(x).trim()).filter(Boolean);
};
const flag = (p: Payload, k: string) => p[k] === true || p[k] === "on" || p[k] === "true";
const slug = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "item"}-${randomUUID().slice(0, 4)}`;
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Prices are entered and stored in US dollars (stored as cents). */
async function cents(raw: string, _currency?: string): Promise<number | null> {
  const n = Number(raw.replace(/[,\s$]/g, ""));
  if (!raw || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

async function editCatalog(mutate: (c: Catalog) => string | void): Promise<OpResult> {
  const repo = getRepo();
  const c = await repo.getCatalog();
  const err = mutate(c);
  if (err) return fail(err);
  c.updatedAt = new Date().toISOString();
  await repo.saveCatalog(c);
  return ok("Saved.");
}

async function saveTrimPrices(p: Payload): Promise<OpResult> {
  const cur = str(p, "currency");
  const prices: Record<string, number | null> = {};
  for (const id of ["performance", "thrust", "rocket"]) {
    const raw = str(p, `price_${id}`);
    const c = raw ? await cents(raw, cur) : null;
    if (raw && c == null) return fail("Prices must be positive numbers (leave empty for invitation only).");
    prices[id] = c;
  }
  const r = await editCatalog((c) => {
    for (const t of c.trims) {
      t.reservationCents = prices[t.id] ?? null;
      t.available = flag(p, `available_${t.id}`);
    }
    if (!c.trims.some((t) => t.available)) return "Keep at least one version available.";
  });
  return r.ok ? ok("Vehicle prices saved. New reservations use them immediately.") : r;
}

async function savePackage(p: Payload): Promise<OpResult> {
  const name = str(p, "name").slice(0, 60), description = str(p, "description").slice(0, 240), id = str(p, "id");
  const durationMin = Math.round(Number(str(p, "durationMin")));
  const price = await cents(str(p, "price"), str(p, "currency"));
  if (name.length < 2) return fail("Give the experience a name.");
  if (!(durationMin >= 10 && durationMin <= 600)) return fail("Duration must be 10–600 minutes.");
  if (price == null) return fail("Enter the upgrade price in USD (0 = included).");
  const r = await editCatalog((c) => {
    const item = { name, description, durationMin, priceCents: price, creditable: flag(p, "creditable"), active: id ? flag(p, "active") : true };
    const existing = c.testDrive.packages.find((x) => x.id === id);
    if (id && !existing) return "Experience not found.";
    if (existing) Object.assign(existing, item);
    else c.testDrive.packages.push({ id: slug(name), ...item });
  });
  return r.ok ? ok(id ? "Experience updated." : "Experience added.") : r;
}

async function saveLocation(p: Payload): Promise<OpResult> {
  const name = str(p, "name").slice(0, 60), address = str(p, "address").slice(0, 160), id = str(p, "id");
  const country = str(p, "country").slice(0, 60), timeZone = str(p, "timeZone");
  if (name.length < 2 || address.length < 4) return fail("Enter the city and the meeting point address.");
  if (!EUROPE_TIME_ZONES.includes(timeZone)) return fail("Choose the city's time zone.");
  const r = await editCatalog((c) => {
    const existing = c.testDrive.locations.find((x) => x.id === id);
    if (id && !existing) return "City not found.";
    if (existing) Object.assign(existing, { name, country, timeZone, address, active: flag(p, "active") });
    else c.testDrive.locations.push({ id: slug(name), name, country, timeZone, address, active: true });
  });
  return r.ok ? ok(id ? "City updated." : "City added.") : r;
}

async function saveDriveSettings(p: Payload): Promise<OpResult> {
  const slots = [...new Set(list(p, "slots"))].sort();
  if (!slots.length || slots.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) return fail("Times must look like 10:00, 14:30 (24-hour).");
  const capacityPerSlot = Math.round(Number(str(p, "capacityPerSlot")));
  const leadDays = Math.round(Number(str(p, "leadDays")));
  const horizonDays = Math.round(Number(str(p, "horizonDays")));
  if (!(capacityPerSlot >= 1 && capacityPerSlot <= 50)) return fail("Cars per slot must be 1–50.");
  if (!(leadDays >= 0 && leadDays <= 30) || !(horizonDays >= leadDays + 1 && horizonDays <= 120)) return fail("Check the booking window.");
  const closedWeekdays = list(p, "closedWeekdays").map(Number).filter((d) => d >= 0 && d <= 6);
  if (closedWeekdays.length === 7) return fail("Keep at least one day open.");
  const r = await editCatalog((c) => {
    Object.assign(c.testDrive, { enabled: flag(p, "enabled"), slots, capacityPerSlot, leadDays, horizonDays, closedWeekdays });
  });
  return r.ok ? ok("Test-drive schedule saved.") : r;
}

/** Test-drive price for each car (USD) and which cars are offered. */
async function saveDriveCars(p: Payload): Promise<OpResult> {
  const ids = ["performance", "thrust", "rocket"] as const;
  const prices: Partial<Record<(typeof ids)[number], number>> = {};
  for (const id of ids) {
    const c = await cents(str(p, `price_${id}`));
    if (c == null || c < 100) return fail("Each car needs a test-drive price of at least $1.");
    prices[id] = c;
  }
  const cars = ids.filter((id) => flag(p, `offered_${id}`));
  if (!cars.length) return fail("Offer at least one car.");
  const r = await editCatalog((c) => {
    c.testDrive.carPrices = prices as Catalog["testDrive"]["carPrices"];
    c.testDrive.cars = cars;
  });
  return r.ok ? ok("Test-drive prices saved.") : r;
}

const appliesOf = (p: Payload) => (["reservation", "test_drive", "both"].includes(str(p, "appliesTo")) ? str(p, "appliesTo") : "both") as Applies;

async function saveAddon(p: Payload): Promise<OpResult> {
  const name = str(p, "name").slice(0, 60), description = str(p, "description").slice(0, 200), id = str(p, "id");
  const price = await cents(str(p, "price"), str(p, "currency"));
  if (name.length < 2) return fail("Give the add-on a name.");
  if (price == null || price < 100) return fail("Enter a price of at least $1.");
  const r = await editCatalog((c) => {
    const item = { name, description, priceCents: price, appliesTo: appliesOf(p), active: id ? flag(p, "active") : true };
    const existing = c.addons.find((x) => x.id === id);
    if (id && !existing) return "Add-on not found.";
    if (existing) Object.assign(existing, item);
    else c.addons.push({ id: slug(name), ...item });
  });
  return r.ok ? ok(id ? "Add-on updated." : "Add-on added.") : r;
}

async function savePromo(p: Payload): Promise<OpResult> {
  const code = str(p, "code").toUpperCase();
  if (!/^[A-Z0-9-]{3,24}$/.test(code)) return fail("Codes use 3–24 letters, numbers or dashes.");
  const kind: "percent" | "fixed" = str(p, "kind") === "fixed" ? "fixed" : "percent";
  let value: number;
  if (kind === "percent") {
    value = Math.round(Number(str(p, "value")));
    if (!(value >= 1 && value <= 100)) return fail("Percent must be 1–100.");
  } else {
    const c = await cents(str(p, "value"), str(p, "currency"));
    if (c == null || c < 100) return fail("Enter an amount of at least $1.");
    value = c;
  }
  const maxRaw = str(p, "maxUses");
  const maxUses = maxRaw ? Math.round(Number(maxRaw)) : null;
  if (maxUses != null && !(maxUses >= 1)) return fail("Max uses must be a positive number (or empty for unlimited).");
  const exp = str(p, "expiresAt");
  if (exp && !isDate(exp)) return fail("Expiry must be a date.");
  const r = await editCatalog((c) => {
    const item = { kind, value, appliesTo: appliesOf(p), maxUses, expiresAt: exp ? `${exp}T23:59:59+01:00` : null, active: true };
    const existing = c.promos.find((x) => x.code === code);
    if (existing) Object.assign(existing, item);
    else c.promos.push({ code, ...item, used: 0 });
  });
  return r.ok ? ok(`Promo code ${code} saved.`) : r;
}

type Toggleable = { id?: string; code?: string; active: boolean };
const toggler = (pick: (c: Catalog) => Toggleable[], key: "id" | "code", label: string) => async (p: Payload): Promise<OpResult> => {
  let state = false;
  const r = await editCatalog((c) => {
    const item = pick(c).find((x) => x[key] === str(p, key));
    if (!item) return `${label} not found.`;
    item.active = !item.active;
    state = item.active;
  });
  return r.ok ? ok(`${label} ${state ? "activated" : "paused"}.`) : r;
};

// ── payment requests ──────────────────────────────────────────────────────
/**
 * Issue payment details for the next due installment: the admin picks the
 * receiving address or bank account, can adjust the amount, and sets how long
 * the details stay valid. The crypto rate is locked now.
 */
async function issuePayment(p: Payload): Promise<OpResult> {
  const repo = getRepo();
  const id = str(p, "orderId");
  const order = await repo.getOrder(id);
  if (!order) return fail("Order not found.");
  if (order.status === "cancelled" || order.status === "invitation_requested") return fail("This order can't take payments.");
  const st = paymentState(order);
  if (!st.next || st.next.status !== "due") return fail("Nothing is due on this order.");
  const minutes = Math.round(Number(str(p, "expiresIn")));
  if (!(minutes >= 5 && minutes <= 10_080)) return fail("Expiry must be between 5 minutes and 7 days.");

  const [kind, destId] = str(p, "destination").split(":");
  let destination: Destination;
  let rate = 1;
  const settings = await repo.getSettings();
  if (kind === "bank") {
    const b = (await repo.listBanks()).find((x) => x.id === destId && x.active);
    if (!b) return fail("Choose an active bank account.");
    destination = { kind: "bank", bankId: b.id, bankName: b.bankName, accountName: b.accountName, accountNumber: b.accountNumber, currency: "USD" };
  } else {
    const w = (await repo.listWallets()).find((x) => x.id === destId && x.active);
    if (!w) return fail("Choose an active receiving address.");
    destination = { kind: "wallet", walletId: w.id, network: w.network, address: w.address };
    rate = w.network === "btc-testnet" ? settings.btcUsd : settings.ethUsd;
  }

  const raw = str(p, "amount");
  const amount = raw ? await cents(raw) : st.next.amountCents;
  if (amount == null || amount < 100) return fail("Enter an amount of at least $1.");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + minutes * 60_000).toISOString();
  const n = st.next.n;
  await repo.updateOrder(id, (o) => {
    const inst = o.schedule.find((x) => x.n === n)!;
    const adjusted = inst.amountCents !== amount;
    inst.amountCents = amount;
    o.totalCents = o.schedule.reduce((a, x) => a + x.amountCents, 0);
    const net = destination.kind === "wallet" ? NETWORKS[destination.network] : null;
    inst.cryptoAmount = net ? cryptoAmount(amount, rate, net.decimals) : undefined;
    o.destination = destination;
    o.method = destination.kind === "bank" ? "bank" : NETWORKS[destination.network].method;
    o.lockedRate = rate;
    o.window = { n, issuedAt: now.toISOString(), expiresAt };
    o.request = null;
    recompute(o);
    const what = net ? `${inst.cryptoAmount} ${net.asset} to ${destination.kind === "wallet" ? destination.address.slice(0, 10) : ""}…` : `${(amount / 100).toLocaleString("en-US")} to ${destination.kind === "bank" ? destination.bankName : ""}`;
    o.events.push({
      at: now.toISOString(),
      type: "payment_issued",
      note: `Payment details issued${o.schedule.length > 1 ? ` for installment ${n}` : ""} · ${what}${adjusted ? " · amount adjusted" : ""} · valid ${minutes >= 60 ? `${+(minutes / 60).toFixed(1)} h` : `${minutes} min`}`,
      by: "admin",
    });
  });
  return ok("Payment details sent to the customer. The countdown has started.");
}

// ── test-drive bookings ───────────────────────────────────────────────────
async function setBookingStatus(p: Payload): Promise<OpResult> {
  const status = str(p, "status") as BookingStatus;
  const label = ({ scheduled: "scheduled", completed: "completed", no_show: "no-show" } as const)[status];
  if (!label) return fail("Unknown status.");
  const o = await getRepo().updateOrder(str(p, "orderId"), (x) => {
    if (!x.booking) return;
    x.booking.status = status;
    x.events.push({ at: new Date().toISOString(), type: "booking_status", note: `Test drive marked ${label}`, by: "admin" });
  });
  return o?.booking ? ok(`Marked ${label}.`) : fail("Booking not found.");
}

async function rescheduleBooking(p: Payload): Promise<OpResult> {
  const repo = getRepo();
  const id = str(p, "orderId"), date = str(p, "date"), time = str(p, "time"), locationId = str(p, "locationId");
  const [catalog, orders] = await Promise.all([repo.getCatalog(), repo.listOrders()]);
  const cfg = catalog.testDrive;
  const loc = cfg.locations.find((l) => l.id === locationId);
  if (!loc) return fail("Choose a location.");
  const today = driveDates({ ...cfg, leadDays: 0, closedWeekdays: [] })[0];
  if (!isDate(date) || date < today) return fail("Choose a date from today on.");
  if (!/^\d{2}:\d{2}$/.test(time)) return fail("Choose a time.");
  if ((slotLoad(orders, id).get(slotKey(date, time, locationId)) ?? 0) >= cfg.capacityPerSlot) return fail("That slot is full.");
  const o = await repo.updateOrder(id, (x) => {
    if (!x.booking) return;
    x.booking = {
      ...x.booking, date, time, locationId, locationName: loc.name, locationAddress: loc.address,
      country: loc.country, timeZone: loc.timeZone, status: "scheduled",
    };
    x.events.push({ at: new Date().toISOString(), type: "rescheduled", note: `Rescheduled to ${date} ${time} · ${loc.name}`, by: "admin" });
  });
  if (!o?.booking) return fail("Booking not found.");
  return ok(`Booking rescheduled.${o.status === "paid" ? await emailMeetingPoint(id, true) : ""}`);
}

async function sendMeetingDetails(p: Payload): Promise<OpResult> {
  const msg = await emailMeetingPoint(str(p, "orderId"));
  return msg ? ok(msg.trim()) : fail("Only paid, scheduled test drives get a meeting point email.");
}

export const ADMIN_OPS: Record<string, (p: Payload) => Promise<OpResult>> = {
  sendMeetingDetails,
  addWallet, toggleWallet, addSampleWallets, addBank, toggleBank, saveRates, confirmInstallment, rejectSubmission, cancelOrder,
  saveTrimPrices, savePackage, saveLocation, saveDriveSettings, saveDriveCars, saveAddon, savePromo, issuePayment,
  togglePackage: toggler((c) => c.testDrive.packages, "id", "Experience"),
  toggleLocation: toggler((c) => c.testDrive.locations, "id", "Location"),
  toggleAddon: toggler((c) => c.addons, "id", "Add-on"),
  togglePromo: toggler((c) => c.promos, "code", "Promo code"),
  setBookingStatus,
  rescheduleBooking,
};
