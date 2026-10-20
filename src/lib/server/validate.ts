// Server-side module: imported only from route handlers.
import { COLORS, PLANS, TRIMS } from "@/lib/commerce/catalog";
import { INTERESTS, INVESTOR_TYPES, TICKETS } from "@/lib/commerce/leads";

type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

export type OrderInput = {
  trimId: (typeof TRIMS)[number]["id"];
  colorId: string;
  planId: (typeof PLANS)[number]["id"];
  method: "btc" | "eth" | "bank" | "none";
  customer: { name: string; email: string; phone: string; country: string; city: string; address?: string };
};

export function validateOrder(body: unknown): Result<OrderInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const c = (b.customer ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const trimId = str(b.trimId);
  const planId = str(b.planId) || "full";
  const colorId = str(b.colorId) || COLORS[0].id;
  const method = str(b.method);
  if (!TRIMS.some((t) => t.id === trimId)) errors.trimId = "Choose a version.";
  if (!PLANS.some((p) => p.id === planId)) errors.planId = "Choose a payment plan.";
  if (!COLORS.some((x) => x.id === colorId)) errors.colorId = "Choose a colour.";
  const isRocket = trimId === "rocket";
  if (!isRocket && !["btc", "eth", "bank"].includes(method)) errors.method = "Choose a payment method.";
  const customer = {
    name: str(c.name),
    email: str(c.email).toLowerCase(),
    phone: str(c.phone),
    country: str(c.country),
    city: str(c.city),
    address: str(c.address) || undefined,
  };
  if (customer.name.length < 2 || customer.name.length > 80) errors.name = "Enter your full name.";
  if (!EMAIL.test(customer.email) || customer.email.length > 120) errors.email = "Enter a valid email.";
  if (!PHONE.test(customer.phone)) errors.phone = "Enter a valid phone number.";
  if (customer.country.length < 2 || customer.country.length > 56) errors.country = "Choose your country.";
  if (customer.city.length < 1 || customer.city.length > 80) errors.city = "Enter your city.";
  if ((customer.address ?? "").length > 200) errors.address = "Address is too long.";
  if (b.consent !== true) errors.consent = "Please confirm you understand this is a test-mode demo.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      trimId: trimId as OrderInput["trimId"],
      colorId,
      planId: planId as OrderInput["planId"],
      method: (isRocket ? "none" : method) as OrderInput["method"],
      customer,
    },
  };
}

export type LeadInput = {
  name: string; email: string; phone: string; country: string; organization: string;
  investorType: string; ticket: string; interest: string; message: string;
};


export function validateLead(body: unknown): Result<LeadInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const v = {
    name: str(b.name), email: str(b.email).toLowerCase(), phone: str(b.phone), country: str(b.country),
    organization: str(b.organization), investorType: str(b.investorType), ticket: str(b.ticket),
    interest: str(b.interest), message: str(b.message),
  };
  const errors: Record<string, string> = {};
  if (v.name.length < 2 || v.name.length > 80) errors.name = "Enter your full name.";
  if (!EMAIL.test(v.email)) errors.email = "Enter a valid email.";
  if (v.phone && !PHONE.test(v.phone)) errors.phone = "Enter a valid phone number.";
  if (v.country.length < 2) errors.country = "Choose your country.";
  if (v.organization.length > 120) errors.organization = "Too long.";
  if (!INVESTOR_TYPES.includes(v.investorType)) errors.investorType = "Choose one.";
  if (!TICKETS.includes(v.ticket)) errors.ticket = "Choose one.";
  if (!INTERESTS.includes(v.interest)) errors.interest = "Choose one.";
  if (v.message.length > 2000) errors.message = "Please keep it under 2,000 characters.";
  if (b.consent !== true) errors.consent = "Please acknowledge the notice.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: v };
}

// Minimal in-memory rate limit for public POST endpoints.
const hits = new Map<string, number[]>();
export function rateLimited(key: string, limit = 12, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > limit;
}

export function clientKey(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export function adminAuthorized(req: Request) {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return null; // admin API disabled until a token is configured
  return req.headers.get("authorization") === `Bearer ${token}`;
}
