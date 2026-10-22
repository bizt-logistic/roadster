"use client";

// Pieces shared by the reservation and test-drive checkouts.
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/commerce/pricing";
import { METHOD_LABEL, NETWORKS, cryptoAmount, type Method } from "@/lib/commerce/crypto";
import type { Addon, OrderKind } from "@/lib/commerce/offers";

export type Errors = Record<string, string>;
export type PayOptions = { methods: Record<Method, boolean>; rates: { btcUsd: number; ethUsd: number } };
export type Customer = { name: string; email: string; phone: string; country: string; city: string; address: string };
export type AppliedPromo = { code: string; cents: number; label: string };

export const COUNTRIES = ["United Kingdom", "Ireland", "France", "Germany", "Italy", "Spain", "Portugal", "Netherlands", "Belgium", "Luxembourg", "Switzerland", "Austria", "Monaco", "Sweden", "Norway", "Denmark", "Finland", "Poland", "Czech Republic", "Greece", "Other"];

export function FieldError({ errors, k }: { errors: Errors; k: string }) {
  return errors[k] ? <span className="field__err">{errors[k]}</span> : null;
}

/** Which payment methods the admin has enabled, and the locked-rate preview. */
export function usePayOptions(onFirst: (m: Method) => void) {
  const [opts, setOpts] = useState<PayOptions | null>(null);
  useEffect(() => {
    fetch("/api/payment-options", { cache: "no-store" })
      .then((r) => r.json())
      .then((o: PayOptions) => {
        setOpts(o);
        const first = (["btc", "eth", "bank"] as Method[]).find((m) => o.methods[m]);
        if (first) onFirst(first);
      })
      .catch(() => setOpts(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return opts;
}

/** All prices are in US dollars. */
export const money = (c: number) => formatMoney(c);

export function Extras({
  addons,
  picked,
  onToggle,
  money,
}: {
  addons: Addon[];
  picked: string[];
  onToggle: (id: string) => void;
  money: (c: number) => string;
}) {
  if (!addons.length) return null;
  return (
    <div className="extras">
      {addons.map((a) => {
        const on = picked.includes(a.id);
        return (
          <label key={a.id} className={`extra${on ? " is-on" : ""}`}>
            <input type="checkbox" checked={on} onChange={() => onToggle(a.id)} />
            <span className="extra__name">{a.name}</span>
            <span className="extra__price">+ {money(a.priceCents)}</span>
            <span className="extra__desc">{a.description}</span>
          </label>
        );
      })}
    </div>
  );
}

export function PromoField({
  kind,
  subtotalCents,
  applied,
  onApply,
  error,
}: {
  kind: OrderKind;
  subtotalCents: number;
  applied: AppliedPromo | null;
  onApply: (p: AppliedPromo | null) => void;
  error?: string;
}) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // re-price an applied percentage code when the basket changes
  useEffect(() => {
    if (!applied) return;
    fetch("/api/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: applied.code, kind, subtotalCents }) })
      .then((r) => r.json())
      .then((d) => (d.ok ? d.cents !== applied.cents && onApply({ code: d.code, cents: d.cents, label: d.label }) : onApply(null)))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalCents]);

  async function apply() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, kind, subtotalCents }) });
      const d = await r.json();
      if (d.ok) onApply({ code: d.code, cents: d.cents, label: d.label });
      else setMsg(d.error ?? "That code isn't valid.");
    } catch {
      setMsg("Couldn't check the code.");
    }
    setBusy(false);
  }

  if (applied) {
    return (
      <div className="promo promo--on">
        <span>
          Code <strong>{applied.code}</strong> applied
        </span>
        <button type="button" className="linkbtn" onClick={() => onApply(null)}>
          Remove
        </button>
      </div>
    );
  }
  return (
    <div className="promo">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Promo code"
        aria-label="Promo code"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (code) apply();
          }
        }}
      />
      <button type="button" className="btn-ghost" disabled={!code || busy} onClick={apply}>
        {busy ? "Checking…" : "Apply"}
      </button>
      {(msg || error) && <span className="field__err">{msg || error}</span>}
    </div>
  );
}

export function PayMethods({
  method,
  onChange,
  opts,
  dueTodayCents,
  errors,
}: {
  method: Method;
  onChange: (m: Method) => void;
  opts: PayOptions | null;
  dueTodayCents: number | null;
  errors: Errors;
}) {
  return (
    <>
      <div className="paymethods" role="radiogroup" aria-label="Payment method">
        {(["btc", "eth", "bank"] as Method[]).map((m) => {
          const available = opts ? opts.methods[m] : true;
          const est =
            dueTodayCents != null && opts && m !== "bank"
              ? `≈ ${cryptoAmount(dueTodayCents, m === "btc" ? opts.rates.btcUsd : opts.rates.ethUsd, m === "btc" ? 8 : 6)} ${m.toUpperCase()} today`
              : m === "bank"
                ? "USD account"
                : "";
          return (
            <label key={m} className={`paymethod${method === m ? " is-on" : ""}${available ? "" : " is-off"}`}>
              <input type="radio" name="method" value={m} checked={method === m} disabled={!available} onChange={() => onChange(m)} />
              <span className="paymethod__icon" aria-hidden="true">
                {m === "btc" ? "₿" : m === "eth" ? "Ξ" : "⌂"}
              </span>
              <span className="paymethod__name">{METHOD_LABEL[m]}</span>
              <span className="paymethod__est">{available ? est : "Not available yet"}</span>
            </label>
          );
        })}
      </div>
      <FieldError errors={errors} k="method" />
      <p className="hint">
        Submit your request and our team prepares your payment details:{" "}
        {method === "bank"
          ? "the bank account and your reference"
          : `a ${method === "btc" ? NETWORKS["btc-testnet"].label : NETWORKS["eth-sepolia"].label} address, QR code and exact amount`}
        . They appear on your receipt page, usually within minutes, and stay valid for a limited time. Payments run on test
        networks only, so testnet coins have no value.
      </p>
    </>
  );
}

export function DetailsFields({
  customer,
  set,
  errors,
  addressLabel = "Delivery address (optional)",
}: {
  customer: Customer;
  set: (k: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  errors: Errors;
  addressLabel?: string;
}) {
  return (
    <div className="fields">
      <label className="field field--wide">
        <span>Full name</span>
        <input value={customer.name} onChange={set("name")} autoComplete="name" required />
        <FieldError errors={errors} k="name" />
      </label>
      <label className="field">
        <span>Email</span>
        <input type="email" value={customer.email} onChange={set("email")} autoComplete="email" required />
        <FieldError errors={errors} k="email" />
      </label>
      <label className="field">
        <span>Phone</span>
        <input type="tel" value={customer.phone} onChange={set("phone")} autoComplete="tel" placeholder="+44 …" required />
        <FieldError errors={errors} k="phone" />
      </label>
      <label className="field">
        <span>Country</span>
        <select value={customer.country} onChange={set("country")} autoComplete="country-name">
          {COUNTRIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <FieldError errors={errors} k="country" />
      </label>
      <label className="field">
        <span>City</span>
        <input value={customer.city} onChange={set("city")} autoComplete="address-level2" required />
        <FieldError errors={errors} k="city" />
      </label>
      <label className="field field--wide">
        <span>{addressLabel}</span>
        <input value={customer.address} onChange={set("address")} autoComplete="street-address" />
        <FieldError errors={errors} k="address" />
      </label>
    </div>
  );
}

/** POST the order and go to the receipt; returns field errors on failure. */
export async function placeOrder(body: Record<string, unknown>): Promise<{ errors?: Errors; error?: string }> {
  try {
    const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) return { errors: data.fields ?? {}, error: data.error ?? "Something went wrong." };
    window.location.assign(`/reserve/confirmation/${data.id}`);
    return {};
  } catch {
    return { error: "Network error. Please try again." };
  }
}
