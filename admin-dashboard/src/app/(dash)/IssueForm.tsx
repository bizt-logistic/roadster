import { EXPIRY_OPTIONS, NETWORKS, money, usdInput, type BankAccount, type Order, type Wallet } from "@/lib/types";
import { adminAction } from "../actions";
import { Act, Usd } from "../ui";

/**
 * Issue payment details for an order's next due installment: pick where the
 * customer pays, confirm the amount (USD) and how long the details stay valid.
 */
export function IssueForm({ o, wallets, banks, back }: { o: Order; wallets: Wallet[]; banks: BankAccount[]; back: string }) {
  const next = o.schedule.find((s) => s.status === "due");
  if (!next) return null;
  const preferred = o.request?.method ?? o.method;
  const activeWallets = wallets.filter((w) => w.active);
  const activeBanks = banks.filter((b) => b.active);
  const order = (w: Wallet) => (NETWORKS[w.network].asset.toLowerCase() === preferred ? 0 : 1);
  const options = [
    ...activeWallets.sort((a, b) => order(a) - order(b)).map((w) => ({
      value: `wallet:${w.id}`,
      label: `${NETWORKS[w.network].label} · ${w.label} · ${w.address.slice(0, 10)}…`,
      preferred: NETWORKS[w.network].asset.toLowerCase() === preferred,
    })),
    ...activeBanks.map((b) => ({ value: `bank:${b.id}`, label: `Bank · ${b.bankName} · ${b.accountNumber}`, preferred: preferred === "bank" })),
  ].sort((a, b) => Number(b.preferred) - Number(a.preferred));

  if (!options.length) {
    return <p className="adm-flash adm-flash--warn">Add an active wallet or bank account under Wallets &amp; banks first.</p>;
  }
  return (
    <form action={adminAction} className="adm-form adm-form--flush adm-issue">
      <Act action="issuePayment" back={back} />
      <input type="hidden" name="orderId" value={o.id} />
      <label className="adm-field adm-field--grow">
        <span>Pay into</span>
        <select name="destination" defaultValue={options[0].value}>
          {options.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
              {x.preferred ? " (customer's choice)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="adm-field">
        <span>
          Amount{o.schedule.length > 1 ? ` (installment ${next.n})` : ""}
        </span>
        <span className="adm-price">
          <input name="amount" defaultValue={usdInput(next.amountCents)} inputMode="decimal" aria-label="Amount in USD" />
          <Usd />
        </span>
      </label>
      <label className="adm-field">
        <span>Valid for</span>
        <select name="expiresIn" defaultValue="60">
          {EXPIRY_OPTIONS.map((e) => (
            <option key={e.min} value={e.min}>
              {e.label}
            </option>
          ))}
        </select>
      </label>
      <button className="adm-btn adm-btn--primary" type="submit">
        Generate payment
      </button>
      <span className="adm-muted adm-small adm-issue__note">
        Due {money(next.amountCents)}. Crypto amounts use the rate on Wallets &amp; banks at the moment you generate.
      </span>
    </form>
  );
}
