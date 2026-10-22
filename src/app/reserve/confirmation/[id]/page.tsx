import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CommerceShell } from "@/components/commerce/CommerceShell";
import { PrintButton } from "@/components/commerce/PrintButton";
import { CopyField, Countdown, LiveRefresh, NotifyPaid, RequestPayment } from "@/components/commerce/PaymentLive";
import { COLORS, PLANS, TRIMS } from "@/lib/commerce/catalog";
import { formatMoney } from "@/lib/commerce/pricing";
import { METHOD_LABEL, NETWORKS, paymentUri } from "@/lib/commerce/crypto";
import { formatDriveDate } from "@/lib/commerce/offers";
import { getRepo, paymentState, type Order, type OrderStatus } from "@/lib/server/repo";
import { driveIcs } from "@/lib/server/mail";

export const metadata: Metadata = { title: "Your booking | Roadster Concept", robots: { index: false } };
export const dynamic = "force-dynamic";
const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  payment_requested: { label: "Preparing payment details", tone: "wait" },
  awaiting_payment: { label: "Awaiting payment", tone: "wait" },
  partially_paid: { label: "Installment plan active", tone: "ok" },
  paid: { label: "Fully paid", tone: "ok" },
  invitation_requested: { label: "Invitation requested", tone: "wait" },
  cancelled: { label: "Cancelled", tone: "bad" },
};

/** Calendar invite for a paid test drive, in the city's own time zone. */
const calendarHref = (o: Order) => `data:text/calendar;charset=utf-8,${encodeURIComponent(driveIcs(o))}`;

export default async function Confirmation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const order = await getRepo().getOrder(id);
  if (!order) notFound();
  const trim = TRIMS.find((t) => t.id === order.trimId)!;
  const plan = PLANS.find((p) => p.id === order.planId);
  const isDriveOrder = order.kind === "test_drive";
  const status = isDriveOrder && order.status === "paid" ? { label: "Confirmed", tone: "ok" } : STATUS[order.status];
  const money = (c: number) => formatMoney(c);
  const dest = order.destination;
  const net = dest?.kind === "wallet" ? NETWORKS[dest.network] : null;
  const pay = paymentState(order);
  const next = pay.next;
  const open = ["payment_requested", "awaiting_payment", "partially_paid"].includes(order.status);
  const drive = order.kind === "test_drive" && order.booking ? order.booking : null;
  const noun = drive ? "Booking" : "Reservation";
  const methodLabel = order.method === "none" ? "" : METHOD_LABEL[order.method];
  const label = next && order.schedule.length > 1 ? `Installment ${next.n} of ${order.schedule.length}` : "Payment";
  const showDetails = open && next && dest && (pay.live || next.status === "submitted");

  let qrSvg = "";
  let uri = "";
  if (showDetails && next.status === "due" && dest.kind === "wallet" && next.cryptoAmount) {
    uri = paymentUri(dest.network, dest.address, next.cryptoAmount, order.number);
    qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 220, color: { dark: "#0d0d0d", light: "#ffffff" } });
  }

  return (
    <CommerceShell active={drive ? "drive" : "reserve"}>
      <article className="receipt">
        <p className="mono eyebrow">{drive ? "Test drive" : "Reservation"} · test networks</p>
        <h1>
          {order.status === "invitation_requested"
            ? "Request received."
            : order.status === "paid"
              ? drive
                ? drive.status === "completed"
                  ? "Thanks for driving with us."
                  : "You're booked. See you on the road."
                : "Fully paid. Welcome aboard."
              : order.status === "cancelled"
                ? `${noun} cancelled.`
                : pay.live
                  ? "Complete your payment."
                  : order.paidCents > 0
                    ? "Payment received."
                    : "Request received."}
        </h1>
        <div className="receipt__meta">
          <div>
            <span className="mono">{noun}</span>
            <strong>{order.number}</strong>
          </div>
          <div>
            <span className="mono">Status</span>
            <strong className={`badge badge--${status.tone}`}>{status.label}</strong>
          </div>
          <div>
            <span className="mono">Paid</span>
            <strong>
              {money(order.paidCents)} of {money(order.totalCents)}
            </strong>
          </div>
        </div>

        {open && next && (
          <section className="paybox">
            <div className="paybox__head">
              <div>
                <span className="mono">
                  {label}
                  {methodLabel ? ` · ${methodLabel}` : ""}
                </span>
                <h2>
                  {showDetails && net && next.cryptoAmount ? (
                    <>
                      Send {next.cryptoAmount} {net.asset}
                    </>
                  ) : showDetails ? (
                    <>Transfer {money(next.amountCents)}</>
                  ) : (
                    <>{money(next.amountCents)}</>
                  )}
                </h2>
                <p>
                  {showDetails && net && order.lockedRate
                    ? `${money(next.amountCents)} · rate locked at $${order.lockedRate.toLocaleString("en-US")}/${net.asset}`
                    : `Due ${next.n === 1 ? "now" : next.dueDate}`}
                </p>
              </div>
              <div className="paybox__side">
                {pay.live && next.status === "due" && <Countdown until={pay.win!.expiresAt} />}
                <LiveRefresh active />
              </div>
            </div>

            {next.status === "submitted" ? (
              <p className="notice notice--info">
                <strong>Payment sent, verifying.</strong> Our team is confirming {label.toLowerCase()}
                {next.txHash ? ` (tx ${next.txHash.slice(0, 10)}…)` : ""}. This page updates automatically.
              </p>
            ) : pay.live && dest?.kind === "wallet" ? (
              <div className="paybox__grid">
                <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} role="img" aria-label="Payment QR code" />
                <div className="paybox__fields">
                  <p className="notice">
                    <strong>{net!.label} only.</strong> Payments run on a test network, so testnet coins have no value.
                    Do not send real {net!.asset}.
                  </p>
                  <CopyField label="Address" value={dest.address} />
                  <CopyField label={`Amount (${net!.asset})`} value={next.cryptoAmount!} />
                  <a className="mono" href={uri}>
                    Open in wallet app ↗
                  </a>
                  <NotifyPaid orderId={order.id} kind="wallet" />
                </div>
              </div>
            ) : pay.live && dest?.kind === "bank" ? (
              <div className="paybox__fields">
                <CopyField label="Bank" value={dest.bankName} />
                <CopyField label="Account name" value={dest.accountName} />
                <CopyField label="Account number" value={dest.accountNumber} />
                <CopyField label="Amount (USD)" value={(next.amountCents / 100).toFixed(2)} />
                <CopyField label="Narration / reference" value={order.number} />
                <NotifyPaid orderId={order.id} kind="bank" />
              </div>
            ) : pay.requested ? (
              <p className="notice notice--info">
                <strong>We&apos;re preparing your payment details.</strong> Our team has been notified and will send the
                {order.method === "bank" ? " bank account" : " wallet address and exact amount"} here shortly. You don&apos;t
                need to refresh: this page updates by itself.
              </p>
            ) : pay.expired ? (
              <div className="paybox__fields">
                <p className="notice">
                  <strong>These payment details have expired.</strong> Don&apos;t send to the old address or account.
                  Request new details and we&apos;ll issue them with a fresh rate.
                </p>
                <RequestPayment orderId={order.id} method={order.method} label="Request new payment details" />
              </div>
            ) : (
              <div className="paybox__fields">
                <p className="notice">
                  {label} is due {next.n === 1 ? "now" : `on ${next.dueDate}`}. Request your payment details when you&apos;re
                  ready to pay.
                </p>
                <RequestPayment orderId={order.id} method={order.method} label="Request payment details" />
              </div>
            )}
          </section>
        )}

        <dl className="receipt__lines">
          {drive && (
            <>
              <div>
                <dt>Experience</dt>
                <dd>
                  {drive.packageName} · {drive.durationMin} min
                </dd>
              </div>
              <div>
                <dt>When</dt>
                <dd>
                  {formatDriveDate(drive.date)} at {drive.time} (local time)
                  {drive.status !== "scheduled" && <> · {drive.status === "completed" ? "completed" : "missed"}</>}
                </dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>
                  {drive.locationName}
                  {drive.country ? `, ${drive.country}` : ""}
                </dd>
              </div>
              <div>
                <dt>Meeting point</dt>
                <dd>
                  {order.status === "paid"
                    ? `${drive.locationAddress}${drive.emailedAt ? " · also sent to your email" : ""}`
                    : "We email you the exact meeting point as soon as your payment is confirmed."}
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>{drive ? "Car" : "Vehicle"}</dt>
            <dd>
              Roadster {trim.name}
              {drive ? "" : ` · ${COLORS.find((c) => c.id === order.colorId)?.name}`}
            </dd>
          </div>
          {(order.items ?? []).map((it) => (
            <div key={it.id}>
              <dt>{it.id.startsWith("pkg:") || it.id.startsWith("trim:") ? (drive ? "Experience fee" : "Reservation amount") : it.name}</dt>
              <dd>{money(it.priceCents)}</dd>
            </div>
          ))}
          {order.discount && (
            <div>
              <dt>Promo {order.discount.code}</dt>
              <dd>− {money(order.discount.cents)}</dd>
            </div>
          )}
          {order.totalCents > 0 && (
            <>
              <div>
                <dt>Total</dt>
                <dd>
                  <strong>{money(order.totalCents)}</strong>
                </dd>
              </div>
              {!drive && (
                <div>
                  <dt>Plan</dt>
                  <dd>{plan?.label}</dd>
                </div>
              )}
            </>
          )}
          {drive?.creditable && (
            <div>
              <dt>Credit</dt>
              <dd>This fee is credited towards a Roadster reservation made within 30 days.</dd>
            </div>
          )}
          <div>
            <dt>Customer</dt>
            <dd>
              {order.customer.name} · {order.customer.email} · {order.customer.city}, {order.customer.country}
            </dd>
          </div>
          <div>
            <dt>{drive ? "Booked" : "Reserved"}</dt>
            <dd>{new Date(order.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</dd>
          </div>
        </dl>

        {order.schedule.length > 1 && (
          <table className="schedule">
            <thead>
              <tr>
                <th>#</th>
                <th>Due</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {order.schedule.map((s) => (
                <tr key={s.n}>
                  <td>{s.n}</td>
                  <td>{s.dueDate}</td>
                  <td>
                    {money(s.amountCents)}
                    {s.cryptoAmount && net ? ` · ${s.cryptoAmount} ${net.asset}` : ""}
                  </td>
                  <td className={`st st--${s.status}`}>
                    {s.status === "submitted" ? "verifying" : s.status}
                    {s.txHash && net && (
                      <>
                        {" "}
                        ·{" "}
                        <a href={net.explorerTx(s.txHash)} target="_blank" rel="noreferrer">
                          tx ↗
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="receipt__actions">
          <a className="cta" href="/">
            Back to the experience
          </a>
          {drive && order.status === "paid" && (
            <a className="btn-ghost" href={calendarHref(order)} download={`roadster-${order.number}.ics`}>
              Add to calendar
            </a>
          )}
          <PrintButton />
        </div>
        <p className="hint">Keep this page&apos;s link: it&apos;s your receipt. A confirmation email would be sent here once an email provider is connected.</p>
      </article>
    </CommerceShell>
  );
}
