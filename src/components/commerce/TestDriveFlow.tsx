"use client";

import { useMemo, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { COLORS, TRIMS, type TrimId } from "@/lib/commerce/catalog";
import { applies, drivePrice, formatDriveDate, slotKey, type PublicCatalog } from "@/lib/commerce/offers";
import type { Method } from "@/lib/commerce/crypto";
import {
  DetailsFields, Extras, FieldError, PayMethods, PromoField, money, placeOrder, usePayOptions,
  type AppliedPromo, type Customer, type Errors,
} from "./CheckoutParts";

const CarViewer = dynamic(() => import("./CarViewer"), { ssr: false, loading: () => <div className="viewer viewer--loading" /> });

export function TestDriveFlow({ catalog, dates, taken }: { catalog: PublicCatalog; dates: string[]; taken: Record<string, number> }) {
  const cfg = catalog.testDrive;
  const packages = cfg.packages.filter((p) => p.active);
  const locations = cfg.locations.filter((l) => l.active);
  const cars = TRIMS.filter((t) => cfg.cars.includes(t.id));

  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [trimId, setTrimId] = useState<TrimId>(cars[0]?.id ?? "performance");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [date, setDate] = useState(dates[0] ?? "");
  const [time, setTime] = useState("");
  const [method, setMethod] = useState<Method>("btc");
  const opts = usePayOptions(setMethod);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [customer, setCustomer] = useState<Customer>({ name: "", email: "", phone: "", country: "United Kingdom", city: "", address: "" });
  const [licence, setLicence] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const pkg = packages.find((p) => p.id === packageId);
  const loc = locations.find((l) => l.id === locationId);
  const addons = catalog.addons.filter((a) => a.active && applies(a.appliesTo, "test_drive"));
  const picked = addons.filter((a) => addonIds.includes(a.id));
  const carCents = cfg.carPrices[trimId] ?? 0;
  const subtotal = drivePrice(cfg, trimId, pkg) + picked.reduce((s, a) => s + a.priceCents, 0);
  const total = Math.max(0, subtotal - (promo?.cents ?? 0));
  const left = useMemo(
    () => (d: string, t: string) => Math.max(0, cfg.capacityPerSlot - (taken[slotKey(d, t, locationId)] ?? 0)),
    [cfg.capacityPerSlot, taken, locationId],
  );

  const set = (k: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCustomer((c) => ({ ...c, [k]: e.target.value }));
  const toggle = (id: string) => setAddonIds((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  if (!cfg.enabled || !packages.length || !locations.length || !dates.length) {
    return (
      <p className="notice">
        Test drives aren&apos;t open for booking right now. Please check back soon or <a href="/reserve">reserve a Roadster</a>.
      </p>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServerError("");
    const errs: Errors = {};
    if (!time) errs.time = "Choose a time.";
    if (!licence) errs.licence = "A valid driver's licence is required to drive.";
    if (opts && !opts.methods[method]) errs.method = "This payment method isn't available yet.";
    if (!consent) errs.consent = "Please confirm you've read the note above.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const r = await placeOrder({
      kind: "test_drive", trimId, planId: "full", colorId: COLORS[0].id, method, customer, consent, licence,
      addonIds, promoCode: promo?.code ?? "", drive: { packageId, locationId, date, time },
    });
    if (r.error) {
      setErrors((x) => ({ ...x, ...(r.errors ?? {}) }));
      setServerError(r.error);
      setBusy(false);
    }
  }

  return (
    <form className="reserve" onSubmit={submit} noValidate>
      <aside className="reserve__aside">
        <CarViewer className="viewer" />
        <div className="summary" aria-live="polite">
          <div className="summary__head">
            <span className="mono">Your test drive</span>
            <span className="mono">USD</span>
          </div>
          <div className="summary__row">
            <span>Roadster {TRIMS.find((t) => t.id === trimId)?.name} test drive</span>
            <span>{money(carCents)}</span>
          </div>
          {pkg && (
            <div className="summary__row summary__row--muted">
              <span>
                {pkg.name} · {pkg.durationMin} min
              </span>
              <span>{pkg.priceCents ? `+ ${money(pkg.priceCents)}` : "Included"}</span>
            </div>
          )}
          <div className="summary__row summary__row--muted">
            <span>When</span>
            <span>{time ? `${formatDriveDate(date)} · ${time}` : "Choose a time"}</span>
          </div>
          {loc && (
            <div className="summary__row summary__row--muted">
              <span>City</span>
              <span>
                {loc.name}, {loc.country}
              </span>
            </div>
          )}
          {picked.map((a) => (
            <div className="summary__row summary__row--muted" key={a.id}>
              <span>{a.name}</span>
              <span>+ {money(a.priceCents)}</span>
            </div>
          ))}
          {promo && (
            <div className="summary__row summary__row--save">
              <span>Promo {promo.code}</span>
              <span>− {money(promo.cents)}</span>
            </div>
          )}
          <div className="summary__total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          {pkg?.creditable && <p className="summary__note">The experience fee is credited towards your reservation if you reserve within 30 days.</p>}
        </div>
      </aside>

      <div className="reserve__steps">
        <section className="step">
          <h2>
            <span className="mono">01</span> Choose your car
          </h2>
          <div className="plans" role="radiogroup" aria-label="Car">
            {cars.map((t) => (
              <label key={t.id} className={`plan${t.id === trimId ? " is-on" : ""}`}>
                <input type="radio" name="car" checked={t.id === trimId} onChange={() => setTrimId(t.id)} />
                <span>
                  Roadster {t.name} · 0–60 {t.zeroToSixty}
                </span>
                <strong>{money(cfg.carPrices[t.id] ?? 0)}</strong>
              </label>
            ))}
          </div>
          <FieldError errors={errors} k="trimId" />
        </section>

        <section className="step">
          <h2>
            <span className="mono">02</span> Choose your experience
          </h2>
          <div className="trims" role="radiogroup" aria-label="Experience">
            {packages.map((p) => (
              <label key={p.id} className={`trim${p.id === packageId ? " is-on" : ""}`}>
                <input type="radio" name="package" checked={p.id === packageId} onChange={() => setPackageId(p.id)} />
                <span className="trim__name">{p.name}</span>
                <span className="trim__tag">{p.durationMin} minutes</span>
                <span className="trim__price">{p.priceCents ? `+ ${money(p.priceCents)}` : "Included"}</span>
                <span className="trim__desc">{p.description}</span>
                {p.creditable && <span className="trim__meta mono">Credited to your reservation</span>}
              </label>
            ))}
          </div>
          <FieldError errors={errors} k="packageId" />
        </section>

        <section className="step">
          <h2>
            <span className="mono">03</span> City &amp; time
          </h2>
          <div className="plans plans--cities" role="radiogroup" aria-label="City">
            {locations.map((l) => (
              <label key={l.id} className={`plan${l.id === locationId ? " is-on" : ""}`}>
                <input
                  type="radio"
                  name="location"
                  checked={l.id === locationId}
                  onChange={() => {
                    setLocationId(l.id);
                    setTime("");
                  }}
                />
                <strong>{l.name}</strong>
                <span className="plan__sub">{l.country}</span>
              </label>
            ))}
          </div>
          <div className="dates" role="radiogroup" aria-label="Date">
            {dates.map((d) => {
              const free = cfg.slots.some((t) => left(d, t) > 0);
              return (
                <button
                  type="button"
                  key={d}
                  className={`datechip${d === date ? " is-on" : ""}`}
                  aria-pressed={d === date}
                  disabled={!free}
                  onClick={() => {
                    setDate(d);
                    setTime("");
                  }}
                >
                  {formatDriveDate(d)}
                </button>
              );
            })}
          </div>
          <div className="times" role="radiogroup" aria-label="Time">
            {cfg.slots.map((t) => {
              const n = left(date, t);
              return (
                <button
                  type="button"
                  key={t}
                  className={`timeslot${t === time ? " is-on" : ""}`}
                  aria-pressed={t === time}
                  disabled={n === 0}
                  onClick={() => setTime(t)}
                >
                  <strong>{t}</strong>
                  <span>{n === 0 ? "Full" : `${n} left`}</span>
                </button>
              );
            })}
          </div>
          <p className="hint">Times are local to {loc?.name ?? "the city"}. Your exact meeting point is emailed to you as soon as your payment is confirmed.</p>
          <FieldError errors={errors} k="date" />
          <FieldError errors={errors} k="time" />
        </section>

        {addons.length > 0 && (
          <section className="step">
            <h2>
              <span className="mono">04</span> Extras
            </h2>
            <Extras addons={addons} picked={addonIds} onToggle={toggle} money={money} />
          </section>
        )}

        <section className="step">
          <h2>
            <span className="mono">{addons.length ? "05" : "04"}</span> Your details
          </h2>
          <DetailsFields customer={customer} set={set} errors={errors} addressLabel="Pickup address (only if you add chauffeured pickup)" />
          <label className="consent">
            <input type="checkbox" checked={licence} onChange={(e) => setLicence(e.target.checked)} />
            <span>I hold a valid driver&apos;s licence and will bring it to the drive.</span>
          </label>
          <FieldError errors={errors} k="licence" />
        </section>

        <section className="step">
          <h2>
            <span className="mono">{addons.length ? "06" : "05"}</span> Payment
          </h2>
          <PromoField kind="test_drive" subtotalCents={subtotal} applied={promo} onApply={setPromo} error={errors.promoCode} />
          <PayMethods method={method} onChange={setMethod} opts={opts} dueTodayCents={total} errors={errors} />
        </section>

        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I understand this is a <strong>concept presentation</strong>: payments run on test networks, and it is not
            affiliated with Tesla, Inc.
          </span>
        </label>
        <FieldError errors={errors} k="consent" />

        {serverError && (
          <p className="form-error" role="alert">
            {serverError}
          </p>
        )}

        <button className="cta" type="submit" disabled={busy}>
          {busy ? "Sending…" : `Book test drive · request payment of ${money(total)}`}
        </button>
      </div>
    </form>
  );
}
