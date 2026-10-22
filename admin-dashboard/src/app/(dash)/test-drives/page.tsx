import Link from "next/link";
import { api, ApiError, type Summary } from "@/lib/api";
import { BOOKING_LABEL, TRIM_NAME, cetToday, driveDay, isDrive, money, type Order } from "@/lib/types";
import { adminAction } from "../../actions";
import { Act, ApiProblem, Flash, PayPill } from "../../ui";

const FILTERS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "unpaid", label: "Awaiting payment" },
  { key: "review", label: "Needs review" },
  { key: "past", label: "Completed & past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

export default async function TestDrives({ searchParams }: { searchParams: Promise<{ view?: string; ok?: string; error?: string }> }) {
  const { view = "upcoming", ok, error } = await searchParams;
  let s: Summary;
  try {
    s = await api.summary();
  } catch (e) {
    return <ApiProblem message={e instanceof ApiError ? e.message : "Unknown error."} />;
  }
  const today = cetToday();
  const in7 = new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10);
  const all = s.orders.filter((o) => isDrive(o) && o.booking) as (Order & { booking: NonNullable<Order["booking"]> })[];
  const live = all.filter((o) => o.status !== "cancelled");
  const received = live.reduce((a, o) => a + o.paidCents, 0);

  const shown = all
    .filter((o) => {
      const b = o.booking;
      switch (view) {
        case "today": return o.status !== "cancelled" && b.date === today;
        case "unpaid": return o.status === "awaiting_payment";
        case "review": return o.schedule.some((x) => x.status === "submitted");
        case "past": return o.status !== "cancelled" && (b.date < today || b.status !== "scheduled");
        case "cancelled": return o.status === "cancelled";
        case "all": return true;
        default: return o.status !== "cancelled" && b.date >= today && b.status === "scheduled";
      }
    })
    .sort((a, b) => {
      const ka = `${a.booking.date} ${a.booking.time}`, kb = `${b.booking.date} ${b.booking.time}`;
      return view === "past" || view === "all" || view === "cancelled" ? kb.localeCompare(ka) : ka.localeCompare(kb);
    });

  return (
    <>
      <header className="adm-head">
        <h1>Test drives</h1>
        <p className="adm-muted">Paid test-drive bookings. Prices, times and locations are set under Setup.</p>
      </header>
      <nav className="adm-tabs" aria-label="Test drives">
        <Link href="/test-drives" aria-current="page">Bookings</Link>
        <Link href="/test-drives/setup">Setup</Link>
      </nav>
      <Flash ok={ok} error={error} />

      <section className="adm-kpis">
        <div className="adm-card adm-kpi">
          <span>Today</span>
          <strong>{live.filter((o) => o.booking.date === today).length}</strong>
          <em>{driveDay(today)}</em>
        </div>
        <div className="adm-card adm-kpi">
          <span>Next 7 days</span>
          <strong>{live.filter((o) => o.booking.date >= today && o.booking.date < in7).length}</strong>
          <em>booked drives</em>
        </div>
        <div className="adm-card adm-kpi">
          <span>Received</span>
          <strong>{money(received)}</strong>
          <em>USD, test networks</em>
        </div>
        <div className="adm-card adm-kpi">
          <span>Completed</span>
          <strong>{all.filter((o) => o.booking.status === "completed").length}</strong>
          <em>{all.filter((o) => o.booking.status === "no_show").length} no-shows</em>
        </div>
      </section>

      <nav className="adm-tabs" aria-label="Filter">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/test-drives?view=${f.key}`} aria-current={view === f.key ? "page" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="adm-card adm-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Booking</th>
              <th>Customer</th>
              <th>Experience</th>
              <th>City</th>
              <th>Paid</th>
              <th>Payment</th>
              <th>Drive</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => {
              const b = o.booking;
              return (
                <tr key={o.id} className={b.date === today ? "adm-row--today" : undefined}>
                  <td>
                    <strong>{driveDay(b.date)}</strong>
                    <div className="adm-muted">{b.time} · {b.durationMin} min</div>
                  </td>
                  <td>
                    <Link href={`/orders/${o.id}`}>{o.number}</Link>
                  </td>
                  <td>
                    {o.customer.name}
                    <div className="adm-muted">
                      <a href={`tel:${o.customer.phone.replace(/\s/g, "")}`}>{o.customer.phone}</a>
                    </div>
                  </td>
                  <td>
                    {b.packageName}
                    <div className="adm-muted">Roadster {TRIM_NAME[o.trimId] ?? o.trimId}</div>
                  </td>
                  <td>{b.locationName}</td>
                  <td>
                    {money(o.paidCents)} / {money(o.totalCents)}
                    {o.discount && <div className="adm-muted">code {o.discount.code}</div>}
                  </td>
                  <td>
                    <PayPill o={o} />
                  </td>
                  <td>
                    <span className={`adm-pill adm-pill--${b.status === "completed" ? "ok" : b.status === "no_show" ? "bad" : "muted"}`}>
                      {BOOKING_LABEL[b.status]}
                    </span>
                  </td>
                  <td>
                    {o.status === "paid" && b.status === "scheduled" && (
                      <div className="adm-actions">
                        <form action={adminAction}>
                          <Act action="setBookingStatus" back={`/test-drives?view=${view}`} />
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="status" value="completed" />
                          <button className="adm-btn adm-btn--ghost" type="submit">Completed</button>
                        </form>
                        <form action={adminAction}>
                          <Act action="setBookingStatus" back={`/test-drives?view=${view}`} />
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="status" value="no_show" />
                          <button className="adm-btn adm-btn--ghost" type="submit">No-show</button>
                        </form>
                      </div>
                    )}
                    {o.status !== "paid" && o.status !== "cancelled" && <Link href={`/orders/${o.id}`}>Verify payment →</Link>}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="adm-muted">
                  No bookings here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
