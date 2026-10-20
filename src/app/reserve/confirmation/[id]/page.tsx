import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CommerceShell } from "@/components/commerce/CommerceShell";
import { PrintButton } from "@/components/commerce/PrintButton";
import { CopyField, LiveRefresh, NotifyPaid } from "@/components/commerce/PaymentLive";
import { COLORS, PLANS, TRIMS } from "@/lib/commerce/catalog";
import { formatMoney } from "@/lib/commerce/pricing";
import { METHOD_LABEL, NETWORKS, paymentUri } from "@/lib/commerce/crypto";
import { getRepo, type OrderStatus } from "@/lib/server/repo";

export const metadata: Metadata = { title: "Reservation — Roadster Fan Concept (Demo)", robots: { index: false } };
export const dynamic = "force-dynamic";
// good
const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  awaiting_payment: { label: "Awaiting payment", tone: "wait" },
  partially_paid: { label: "Installment plan active", tone: "ok" },
  paid: { label: "Fully paid", tone: "ok" },
  invitation_requested: { label: "Invitation requested", tone: "wait" },
  cancelled: { label: "Cancelled", tone: "bad" },
};

export default async function Confirmation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const order = await getRepo().getOrder(id);
  if (!order) notFound();
  const trim = TRIMS.find((t) => t.id === order.trimId)!;
  const plan = PLANS.find((p) => p.id === order.planId);
  const status = STATUS[order.status];
  const money = (c: number) => formatMoney(c, "USD");
  const dest = order.destination;
  const net = dest?.kind === "wallet" ? NETWORKS[dest.network] : null;
  const next = order.schedule.find((s) => s.status === "due" || s.status === "submitted");
  const open = order.status === "awaiting_payment" || order.status === "partially_paid";

  let qrSvg = "";
  let uri = "";
  if (open && next && dest?.kind === "wallet" && next.cryptoAmount) {
    uri = paymentUri(dest.network, dest.address, next.cryptoAmount, order.number);
    qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 220, color: { dark: "#0d0d0d", light: "#ffffff" } });
  }
  const bankAmount =
    next && dest?.kind === "bank"
      ? dest.currency === "NGN" && order.lockedRate
        ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(
            (next.amountCents / 100) * order.lockedRate,
          )
        : money(next.amountCents)
      : "";

  return (
    <CommerceShell active="reserve">
      <article className="receipt">
        <p className="mono eyebrow">Reservation · test networks</p>
        <h1>
          {order.status === "invitation_requested"
            ? "Request received."
            : order.status === "paid"
              ? "Fully paid. Welcome aboard."
              : order.status === "cancelled"
                ? "Reservation cancelled."
                : order.paidCents > 0
                  ? "Payment received."
                  : "Complete your payment."}
        </h1>
        <div className="receipt__meta">
          <div>
            <span className="mono">Reservation</span>
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

        {open && next && dest && (
          <section className="paybox">
            <div className="paybox__head">
              <div>
                <span className="mono">
                  Installment {next.n} of {order.schedule.length} · {METHOD_LABEL[order.method as "btc" | "eth" | "bank"]}
                </span>
                <h2>
                  {net && next.cryptoAmount ? (
                    <>
                      Send {next.cryptoAmount} {net.asset}
                    </>
                  ) : (
                    <>Transfer {bankAmount}</>
                  )}
                </h2>
                <p>
                  {money(next.amountCents)}
                  {net && order.lockedRate ? ` · rate locked at $${order.lockedRate.toLocaleString("en-US")}/${net.asset}` : ""}
                </p>
              </div>
              <LiveRefresh active />
            </div>

            {next.status === "submitted" ? (
              <p className="notice notice--info">
                <strong>Payment sent — verifying.</strong> An admin is confirming installment {next.n}
                {next.txHash ? ` (tx ${next.txHash.slice(0, 10)}…)` : ""}. This page updates automatically.
              </p>
            ) : dest.kind === "wallet" ? (
              <div className="paybox__grid">
                <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} role="img" aria-label="Payment QR code" />
                <div className="paybox__fields">
                  <p className="notice">
                    <strong>{net!.label} only.</strong> This is a demo on a test network — testnet coins have no value.
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
            ) : (
              <div className="paybox__fields">
                <CopyField label="Bank" value={dest.bankName} />
                <CopyField label="Account name" value={dest.accountName} />
                <CopyField label="Account number" value={dest.accountNumber} />
                <CopyField label="Narration / reference" value={order.number} />
                <NotifyPaid orderId={order.id} kind="bank" />
              </div>
            )}
          </section>
        )}

        <dl className="receipt__lines">
          <div>
            <dt>Vehicle</dt>
            <dd>
              Roadster {trim.name} · {COLORS.find((c) => c.id === order.colorId)?.name}
            </dd>
          </div>
          {order.totalCents > 0 && (
            <>
              <div>
                <dt>Reservation amount</dt>
                <dd>{money(order.totalCents)}</dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>{plan?.label}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Customer</dt>
            <dd>
              {order.customer.name} · {order.customer.email} · {order.customer.city}, {order.customer.country}
            </dd>
          </div>
          <div>
            <dt>Reserved</dt>
            <dd>{new Date(order.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</dd>
          </div>
        </dl>

        {order.schedule.length > 0 && (
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
          <PrintButton />
        </div>
        <p className="hint">Keep this page&apos;s link — it&apos;s your receipt. A confirmation email would be sent here once an email provider is connected.</p>
      </article>
    </CommerceShell>
  );
}
