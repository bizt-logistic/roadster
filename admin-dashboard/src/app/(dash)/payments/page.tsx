import { api, ApiError, type Summary } from "@/lib/api";
import { NETWORKS, when } from "@/lib/types";
import { addBank, addSampleWallets, addWallet, saveRates, toggleBank, toggleWallet } from "../../actions";
import { ApiProblem, Flash } from "../../ui";

export default async function Payments({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const flash = await searchParams;
  let s: Summary;
  try {
    s = await api.summary();
  } catch (e) {
    return <ApiProblem message={e instanceof ApiError ? e.message : "Unknown error."} />;
  }
  const { wallets, banks, settings, orders } = s;
  const uses = (id: string) =>
    orders.filter((o) => o.destination && (o.destination.kind === "wallet" ? o.destination.walletId : o.destination.bankId) === id).length;

  return (
    <>
      <header className="adm-head">
        <h1>Wallets &amp; banks</h1>
        <p className="adm-muted">Where customers send reservation payments. Crypto is preferred; bank transfer is optional.</p>
      </header>
      <Flash ok={flash.ok} error={flash.error} />
      <p className="adm-flash adm-flash--warn">
        Test networks: only <strong>Bitcoin testnet</strong> and <strong>Ethereum Sepolia</strong> addresses are accepted. Mainnet
        addresses are rejected by the site.
      </p>

      <section className="adm-card">
        <div className="adm-card__head">
          <h2>Crypto receiving addresses</h2>
          {wallets.length === 0 && (
            <form action={addSampleWallets}>
              <button className="adm-btn adm-btn--ghost" type="submit">
                Use sample testnet addresses
              </button>
            </form>
          )}
        </div>
        <p className="adm-muted">
          Create the address in your own wallet app (switched to a test network) and paste it here. This dashboard is
          watch-only: private keys never touch either server. Reservations rotate across active addresses.
        </p>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Network</th>
                <th>Label</th>
                <th>Address</th>
                <th>Assigned</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => (
                <tr key={w.id}>
                  <td>{NETWORKS[w.network].label}</td>
                  <td>{w.label}</td>
                  <td className="adm-mono">
                    <a href={NETWORKS[w.network].address(w.address)} target="_blank" rel="noreferrer">
                      {w.address}
                    </a>
                  </td>
                  <td>{uses(w.id)}</td>
                  <td>
                    <span className={`adm-pill adm-pill--${w.active ? "ok" : "muted"}`}>{w.active ? "Active" : "Paused"}</span>
                  </td>
                  <td>
                    <form action={toggleWallet}>
                      <input type="hidden" name="id" value={w.id} />
                      <button className="adm-btn adm-btn--ghost" type="submit">
                        {w.active ? "Pause" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {wallets.length === 0 && (
                <tr>
                  <td colSpan={6} className="adm-muted">
                    No addresses yet. Customers can&apos;t pay in crypto until you add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <form action={addWallet} className="adm-form">
          <label className="adm-field">
            <span>Network</span>
            <select name="network" defaultValue="btc-testnet">
              <option value="btc-testnet">Bitcoin testnet (BTC)</option>
              <option value="eth-sepolia">Ethereum Sepolia (ETH)</option>
            </select>
          </label>
          <label className="adm-field adm-field--grow">
            <span>Receiving address</span>
            <input name="address" placeholder="tb1q… or 0x…" required autoComplete="off" spellCheck={false} />
          </label>
          <label className="adm-field">
            <span>Label</span>
            <input name="label" placeholder="e.g. Treasury #1" />
          </label>
          <button className="adm-btn adm-btn--primary" type="submit">
            Add address
          </button>
        </form>
      </section>

      <section className="adm-card">
        <h2>Bank accounts</h2>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Bank</th>
                <th>Account name</th>
                <th>Number</th>
                <th>Currency</th>
                <th>Assigned</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {banks.map((b) => (
                <tr key={b.id}>
                  <td>{b.bankName}</td>
                  <td>{b.accountName}</td>
                  <td className="adm-mono">{b.accountNumber}</td>
                  <td>{b.currency}</td>
                  <td>{uses(b.id)}</td>
                  <td>
                    <span className={`adm-pill adm-pill--${b.active ? "ok" : "muted"}`}>{b.active ? "Active" : "Paused"}</span>
                  </td>
                  <td>
                    <form action={toggleBank}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="adm-btn adm-btn--ghost" type="submit">
                        {b.active ? "Pause" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {banks.length === 0 && (
                <tr>
                  <td colSpan={7} className="adm-muted">
                    No bank accounts. Bank transfer is hidden from customers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <form action={addBank} className="adm-form">
          <label className="adm-field">
            <span>Bank</span>
            <input name="bankName" placeholder="e.g. Barclays" required />
          </label>
          <label className="adm-field adm-field--grow">
            <span>Account name</span>
            <input name="accountName" placeholder="Company Ltd" required />
          </label>
          <label className="adm-field">
            <span>Account number / IBAN</span>
            <input name="accountNumber" required autoComplete="off" />
          </label>
          <input type="hidden" name="currency" value="USD" />
          <button className="adm-btn adm-btn--primary" type="submit">
            Add account
          </button>
        </form>
      </section>

      <section className="adm-card">
        <h2>Conversion rates</h2>
        <p className="adm-muted">
          Used to quote crypto amounts for USD prices. The rate is locked when you generate a customer's payment details. Last updated{" "}
          {settings.updatedAt.startsWith("1970") ? "never (defaults)" : when(settings.updatedAt)}.
        </p>
        <form action={saveRates} className="adm-form">
          <label className="adm-field">
            <span>USD per BTC</span>
            <input name="btcUsd" defaultValue={settings.btcUsd} inputMode="decimal" />
          </label>
          <label className="adm-field">
            <span>USD per ETH</span>
            <input name="ethUsd" defaultValue={settings.ethUsd} inputMode="decimal" />
          </label>
          <button className="adm-btn adm-btn--primary" type="submit">
            Save rates
          </button>
        </form>
      </section>
    </>
  );
}
