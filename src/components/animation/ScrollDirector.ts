import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { rig, domSync } from "@/lib/rig";
import { SCENES, type SceneName } from "./AnimationTimeline";
import { ARENA, FLIP, flipPose, hopPose, rampPose, type Pose } from "@/lib/stunts";

gsap.registerPlugin(ScrollTrigger);

// One master timeline, scrubbed by scroll, coordinates every animated value:
// the WebGL rig (camera, car, lines, materials, smoke, lights) and the DOM
// (typography, red panels, nav ink). Each property is owned by exactly one
// sequence of non-overlapping tweens; `own()` asserts that in development.

type Vars = gsap.TweenVars;

export type Director = {
  playIntro: () => void;
  scrollTo: (scene: SceneName) => void;
  destroy: () => void;
};

export function createDirector(root: HTMLElement, opts: { reducedMotion: boolean }): Director {
  const reduced = opts.reducedMotion;
  rig.reducedMotion = reduced;
  const q = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));
  const one = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  // Mobile: don't recompute every trigger when the browser chrome shows/hides.
  ScrollTrigger.config({ ignoreMobileResize: true });

  // ── smooth scroll ────────────────────────────────────────────────────────
  let lenis: Lenis | null = null;
  const tick = (time: number) => lenis?.raf(time * 1000);
  if (!reduced) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
  }

  const ctx = gsap.context(() => {}, root);
  let tl!: gsap.core.Timeline;

  ctx.add(() => {
    // CSS supplies pre-hydration hidden states; hand them to GSAP as percent
    // offsets so they are not parsed into fixed pixel translations.
    gsap.set(q(".mask[data-s] > *"), { y: 0, yPercent: 112 });
    gsap.set(q("[data-s=perf-letter]"), { y: 0, yPercent: 118 });

    tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: one("[data-s=track]")!,
        start: "top top",
        end: "bottom bottom",
        scrub: reduced ? true : 0.7,
        invalidateOnRefresh: false,
      },
    });
    Object.entries(SCENES).forEach(([name, at]) => tl.addLabel(name, at));

    // Development guard against two tweens fighting over one property.
    const owners = new Map<object, Map<string, number>>();
    const own = (target: object, props: string[], t0: number, t1: number) => {
      if (process.env.NODE_ENV === "production") return;
      let m = owners.get(target);
      if (!m) owners.set(target, (m = new Map()));
      for (const p of props) {
        const end = m.get(p);
        if (end !== undefined && t0 < end - 1e-6) console.warn(`[director] overlapping tween on "${p}" at ${t0} (busy until ${end})`);
        m.set(p, Math.max(end ?? -Infinity, t1));
      }
    };
    // The anatomy scene was inserted at beat 37: every later beat is shifted.
    const CUT = 37, GAP = 14;
    let shiftOn = true;
    const S = (t: number) => (shiftOn && t >= CUT ? t + GAP : t);
    // DOM lists are several targets; plain arrays of numbers (rig.anat) are one.
    const targetsOf = (t: gsap.TweenTarget): object[] =>
      Array.isArray(t) && t.length && typeof t[0] === "object" ? (t as object[]) : [t as object];
    const META = new Set(["ease", "stagger", "onUpdate", "immediateRender", "svgOrigin", "transformOrigin"]);
    const to = (target: gsap.TweenTarget, t0: number, t1: number, vars: Vars) => {
      t0 = S(t0); t1 = S(t1);
      const props = Object.keys(vars).filter((k) => !META.has(k));
      targetsOf(target).forEach((t) => own(t, props, t0, t1));
      tl.to(target, { ease: "power2.inOut", ...vars, duration: Math.max(0.001, t1 - t0) }, t0);
    };
    const fromTo = (target: gsap.TweenTarget, t0: number, t1: number, from: Vars, vars: Vars) => {
      t0 = S(t0); t1 = S(t1);
      const props = Object.keys(vars).filter((k) => !META.has(k));
      targetsOf(target).forEach((t) => own(t, props, t0, t1));
      tl.fromTo(target, from, { ease: "power2.inOut", immediateRender: false, ...vars, duration: Math.max(0.001, t1 - t0) }, t0);
    };

    const cam = rig.cam;
    const car = rig.car;
    // roll/pitch pivot height — must match CarRig (height × 0.45)
    const pivotY = () => domSync.carHeight * 0.45;

    /** Drive the car from a stunt pose function over [t0, t1]. */
    const stunt = (key: "flip" | "ramp" | "hop", t0: number, t1: number, pose: (p: number) => Pose) => {
      t0 = S(t0); t1 = S(t1);
      own(rig.stunt, [key], t0, t1);
      own(car, ["x", "y", "roll", "pitch"], t0, t1);
      own(rig, ["thrust", "thrustAux"], t0, t1);
      tl.fromTo(
        rig.stunt,
        { [key]: 0 },
        {
          [key]: 1,
          duration: t1 - t0,
          ease: "none",
          immediateRender: false,
          onUpdate: () => {
            const p = pose(Math.min(1, rig.stunt[key]));
            car.x = p.x;
            car.y = p.y;
            car.roll = p.roll;
            car.pitch = p.pitch;
            rig.thrust = rig.reducedMotion ? 0 : p.thrust;
            rig.thrustAux = rig.reducedMotion ? 0 : p.aux ?? 0;
          },
        },
        t0,
      );
    };
    const ink = (t0: number, t1: number, color: string) => to(root, t0, t1, { "--ink": color, ease: "none" });

    // ── SCENE 1–2 · drawing (scroll can also finish the autoplay sketch) ──
    to(rig, 0, 5, { draw: 1, ease: "none" });
    to(rig, 0, 4, { construct: 1, ease: "none" });
    to(one("[data-s=scroll-cue]"), 0.4, 2.2, { autoAlpha: 0, y: 12 });
    to(one("[data-s=intro-copy]"), 4.8, 8, { yPercent: -30, autoAlpha: 0, ease: "power2.in" });
    to(one("[data-s=titleblock]"), 5.5, 7.5, { autoAlpha: 0, y: 16 });
    to(q("[data-anchor]:not([data-anchor^=x-])"), 6.2, 8.2, { opacity: 0 });

    // Studio lights slowly orbit for the whole film, so reflections glide
    // across the paint the way they do on a real turntable shoot.
    to(rig, 8, SCENES.end - GAP, { envRot: Math.PI * 3, ease: "none" });

    // ── SCENE 3 · wireframe → photoreal ──
    to(rig, 6.5, 10, { constructOut: 1, ease: "power1.inOut" });
    to(rig, 7, 15.5, { sweep: 1, ease: "power1.inOut" });
    to(rig, 9, 16, { shadow: 1 });
    to(rig, 12, 17.5, { lines: 0 });
    to(cam, 10, 20, { az: 32, el: 9, dist: 11.2, fov: 24, ty: 0.55, sx: 0.17, sy: 0 });
    fromTo(q("[data-s=form-line] > *"), 12.5, 15.5, { yPercent: 110 }, { yPercent: 0, stagger: 0.35, ease: "power3.out" });
    fromTo(one("[data-s=form-copy]"), 12.5, 14, { autoAlpha: 0 }, { autoAlpha: 1 });
    to(q("[data-s=form-line] > *"), 18, 19.6, { yPercent: -110, stagger: 0.15, ease: "power2.in" });

    // ── SCENE 4 · red performance band ──
    to(cam, 20, 25, { az: -2, el: 3, dist: 11.4, fov: 22, sx: 0, sy: 0 });
    to(cam, 25, 28.2, { az: 2, dist: 11.8, ease: "sine.inOut" });
    to(cam, 28.2, 31, { az: 4, el: 7, dist: 14.2, ease: "power2.out" }); // pull back for the flip
    to(cam, 31, 36.5, { az: 5, el: 3, dist: 11.6, ease: "sine.inOut" });
    to(car, 21, 28.4, { x: FLIP.x0, ease: "sine.in" });
    to(car, 21, 57, { spin: 48, ease: "none" });
    fromTo(one("[data-s=perf-line]"), 19.8, 21.6, { scaleX: 0, autoAlpha: 1, transformOrigin: "0% 50%" }, { scaleX: 1, ease: "power3.inOut" });
    fromTo(one("[data-s=perf-band]"), 21.3, 23.8, { clipPath: "inset(50% 0% 50% 0%)" }, { clipPath: "inset(17% 0% 17% 0%)", ease: "power3.inOut" });
    fromTo(q("[data-s=perf-letter]"), 22.4, 26, { yPercent: 118 }, { yPercent: 0, stagger: 0.28, ease: "power3.out" });
    fromTo(q("[data-s=stat]"), 25, 28.4, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, stagger: 0.55, ease: "power3.out" });
    q("[data-count]").forEach((el, i) => {
      const target = Number(el.dataset.count);
      const dec = Number(el.dataset.decimals ?? 0);
      const o = { v: 0 };
      fromTo(o, 25.4 + i * 0.55, 29.2 + i * 0.55, { v: 0 }, {
        v: target,
        ease: "power2.out",
        onUpdate: () => { el.textContent = o.v.toFixed(dec); },
      });
    });
    fromTo(one("[data-s=perf-note]"), 27.5, 29.5, { autoAlpha: 0 }, { autoAlpha: 1 });
    // The flip: cold-gas thrusters launch the car into a full barrel roll
    // above its own shadow; it lands and settles on its suspension.
    stunt("flip", 28.4, 33.6, flipPose);
    to(rig.stunt, 33.6, 35.6, { flip: 1.4, ease: "none" }); // let the trail dissipate
    to(car, 33.6, 36.5, { x: 0.9, ease: "sine.out" });
    to(q("[data-s=perf-letter]"), 34.4, 37, { yPercent: -118, stagger: 0.18, ease: "power3.in" });
    to(q("[data-s=stat]"), 34, 35.6, { autoAlpha: 0, y: -18, stagger: 0.12, ease: "power2.in" });
    to(one("[data-s=perf-note]"), 34, 35, { autoAlpha: 0 });
    to(one("[data-s=perf-band]"), 35.2, 36.6, { clipPath: "inset(50% 0% 50% 0%)", ease: "power3.inOut" });
    to(one("[data-s=perf-line]"), 36.3, 36.95, { scaleX: 0, transformOrigin: "100% 50%", ease: "power3.inOut" });

    // ── SCENE 4b · X-ray anatomy (authored in unshifted beats 37–51) ──
    shiftOn = false;
    const bgEl = one("[data-s=bg]");
    to(bgEl, 37, 38.6, { backgroundColor: "#05070b" });
    ink(37, 38.6, "#f2f2f2");
    to(car, 37, 39, { x: 0 });
    to(cam, 37, 39.5, { az: 38, el: 20, dist: 10.5, fov: 26, sx: 0.12, ty: 0.42 });
    to(cam, 39.5, 48.5, { az: -38, el: 15, ease: "sine.inOut" });
    to(cam, 48.5, 51, { el: 8, dist: 10.2, sx: 0, ty: 0.55 });
    to(rig, 38, 40, { xray: 1 });
    to(rig, 38.5, 40.5, { lines: 0.55 });
    fromTo(q("[data-s=anat-line] > *"), 38.4, 40.6, { yPercent: 110 }, { yPercent: 0, stagger: 0.3, ease: "power3.out" });
    const anatItems = q("[data-s=anat-item]");
    const anatLabels = q("[data-s=anat-label]");
    [39, 40, 41, 42, 43, 44].forEach((t, i) => {
      to(rig.anat, t, t + 1.3, { [i]: 1, ease: "power2.out" });
      if (anatItems[i]) fromTo(anatItems[i], t, t + 1, { autoAlpha: 0.25, x: -8 }, { autoAlpha: 1, x: 0, ease: "power2.out" });
      if (anatLabels[i]) fromTo(anatLabels[i], t + 0.3, t + 1.1, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0 });
    });
    fromTo(one("[data-s=anat-note]"), 44.5, 45.5, { autoAlpha: 0 }, { autoAlpha: 1 });
    to(one("[data-s=anat-note]"), 47.2, 48.2, { autoAlpha: 0 });
    to(rig.anat, 47.4, 48.6, { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, ease: "power2.in" });
    to(anatLabels, 47.2, 48.2, { autoAlpha: 0 });
    to(anatItems, 47.2, 48.4, { autoAlpha: 0 });
    to(q("[data-s=anat-line] > *"), 47.2, 48.6, { yPercent: -110, stagger: 0.12, ease: "power2.in" });
    to(rig, 47.8, 49.4, { lines: 0 });
    to(rig, 48, 50, { xray: 0 });
    to(bgEl, 49, 50.6, { backgroundColor: "#ffffff" });
    ink(49, 50.6, "#0d0d0d");
    shiftOn = true;

    // ── SCENE 5 · cinematic camera moves ──
    to(car, 37, 42, { x: 0 });
    to(cam, 37, 42, { az: -90, el: 7, dist: 9.8, fov: 26 });
    to(cam, 42, 46.5, { az: -180, el: 4, dist: 10.8, fov: 24 });
    to(cam, 46.5, 50.5, { az: -222, el: 13, dist: 9.4, fov: 26 });
    to(cam, 50.5, 57, { az: -450, el: 89, dist: 10.2, fov: 30, ty: 0.4 });
    fromTo(one("[data-s=viewfinder]"), 37.4, 39, { autoAlpha: 0, scale: 1.04 }, { autoAlpha: 1, scale: 1 });
    to(one("[data-s=viewfinder]"), 56, 57.6, { autoAlpha: 0, scale: 1.04 });
    const caps = q("[data-s=caption]");
    const capTimes: [number, number][] = [[39.2, 41.8], [43.4, 46], [47.4, 50.2], [53.6, 57]];
    caps.forEach((el, i) => {
      const [a, b] = capTimes[i];
      fromTo(el, a, a + 0.9, { clipPath: "inset(0% 100% 0% 0%)", autoAlpha: 1 }, { clipPath: "inset(0% 0% 0% 0%)", ease: "power3.out" });
      to(el, b - 0.6, b, { clipPath: "inset(0% 0% 0% 100%)", ease: "power2.in" });
    });

    // ── SCENE 6 · multi-perspective showcase ──
    to(rig, 57.4, 62.6, { split: 1, ease: "none" });
    to(rig.panels[1], 58, 70.5, { az: 72, el: 14, ease: "sine.inOut" });
    to(rig.panels[2], 58, 70.5, { az: -108, el: 5, ease: "sine.inOut" });
    to(cam, 58, 70.5, { az: -446, dist: 9.6, ease: "sine.inOut" });
    fromTo(q("[data-s=showcase-head] > *"), 60.6, 62.8, { yPercent: 110 }, { yPercent: 0, stagger: 0.25, ease: "power3.out" });
    fromTo(q("[data-s=panel-label]"), 61.4, 63.6, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.3 });
    to(q("[data-s=showcase-head] > *"), 67.6, 69, { yPercent: -110, ease: "power2.in" });
    to(q("[data-s=panel-label]"), 67.6, 68.8, { autoAlpha: 0 });
    to(rig, 68.4, 72.4, { splitOut: 1, ease: "none" });

    // ── SCENE 7 · vertical red wake ──
    const wake = one("[data-s=wake]");
    fromTo(wake, 72, 74.6, { "--side": "50vw" }, { "--side": "31vw", ease: "power3.inOut" });
    to(cam, 72, 80.5, { dist: 11.8, ease: "sine.inOut" });
    to(car, 72.6, 80.6, { x: 9.5, ease: "power2.in" });
    to(car, 72.6, 80.6, { spin: 140, ease: "power2.in" });
    fromTo(q("[data-s=split-line] > *"), 73.6, 75.6, { yPercent: 110 }, { yPercent: 0, stagger: 0.3, ease: "power3.out" });
    to(q("[data-s=split-line] > *"), 78.2, 79.6, { yPercent: -110, stagger: 0.12, ease: "power2.in" });
    to(wake, 79.4, 81.4, { "--side": "0vw", ease: "power3.inOut" });
    to(car, 80.6, 80.7, { visible: 0 });
    ink(80.2, 81, "#ffffff");
    fromTo(one("[data-s=wash]"), 81.3, 81.5, { autoAlpha: 0 }, { autoAlpha: 1 });

    // ── SCENE 8 · oversized typography (zoom-out through the letter T) ──
    const zoom = one("[data-s=type-zoom]");
    fromTo(one("[data-s=type]"), 81.5, 81.55, { autoAlpha: 0 }, { autoAlpha: 1 });
    to(wake, 81.6, 81.65, { autoAlpha: 0 });
    to(one("[data-s=wash]"), 81.7, 81.75, { autoAlpha: 0 });
    fromTo(zoom, 81.6, 86.6, { scale: 140 }, { scale: 1, ease: "expo.inOut" });
    ink(82.8, 83.8, "#0d0d0d");
    fromTo(q("[data-s=type-line] > *"), 85.4, 88, { yPercent: 110 }, { yPercent: 0, stagger: 0.35, ease: "power3.out" });
    fromTo(q("[data-s=type-rule]"), 85.2, 87.6, { scaleX: 0 }, { scaleX: 1, transformOrigin: "0% 50%", ease: "power3.inOut" });

    // ── SCENE 9 · smoke + final composition ──
    to(rig, 88.4, 91.6, { smokeCover: 1, ease: "power1.in" });
    to(one("[data-s=bg]"), 91.3, 91.4, { backgroundColor: "#0b0b0c" });
    to(one("[data-s=type]"), 91.3, 91.4, { autoAlpha: 0 });
    ink(91.3, 91.4, "#f2f2f2");
    // Under the smoke: cut to the reveal-stage arena, car at the ramp approach.
    to(car, 91.4, 91.5, { x: ARENA.approach, y: 0, roll: 0, pitch: 0, visible: 1 });
    to(cam, 91.4, 91.5, { az: 6, el: 7, dist: 24, fov: 30, tx: -28, ty: 2.6, sx: 0, sy: 0 });
    to(rig, 91.4, 91.5, { env: 0.6, shadow: 0.85, arena: 1 });
    to(rig, 92, 96, { smokeClear: 1, ease: "power1.inOut" });
    to(rig, 92, 95.5, { smokeFloor: 1, ease: "power1.out" });
    to(rig, 92.5, 96.5, { rim: 1 });

    // STUNT 01 · inverted ramp
    const stuntCaps = q("[data-s=stunt-cap]");
    fromTo(stuntCaps[0], 95.4, 96.6, { clipPath: "inset(0% 100% 0% 0%)", autoAlpha: 1 }, { clipPath: "inset(0% 0% 0% 0%)", ease: "power3.out" });
    stunt("ramp", 96, 106, (p) => rampPose(p, pivotY()));
    to(cam, 96, 106, { az: 12, el: 9, dist: 21.5, ease: "sine.inOut" });
    to(rig.stunt, 106, 108.5, { ramp: 1.35, ease: "none" });
    to(stuntCaps[0], 105.2, 106.2, { clipPath: "inset(0% 0% 0% 100%)", ease: "power2.in" });

    // STUNT 02 · the hop over the lineup
    to(cam, 106, 109, { az: 22, el: 9, dist: 31, tx: 2, ty: 2.4, ease: "power2.inOut" });
    fromTo(stuntCaps[1], 107.6, 108.8, { clipPath: "inset(0% 100% 0% 0%)", autoAlpha: 1 }, { clipPath: "inset(0% 0% 0% 0%)", ease: "power3.out" });
    stunt("hop", 108.6, 117, hopPose);
    to(cam, 109, 116, { tx: 5, az: 18, ease: "sine.inOut" });
    to(rig.stunt, 117, 119.5, { hop: 1.35, ease: "none" });
    to(stuntCaps[1], 116.4, 117.4, { clipPath: "inset(0% 0% 0% 100%)", ease: "power2.in" });

    // Final hero frame on the car where it came to rest.
    to(cam, 116, 119.5, { tx: ARENA.stopX, ty: 0.5, az: 30, el: 3.5, dist: 12, fov: 26, sy: -0.1, ease: "power2.inOut" });
    to(cam, 119.5, 123.5, { az: 21, el: 2.4, dist: 10.6, ease: "sine.out" });
    fromTo(q("[data-s=finale-line] > *"), 119.2, 122, { yPercent: 110 }, { yPercent: 0, stagger: 0.4, ease: "power3.out" });
    fromTo(one("[data-s=finale-credit]"), 121.2, 123, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0 });
    fromTo(one("[data-s=finale-credit-cta]"), 120.4, 122.2, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0 });
    tl.set({}, {}, SCENES.end);
  });

  // ── autoplay intro (time-based, runs once the model is ready) ────────────
  const playIntro = () => {
    ctx.add(() => {
      const loader = document.querySelector("[data-s=loader]");
      if (reduced) {
        rig.introDraw = 1;
        rig.introConstruct = 1;
        gsap.set(loader, { autoAlpha: 0 });
        gsap.set(q("[data-s=intro-reveal] > *"), { yPercent: 0 });
        gsap.set(q("[data-s=nav-item], [data-s=dim-inner], [data-s=titleblock-inner], [data-s=scroll-cue-inner]"), { autoAlpha: 1, y: 0 });
        return;
      }
      const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
      intro
        .to(loader, { clipPath: "inset(0% 0% 100% 0%)", duration: 1.2, ease: "expo.inOut" }, 0)
        .set(loader, { autoAlpha: 0 })
        .fromTo(q("[data-s=nav-item]"), { y: -14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, stagger: 0.06 }, 0.75)
        .to(rig, { introConstruct: 1, duration: 2.8, ease: "power1.inOut" }, 0.6)
        .to(rig, { introDraw: 1, duration: 5.6, ease: "power1.inOut" }, 1.1)
        .fromTo(q("[data-s=intro-reveal] > *"), { yPercent: 115 }, { yPercent: 0, duration: 1.5, stagger: 0.12 }, 1.0)
        .fromTo(q("[data-s=dim-inner]"), { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.18 }, 2.6)
        .fromTo(one("[data-s=titleblock-inner]"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1.2 }, 3.2)
        .fromTo(one("[data-s=scroll-cue-inner]"), { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 1.2 }, 4.4);
    });
    lenis?.start();
  };

  lenis?.stop();

  // QA hook used by scripts/capture.mjs to jump to exact timeline beats.
  (window as unknown as { __roadster?: unknown }).__roadster = {
    goto(beat: number) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = (Math.min(SCENES.end, Math.max(0, beat)) / SCENES.end) * max;
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    },
  };

  const scrollTo = (scene: SceneName) => {
    const st = tl.scrollTrigger;
    if (!st) return;
    const y = st.labelToScroll(scene) + 2;
    if (lenis) lenis.scrollTo(y, { duration: 2.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else window.scrollTo({ top: y, behavior: "auto" });
  };

  return {
    playIntro,
    scrollTo,
    destroy() {
      ctx.revert();
      if (lenis) {
        gsap.ticker.remove(tick);
        lenis.destroy();
      }
    },
  };
}
