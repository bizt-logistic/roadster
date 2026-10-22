// Server-side module: imported only from route handlers / server components.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Installment } from "@/lib/commerce/pricing";
import type { Method, Network } from "@/lib/commerce/crypto";
import { withDefaults, type Catalog, type OrderKind } from "@/lib/commerce/offers";

// Persistence for the reservation demo.
//   • default: a JSON file in .data/ (zero setup, survives restarts)
//   • Supabase: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and the same
//     interface writes to Postgres via PostgREST (schema: supabase/schema.sql)

/** payment_requested: the customer asked to pay; an admin hasn't issued payment details yet. */
export type OrderStatus = "payment_requested" | "awaiting_payment" | "partially_paid" | "paid" | "invitation_requested" | "cancelled";
export type InstallmentStatus = "due" | "submitted" | "paid";

export type OrderInstallment = Installment & {
  status: InstallmentStatus;
  /** crypto amount for this installment at the locked rate (crypto methods) */
  cryptoAmount?: string;
  txHash?: string;
  submittedAt?: string;
  paidAt?: string;
};

export type Destination =
  | { kind: "wallet"; walletId: string; network: Network; address: string }
  | { kind: "bank"; bankId: string; bankName: string; accountName: string; accountNumber: string; currency: string };

/** The customer asked for payment details for installment n. */
export type PaymentRequest = { n: number; method: Method; requestedAt: string };
/** Payment details an admin issued for installment n; valid until expiresAt. */
export type PaymentWindow = { n: number; issuedAt: string; expiresAt: string };

export type OrderEvent = { at: string; type: string; note: string; by: "customer" | "admin" | "system" };

export type OrderItem = { id: string; name: string; priceCents: number };
export type BookingStatus = "scheduled" | "completed" | "no_show";
export type Booking = {
  packageId: string;
  packageName: string;
  durationMin: number;
  date: string;
  time: string;
  locationId: string;
  /** city */
  locationName: string;
  /** meeting point, shown and emailed once the booking is paid */
  locationAddress: string;
  country?: string;
  timeZone?: string;
  creditable: boolean;
  status: BookingStatus;
  /** when the meeting-point email last went out */
  emailedAt?: string;
};

export type Order = {
  id: string;
  /** missing on records created before test drives existed = reservation */
  kind?: OrderKind;
  number: string;
  createdAt: string;
  status: OrderStatus;
  trimId: string;
  colorId: string;
  planId: string;
  /** base price + add-ons, before any promo code */
  subtotalCents?: number;
  items?: OrderItem[];
  discount?: { code: string; cents: number } | null;
  booking?: Booking;
  totalCents: number;
  paidCents: number;
  schedule: OrderInstallment[];
  customer: { name: string; email: string; phone: string; country: string; city: string; address?: string };
  method: Method | "none";
  destination: Destination | null;
  /** USD price of 1 BTC/ETH locked when payment details were issued (1 for bank) */
  lockedRate: number | null;
  request?: PaymentRequest | null;
  window?: PaymentWindow | null;
  events: OrderEvent[];
  testMode: true;
};

export type Wallet = { id: string; network: Network; address: string; label: string; active: boolean; createdAt: string };
export type BankAccount = {
  id: string; bankName: string; accountName: string; accountNumber: string; currency: "USD";
  active: boolean; createdAt: string;
};
export type Settings = { btcUsd: number; ethUsd: number; updatedAt: string };

/** Every email the site sends (or would send without a provider) is kept here. */
export type EmailRecord = {
  id: string;
  createdAt: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  kind: "meeting_point" | "meeting_point_update" | "other";
  orderId?: string;
  /** sent: delivered to the provider · logged: no provider configured · failed: provider error */
  status: "sent" | "logged" | "failed";
  provider: "resend" | "none";
  error?: string;
};

export type InvestorLead = {
  id: string; createdAt: string; name: string; email: string; phone: string; country: string;
  organization: string; investorType: string; ticket: string; interest: string; message: string;
};

export const DEFAULT_SETTINGS: Settings = { btcUsd: 100_000, ethUsd: 3_500, updatedAt: new Date(0).toISOString() };

export interface Repo {
  readonly kind: "file" | "supabase";
  createOrder(o: Order): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  listOrders(): Promise<Order[]>;
  updateOrder(id: string, mutate: (o: Order) => void): Promise<Order | null>;
  createLead(l: InvestorLead): Promise<InvestorLead>;
  listLeads(): Promise<InvestorLead[]>;
  listWallets(): Promise<Wallet[]>;
  saveWallet(w: Wallet): Promise<Wallet>;
  listBanks(): Promise<BankAccount[]>;
  saveBank(b: BankAccount): Promise<BankAccount>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<Settings>;
  getCatalog(): Promise<Catalog>;
  saveCatalog(c: Catalog): Promise<Catalog>;
  listEmails(): Promise<EmailRecord[]>;
  saveEmail(e: EmailRecord): Promise<EmailRecord>;
}

// ── JSON file ──────────────────────────────────────────────────────────────
type Db = { orders: Order[]; leads: InvestorLead[]; wallets: Wallet[]; banks: BankAccount[]; settings?: Settings; catalog?: Catalog; emails?: EmailRecord[] };

class FileRepo implements Repo {
  readonly kind = "file" as const;
  private file = path.join(process.cwd(), ".data", "db.json");
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Db> {
    try {
      const db = JSON.parse(await fs.readFile(this.file, "utf8")) as Partial<Db>;
      return {
        // older demo records (card era) lack the newer fields; keep only compatible orders
        orders: (db.orders ?? []).filter((o) => Array.isArray((o as Order).events)),
        leads: db.leads ?? [],
        wallets: db.wallets ?? [],
        banks: db.banks ?? [],
        settings: db.settings,
        catalog: db.catalog,
        emails: db.emails ?? [],
      };
    } catch {
      return { orders: [], leads: [], wallets: [], banks: [] };
    }
  }
  private write<T>(mutate: (db: Db) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.read();
      const out = mutate(db);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db, null, 2));
      await fs.rename(tmp, this.file);
      return out;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
  private upsert<T extends { id: string }>(list: T[], item: T) {
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = item; else list.push(item);
  }

  async createOrder(o: Order) { await this.write((db) => db.orders.push(o)); return o; }
  async getOrder(id: string) { return (await this.read()).orders.find((o) => o.id === id) ?? null; }
  async listOrders() { return (await this.read()).orders.slice().reverse(); }
  updateOrder(id: string, mutate: (o: Order) => void) {
    return this.write((db) => {
      const o = db.orders.find((x) => x.id === id);
      if (!o) return null;
      mutate(o);
      return o;
    });
  }
  async createLead(l: InvestorLead) { await this.write((db) => db.leads.push(l)); return l; }
  async listLeads() { return (await this.read()).leads.slice().reverse(); }
  async listWallets() { return (await this.read()).wallets; }
  async saveWallet(w: Wallet) { await this.write((db) => this.upsert(db.wallets, w)); return w; }
  // every account is USD now; older records may still say otherwise
  async listBanks() { return (await this.read()).banks.map((b) => ({ ...b, currency: "USD" as const })); }
  async saveBank(b: BankAccount) { await this.write((db) => this.upsert(db.banks, b)); return b; }
  async getSettings() { return (await this.read()).settings ?? DEFAULT_SETTINGS; }
  async saveSettings(s: Settings) { await this.write((db) => (db.settings = s)); return s; }
  async getCatalog() { return withDefaults((await this.read()).catalog); }
  async saveCatalog(c: Catalog) { await this.write((db) => (db.catalog = c)); return c; }
  async listEmails() { return ((await this.read()).emails ?? []).slice().reverse(); }
  async saveEmail(e: EmailRecord) { await this.write((db) => this.upsert((db.emails ??= []), e)); return e; }
}

// ── Supabase (PostgREST over fetch; no SDK needed) ─────────────────────────
// Tables mirror the types; nested structures are jsonb. See supabase/schema.sql.
class SupabaseRepo implements Repo {
  readonly kind = "supabase" as const;
  constructor(private url: string, private key: string) {}

  private async req<T>(table: string, init: RequestInit & { query?: string } = {}): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1/${table}${init.query ?? ""}`, {
      ...init,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=merge-duplicates",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }
  // Each table stores the full record in a `data` jsonb column plus indexed id/created_at.
  private async upsert<T extends { id: string; createdAt: string }>(table: string, item: T) {
    await this.req(table, { method: "POST", body: JSON.stringify({ id: item.id, created_at: item.createdAt, data: item }) });
    return item;
  }
  private async all<T>(table: string, order = "created_at.desc") {
    const rows = await this.req<{ data: T }[]>(table, { query: `?select=data&order=${order}` });
    return rows.map((r) => r.data);
  }
  private async one<T>(table: string, id: string) {
    const rows = await this.req<{ data: T }[]>(table, { query: `?select=data&id=eq.${encodeURIComponent(id)}&limit=1` });
    return rows[0]?.data ?? null;
  }

  createOrder(o: Order) { return this.upsert("orders", o); }
  getOrder(id: string) { return this.one<Order>("orders", id); }
  listOrders() { return this.all<Order>("orders"); }
  async updateOrder(id: string, mutate: (o: Order) => void) {
    const o = await this.getOrder(id);
    if (!o) return null;
    mutate(o);
    return this.upsert("orders", o);
  }
  createLead(l: InvestorLead) { return this.upsert("investor_leads", l); }
  listLeads() { return this.all<InvestorLead>("investor_leads"); }
  listWallets() { return this.all<Wallet>("wallets", "created_at.asc"); }
  saveWallet(w: Wallet) { return this.upsert("wallets", w); }
  async listBanks() { return (await this.all<BankAccount>("bank_accounts", "created_at.asc")).map((b) => ({ ...b, currency: "USD" as const })); }
  saveBank(b: BankAccount) { return this.upsert("bank_accounts", b); }
  async getSettings() {
    return (await this.one<Settings>("settings", "global")) ?? DEFAULT_SETTINGS;
  }
  async saveSettings(s: Settings) {
    await this.req("settings", { method: "POST", body: JSON.stringify({ id: "global", created_at: s.updatedAt, data: s }) });
    return s;
  }
  async getCatalog() {
    return withDefaults(await this.one<Catalog>("settings", "catalog"));
  }
  async saveCatalog(c: Catalog) {
    await this.req("settings", { method: "POST", body: JSON.stringify({ id: "catalog", created_at: c.updatedAt, data: c }) });
    return c;
  }
  listEmails() { return this.all<EmailRecord>("emails"); }
  saveEmail(e: EmailRecord) { return this.upsert("emails", e); }
}

let repo: Repo | null = null;
export function getRepo(): Repo {
  if (repo) return repo;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  repo = url && key ? new SupabaseRepo(url.replace(/\/$/, ""), key) : new FileRepo();
  return repo;
}

/** Recompute paid total and order status from the installment states. */
export function recompute(o: Order) {
  if (o.status === "invitation_requested" || o.status === "cancelled") return;
  o.paidCents = o.schedule.filter((s) => s.status === "paid").reduce((a, s) => a + s.amountCents, 0);
  o.status =
    o.paidCents >= o.totalCents && o.totalCents > 0 ? "paid" : o.paidCents > 0 ? "partially_paid" : o.window ? "awaiting_payment" : "payment_requested";
}

/** Where the next payment stands: which installment, and whether its payment details are live. */
export function paymentState(o: Order, now = new Date()) {
  const next = o.schedule.find((s) => s.status === "due" || s.status === "submitted") ?? null;
  const win = next && o.window && o.window.n === next.n ? o.window : null;
  const live = !!win && new Date(win.expiresAt) > now;
  const requested = !!next && !!o.request && o.request.n === next.n;
  return { next, win, live, expired: !!win && !live, requested };
}
