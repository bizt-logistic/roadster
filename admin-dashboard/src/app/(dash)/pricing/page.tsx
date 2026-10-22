import { api, ApiError, type Summary } from "@/lib/api";
import { APPLIES_LABEL, TRIM_NAME, money, usdInput, type Applies } from "@/lib/types";
import { adminAction } from "../../actions";
import { Act, ApiProblem, Flash, Usd } from "../../ui";

const BACK = "/pricing";

function AppliesSelect({ value }: { value: Applies }) {
  return (
    <select name="appliesTo" defaultValue={value}>
      {(Object.keys(APPLIES_LABEL) as Applies[]).map((k) => (
        <option key={k} value={k}>
          {APPLIES_LABEL[k]}
        </option>
      ))}
    </select>
  );
}

export default async function Pricing({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const flash = await searchParams;
  let s: Summary;
  try {
    s = await api.summary();
  } catch (e) {
    return <ApiProblem message={e instanceof ApiError ? e.message : "Unknown error."} />;
  }
  const { catalog } = s;
  const live = s.orders.filter((o) => o.status !== "cancelled");
  const addonRevenue = (id: string) =>
    live.reduce((a, o) => a + (o.items ?? []).filter((i) => i.id === id).reduce((x, i) => x + i.priceCents, 0), 0);

  return (
    <>
      <header className="adm-head">
        <h1>Pricing &amp; offers</h1>
        <p className="adm-muted">
          Everything a customer pays is priced here. New orders use these prices immediately; existing orders keep the price they were placed at.
        </p>
      </header>
      <Flash ok={flash.ok} error={flash.error} />

      <section className="adm-card">
        <h2>Vehicle reservations</h2>
        <form action={adminAction} className="adm-stack">
          <Act action="saveTrimPrices" back={BACK} />
          <div className="adm-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Reservation price</th>
                  <th>Now</th>
                  <th>On sale</th>
                </tr>
              </thead>
              <tbody>
                {catalog.trims.map((t) => (
                  <tr key={t.id}>
                    <td>Roadster {TRIM_NAME[t.id]}</td>
                    <td>
                      <input
                        name={`price_${t.id}`}
                        defaultValue={t.reservationCents == null ? "" : usdInput(t.reservationCents)}
                        placeholder="Empty = invitation only"
                        inputMode="decimal"
                        aria-label={`${TRIM_NAME[t.id]} reservation price`}
                      />
                    </td>
                    <td className="adm-muted">
                      {t.reservationCents == null ? "Invitation only" : money(t.reservationCents)}
                    </td>
                    <td>
                      <input type="checkbox" name={`available_${t.id}`} defaultChecked={t.available} aria-label={`${TRIM_NAME[t.id]} on sale`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="adm-actions">
            <span className="adm-muted adm-small">All prices in US dollars.</span>
            <button className="adm-btn adm-btn--primary" type="submit">
              Save vehicle prices
            </button>
          </div>
        </form>
      </section>

      <section className="adm-card">
        <h2>Add-ons</h2>
        <p className="adm-muted">Optional extras customers can tick at checkout: accessories, services and upgrades.</p>
        <div className="adm-cards">
          {catalog.addons.map((a) => (
            <form key={a.id} action={adminAction} className={`adm-subcard${a.active ? "" : " is-off"}`}>
              <Act action="saveAddon" back={BACK} />
              <input type="hidden" name="id" value={a.id} />
              <div className="adm-subcard__head">
                <strong>{a.name}</strong>
                <span className="adm-muted">
                  {money(a.priceCents)} · sold {money(addonRevenue(a.id))}
                </span>
              </div>
              <label className="adm-field">
                <span>Name</span>
                <input name="name" defaultValue={a.name} />
              </label>
              <label className="adm-field">
                <span>Description</span>
                <textarea name="description" defaultValue={a.description} rows={2} />
              </label>
              <div className="adm-inline-fields">
                <label className="adm-field">
                  <span>Price</span>
                  <span className="adm-price">
                    <input name="price" defaultValue={usdInput(a.priceCents)} inputMode="decimal" />
                    <Usd />
                  </span>
                </label>
                <label className="adm-field">
                  <span>Offered on</span>
                  <AppliesSelect value={a.appliesTo} />
                </label>
              </div>
              <label className="adm-check">
                <input type="checkbox" name="active" defaultChecked={a.active} /> On sale
              </label>
              <button className="adm-btn adm-btn--primary" type="submit">
                Save
              </button>
            </form>
          ))}
          <form action={adminAction} className="adm-subcard adm-subcard--new">
            <Act action="saveAddon" back={BACK} />
            <div className="adm-subcard__head">
              <strong>New add-on</strong>
            </div>
            <label className="adm-field">
              <span>Name</span>
              <input name="name" placeholder="e.g. Home charger installation" required />
            </label>
            <label className="adm-field">
              <span>Description</span>
              <textarea name="description" rows={2} />
            </label>
            <div className="adm-inline-fields">
              <label className="adm-field">
                <span>Price</span>
                <span className="adm-price">
                  <input name="price" inputMode="decimal" required />
                  <Usd />
                </span>
              </label>
              <label className="adm-field">
                <span>Offered on</span>
                <AppliesSelect value="reservation" />
              </label>
            </div>
            <button className="adm-btn" type="submit">
              Add add-on
            </button>
          </form>
        </div>
      </section>

      <section className="adm-card">
        <h2>Promo codes</h2>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>For</th>
                <th>Used</th>
                <th>Expires</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {catalog.promos.map((p) => (
                <tr key={p.code}>
                  <td className="adm-mono">{p.code}</td>
                  <td>{p.kind === "percent" ? `${p.value}%` : money(p.value)}</td>
                  <td>{APPLIES_LABEL[p.appliesTo]}</td>
                  <td>
                    {p.used}
                    {p.maxUses != null ? ` / ${p.maxUses}` : ""}
                  </td>
                  <td>{p.expiresAt ? p.expiresAt.slice(0, 10) : "Never"}</td>
                  <td>
                    <span className={`adm-pill adm-pill--${p.active ? "ok" : "muted"}`}>{p.active ? "Active" : "Paused"}</span>
                  </td>
                  <td>
                    <form action={adminAction}>
                      <Act action="togglePromo" back={BACK} />
                      <input type="hidden" name="code" value={p.code} />
                      <button className="adm-btn adm-btn--ghost" type="submit">
                        {p.active ? "Pause" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {catalog.promos.length === 0 && (
                <tr>
                  <td colSpan={7} className="adm-muted">
                    No promo codes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <form action={adminAction} className="adm-form">
          <Act action="savePromo" back={BACK} />
          <label className="adm-field">
            <span>Code</span>
            <input name="code" placeholder="e.g. EIDSPECIAL" required className="adm-upper" />
          </label>
          <label className="adm-field">
            <span>Type</span>
            <select name="kind" defaultValue="percent">
              <option value="percent">Percent off</option>
              <option value="fixed">Amount off</option>
            </select>
          </label>
          <label className="adm-field">
            <span>Value</span>
            <span className="adm-price">
              <input name="value" placeholder="10" inputMode="decimal" required />
              <Usd />
            </span>
          </label>
          <label className="adm-field">
            <span>For</span>
            <AppliesSelect value="both" />
          </label>
          <label className="adm-field">
            <span>Max uses</span>
            <input name="maxUses" type="number" min={1} placeholder="Unlimited" />
          </label>
          <label className="adm-field">
            <span>Expires</span>
            <input name="expiresAt" type="date" />
          </label>
          <button className="adm-btn adm-btn--primary" type="submit">
            Save code
          </button>
        </form>
        <p className="adm-muted adm-small">Saving an existing code updates it. Amount-off codes are in US dollars.</p>
      </section>
    </>
  );
}
