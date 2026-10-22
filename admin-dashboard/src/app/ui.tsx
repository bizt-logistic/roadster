import { payState, type Order, type OrderStatus } from "@/lib/types";

const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  payment_requested: { label: "Payment requested", tone: "warn" },
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

/** Shown when the site's admin API can't be reached or rejects the token. */
export function ApiProblem({ message }: { message: string }) {
  return (
    <section className="adm-card">
      <h2>Can&apos;t load data from the site</h2>
      <p className="adm-flash adm-flash--error">{message}</p>
      <p className="adm-muted">
        This dashboard reads everything from the public site&apos;s admin API. Check that the site is running and that{" "}
        <code>SITE_URL</code> and <code>ADMIN_API_TOKEN</code> in this app&apos;s <code>.env.local</code> match the site.
      </p>
    </section>
  );
}

/** Hidden fields for the generic adminAction form handler. */
export function Act({ action, back }: { action: string; back: string }) {
  return (
    <>
      <input type="hidden" name="_action" value={action} />
      <input type="hidden" name="_back" value={back} />
    </>
  );
}

export function PayPill({ o }: { o: Order }) {
  if (o.schedule.some((x) => x.status === "submitted")) return <span className="adm-pill adm-pill--info">Sent, verify</span>;
  const p = payState(o);
  if (o.status !== "cancelled" && o.status !== "paid") {
    if (p.requested) return <span className="adm-pill adm-pill--warn">Payment requested</span>;
    if (p.live) return <span className="adm-pill adm-pill--info">Details sent</span>;
    if (p.expired) return <span className="adm-pill adm-pill--bad">Details expired</span>;
  }
  return <StatusPill status={o.status} />;
}

/** Price input suffix: everything is in US dollars. */
export function Usd() {
  return <span className="adm-cur-tag">USD</span>;
}
