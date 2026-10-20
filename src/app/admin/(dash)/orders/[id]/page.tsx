import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/lib/server/repo";
import { NETWORKS, METHOD_LABEL } from "@/lib/commerce/crypto";
import { PLANS } from "@/lib/commerce/catalog";
import { cancelOrder, confirmInstallment, rejectSubmission } from "../../../actions";
import { Flash, StatusPill, money, trimName, when } from "../../../ui";

export default async function OrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  const o = await getRepo().getOrder(id);
  if (!o) notFound();
  const dest = o.destination;
  const net = dest?.kind === "wallet" ? NETWORKS[dest.network] : null;
  const closed = o.status === "cancelled" || o.status === "invitation_requested";

  return (
    <>
      <header className="adm-head">
        <Link href="/admin/orders" className="adm-muted">
          ← Reservations
        </Link>
        <h1>
          {o.number} <StatusPill status={o.status} />
        </h1>
        <p className="adm-muted">
          Created {when(o.createdAt)} · <a href={`/reserve/confirmation/${o.id}`} target="_blank" rel="noreferrer">customer receipt ↗</a>
        </p>
      </header>
      <Flash ok={flash.ok} error={flash.error} />

      <section className="adm-grid2">
        <div className="adm-card">
          <h2>Reservation</h2>
          <dl className="adm-dl">
            <dt>Version</dt>
            <dd>Roadster {trimName(o.trimId)}</dd>
            <dt>Plan</dt>
            <dd>{PLANS.find((p) => p.id === o.planId)?.label ?? "—"}</dd>
            <dt>Total</dt>
            <dd>{money(o.totalCents)}</dd>
            <dt>Received</dt>
            <dd>{money(o.paidCents)}</dd>
            <dt>Method</dt>
            <dd>{o.method === "none" ? "—" : METHOD_LABEL[o.method]}</dd>
            {o.lockedRate && net && (
              <>
                <dt>Locked rate</dt>
                <dd>
                  ${o.lockedRate.toLocaleString("en-US")} / {net.asset}
                </dd>
              </>
            )}
          </dl>
        </div>
        <div className="adm-card">
          <h2>Customer</h2>
          <dl className="adm-dl">
            <dt>Name</dt>
            <dd>{o.customer.name}</dd>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${o.customer.email}`}>{o.customer.email}</a>
            </dd>
            <dt>Phone</dt>
            <dd>{o.customer.phone}</dd>
            <dt>Location</dt>
            <dd>
              {o.customer.city}, {o.customer.country}
            </dd>
            {o.customer.address && (
              <>
                <dt>Address</dt>
                <dd>{o.customer.address}</dd>
              </>
            )}
          </dl>
        </div>
      </section>

      {dest && (
        <section className="adm-card">
          <h2>Paying into</h2>
          {dest.kind === "wallet" ? (
            <p className="adm-mono">
              {net!.label} · {dest.address}{" "}
              <a href={net!.explorerAddress(dest.address)} target="_blank" rel="noreferrer">
                view on explorer ↗
              </a>
            </p>
          ) : (
            <p className="adm-mono">
              {dest.bankName} · {dest.accountName} · {dest.accountNumber} ({dest.currency})
            </p>
          )}
        </section>
      )}

      {o.schedule.length > 0 && (
        <section className="adm-card adm-scroll">
          <h2>Installments</h2>
          <table className="adm-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Due</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Transaction</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {o.schedule.map((s) => (
                <tr key={s.n}>
                  <td>{s.n}</td>
                  <td>{s.dueDate}</td>
                  <td>
                    {money(s.amountCents)}
                    {s.cryptoAmount && net && (
                      <div className="adm-muted adm-mono">
                        {s.cryptoAmount} {net.asset}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`adm-pill adm-pill--${s.status === "paid" ? "ok" : s.status === "submitted" ? "info" : "muted"}`}>
                      {s.status === "submitted" ? "Sent — verify" : s.status}
                    </span>
                    {s.paidAt && <div className="adm-muted">{when(s.paidAt)}</div>}
                  </td>
                  <td className="adm-mono">
                    {s.txHash ? (
                      net ? (
                        <a href={net.explorerTx(s.txHash)} target="_blank" rel="noreferrer">
                          {s.txHash.slice(0, 10)}…{s.txHash.slice(-6)} ↗
                        </a>
                      ) : (
                        s.txHash
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {s.status !== "paid" && !closed && (
                      <div className="adm-actions">
                        <form action={confirmInstallment} className="adm-inline">
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="n" value={s.n} />
                          <input
                            name="txHash"
                            defaultValue={s.txHash ?? ""}
                            placeholder={net ? "tx hash (optional)" : "bank reference (optional)"}
                            aria-label="Transaction hash or reference"
                          />
                          <button className="adm-btn adm-btn--primary" type="submit">
                            Confirm received
                          </button>
                        </form>
                        {s.status === "submitted" && (
                          <form action={rejectSubmission}>
                            <input type="hidden" name="orderId" value={o.id} />
                            <input type="hidden" name="n" value={s.n} />
                            <button className="adm-btn adm-btn--ghost" type="submit">
                              Not found
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="adm-muted">
            Verify each payment on the explorer (or your bank statement) before confirming. The customer&apos;s receipt
            updates automatically.
          </p>
        </section>
      )}

      <section className="adm-grid2">
        <div className="adm-card">
          <h2>Timeline</h2>
          <ol className="adm-timeline">
            {o.events
              .slice()
              .reverse()
              .map((e, i) => (
                <li key={i}>
                  <span className={`adm-tag adm-tag--${e.by}`}>{e.by}</span>
                  <div>
                    {e.note}
                    <div className="adm-muted">{when(e.at)}</div>
                  </div>
                </li>
              ))}
          </ol>
        </div>
        {!closed && (
          <div className="adm-card">
            <h2>Cancel reservation</h2>
            <form action={cancelOrder} className="adm-stack">
              <input type="hidden" name="orderId" value={o.id} />
              <label className="adm-field">
                <span>Reason</span>
                <input name="reason" placeholder="e.g. customer request" />
              </label>
              <button className="adm-btn adm-btn--danger" type="submit">
                Cancel reservation
              </button>
            </form>
          </div>
        )}
      </section>
    </>
  );
}
