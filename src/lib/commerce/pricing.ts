import { NGN_PER_USD, getPlan, getTrim, type Currency, type PlanId, type TrimId } from "./catalog";

export type Installment = { n: number; dueDate: string; amountCents: number };

export type Quote = {
  trimId: TrimId;
  planId: PlanId;
  totalCents: number;
  dueTodayCents: number;
  schedule: Installment[];
};

/** Split the reservation into equal monthly installments; the first is due today. */
export function quote(trimId: TrimId, planId: PlanId, start = new Date()): Quote | null {
  const trim = getTrim(trimId);
  const plan = getPlan(planId);
  if (!trim || !plan || trim.reservationCents == null) return null;
  const total = trim.reservationCents;
  const base = Math.floor(total / plan.months);
  const schedule: Installment[] = [];
  for (let i = 0; i < plan.months; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, Math.min(start.getUTCDate(), 28)));
    // put the rounding remainder on the first payment
    const amount = i === 0 ? total - base * (plan.months - 1) : base;
    schedule.push({ n: i + 1, dueDate: d.toISOString().slice(0, 10), amountCents: amount });
  }
  return { trimId, planId, totalCents: total, dueTodayCents: schedule[0].amountCents, schedule };
}

export function formatMoney(cents: number, currency: Currency = "USD") {
  const usd = cents / 100;
  if (currency === "NGN") {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(usd * NGN_PER_USD);
  }
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(usd);
}
