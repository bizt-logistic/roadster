import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { when, type EmailRecord } from "@/lib/types";
import { ApiProblem } from "../../ui";

const STATUS: Record<EmailRecord["status"], { label: string; tone: string }> = {
  sent: { label: "Sent", tone: "ok" },
  logged: { label: "Saved, not delivered", tone: "warn" },
  failed: { label: "Failed", tone: "bad" },
};

export default async function Emails() {
  let emails: EmailRecord[];
  try {
    emails = await api.emails();
  } catch (e) {
    return <ApiProblem message={e instanceof ApiError ? e.message : "Unknown error."} />;
  }
  const delivering = emails.some((e) => e.provider === "resend");
  return (
    <>
      <header className="adm-head">
        <h1>Emails</h1>
        <p className="adm-muted">
          Customers get their test-drive meeting point by email as soon as you confirm their payment. Every message is kept here.
        </p>
      </header>
      {!delivering && (
        <p className="adm-flash adm-flash--warn">
          No email provider is connected yet, so messages are saved here but not delivered. Add <code>RESEND_API_KEY</code> and{" "}
          <code>MAIL_FROM</code> to the site&apos;s <code>.env.local</code> to send them for real.
        </p>
      )}
      <section className="adm-stack">
        {emails.map((m) => (
          <details key={m.id} className="adm-card adm-mail">
            <summary>
              <span className={`adm-pill adm-pill--${STATUS[m.status].tone}`}>{STATUS[m.status].label}</span>
              <strong>{m.subject}</strong>
              <span className="adm-muted">
                to {m.to} · {when(m.createdAt)}
              </span>
            </summary>
            {m.error && <p className="adm-flash adm-flash--error">{m.error}</p>}
            {m.orderId && (
              <p>
                <Link href={`/orders/${m.orderId}`}>Open booking →</Link>
              </p>
            )}
            <iframe className="adm-mail__preview" title={`Preview: ${m.subject}`} srcDoc={m.html} sandbox="" />
          </details>
        ))}
        {emails.length === 0 && (
          <div className="adm-card">
            <p className="adm-muted">No emails yet. The first one goes out when you confirm a test-drive payment.</p>
          </div>
        )}
      </section>
    </>
  );
}
