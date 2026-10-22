import Link from "next/link";
import { api, ApiError, type Summary } from "@/lib/api";
import { METHOD_LABEL, TRIM_NAME, cetToday, driveDay, isDrive, money, payState, relative, when } from "@/lib/types";
import { ApiProblem, PayPill } from "../ui";

export default async function Overview() {
  let s: Summary;
  try {
    s = await api.summary();
  } catch (e) {
    return <ApiProblem message={e instanceof ApiError ? e.message : "Unknown error."} />;
  }
  const { orders } = s;
  const today = cetToday();
  const live = orders.filter((o) => o.status !== "cancelled" && o.status !== "invitation_requested");
  const reservations = live.filter((o) => !isDrive(o));
  const drives = live.filter(isDrive);
  const received = live.reduce((a, o) => a + o.paidCents, 0);
  const booked = live.reduce((a, o) => a + o.totalCents, 0);
  const sum = (list: typeof live, f: (o: (typeof live)[number]) => number) => list.reduce((a, o) => a + f(o), 0);
  const addonCents = sum(live, (o) => (o.items ?? []).filter((i) => !i.id.includes(":")).reduce((a, i) => a + i.priceCents, 0));
  const discountCents = sum(live, (o) => o.discount?.cents ?? 0);
  const streams = [
    { label: "Reservations", n: reservations.length, booked: sum(reservations, (o) => o.totalCents), got: sum(reservations, (o) => o.paidCents) },
    { label: "Test drives", n: drives.length, booked: sum(drives, (o) => o.totalCents), got: sum(drives, (o) => o.paidCents) },
  ];
  const requests = orders
    .filter((o) => !["cancelled", "paid", "invitation_requested"].includes(o.status) && payState(o).requested)
    .sort((a, b) => a.request!.requestedAt.localeCompare(b.request!.requestedAt));
  const review = orders.flatMap((o) => o.schedule.filter((x) => x.status === "submitted").map((x) => ({ o, x })));
  const byMethod = (["btc", "eth", "bank"] as const).map((m) => ({
    m,
    n: live.filter((o) => o.method === m).length,
    cents: live.filter((o) => o.method === m).reduce((a, o) => a + o.paidCents, 0),
  }));
  const upcoming = drives
    .filter((o) => o.booking && o.booking.date >= today && o.booking.status === "scheduled")
    .sort((a, b) => `${a.booking!.date}${a.booking!.time}`.localeCompare(`${b.booking!.date}${b.booking!.time}`))
    .slice(0, 6);
  const setupMissing = !s.wallets.some((w) => w.active) && !s.banks.some((b) => b.active);

  return (
    <>
      <header className="adm-head">
        <h1>Overview</h1>
        <p className="adm-muted">Every revenue stream, payment and booking at a glance.</p>
      </header>
      {setupMissing && (
        <p className="adm-flash adm-flash--warn">
          No receiving wallet or bank account yet. Customers can&apos;t pay. <Link href="/payments">Set up payments →</Link>
        </p>
      )}
      <section className="adm-kpis">
        <div className="adm-card adm-kpi">
          <span>Received (test networks)</span>
          <strong>{money(received)}</strong>
          <em>of {money(booked)} booked (USD)</em>
        </div>
        <div className="adm-card adm-kpi">
          <span>Reservations</span>
          <strong>{reservations.length}</strong>
          <em>{orders.filter((o) => o.status === "invitation_requested").length} invitation requests</em>
        </div>
        <div className="adm-card adm-kpi">
          <span>Test drives</span>
          <strong>{drives.length}</strong>
          <em>{drives.filter((o) => o.booking?.date === today).length} today</em>
        </div>
        <div className="adm-card adm-kpi">
          <span>Payment requests</span>
          <strong>{requests.length}</strong>
          <em>{review.length} payments to verify</em>
        </div>
      </section>

      {requests.length > 0 && (
        <section className="adm-card adm-card--alert">
          <div className="adm-card__head">
            <h2>Customers waiting for payment details</h2>
            <Link href="/requests">Generate payments →</Link>
          </div>
          <table className="adm-table">
            <tbody>
              {requests.slice(0, 5).map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/orders/${o.id}`}>{o.number}</Link>
                  </td>
                  <td>{o.customer.name}</td>
                  <td>{isDrive(o) ? "Test drive" : "Reservation"}</td>
                  <td>{METHOD_LABEL[o.request!.method]}</td>
                  <td className="adm-muted">{relative(o.request!.requestedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="adm-grid2">
        <div className="adm-card">
          <h2>Revenue by stream</h2>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Stream</th>
                <th>Orders</th>
                <th>Booked</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {streams.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{r.n}</td>
                  <td>{money(r.booked)}</td>
                  <td>{money(r.got)}</td>
                </tr>
              ))}
              <tr>
                <td>Add-ons (within the above)</td>
                <td />
                <td>{money(addonCents)}</td>
                <td />
              </tr>
              <tr>
                <td>Promo discounts given</td>
                <td />
                <td>−{money(discountCents)}</td>
                <td />
              </tr>
            </tbody>
          </table>
          <p className="adm-muted adm-small">
            Prices and offers: <Link href="/pricing">Pricing &amp; offers</Link> · <Link href="/test-drives/setup">Test-drive setup</Link>
          </p>
        </div>
        <div className="adm-card">
          <h2>To review</h2>
          {review.length === 0 ? (
            <p className="adm-muted">Nothing waiting. When a customer marks a payment as sent it appears here.</p>
          ) : (
            <table className="adm-table">
              <tbody>
                {review.map(({ o, x }) => (
                  <tr key={`${o.id}-${x.n}`}>
                    <td>
                      <Link href={`/orders/${o.id}`}>{o.number}</Link>
                    </td>
                    <td>{o.customer.name}</td>
                    <td>
                      #{x.n} · {x.cryptoAmount ? `${x.cryptoAmount} ${o.method.toUpperCase()}` : money(x.amountCents)}
                    </td>
                    <td className="adm-muted">{when(x.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="adm-grid2">
        <div className="adm-card">
          <div className="adm-card__head">
            <h2>Upcoming test drives</h2>
            <Link href="/test-drives">All bookings →</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="adm-muted">No upcoming drives.</p>
          ) : (
            <table className="adm-table">
              <tbody>
                {upcoming.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{driveDay(o.booking!.date)}</strong> {o.booking!.time}
                    </td>
                    <td>
                      <Link href={`/orders/${o.id}`}>{o.customer.name}</Link>
                      <div className="adm-muted">{o.booking!.packageName}</div>
                    </td>
                    <td>
                      <PayPill o={o} />
                    </td>
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
                    {r.n} order{r.n === 1 ? "" : "s"}
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
          <h2>Latest orders</h2>
          <Link href="/orders">Reservations →</Link>
        </div>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Car</th>
                <th>Method</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/orders/${o.id}`}>{o.number}</Link>
                  </td>
                  <td>{isDrive(o) ? "Test drive" : "Reservation"}</td>
                  <td>{o.customer.name}</td>
                  <td>{TRIM_NAME[o.trimId] ?? o.trimId}</td>
                  <td>{METHOD_LABEL[o.method]}</td>
                  <td>
                    {money(o.paidCents)} / {money(o.totalCents)}
                  </td>
                  <td>
                    <PayPill o={o} />
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="adm-muted">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
