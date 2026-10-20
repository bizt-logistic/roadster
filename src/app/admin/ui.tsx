import { formatMoney } from "@/lib/commerce/pricing";
import { TRIMS } from "@/lib/commerce/catalog";
import type { OrderStatus } from "@/lib/server/repo";

export const money = (c: number) => formatMoney(c, "USD");
export const trimName = (id: string) => TRIMS.find((t) => t.id === id)?.name ?? id;
export const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  awaiting_payment: { label: "Awaiting payment", tone: "warn" },
  partially_paid: { label: "Installments active", tone: "info" },
  paid: { label: "Paid", tone: "ok" },
  invitation_requested: { label: "Invitation request", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "bad" },
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const s = STATUS[status] ?? { label: status, tone: "muted" };
  return <span className={`adm-pill adm-pill--${s.tone}`}>{s.label}</span>;
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return <p className={`adm-flash adm-flash--${error ? "error" : "ok"}`}>{error ?? ok}</p>;
}
