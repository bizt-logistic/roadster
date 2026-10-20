import Link from "next/link";
import { getRepo } from "@/lib/server/repo";
import { METHOD_LABEL } from "@/lib/commerce/crypto";
import { StatusPill, money, trimName, when } from "../ui";

export default async function Overview() {
  const repo = getRepo();
  const [orders, leads, wallets, banks] = await Promise.all([repo.listOrders(), repo.listLeads(), repo.listWallets(), repo.listBanks()]);
  const live = orders.filter((o) => o.status !== "cancelled" && o.status !== "invitation_requested");
  const received = live.reduce((a, o) => a + o.paidCents, 0);
  const booked = live.reduce((a, o) => a + o.totalCents, 0);
  const review = orders.flatMap((o) => o.schedule.filter((s) => s.status === "submitted").map((s) => ({ o, s })));
  const byMethod = (["btc", "eth", "bank"] as const).map((m) => ({
    m,
    n: live.filter((o) => o.method === m).length,
    cents: live.filter((o) => o.method === m).reduce((a, o) => a + o.paidCents, 0),
  }));
  const setupMissing = !wallets.some((w) => w.active) && !banks.some((b) => b.active);

  return (
    <>
      <header className="adm-head">
        <h1>Overview</h1>
        <p className="adm-muted">Reservations, payments and leads at a glance.</p>
      </header>

      {setupMissing && (
        <p className="adm-flash adm-flash--warn">
          No receiving wallet or bank account yet — customers can&apos;t pay. <Link href="/admin/payments">Set up payments →</Link>
        </p>
      )}

      <section className="adm-kpis">
        <div className="adm-card adm-kpi">
          <span>Reservations</span>
          <strong>{live.length}</strong>
          <em>{orders.filter((o) => o.status === "invitation_requested").length} Rocket invitation requests</em>
        </div>
        <div className="adm-card adm-kpi">
          <span>Received (USD equiv.)</span>
          <strong>{money(received)}</strong>
          <em>of {money(booked)} booked</em>
        </div>
        <div className="adm-card adm-kpi">
          <span>Needs review</span>
          <strong>{review.length}</strong>
          <em>payments marked as sent</em>
        </div>
        <div className="adm-card adm-kpi">
          <span>Investor leads</span>
          <strong>{leads.length}</strong>
          <em>registered interest</em>
        </div>
      </section>

      <section className="adm-grid2">
        <div className="adm-card">
          <h2>To review</h2>
          {review.length === 0 ? (
            <p className="adm-muted">Nothing waiting. When a customer marks a payment as sent it appears here.</p>
          ) : (
            <table className="adm-table">
              <tbody>
                {review.map(({ o, s }) => (
                  <tr key={`${o.id}-${s.n}`}>
                    <td>
                      <Link href={`/admin/orders/${o.id}`}>{o.number}</Link>
                    </td>
                    <td>{o.customer.name}</td>
                    <td>
                      #{s.n} · {s.cryptoAmount ? `${s.cryptoAmount} ${o.method.toUpperCase()}` : money(s.amountCents)}
                    </td>
                    <td className="adm-muted">{when(s.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="adm-card">
          <h2>By payment method</h2>
          <table className="adm-table">
            <tbody>
              {byMethod.map((r) => (
                <tr key={r.m}>
                  <td>{METHOD_LABEL[r.m]}</td>
                  <td>
                    {r.n} reservation{r.n === 1 ? "" : "s"}
                  </td>
                  <td>{money(r.cents)} received</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="adm-card">
        <div className="adm-card__head">
          <h2>Latest reservations</h2>
          <Link href="/admin/orders">View all →</Link>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Reservation</th>
              <th>Customer</th>
              <th>Version</th>
              <th>Method</th>
              <th>Paid</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 8).map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/orders/${o.id}`}>{o.number}</Link>
                </td>
                <td>{o.customer.name}</td>
                <td>{trimName(o.trimId)}</td>
                <td>{o.method === "none" ? "—" : METHOD_LABEL[o.method]}</td>
                <td>
                  {money(o.paidCents)} / {money(o.totalCents)}
                </td>
                <td>
                  <StatusPill status={o.status} />
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="adm-muted">
                  No reservations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
