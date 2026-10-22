"use client";

import { useEffect } from "react";
import { formatMoney } from "@/lib/commerce/pricing";

/**
 * Scroll effects for the home sections: staggered reveals, masked headline
 * words, gentle image parallax, a counting price and hiding the experience's
 * floating nav once the sections take over. Respects reduced motion.
 */
export function HomeMotion() {
  useEffect(() => {
    const home = document.querySelector<HTMLElement>(".home");
    if (!home) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveals = [...home.querySelectorAll<HTMLElement>("[data-reveal]")];
    const counters = [...home.querySelectorAll<HTMLElement>("[data-count]")];
    const parallax = [...home.querySelectorAll<HTMLElement>("[data-parallax]")];

    if (reduced) {
      reveals.forEach((el) => el.classList.add("is-in"));
    }

    const count = (el: HTMLElement) => {
      const target = Number(el.dataset.count);
      if (!target || reduced) return;
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 1400);
        const eased = 1 - Math.pow(1 - k, 4);
        el.textContent = formatMoney(Math.round((target * eased) / 100) * 100);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      // always land on the exact price, even if frames are throttled
      setTimeout(() => (el.textContent = formatMoney(target)), 1500);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.classList.add("is-in");
          if (el.dataset.count) count(el);
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    if (!reduced) reveals.forEach((el) => io.observe(el));
    counters.forEach((el) => io.observe(el));

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vh = window.innerHeight;
        // the floating experience nav steps aside once the sections cover the screen
        document.documentElement.toggleAttribute("data-home", home.getBoundingClientRect().top < 72);
        if (reduced) return;
        for (const el of parallax) {
          const r = el.parentElement!.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh) continue;
          const offset = (r.top + r.height / 2 - vh / 2) * Number(el.dataset.parallax ?? 0.06);
          el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(1.12)`;
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.documentElement.removeAttribute("data-home");
    };
  }, []);
  return null;
}
