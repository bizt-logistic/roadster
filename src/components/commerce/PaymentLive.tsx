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
          setError((await res?.json().catch(() => null))?.error ?? "Couldn't send — try again.");
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
        {state === "busy" ? "Sending…" : state === "done" ? "Thanks — we're verifying" : "I've sent the payment"}
      </button>
    </form>
  );
}
