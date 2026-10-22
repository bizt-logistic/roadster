"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the server receipt every 12 s so admin confirmations appear live. */
export function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 12000);
    return () => clearInterval(t);
  }, [active, router]);
  return active ? <span className="live-dot">Live · updates automatically</span> : null;
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copyfield">
      <span className="mono">{label}</span>
      <div>
        <code>{value}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard unavailable */
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/** "I've sent the payment" — optional tx hash / bank reference. */
export function NotifyPaid({ orderId, kind }: { orderId: string; kind: "wallet" | "bank" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  return (
    <form
      className="notify"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setState("busy");
        const res = await fetch(`/api/orders/${orderId}/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kind === "wallet" ? { txHash: value } : { reference: value }),
        }).catch(() => null);
        if (!res || !res.ok) {
          setError((await res?.json().catch(() => null))?.error ?? "Couldn't send. Please try again.");
          setState("idle");
          return;
        }
        setState("done");
        router.refresh();
      }}
    >
      <label className="field">
        <span>{kind === "wallet" ? "Transaction hash (optional, speeds up verification)" : "Transfer reference (optional)"}</span>
        <input value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} autoComplete="off" />
      </label>
      {error && <p className="field__err">{error}</p>}
      <button className="cta" type="submit" disabled={state !== "idle"}>
        {state === "busy" ? "Sending…" : state === "done" ? "Thanks, we're verifying" : "I've sent the payment"}
      </button>
    </form>
  );
}

/** Time left on the issued payment details; refreshes the page when they expire. */
export function Countdown({ until }: { until: string }) {
  const router = useRouter();
  const end = new Date(until).getTime();
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const ms = Math.max(0, end - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(t);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [end, router]);
  const s = Math.floor(left / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className={`countdown${s < 300 ? " countdown--low" : ""}`} role="timer" aria-live="off">
      Expires in {h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`}
    </span>
  );
}

/** Ask the team to issue (new) payment details; the admin is notified. */
export function RequestPayment({ orderId, method, label }: { orderId: string; method: string; label: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy">("idle");
  const [error, setError] = useState("");
  return (
    <div className="notify">
      {error && <p className="field__err">{error}</p>}
      <button
        className="cta"
        type="button"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          setError("");
          const res = await fetch(`/api/orders/${orderId}/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method }),
          }).catch(() => null);
          if (!res || !res.ok) {
            setError((await res?.json().catch(() => null))?.error ?? "Couldn't send the request. Please try again.");
            setState("idle");
            return;
          }
          router.refresh();
        }}
      >
        {state === "busy" ? "Sending…" : label}
      </button>
    </div>
  );
}
