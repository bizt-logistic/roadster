import Link from "next/link";
import { api, ApiError, type Summary } from "@/lib/api";
import { EUROPE_TIME_ZONES, TRIM_NAME, WEEKDAYS, money, usdInput } from "@/lib/types";
import { adminAction } from "../../../actions";
import { Act, ApiProblem, Flash, Usd } from "../../../ui";

const BACK = "/test-drives/setup";

export default async function DriveSetup({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const flash = await searchParams;
  let s: Summary;
  try {
    s = await api.summary();
  } catch (e) {
    return <ApiProblem message={e instanceof ApiError ? e.message : "Unknown error."} />;
  }
  const cfg = s.catalog.testDrive;

  return (
    <>
      <header className="adm-head">
        <h1>Test drives</h1>
        <p className="adm-muted">Experiences, prices, locations and opening times. Changes apply to the booking page immediately.</p>
      </header>
      <nav className="adm-tabs" aria-label="Test drives">
        <Link href="/test-drives">Bookings</Link>
        <Link href="/test-drives/setup" aria-current="page">Setup</Link>
      </nav>
      <Flash ok={flash.ok} error={flash.error} />

      <section className="adm-card">
        <h2>Cars &amp; test-drive prices</h2>
        <p className="adm-muted">The price of a test drive in each car, in US dollars. Experiences below are added on top.</p>
        <form action={adminAction} className="adm-stack">
          <Act action="saveDriveCars" back={BACK} />
          <table className="adm-table">
            <thead>
              <tr>
                <th>Car</th>
                <th>Test-drive price</th>
                <th>Offered</th>
              </tr>
            </thead>
            <tbody>
              {(["performance", "thrust", "rocket"] as const).map((t) => (
                <tr key={t}>
                  <td>Roadster {TRIM_NAME[t]}</td>
                  <td>
                    <span className="adm-price">
                      <input name={`price_${t}`} defaultValue={usdInput(cfg.carPrices[t] ?? 0)} inputMode="decimal" aria-label={`${TRIM_NAME[t]} test-drive price`} />
                      <Usd />
                    </span>
                  </td>
                  <td>
                    <input type="checkbox" name={`offered_${t}`} defaultChecked={cfg.cars.includes(t)} aria-label={`Offer ${TRIM_NAME[t]}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <button className="adm-btn adm-btn--primary" type="submit">
              Save car prices
            </button>
          </div>
        </form>
      </section>

      <section className="adm-card">
        <h2>Schedule</h2>
        <form action={adminAction} className="adm-form adm-form--flush">
          <Act action="saveDriveSettings" back={BACK} />
          <label className="adm-check">
            <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} /> Bookings open
          </label>
          <label className="adm-field adm-field--grow">
            <span>Start times (local to each city, comma-separated)</span>
            <input name="slots" defaultValue={cfg.slots.join(", ")} />
          </label>
          <label className="adm-field">
            <span>Cars per slot</span>
            <input name="capacityPerSlot" type="number" min={1} max={50} defaultValue={cfg.capacityPerSlot} />
          </label>
          <label className="adm-field">
            <span>Earliest (days ahead)</span>
            <input name="leadDays" type="number" min={0} max={30} defaultValue={cfg.leadDays} />
          </label>
          <label className="adm-field">
            <span>Latest (days ahead)</span>
            <input name="horizonDays" type="number" min={1} max={120} defaultValue={cfg.horizonDays} />
          </label>
          <fieldset className="adm-fieldset">
            <legend>Closed on</legend>
            {WEEKDAYS.map((d, i) => (
              <label className="adm-check" key={d}>
                <input type="checkbox" name="closedWeekdays" value={i} defaultChecked={cfg.closedWeekdays.includes(i)} /> {d}
              </label>
            ))}
          </fieldset>
          <button className="adm-btn adm-btn--primary" type="submit">
            Save schedule
          </button>
        </form>
      </section>

      <section className="adm-card">
        <h2>Experiences &amp; prices</h2>
        <p className="adm-muted">Each experience adds an upgrade price (USD) on top of the car&apos;s test-drive price. Use 0 for an experience that&apos;s included.</p>
        <div className="adm-cards">
          {cfg.packages.map((p) => (
            <form key={p.id} action={adminAction} className={`adm-subcard${p.active ? "" : " is-off"}`}>
              <Act action="savePackage" back={BACK} />
              <input type="hidden" name="id" value={p.id} />
              <div className="adm-subcard__head">
                <strong>{p.name}</strong>
                <span className="adm-muted">{p.priceCents ? `+ ${money(p.priceCents)}` : "Included"}</span>
              </div>
              <label className="adm-field">
                <span>Name</span>
                <input name="name" defaultValue={p.name} />
              </label>
              <label className="adm-field">
                <span>Description</span>
                <textarea name="description" defaultValue={p.description} rows={2} />
              </label>
              <div className="adm-inline-fields">
                <label className="adm-field">
                  <span>Upgrade price</span>
                  <span className="adm-price">
                    <input name="price" defaultValue={usdInput(p.priceCents)} inputMode="decimal" />
                    <Usd />
                  </span>
                </label>
                <label className="adm-field">
                  <span>Minutes</span>
                  <input name="durationMin" type="number" min={10} max={600} defaultValue={p.durationMin} />
                </label>
              </div>
              <label className="adm-check">
                <input type="checkbox" name="creditable" defaultChecked={p.creditable} /> Credit fee to a later reservation
              </label>
              <label className="adm-check">
                <input type="checkbox" name="active" defaultChecked={p.active} /> On sale
              </label>
              <button className="adm-btn adm-btn--primary" type="submit">
                Save
              </button>
            </form>
          ))}
          <form action={adminAction} className="adm-subcard adm-subcard--new">
            <Act action="savePackage" back={BACK} />
            <div className="adm-subcard__head">
              <strong>New experience</strong>
            </div>
            <label className="adm-field">
              <span>Name</span>
              <input name="name" placeholder="e.g. Sunset drive" required />
            </label>
            <label className="adm-field">
              <span>Description</span>
              <textarea name="description" rows={2} />
            </label>
            <div className="adm-inline-fields">
              <label className="adm-field">
                <span>Upgrade price</span>
                <span className="adm-price">
                  <input name="price" inputMode="decimal" defaultValue="0" required />
                  <Usd />
                </span>
              </label>
              <label className="adm-field">
                <span>Minutes</span>
                <input name="durationMin" type="number" min={10} max={600} defaultValue={45} />
              </label>
            </div>
            <label className="adm-check">
              <input type="checkbox" name="creditable" defaultChecked /> Credit fee to a later reservation
            </label>
            <button className="adm-btn" type="submit">
              Add experience
            </button>
          </form>
        </div>
      </section>

      <section className="adm-card">
        <h2>Cities</h2>
        <p className="adm-muted">
          Customers choose a city. The meeting point stays private and is emailed to them automatically once their payment is confirmed.
        </p>
        <div className="adm-stack">
          {cfg.locations.map((l) => (
            <form key={l.id} action={adminAction} className={`adm-form adm-form--flush adm-row-form${l.active ? "" : " is-off"}`}>
              <Act action="saveLocation" back={BACK} />
              <input type="hidden" name="id" value={l.id} />
              <label className="adm-field">
                <span>City</span>
                <input name="name" defaultValue={l.name} />
              </label>
              <label className="adm-field">
                <span>Country</span>
                <input name="country" defaultValue={l.country} />
              </label>
              <label className="adm-field">
                <span>Time zone</span>
                <select name="timeZone" defaultValue={l.timeZone}>
                  {EUROPE_TIME_ZONES.map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </label>
              <label className="adm-field adm-field--grow">
                <span>Meeting point (emailed after payment)</span>
                <input name="address" defaultValue={l.address} />
              </label>
              <label className="adm-check">
                <input type="checkbox" name="active" defaultChecked={l.active} /> Open
              </label>
              <button className="adm-btn" type="submit">
                Save
              </button>
            </form>
          ))}
        </div>
        <form action={adminAction} className="adm-form">
          <Act action="saveLocation" back={BACK} />
          <label className="adm-field">
            <span>New city</span>
            <input name="name" placeholder="e.g. Vienna" required />
          </label>
          <label className="adm-field">
            <span>Country</span>
            <input name="country" placeholder="e.g. Austria" required />
          </label>
          <label className="adm-field">
            <span>Time zone</span>
            <select name="timeZone" defaultValue={"Europe/Paris"}>
                  {EUROPE_TIME_ZONES.map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
          </label>
          <label className="adm-field adm-field--grow">
            <span>Meeting point</span>
            <input name="address" placeholder="Venue, street, postcode, city" required />
          </label>
          <button className="adm-btn adm-btn--primary" type="submit">
            Add city
          </button>
        </form>
      </section>
    </>
  );
}
