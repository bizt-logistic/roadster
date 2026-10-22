"use client";

import { useState, type FormEvent } from "react";
import { INTERESTS, INVESTOR_TYPES, TICKETS } from "@/lib/commerce/leads";

const COUNTRIES = ["United Kingdom", "Ireland", "France", "Germany", "Italy", "Spain", "Portugal", "Netherlands", "Belgium", "Luxembourg", "Switzerland", "Austria", "Monaco", "Sweden", "Norway", "Denmark", "Finland", "Poland", "Czech Republic", "Greece", "Other"];

export function InvestForm() {
  const [v, setV] = useState({
    name: "", email: "", phone: "", country: "United Kingdom", organization: "",
    investorType: INVESTOR_TYPES[0], ticket: TICKETS[0], interest: INTERESTS[1], message: "",
  });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [serverError, setServerError] = useState("");

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));
  const err = (k: string) => (errors[k] ? <span className="field__err">{errors[k]}</span> : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServerError("");
    setState("busy");
    try {
      const res = await fetch("/api/investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, consent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setServerError(data.error ?? "Something went wrong.");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setServerError("Network error. Please try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="receipt" role="status">
        <p className="mono eyebrow">Interest registered</p>
        <h2>Thank you, {v.name.split(" ")[0]}.</h2>
        <p>Your details were recorded. In a live deployment the team would follow up at {v.email}.</p>
        <a className="cta" href="/">
          Back to the experience
        </a>
      </div>
    );
  }

  return (
    <form className="invest" onSubmit={submit} noValidate>
      <div className="fields">
        <label className="field">
          <span>Full name</span>
          <input value={v.name} onChange={set("name")} autoComplete="name" />
          {err("name")}
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={v.email} onChange={set("email")} autoComplete="email" />
          {err("email")}
        </label>
        <label className="field">
          <span>Phone (optional)</span>
          <input type="tel" value={v.phone} onChange={set("phone")} autoComplete="tel" />
          {err("phone")}
        </label>
        <label className="field">
          <span>Country</span>
          <select value={v.country} onChange={set("country")}>
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {err("country")}
        </label>
        <label className="field field--wide">
          <span>Organization (optional)</span>
          <input value={v.organization} onChange={set("organization")} autoComplete="organization" />
          {err("organization")}
        </label>
        <label className="field">
          <span>I am a…</span>
          <select value={v.investorType} onChange={set("investorType")}>
            {INVESTOR_TYPES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Interested in</span>
          <select value={v.interest} onChange={set("interest")}>
            {INTERESTS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field field--wide">
          <span>Indicative size</span>
          <select value={v.ticket} onChange={set("ticket")}>
            {TICKETS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field field--wide">
          <span>Message (optional)</span>
          <textarea rows={4} value={v.message} onChange={set("message")} />
          {err("message")}
        </label>
      </div>
      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I understand this form only registers interest. It is <strong>not an offer of securities</strong>, no money is
          collected, and this concept is not affiliated with Tesla, Inc.
        </span>
      </label>
      {err("consent")}
      {serverError && (
        <p className="form-error" role="alert">
          {serverError}
        </p>
      )}
      <button className="cta" type="submit" disabled={state === "busy"}>
        {state === "busy" ? "Sending…" : "Register interest"}
      </button>
    </form>
  );
}
