"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { COLORS, PLANS, TRIMS, type Currency, type PlanId, type TrimId } from "@/lib/commerce/catalog";
import { formatMoney, quote } from "@/lib/commerce/pricing";
import { METHOD_LABEL, NETWORKS, cryptoAmount, type Method } from "@/lib/commerce/crypto";

const CarViewer = dynamic(() => import("./CarViewer"), { ssr: false, loading: () => <div className="viewer viewer--loading" /> });

const COUNTRIES = ["Nigeria", "Ghana", "Kenya", "South Africa", "United States", "United Kingdom", "Canada", "United Arab Emirates", "Germany", "Other"];


type Errors = Record<string, string>;

export function ReserveFlow() {
  const [trimId, setTrimId] = useState<TrimId>("performance");
  const [planId, setPlanId] = useState<PlanId>("full");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [method, setMethod] = useState<Method>("btc");
  const [opts, setOpts] = useState<{ methods: Record<Method, boolean>; rates: { btcUsd: number; ethUsd: number; ngnPerUsd: number } } | null>(null);
  useEffect(() => {
    fetch("/api/payment-options", { cache: "no-store" })
      .then((r) => r.json())
      .then((o) => {
        setOpts(o);
        const first = (["btc", "eth", "bank"] as Method[]).find((m) => o.methods[m]);
        if (first) setMethod(first);
      })
      .catch(() => setOpts(null));
  }, []);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", country: "Nigeria", city: "", address: "" });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const trim = TRIMS.find((t) => t.id === trimId)!;
  const invite = trim.reservationCents == null;
  const q = useMemo(() => quote(trimId, planId), [trimId, planId]);
  const money = (c: number) => formatMoney(c, currency);

  const set = (k: keyof typeof customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCustomer((c) => ({ ...c, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServerError("");
    const errs: Errors = {};
    if (!invite && opts && !opts.methods[method]) errs.method = "This payment method isn't available yet.";
    if (!consent) errs.consent = "Please confirm you understand this is a test-mode demo.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trimId, planId, colorId: COLORS[0].id, method, customer, consent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((x) => ({ ...x, ...(data.fields ?? {}) }));
        setServerError(data.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      window.location.assign(`/reserve/confirmation/${data.id}`);
    } catch {
      setServerError("Network error — please try again.");
      setBusy(false);
    }
  }

  const err = (k: string) => (errors[k] ? <span className="field__err">{errors[k]}</span> : null);

  return (
    <form className="reserve" onSubmit={submit} noValidate>
      <aside className="reserve__aside">
        <CarViewer className="viewer" />
        <div className="summary" aria-live="polite">
          <div className="summary__head">
            <span className="mono">Your reservation</span>
            <div className="seg" role="group" aria-label="Display currency">
              {(["USD", "NGN"] as const).map((c) => (
                <button type="button" key={c} aria-pressed={currency === c} onClick={() => setCurrency(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="summary__row">
            <span>Roadster {trim.name}</span>
            <span>{invite ? "By invitation" : money(trim.reservationCents!)}</span>
          </div>
          <div className="summary__row summary__row--muted">
            <span>Colour</span>
            <span>{COLORS[0].name}</span>
          </div>
          {!invite && q && (
            <>
              <div className="summary__row summary__row--muted">
                <span>Plan</span>
                <span>{PLANS.find((p) => p.id === planId)!.label}</span>
              </div>
              <div className="summary__total">
                <span>Due today</span>
                <strong>{money(q.dueTodayCents)}</strong>
              </div>
              {q.schedule.length > 1 && (
                <p className="summary__note">
                  Then {q.schedule.length - 1} × {money(q.schedule[1].amountCents)} monthly · 0% demo financing
                </p>
              )}
            </>
          )}
          {currency === "NGN" && <p className="summary__note">NGN shown at an indicative rate; this demo settles in USD.</p>}
        </div>
      </aside>

      <div className="reserve__steps">
        <section className="step">
          <h2>
            <span className="mono">01</span> Choose your Roadster
          </h2>
          <div className="trims" role="radiogroup" aria-label="Version">
            {TRIMS.map((t) => (
              <label key={t.id} className={`trim${t.id === trimId ? " is-on" : ""}`}>
                <input type="radio" name="trim" value={t.id} checked={t.id === trimId} onChange={() => setTrimId(t.id)} />
                <span className="trim__name">{t.name}</span>
                <span className="trim__tag">{t.tagline}</span>
                <span className="trim__price">{t.reservationCents == null ? "Request invitation" : `${money(t.reservationCents)} to reserve`}</span>
                <span className="trim__meta mono">
                  0–60 {t.zeroToSixty} · {t.seats} seat{t.seats > 1 ? "s" : ""}
                </span>
                <ul>
                  {t.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </label>
            ))}
          </div>
        </section>

        {!invite && (
          <section className="step">
            <h2>
              <span className="mono">02</span> Payment plan
            </h2>
            <div className="plans" role="radiogroup" aria-label="Payment plan">
              {PLANS.map((p) => {
                const pq = quote(trimId, p.id)!;
                return (
                  <label key={p.id} className={`plan${p.id === planId ? " is-on" : ""}`}>
                    <input type="radio" name="plan" value={p.id} checked={p.id === planId} onChange={() => setPlanId(p.id)} />
                    <span>{p.label}</span>
                    <strong>{p.months === 1 ? money(pq.totalCents) : `${money(pq.schedule[1].amountCents)}/mo`}</strong>
                  </label>
                );
              })}
            </div>
            {q && q.schedule.length > 1 && (
              <table className="schedule">
                <caption className="sr-only">Installment schedule</caption>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Due</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {q.schedule.map((s) => (
                    <tr key={s.n}>
                      <td>{s.n}</td>
                      <td>{s.n === 1 ? "Today" : s.dueDate}</td>
                      <td>{money(s.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        <section className="step">
          <h2>
            <span className="mono">{invite ? "02" : "03"}</span> Your details
          </h2>
          <div className="fields">
            <label className="field field--wide">
              <span>Full name</span>
              <input value={customer.name} onChange={set("name")} autoComplete="name" required />
              {err("name")}
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={customer.email} onChange={set("email")} autoComplete="email" required />
              {err("email")}
            </label>
            <label className="field">
              <span>Phone</span>
              <input type="tel" value={customer.phone} onChange={set("phone")} autoComplete="tel" placeholder="+234 …" required />
              {err("phone")}
            </label>
            <label className="field">
              <span>Country</span>
              <select value={customer.country} onChange={set("country")} autoComplete="country-name">
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {err("country")}
            </label>
            <label className="field">
              <span>City</span>
              <input value={customer.city} onChange={set("city")} autoComplete="address-level2" required />
              {err("city")}
            </label>
            <label className="field field--wide">
              <span>Delivery address (optional)</span>
              <input value={customer.address} onChange={set("address")} autoComplete="street-address" />
              {err("address")}
            </label>
          </div>
        </section>

        {!invite && (
          <section className="step">
            <h2>
              <span className="mono">04</span> Payment
            </h2>
            <div className="paymethods" role="radiogroup" aria-label="Payment method">
              {(["btc", "eth", "bank"] as Method[]).map((m) => {
                const available = opts ? opts.methods[m] : true;
                const est =
                  q && opts && m !== "bank"
                    ? `≈ ${cryptoAmount(q.dueTodayCents, m === "btc" ? opts.rates.btcUsd : opts.rates.ethUsd, m === "btc" ? 8 : 6)} ${m.toUpperCase()} today`
                    : m === "bank"
                      ? "NGN or USD account"
                      : "";
                return (
                  <label key={m} className={`paymethod${method === m ? " is-on" : ""}${available ? "" : " is-off"}`}>
                    <input type="radio" name="method" value={m} checked={method === m} disabled={!available} onChange={() => setMethod(m)} />
                    <span className="paymethod__icon" aria-hidden="true">{m === "btc" ? "₿" : m === "eth" ? "Ξ" : "⌂"}</span>
                    <span className="paymethod__name">{METHOD_LABEL[m]}</span>
                    <span className="paymethod__est">{available ? est : "Not available yet"}</span>
                  </label>
                );
              })}
            </div>
            {err("method")}
            <p className="hint">
              {method === "bank"
                ? "You'll get the account details and a reference on the next page. The reservation is held until the transfer is confirmed."
                : `Next you'll get a ${method === "btc" ? NETWORKS["btc-testnet"].label : NETWORKS["eth-sepolia"].label} address and QR code. Demo mode uses test networks only — testnet coins have no value. The rate is locked when you reserve.`}
            </p>
          </section>
        )}

        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I understand this is a <strong>concept demo on test networks</strong>: no real payment is taken, no vehicle is
            sold, and it is not affiliated with Tesla, Inc.
          </span>
        </label>
        {err("consent")}

        {serverError && (
          <p className="form-error" role="alert">
            {serverError}
          </p>
        )}

        <button className="cta" type="submit" disabled={busy}>
          {busy ? "Processing…" : invite ? "Request invitation" : q ? `Reserve · pay ${money(q.dueTodayCents)} today` : "Reserve"}
        </button>
      </div>
    </form>
  );
}
