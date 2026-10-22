import { getPlan, type PlanId } from "./catalog";

export type Installment = { n: number; dueDate: string; amountCents: number };

export type Quote = {
  planId: PlanId;
  totalCents: number;
  dueTodayCents: number;
  schedule: Installment[];
};

/** Split a total into equal monthly installments; the first is due today. */
export function quote(totalCents: number, planId: PlanId, start = new Date()): Quote | null {
  const plan = getPlan(planId);
  if (!plan || totalCents < 0) return null;
  const months = totalCents === 0 ? 1 : plan.months;
  const base = Math.floor(totalCents / months);
  const schedule: Installment[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, Math.min(start.getUTCDate(), 28)));
    // put the rounding remainder on the first payment
    const amount = i === 0 ? totalCents - base * (months - 1) : base;
    schedule.push({ n: i + 1, dueDate: d.toISOString().slice(0, 10), amountCents: amount });
  }
  return { planId, totalCents, dueTodayCents: schedule[0].amountCents, schedule };
}

export function formatMoney(cents: number) {
  const usd = cents / 100;
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(usd);
}
