import { Fragment } from "react";
import { TRIMS } from "@/lib/commerce/catalog";
import { driveFrom, type PublicCatalog } from "@/lib/commerce/offers";
import { formatMoney } from "@/lib/commerce/pricing";
import { HomeMotion } from "./HomeMotion";

// After the cinematic scroll: the three ways in. Test drive, reserve, invest.
// Server-rendered from the admin's live catalogue; HomeMotion adds the scroll effects.

const CAR_SHOTS: Record<string, { src: string; alt: string }> = {
  performance: { src: "/images/gallery/low-sm.webp", alt: "Roadster Performance, low front three-quarter view" },
  thrust: { src: "/images/gallery/rear-sm.webp", alt: "Roadster Thrust, rear three-quarter view with red light" },
  rocket: { src: "/images/gallery/front-sm.webp", alt: "Roadster Rocket, head-on front view" },
};

/** Headline split into words for the masked rise-in. */
function Split({ text, className, id }: { text: string; className: string; id?: string }) {
  return (
    <h2 className={className} id={id} data-reveal="">
      {text.split(" ").map((w, i) => (
        <Fragment key={i}>
          <span className="hs-word">
            <span style={{ "--i": i } as React.CSSProperties}>{w}</span>
          </span>{" "}
        </Fragment>
      ))}
    </h2>
  );
}

export function HomeSections({ catalog }: { catalog: PublicCatalog }) {
  const td = catalog.testDrive;
  const cities = td.locations.filter((l) => l.active);
  const cars = TRIMS.filter((t) => td.cars.includes(t.id));
  const from = driveFrom(td);
  const trims = TRIMS.map((t) => ({ ...t, price: catalog.trims.find((x) => x.id === t.id) })).filter((t) => t.price?.available);
  const extras = catalog.addons.filter((a) => a.active && a.appliesTo !== "test_drive").map((a) => a.name);

  return (
    <div className="home" id="explore">
      <HomeMotion />

      {/* ── test drive ─────────────────────────────────────────────────── */}
      {td.enabled && cities.length > 0 && (
        <section className="hs hs--drive" aria-labelledby="hs-drive">
          <div className="hs__glow" aria-hidden="true" />
          <div className="hs__inner">
            <p className="hs__eyebrow mono" data-reveal="">
              06 · Test drive
            </p>
            <div className="hs__split">
              <Split className="hs__title" id="hs-drive" text="Drive it before you own it." />
              <div className="hs__aside" data-reveal="" style={{ "--i": 2 } as React.CSSProperties}>
                <p className="hs__lede">
                  Private test drives in {cities.length} European cities. Choose your Roadster and a time, pay in Bitcoin,
                  Ethereum or by bank transfer, and we email you the meeting point.
                </p>
                <p className="hs__from">
                  <span className="mono">from</span>
                  <strong data-count={from}>{formatMoney(from)}</strong>
                </p>
              </div>
            </div>

            <ul className="hs-cars">
              {cars.map((t, i) => (
                <li key={t.id} className="hs-car" data-reveal="" style={{ "--i": i } as React.CSSProperties}>
                  <a href="/test-drive" className="hs-car__link">
                    <span className="hs-car__media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={CAR_SHOTS[t.id].src} alt={CAR_SHOTS[t.id].alt} loading="lazy" data-parallax="0.035" />
                    </span>
                    <span className="hs-car__body">
                      <span className="hs-car__name">{t.name}</span>
                      <span className="hs-car__meta mono">0–60 {t.zeroToSixty}</span>
                      <span className="hs-car__price">
                        {formatMoney(td.carPrices[t.id] ?? 0)}
                        <em>test drive</em>
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <div className="hs-marquee" aria-label={`Cities: ${cities.map((c) => c.name).join(", ")}`}>
              <div className="hs-marquee__track" aria-hidden="true">
                {[0, 1].map((k) => (
                  <span key={k} className="hs-marquee__set">
                    {cities.map((c) => (
                      <span key={c.id}>
                        {c.name}
                        <i>·</i>
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            </div>

            <ol className="hs-steps">
              {[
                ["Choose", "Your Roadster, an experience, your city and a time that suits you."],
                ["Pay", "In US dollars by Bitcoin, Ethereum or bank transfer. We send your payment details within minutes."],
                ["Meet", "As soon as your payment is confirmed we email your meeting point and a calendar invite."],
              ].map(([h, p], i) => (
                <li key={h} data-reveal="" style={{ "--i": i } as React.CSSProperties}>
                  <span className="mono">0{i + 1}</span>
                  <strong>{h}</strong>
                  <p>{p}</p>
                </li>
              ))}
            </ol>

            <div className="hs__actions" data-reveal="">
              <a className="hs-cta hs-cta--light" href="/test-drive">
                Book a test drive <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── reserve ────────────────────────────────────────────────────── */}
      <section className="hs hs--reserve" aria-labelledby="hs-reserve">
        <div className="hs__inner">
          <p className="hs__eyebrow mono" data-reveal="">
            07 · Reserve
          </p>
          <Split className="hs__title" id="hs-reserve" text="Reserve yours." />
          <div className="hs-reserve">
            <figure className="hs-reserve__media" data-reveal="">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/gallery/hero.webp" alt="Roadster in Ano White, front three-quarter studio view" loading="lazy" data-parallax="0.08" />
            </figure>
            <div className="hs-reserve__list">
              {trims.map((t, i) => {
                const cents = t.price?.reservationCents ?? null;
                return (
                  <a key={t.id} className="hs-trim" href="/reserve" data-reveal="" style={{ "--i": i } as React.CSSProperties}>
                    <span className="hs-trim__name">{t.name}</span>
                    <span className="hs-trim__tag">{t.tagline}</span>
                    <span className="hs-trim__price">
                      {cents == null ? "By invitation" : formatMoney(cents)}
                      {cents != null && <em>or {formatMoney(Math.ceil(cents / 12 / 100) * 100)}/mo over 12 months</em>}
                    </span>
                    <span className="hs-trim__arrow" aria-hidden="true">
                      →
                    </span>
                  </a>
                );
              })}
              <p className="hs__lede" data-reveal="">
                Pay the reservation in full or in 3, 6 or 12 monthly installments at 0%.
                {extras.length > 0 && ` Add ${extras.slice(0, 3).join(", ").toLowerCase()} and more at checkout.`}
              </p>
              <div className="hs__actions" data-reveal="">
                <a className="hs-cta" href="/reserve">
                  Reserve now <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── invest & partner ───────────────────────────────────────────── */}
      <section className="hs hs--invest" aria-labelledby="hs-invest">
        <div className="hs__inner">
          <p className="hs__eyebrow mono" data-reveal="">
            08 · Invest &amp; partner
          </p>
          <Split className="hs__title hs__title--xl" id="hs-invest" text="Build what comes next with us." />
          <ul className="hs-pillars">
            {[
              ["Distribution", "Dealerships and showrooms that want to bring the Roadster to their city."],
              ["Fleet & corporate", "Hospitality, events and luxury fleets looking for a halo car."],
              ["Strategic investment", "Conversations with qualified investors about the road ahead."],
            ].map(([h, p], i) => (
              <li key={h} data-reveal="" style={{ "--i": i } as React.CSSProperties}>
                <span className="mono">0{i + 1}</span>
                <strong>{h}</strong>
                <p>{p}</p>
              </li>
            ))}
          </ul>
          <div className="hs__actions" data-reveal="">
            <a className="hs-cta hs-cta--white" href="/invest">
              Invest &amp; partner <span aria-hidden="true">→</span>
            </a>
            <span className="hs__note">Register your interest. Not an offer of securities.</span>
          </div>
        </div>
      </section>

      <footer className="hs-foot">
        <div className="hs-foot__brand">ROADSTER</div>
        <nav aria-label="Footer">
          <a href="#top">Experience</a>
          <a href="/gallery">Gallery</a>
          <a href="/test-drive">Test drive</a>
          <a href="/reserve">Reserve</a>
          <a href="/invest">Invest &amp; partner</a>
        </nav>
        <p className="mono">
          Concept design &amp; development by Philip Ojo Oladeji · Unofficial concept · Not affiliated with Tesla, Inc.
        </p>
      </footer>
    </div>
  );
}
