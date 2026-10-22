// Server-side client for the public site's admin API. This dashboard holds no
// data of its own: everything is read from and written to the site through
// GET/POST {SITE_URL}/api/admin with the shared ADMIN_API_TOKEN.
import type { BankAccount, Catalog, EmailRecord, InvestorLead, Order, Settings, Wallet } from "./types";

export class ApiError extends Error {}

function config() {
  const site = process.env.SITE_URL?.replace(/\/$/, "");
  const token = process.env.ADMIN_API_TOKEN;
  if (!site || !token) throw new ApiError("SITE_URL and ADMIN_API_TOKEN must be set in .env.local.");
  return { site, token };
}

async function call<T>(init: { method: "GET"; query: string } | { method: "POST"; body: Record<string, unknown> }): Promise<T> {
  const { site, token } = config();
  let res: Response;
  try {
    res = await fetch(`${site}/api/admin${init.method === "GET" ? `?${init.query}` : ""}`, {
      method: init.method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: init.method === "POST" ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(`Can't reach the site at ${site}. Is it running?`);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401) throw new ApiError("The site rejected the API token. Check ADMIN_API_TOKEN in both apps.");
  if (res.status === 503) throw new ApiError("The site's admin API is disabled. Set ADMIN_API_TOKEN in the site's .env.local.");
  if (!res.ok && init.method === "GET") throw new ApiError(data.error ?? `Site error ${res.status}`);
  return data;
}

export type Summary = {
  orders: Order[];
  leadsCount: number;
  wallets: Wallet[];
  banks: BankAccount[];
  settings: Settings;
  catalog: Catalog;
  storage: "file" | "supabase";
  testMode: true;
};

export const api = {
  summary: () => call<Summary>({ method: "GET", query: "resource=summary" }),
  order: (id: string) => call<{ order: Order }>({ method: "GET", query: `resource=order&id=${encodeURIComponent(id)}` }).then((r) => r.order),
  catalog: () => call<{ catalog: Catalog }>({ method: "GET", query: "resource=catalog" }).then((r) => r.catalog),
  emails: () => call<{ emails: EmailRecord[] }>({ method: "GET", query: "resource=emails" }).then((r) => r.emails),
  investors: () => call<{ investors: InvestorLead[] }>({ method: "GET", query: "resource=investors" }).then((r) => r.investors),
  act: (action: string, payload: Record<string, unknown> = {}) =>
    call<{ ok: boolean; message?: string; error?: string }>({ method: "POST", body: { action, ...payload } }),
};
