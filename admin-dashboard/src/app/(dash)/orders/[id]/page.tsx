import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError, type Summary } from "@/lib/api";
import { BOOKING_LABEL, METHOD_LABEL, NETWORKS, PLAN_LABEL, TRIM_NAME, cetToday, driveDay, isDrive, money, payState, relative, when, type Catalog, type Order } from "@/lib/types";
import { adminAction, cancelOrder, confirmInstallment, rejectSubmission } from "../../../actions";
import { Act, ApiProblem, Flash, StatusPill } from "../../../ui";
import { IssueForm } from "../../IssueForm";

export default async function OrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const flash = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let o: Order;
  let catalog: Catalog;
  let summary: Summary;
  try {
    [o, summary] = await Promise.all([api.order(id), api.summary()]);
    catalog = summary.catalog;
  } catch (e) {
    if (e instanceof ApiError && /not found/i.test(e.message)) notFound();
    return <ApiProblem message={e instanceof ApiError ? e.message : "Unknown error."} />;
  }
  const dest = o.destination;
  const net = dest?.kind === "wallet" ? NETWORKS[dest.network] : null;
  const closed = o.status === "cancelled" || o.status === "invitation_requested";
  const site = process.env.SITE_URL ?? "";
  const drive = isDrive(o) ? o.booking : undefined;
  const back = `/orders/${o.id}`;
  const pay = payState(o);

  return (
    <>
      <header className="adm-head">
        <Link href={drive ? "/test-drives" : "/orders"} className="adm-muted">
          ← {drive ? "Test drives" : "Reservations"}
        </Link>
        <h1>
          {o.number} <StatusPill status={o.status} />
        </h1>
        <p className="adm-muted">
          Created {when(o.createdAt)} ·{" "}
          <a href={`${site}/reserve/confirmation/${o.id}`} target="_blank" rel="noreferrer">
            customer receipt ↗
          </a>
        </p>
      </header>
      <Flash ok={flash.ok} error={flash.error} />

      <section className="adm-grid2">
        <div className="adm-card">
          <h2>{drive ? "Test drive booking" : "Reservation"}</h2>
          <dl className="adm-dl">
            <dt>{drive ? "Car" : "Version"}</dt>
            <dd>Roadster {TRIM_NAME[o.trimId] ?? o.trimId}</dd>
            {!drive && (
              <>
                <dt>Plan</dt>
                <dd>{PLAN_LABEL[o.planId] ?? "Pay in full"}</dd>
              </>
            )}
            {(o.items ?? []).map((it) => (
              <div key={it.id} className="adm-dl__row">
                <dt>{it.id.startsWith("pkg:") ? "Experience" : it.id.startsWith("trim:") ? "Reservation" : "Add-on"}</dt>
                <dd>
                  {it.name} · {money(it.priceCents)}
                </dd>
              </div>
            ))}
            {o.discount && (
              <>
                <dt>Promo</dt>
                <dd>
                  {o.discount.code} · −{money(o.discount.cents)}
                </dd>
              </>
            )}
            <dt>Total</dt>
            <dd>{money(o.totalCents)}</dd>
            <dt>Received</dt>
            <dd>{money(o.paidCents)}</dd>
            <dt>Method</dt>
            <dd>{METHOD_LABEL[o.method]}</dd>
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

      {drive && (
        <section className="adm-card">
          <div className="adm-card__head">
            <h2>Drive</h2>
            <span className={`adm-pill adm-pill--${drive.status === "completed" ? "ok" : drive.status === "no_show" ? "bad" : "muted"}`}>
              {BOOKING_LABEL[drive.status]}
            </span>
          </div>
          <dl className="adm-dl">
            <dt>Experience</dt>
            <dd>
              {drive.packageName} · {drive.durationMin} min
            </dd>
            <dt>When</dt>
            <dd>
              {driveDay(drive.date)} at {drive.time} (local time{drive.timeZone ? `, ${drive.timeZone}` : ""})
            </dd>
            <dt>City</dt>
            <dd>
              {drive.locationName}
              {drive.country ? `, ${drive.country}` : ""}
            </dd>
            <dt>Meeting point</dt>
            <dd>{drive.locationAddress}</dd>
            <dt>Meeting email</dt>
            <dd>
              {drive.emailedAt ? `Sent ${when(drive.emailedAt)} to ${o.customer.email}` : o.status === "paid" ? "Not sent yet" : "Sent automatically when the payment is confirmed"}
            </dd>
          </dl>
          {o.status === "paid" && drive.status === "scheduled" && (
            <form action={adminAction} className="adm-gap">
              <Act action="sendMeetingDetails" back={back} />
              <input type="hidden" name="orderId" value={o.id} />
              <button className="adm-btn" type="submit">
                {drive.emailedAt ? "Resend meeting email" : "Email meeting details"}
              </button>
            </form>
          )}
          {!closed && (
            <>
              <div className="adm-actions adm-gap">
                {(["completed", "no_show", "scheduled"] as const)
                  .filter((st) => st !== drive.status)
                  .map((st) => (
                    <form key={st} action={adminAction}>
                      <Act action="setBookingStatus" back={back} />
                      <input type="hidden" name="orderId" value={o.id} />
                      <input type="hidden" name="status" value={st} />
                      <button className="adm-btn adm-btn--ghost" type="submit">
                        Mark {BOOKING_LABEL[st].toLowerCase()}
                      </button>
                    </form>
                  ))}
              </div>
              <form action={adminAction} className="adm-form">
                <Act action="rescheduleBooking" back={back} />
                <input type="hidden" name="orderId" value={o.id} />
                <label className="adm-field">
                  <span>New date</span>
                  <input type="date" name="date" min={cetToday()} defaultValue={drive.date} required />
                </label>
                <label className="adm-field">
                  <span>Time</span>
                  <select name="time" defaultValue={drive.time}>
                    {[...new Set([...catalog.testDrive.slots, drive.time])].sort().map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="adm-field">
                  <span>City</span>
                  <select name="locationId" defaultValue={drive.locationId}>
                    {catalog.testDrive.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="adm-btn" type="submit">
                  Reschedule
                </button>
              </form>
            </>
          )}
        </section>
      )}

      {!closed && pay.next && (
        <section className="adm-card">
          <div className="adm-card__head">
            <h2>Payment details</h2>
            {pay.requested ? (
              <span className="adm-pill adm-pill--warn">Customer is waiting</span>
            ) : pay.live ? (
              <span className="adm-pill adm-pill--info">Live · expires {relative(pay.win!.expiresAt)}</span>
            ) : pay.expired ? (
              <span className="adm-pill adm-pill--bad">Expired {relative(pay.win!.expiresAt)}</span>
            ) : (
              <span className="adm-pill adm-pill--muted">Not issued</span>
            )}
          </div>
          <p className="adm-muted">
            {pay.requested
              ? `Requested ${relative(o.request!.requestedAt)} by ${METHOD_LABEL[o.request!.method]}. Generate the details below; the customer sees them instantly.`
              : pay.live
                ? `Issued ${when(pay.win!.issuedAt)}, valid until ${when(pay.win!.expiresAt)}. Generating again replaces them and restarts the timer.`
                : pay.expired
                  ? "The customer's details expired. They can request new ones, or you can issue them now."
                  : "The next installment hasn't been requested yet. You can issue details now if the customer asked by phone."}
          </p>
          {pay.next.status === "submitted" ? (
            <p className="adm-flash adm-flash--warn">The customer says they've paid. Verify it in the table below first.</p>
          ) : (
            <IssueForm o={o} wallets={summary.wallets} banks={summary.banks} back={back} />
          )}
        </section>
      )}

      {dest && (
        <section className="adm-card">
          <h2>Paying into</h2>
          {dest.kind === "wallet" ? (
            <p className="adm-mono">
              {net!.label} · {dest.address}{" "}
              <a href={net!.address(dest.address)} target="_blank" rel="noreferrer">
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
          <h2>{o.schedule.length > 1 ? "Installments" : "Payment"}</h2>
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
              {o.schedule.map((x) => (
                <tr key={x.n}>
                  <td>{x.n}</td>
                  <td>{x.dueDate}</td>
                  <td>
                    {money(x.amountCents)}
                    {x.cryptoAmount && net && (
                      <div className="adm-muted adm-mono">
                        {x.cryptoAmount} {net.asset}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`adm-pill adm-pill--${x.status === "paid" ? "ok" : x.status === "submitted" ? "info" : "muted"}`}>
                      {x.status === "submitted" ? "Sent, verify" : x.status}
                    </span>
                    {x.paidAt && <div className="adm-muted">{when(x.paidAt)}</div>}
                  </td>
                  <td className="adm-mono">
                    {x.txHash ? (
                      net ? (
                        <a href={net.tx(x.txHash)} target="_blank" rel="noreferrer">
                          {x.txHash.slice(0, 10)}…{x.txHash.slice(-6)} ↗
                        </a>
                      ) : (
                        x.txHash
                      )
                    ) : (
                      "None"
                    )}
                  </td>
                  <td>
                    {x.status !== "paid" && !closed && (
                      <div className="adm-actions">
                        <form action={confirmInstallment} className="adm-inline">
                          <input type="hidden" name="orderId" value={o.id} />
                          <input type="hidden" name="n" value={x.n} />
                          <input
                            name="txHash"
                            defaultValue={x.txHash ?? ""}
                            placeholder={net ? "tx hash (optional)" : "bank reference (optional)"}
                            aria-label="Transaction hash or reference"
                          />
                          <button className="adm-btn adm-btn--primary" type="submit">
                            Confirm received
                          </button>
                        </form>
                        {x.status === "submitted" && (
                          <form action={rejectSubmission}>
                            <input type="hidden" name="orderId" value={o.id} />
                            <input type="hidden" name="n" value={x.n} />
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
            Verify each payment on the test-network explorer (or the bank statement) before confirming. The
            customer&apos;s receipt updates automatically.
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
            <h2>Cancel {drive ? "booking" : "reservation"}</h2>
            <form action={cancelOrder} className="adm-stack">
              <input type="hidden" name="orderId" value={o.id} />
              <label className="adm-field">
                <span>Reason</span>
                <input name="reason" placeholder="e.g. customer request" />
              </label>
              <button className="adm-btn adm-btn--danger" type="submit">
                Cancel {drive ? "booking" : "reservation"}
              </button>
            </form>
          </div>
        )}
      </section>
    </>
  );
}
