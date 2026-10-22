"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Pulse = {
  requests: number;
  review: number;
  latest: { id: string; number: string; name: string; at: string } | null;
  latestSent: { id: string; number: string; name: string } | null;
};
type Toast = { id: number; text: string; href: string };

/** Short two-tone chime (no audio file needed). */
function chime(ctx: AudioContext | null) {
  if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1320].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, now + i * 0.16);
    g.gain.exponentialRampToValueAtTime(0.2, now + i * 0.16 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.3);
    o.connect(g).connect(ctx.destination);
    o.start(now + i * 0.16);
    o.stop(now + i * 0.16 + 0.32);
  });
}

/**
 * Live alerts: polls every 10 s; when a new payment request (or a "payment
 * sent") arrives it chimes, shows a toast, updates the tab title, sends a
 * desktop notification if allowed, and refreshes the page data.
 */
export function Pulse() {
  const router = useRouter();
  const prev = useRef<Pulse | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    // browsers only allow sound after the first interaction
    const unlock = () => {
      if (!audio.current) audio.current = new AudioContext();
      void audio.current.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    const base = document.title.replace(/^\(\d+\)\s*/, "");

    const tick = async () => {
      const r = await fetch("/api/pulse", { cache: "no-store" }).catch(() => null);
      if (!r || !r.ok) return;
      const p = (await r.json()) as Pulse;
      const before = prev.current;
      prev.current = p;
      const pending = p.requests + p.review;
      document.title = pending ? `(${pending}) ${base}` : base;
      if (!before) return;
      const alerts: Toast[] = [];
      if (p.requests > before.requests && p.latest) {
        alerts.push({ id: Date.now(), text: `New payment request: ${p.latest.number} · ${p.latest.name}`, href: "/requests" });
      }
      if (p.review > before.review && p.latestSent) {
        alerts.push({ id: Date.now() + 1, text: `Payment sent, verify: ${p.latestSent.number} · ${p.latestSent.name}`, href: `/orders/${p.latestSent.id}` });
      }
      if (!alerts.length) {
        if (p.requests !== before.requests || p.review !== before.review) router.refresh();
        return;
      }
      chime(audio.current);
      setToasts((t) => [...t, ...alerts].slice(-4));
      alerts.forEach((a) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== a.id)), 12000));
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        alerts.forEach((a) => new Notification("Roadster Admin", { body: a.text, tag: a.href }));
      }
      router.refresh();
    };
    void tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <>
      {perm === "default" && (
        <button
          type="button"
          className="adm-btn adm-btn--ghost adm-small"
          onClick={async () => setPerm(await Notification.requestPermission())}
        >
          Enable desktop alerts
        </button>
      )}
      <div className="adm-toasts" aria-live="polite">
        {toasts.map((t) => (
          <Link key={t.id} href={t.href} className="adm-toast">
            {t.text}
          </Link>
        ))}
      </div>
    </>
  );
}
