# Asset sources

Every external asset used by this project, with its licence and attribution
requirements. This is an **unofficial fan concept, not affiliated with or
endorsed by Tesla, Inc.** No Tesla logos, wordmarks, fonts, press imagery,
videos or website code are used.

## 3D model (in use)

| | |
|---|---|
| **Asset** | “Tesla Roadster (2028).” — fan model of the production Roadster revealed 15 Oct 2026 |
| **Creator** | morolucky — https://sketchfab.com/morolucky |
| **Source URL** | https://sketchfab.com/3d-models/tesla-roadster-2028-0caed2c3ad1e4dd8ad90b1bb11b23d38 |
| **Licence** | Creative Commons Attribution 4.0 International (CC BY 4.0) — https://creativecommons.org/licenses/by/4.0/ |
| **Attribution required** | Yes. Credit the creator, link the licence, indicate changes. |
| **Where credited** | Final scene footer, the in-site *Credits* dialog, this file, README. |
| **Changes made** | Re-oriented and scaled into car space, textures re-encoded 4096 px PNG → 2048 px WebP (20.5 MB → 1.4 MB), compressed with EXT_meshopt_compression (24.6 MB → 2.15 MB), line art derived from the geometry. At runtime the albedo is used as a mask and the body is repainted Ano White pearl under a clear coat. |

### Candidates evaluated

| Source | Licence | Outcome |
|---|---|---|
| “Tesla Roadster (2028).” — morolucky | CC BY | **Chosen** — closest to the revealed car (wedge profile, rear wing), smooth surfaces, PBR textures, 50k triangles |
| “Tesla Roadtser 2026” — asiphy007 | CC BY | Rejected — angular but auto-generated, noisy surface, colour baked into an emissive texture |
| “Tesla Roadster 2.0” — gmmichaelonearth | CC BY | Rejected — auto-generated mesh, wheels fused into the body, noisy surface |
| “Tesla Roadster (2028) Game-Ready / High poly” — morolucky | Not downloadable | Paid/restricted versions — not used |
| “Tesla Roadster 2020” — metarex.4d | CC BY | Used in an earlier iteration; it depicts the 2017 prototype, not the 2026 production car |
| CGTrader / RenderHub / ArtStation Roadster models | Paid, some *editorial only* | Not purchased |
| Tesla press imagery / tesla.com | Not licensed for reuse | Viewed for design reference only; not used in the site |

All three CC BY candidates were published within days of the reveal and are fan-made approximations, not Tesla design data.

## Gallery images

`public/images/gallery/*.webp` are **our own renders** of the CC BY model above, produced by the internal studio
page (`/studio?shot=…`) and `scripts/capture.mjs`. No Tesla or press photography is used: those images are
copyrighted, and using them would also present the site as an official Tesla page. Licensed photos can be
dropped into the same folder later.

## Procedural fallback car

If no licensed model is installed, the site renders a Roadster-*inspired*
grand tourer generated entirely in code (`src/components/three/ProceduralRoadster.ts`).
It is original work for this project and is not a reproduction of Tesla's
design data.

## Lighting, environment, smoke, shadows

All generated at runtime — no HDRI or texture downloads:

- Studio environment: drei `<Environment>` + `<Lightformer>` softboxes (MIT, pmndrs).
- Smoke: custom domain-warped fBm shader (`AtmosphericSmoke.tsx`).
- Contact shadows: one-shot render-to-texture bake (`contactShadow.ts`), using
  three.js `HorizontalBlurShader` / `VerticalBlurShader` (MIT).

Poly Haven (CC0) HDRIs were evaluated; the procedural light rig was preferred
because it gives cleaner, controllable product-studio reflections with zero
download weight.

## Typefaces (Google Fonts, self-hosted at build time by `next/font`)

| Font | Designer | Licence |
|---|---|---|
| Michroma | Vernon Adams | SIL Open Font License 1.1 |
| Inter | Rasmus Andersson | SIL Open Font License 1.1 |
| JetBrains Mono | JetBrains | SIL Open Font License 1.1 |

Michroma is used as a wide, technical display face *in the spirit of*
automotive branding; it is not Tesla's proprietary typeface.

## Figures, stunts and facts

| Item | Source | How it is presented |
|---|---|---|
| 0–60 mph 0.81 s (demo), top speed 230+ mph, ~300 mi range, trims Performance (< 1.6 s), Thrust (< 0.9 s), Rocket (< 0.59 s), production 2028 | Tesla's 15 Oct 2026 reveal as reported by TechCrunch, Teslarati and Wikipedia | Labelled on-page as Tesla claims; the 0.81 s run was a driverless demo and not independently timed |
| Stunts: suction ramp climb to inverted + thruster flip and landing; thruster hop with barrel roll over Model 3, Model Y, Semi, Cybertruck, Cybercab | Same coverage (TechCrunch, Teslarati, Wikipedia; photos on teslarati.com viewed for reference) | Recreated as stylised animation; heights, distances and timings are artistic, not measured |
| Lineup vehicles | Built in code as simplified stand-ins | Not reproductions of Tesla's designs |
| Wheelbase 2,825 mm (111.2 in) | Wikipedia — “Tesla Roadster (second generation)” | Dimension label in the technical drawing |

## Libraries

Next.js, React, three.js, @react-three/fiber, @react-three/drei, GSAP (+
ScrollTrigger), Lenis, glTF-Transform, meshoptimizer, sharp — all under their
respective open-source licences (MIT / Apache-2.0 / GSAP standard “no charge”
licence).
