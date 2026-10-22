"use client";

import { useMemo, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { COLORS, PLANS, TRIMS, type PlanId, type TrimId } from "@/lib/commerce/catalog";
import { quote } from "@/lib/commerce/pricing";
import { applies, type PublicCatalog } from "@/lib/commerce/offers";
import type { Method } from "@/lib/commerce/crypto";
import {
  DetailsFields, Extras, FieldError, PayMethods, PromoField, money, placeOrder, usePayOptions,
  type AppliedPromo, type Customer, type Errors,
} from "./CheckoutParts";

const CarViewer = dynamic(() => import("./CarViewer"), { ssr: false, loading: () => <div className="viewer viewer--loading" /> });

export function ReserveFlow({ catalog }: { catalog: PublicCatalog }) {
  const prices = Object.fromEntries(catalog.trims.map((t) => [t.id, t]));
  const trims = TRIMS.filter((t) => prices[t.id]?.available);
  const [trimId, setTrimId] = useState<TrimId>(trims[0]?.id ?? "performance");
  const [planId, setPlanId] = useState<PlanId>("full");
  const [method, setMethod] = useState<Method>("btc");
  const opts = usePayOptions(setMethod);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [customer, setCustomer] = useState<Customer>({ name: "", email: "", phone: "", country: "United Kingdom", city: "", address: "" });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const trim = TRIMS.find((t) => t.id === trimId)!;
  const price = prices[trimId]?.reservationCents ?? null;
  const invite = price == null;
  const addons = catalog.addons.filter((a) => a.active && applies(a.appliesTo, "reservation"));
  const picked = addons.filter((a) => addonIds.includes(a.id));
  const subtotal = (price ?? 0) + picked.reduce((s, a) => s + a.priceCents, 0);
  const total = Math.max(0, subtotal - (promo?.cents ?? 0));
  const q = useMemo(() => (invite ? null : quote(total, planId)), [invite, total, planId]);

  const set = (k: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCustomer((c) => ({ ...c, [k]: e.target.value }));
  const toggle = (id: string) => setAddonIds((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServerError("");
    const errs: Errors = {};
    if (!invite && opts && !opts.methods[method]) errs.method = "This payment method isn't available yet.";
    if (!consent) errs.consent = "Please confirm you've read the note above.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const r = await placeOrder({
      kind: "reservation", trimId, planId, colorId: COLORS[0].id, method, customer, consent,
      invitation: invite, addonIds: invite ? [] : addonIds, promoCode: invite ? "" : promo?.code ?? "",
    });
    if (r.error) {
      setErrors((x) => ({ ...x, ...(r.errors ?? {}) }));
      setServerError(r.error);
      setBusy(false);
    }
  }

  let step = 0;
  const n = () => String(++step).padStart(2, "0");

  return (
    <form className="reserve" onSubmit={submit} noValidate>
      <aside className="reserve__aside">
        <CarViewer className="viewer" />
        <div className="summary" aria-live="polite">
          <div className="summary__head">
            <span className="mono">Your reservation</span>
            <span className="mono">USD</span>
          </div>
          <div className="summary__row">
            <span>Roadster {trim.name}</span>
            <span>{invite ? "By invitation" : money(price!)}</span>
          </div>
          <div className="summary__row summary__row--muted">
            <span>Colour</span>
            <span>{COLORS[0].name}</span>
          </div>
          {!invite &&
            picked.map((a) => (
              <div className="summary__row summary__row--muted" key={a.id}>
                <span>{a.name}</span>
                <span>+ {money(a.priceCents)}</span>
              </div>
            ))}
          {!invite && promo && (
            <div className="summary__row summary__row--save">
              <span>Promo {promo.code}</span>
              <span>− {money(promo.cents)}</span>
            </div>
          )}
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
                  Then {q.schedule.length - 1} × {money(q.schedule[1].amountCents)} monthly · 0% financing · total {money(total)}
                </p>
              )}
            </>
          )}
        </div>
      </aside>

      <div className="reserve__steps">
        <section className="step">
          <h2>
            <span className="mono">{n()}</span> Choose your Roadster
          </h2>
          <div className="trims" role="radiogroup" aria-label="Version">
            {trims.map((t) => {
              const p = prices[t.id]?.reservationCents ?? null;
              return (
                <label key={t.id} className={`trim${t.id === trimId ? " is-on" : ""}`}>
                  <input type="radio" name="trim" value={t.id} checked={t.id === trimId} onChange={() => setTrimId(t.id)} />
                  <span className="trim__name">{t.name}</span>
                  <span className="trim__tag">{t.tagline}</span>
                  <span className="trim__price">{p == null ? "Request invitation" : `${money(p)} to reserve`}</span>
                  <span className="trim__meta mono">
                    0–60 {t.zeroToSixty} · {t.seats} seat{t.seats > 1 ? "s" : ""}
                  </span>
                  <ul>
                    {t.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </label>
              );
            })}
          </div>
          <FieldError errors={errors} k="trimId" />
        </section>

        {!invite && addons.length > 0 && (
          <section className="step">
            <h2>
              <span className="mono">{n()}</span> Extras
            </h2>
            <Extras addons={addons} picked={addonIds} onToggle={toggle} money={money} />
          </section>
        )}

        {!invite && (
          <section className="step">
            <h2>
              <span className="mono">{n()}</span> Payment plan
            </h2>
            <div className="plans" role="radiogroup" aria-label="Payment plan">
              {PLANS.map((p) => {
                const pq = quote(total, p.id)!;
                return (
                  <label key={p.id} className={`plan${p.id === planId ? " is-on" : ""}`}>
                    <input type="radio" name="plan" value={p.id} checked={p.id === planId} onChange={() => setPlanId(p.id)} />
                    <span>{p.label}</span>
                    <strong>{p.months === 1 || pq.schedule.length === 1 ? money(pq.totalCents) : `${money(pq.schedule[1].amountCents)}/mo`}</strong>
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
            <span className="mono">{n()}</span> Your details
          </h2>
          <DetailsFields customer={customer} set={set} errors={errors} />
        </section>

        {!invite && (
          <section className="step">
            <h2>
              <span className="mono">{n()}</span> Payment
            </h2>
            <PromoField kind="reservation" subtotalCents={subtotal} applied={promo} onApply={setPromo} error={errors.promoCode} />
            <PayMethods method={method} onChange={setMethod} opts={opts} dueTodayCents={q?.dueTodayCents ?? null} errors={errors} />
          </section>
        )}

        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I understand this is a <strong>concept presentation</strong>: payments run on test networks, no vehicle is
            sold, and it is not affiliated with Tesla, Inc.
          </span>
        </label>
        <FieldError errors={errors} k="consent" />

        {serverError && (
          <p className="form-error" role="alert">
            {serverError}
          </p>
        )}

        <button className="cta" type="submit" disabled={busy}>
          {busy ? "Sending…" : invite ? "Request invitation" : q ? `Reserve · request payment of ${money(q.dueTodayCents)}` : "Reserve"}
        </button>
      </div>
    </form>
  );
}
