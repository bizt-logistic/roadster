import Link from "next/link";
import { api, ApiError, type Summary } from "@/lib/api";
import { METHOD_LABEL, TRIM_NAME, isDrive, money, payState, relative, when } from "@/lib/types";
import { ApiProblem, Flash, PayPill } from "../../ui";
import { IssueForm } from "../IssueForm";

export default async function Requests({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const flash = await searchParams;
  let s: Summary;
  try {
    s = await api.summary();
  } catch (e) {
    return <ApiProblem message={e instanceof ApiError ? e.message : "Unknown error."} />;
  }
  const open = s.orders.filter((o) => !["cancelled", "paid", "invitation_requested"].includes(o.status));
  const waiting = open
    .filter((o) => payState(o).requested)
    .sort((a, b) => a.request!.requestedAt.localeCompare(b.request!.requestedAt));
  const live = open.filter((o) => payState(o).live && payState(o).next?.status === "due");
  const expired = open.filter((o) => payState(o).expired && !payState(o).requested);

  return (
    <>
      <header className="adm-head">
        <h1>Payment requests</h1>
        <p className="adm-muted">
          Customers can&apos;t pay until you generate their payment details. Pick the wallet or account, confirm the amount and
          choose how long the details stay valid.
        </p>
      </header>
      <Flash ok={flash.ok} error={flash.error} />

      <section className="adm-card">
        <div className="adm-card__head">
          <h2>Waiting for you ({waiting.length})</h2>
        </div>
        {waiting.length === 0 && <p className="adm-muted">No requests waiting. New ones appear here with a sound alert.</p>}
        <div className="adm-stack">
          {waiting.map((o) => (
            <article key={o.id} className="adm-request">
              <div className="adm-request__head">
                <div>
                  <Link href={`/orders/${o.id}`}>
                    <strong>{o.number}</strong>
                  </Link>{" "}
                  · {o.customer.name} · <a href={`tel:${o.customer.phone.replace(/\s/g, "")}`}>{o.customer.phone}</a>
                  <div className="adm-muted adm-small">
                    {isDrive(o) ? `Test drive · ${o.booking?.packageName} · ${o.booking?.date} ${o.booking?.time}` : `Reservation · Roadster ${TRIM_NAME[o.trimId]}`}
                    {" · "}prefers {METHOD_LABEL[o.request!.method]} · requested {relative(o.request!.requestedAt)}
                  </div>
                </div>
                <PayPill o={o} />
              </div>
              <IssueForm o={o} wallets={s.wallets} banks={s.banks} back="/requests" />
            </article>
          ))}
        </div>
      </section>

      <section className="adm-grid2">
        <div className="adm-card">
          <h2>Details live ({live.length})</h2>
          {live.length === 0 ? (
            <p className="adm-muted">None.</p>
          ) : (
            <table className="adm-table">
              <tbody>
                {live.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/orders/${o.id}`}>{o.number}</Link>
                      <div className="adm-muted">{o.customer.name}</div>
                    </td>
                    <td>{money(payState(o).next!.amountCents)}</td>
                    <td className="adm-muted">expires {relative(o.window!.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="adm-card">
          <h2>Expired, not re-requested ({expired.length})</h2>
          {expired.length === 0 ? (
            <p className="adm-muted">None.</p>
          ) : (
            <table className="adm-table">
              <tbody>
                {expired.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/orders/${o.id}`}>{o.number}</Link>
                      <div className="adm-muted">{o.customer.name}</div>
                    </td>
                    <td className="adm-muted">expired {when(o.window!.expiresAt)}</td>
                    <td>
                      <Link href={`/orders/${o.id}`}>Re-issue →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
