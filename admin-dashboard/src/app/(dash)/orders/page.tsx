import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { METHOD_LABEL, TRIM_NAME, isDrive, money, when, type Order } from "@/lib/types";
import { ApiProblem, StatusPill } from "../../ui";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "review", label: "Needs review" },
  { key: "awaiting_payment", label: "Awaiting payment" },
  { key: "partially_paid", label: "Installments" },
  { key: "paid", label: "Paid" },
  { key: "invitation_requested", label: "Rocket requests" },
  { key: "cancelled", label: "Cancelled" },
];

export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = "all", q = "" } = await searchParams;
  let all: Order[];
  try {
    all = (await api.summary()).orders.filter((o) => !isDrive(o));
  } catch (e) {
    return <ApiProblem message={e instanceof ApiError ? e.message : "Unknown error."} />;
  }
  const needle = q.trim().toLowerCase();
  const orders = all.filter((o) => {
    if (status === "review" && !o.schedule.some((x) => x.status === "submitted")) return false;
    if (status !== "all" && status !== "review" && o.status !== status) return false;
    if (needle && ![o.number, o.customer.name, o.customer.email].some((v) => v.toLowerCase().includes(needle))) return false;
    return true;
  });

  return (
    <>
      <header className="adm-head">
        <h1>Reservations</h1>
        <p className="adm-muted">{all.length} total</p>
      </header>
      <div className="adm-toolbar">
        <nav className="adm-tabs" aria-label="Filter">
          {FILTERS.map((f) => (
            <Link key={f.key} href={`/orders?status=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={status === f.key ? "page" : undefined}>
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="adm-search">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Search number, name, email" aria-label="Search reservations" />
        </form>
      </div>
      <div className="adm-card adm-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Reservation</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Version</th>
              <th>Plan</th>
              <th>Method</th>
              <th>Paid</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/orders/${o.id}`}>{o.number}</Link>
                  {o.schedule.some((x) => x.status === "submitted") && <span className="adm-dot" title="Payment to review" />}
                </td>
                <td className="adm-muted">{when(o.createdAt)}</td>
                <td>
                  {o.customer.name}
                  <div className="adm-muted">{o.customer.country}</div>
                </td>
                <td>{TRIM_NAME[o.trimId] ?? o.trimId}</td>
                <td>{o.schedule.length > 1 ? `${o.schedule.length} months` : o.schedule.length ? "Full" : "None"}</td>
                <td>{METHOD_LABEL[o.method]}</td>
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
                <td colSpan={8} className="adm-muted">
                  No reservations match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
