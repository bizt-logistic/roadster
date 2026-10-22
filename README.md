# ROADSTER — An Interactive Fan Concept

A scroll-driven WebGL experience in which a Tesla Roadster is **drawn live as an
engineer's technical sketch**, materialises into a **photoreal studio render**,
and is then choreographed through red performance reveals, camera studies, a
multi-viewport showcase, a vertical red wake, an oversized typographic reveal and
a smoke-filled finale.

> **Unofficial concept · Not affiliated with Tesla, Inc.**
> Concept design & development by Philip Ojo Oladeji. Tesla and Roadster are trademarks
> of Tesla, Inc. No Tesla logos, fonts, imagery or code are used.

## Run it locally

Requirements: Node.js 20+ (tested on Node 24).

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000 and scroll.

| Page | What it is |
|---|---|
| `/` | The cinematic scroll experience |
| `/gallery` | Studio renders of the car, scroll to browse |
| `/test-drive` | Book a private test drive in a European city: car, experience, city, date and time, extras, promo code. The meeting point is emailed once the payment is confirmed |
| `/reserve` | Choose a version, pay in full or in 3/6/12 installments with **Bitcoin, Ethereum or bank transfer** |
| `/reserve/confirmation/<id>` | The customer's receipt: QR code, address, amount, live status |
| `/invest` | Investor / partner interest form (no money collected) |

### Admin-controlled pricing and offers

Every amount a customer pays comes from a catalogue the admin edits (stored
with the orders; defaults in `src/lib/commerce/offers.ts`):

- **Vehicle reservation prices** per version (empty = invitation only), on/off sale.
- **Test drives**: experiences with price and duration, locations, start times,
  cars per slot, booking window and closed days. Slots fill up and close
  automatically; the admin can mark drives completed / no-show or reschedule.
- **Add-ons** at checkout (delivery priority, registration & plates, protection
  plan, PPF, drive video, chauffeured pickup…), each for reservations, test drives or both.
- **Promo codes**: percent or amount off, max uses, expiry.

All prices and payments are in **US dollars**. The server recomputes every
total; the browser never sets a price. Test drives are priced per car
(Performance from $1,500, Thrust $2,500, Rocket $5,000 by default) plus an
optional experience upgrade.

### Home page

After the cinematic scroll, three sections slide up over the final frame with
scroll animations (masked headlines, staggered reveals, image parallax, a
counting price and a city marquee): **Test drive** (from the cheapest live
price, cars, cities, how it works), **Reserve** (versions, prices, monthly
plans) and **Invest & partner**, each with a button to its page. Prices come
from the admin's catalogue.

### Test-drive emails

Customers choose a city; the exact meeting point stays private. When the admin
confirms the payment, the customer is emailed the meeting point, time (local to
the city), directions and a calendar invite. Rescheduling a paid drive sends an
update, and the admin can resend from the booking. Every email is kept in the
admin's **Emails** page. To deliver them for real, set `RESEND_API_KEY`,
`MAIL_FROM` and `PUBLIC_SITE_URL` in `.env.local` (https://resend.com);
without a key they're saved to the outbox only.

### Payment requests and expiring payment details

Customers never see a wallet or account until an admin issues one:

1. The customer books or reserves and chooses BTC, ETH or bank transfer. The
   order starts as a **payment request**.
2. The admin app alerts the team live (sound, toast, tab badge and optional
   desktop notification) and lists it under **Payment requests**.
3. The admin picks the receiving address or bank account, confirms or adjusts
   the amount (USD) and sets how long the details are valid (15 min to 48 h).
4. The customer's receipt shows the address, QR code and exact amount with a
   countdown. When it expires the details disappear and the customer can
   request new ones (with a fresh rate). Installment plans repeat this per installment.

### Payments (test networks)

Crypto is the primary method; bank transfer is optional. To keep it safe,
**only test networks are accepted** — Bitcoin testnet and Ethereum Sepolia.
Their coins have no monetary value, so every step can be demonstrated without
moving real money.

1. **Admin adds receiving addresses** (admin app → Wallets & banks): create an
   address in your own wallet app switched to Bitcoin testnet / Ethereum
   Sepolia, and paste it. The dashboard is **watch-only** — private keys never
   touch the server. Mainnet addresses are rejected. "Use sample testnet
   addresses" fills placeholders for a quick walkthrough.
2. **Admin adds bank accounts** (optional, USD) and sets the BTC/ETH rates.
3. **Customer reserves or books**: the server recomputes the price in USD and
   records a payment request with the customer's preferred method.
4. **Admin generates the payment** (see above) and the customer pays: the
   receipt shows a QR code (BIP-21 / EIP-681), the address and amount, a
   countdown, and an "I've sent the payment" button that accepts a transaction
   hash. The page updates itself every 12 seconds.
5. **Admin verifies** the transaction on the explorer link and clicks
   **Confirm received** (or **Not found**). Status, paid total and the audit
   timeline update; the customer's receipt reflects it live.

Going live is a deliberate change for a company deploying under **its own
brand**, with its own wallets and its own compliance — not under the Tesla name.

### Admin dashboard (separate app)

The admin is **its own site** in [`admin-dashboard/`](admin-dashboard/README.md),
with its own `package.json`, login and port. It stores nothing itself: it
talks to this site only through the token-protected `/api/admin` endpoint.
The public site has no `/admin` route.

1. In this site's `.env.local` set `ADMIN_API_TOKEN` (a long random string).
2. In `admin-dashboard/.env.local` (copy its `.env.example`) set the same
   `ADMIN_API_TOKEN`, plus `SITE_URL`, `ADMIN_PASSWORD` and
   `ADMIN_SESSION_SECRET`.
3. Run both:

```bash
npm run dev -- --port 3100
```

```bash
cd admin-dashboard && npm install && npm run dev
```

The admin opens on http://localhost:3200. Sections: Overview (revenue by stream, payments to
review, upcoming drives), Reservations, Test drives (bookings + setup),
Pricing & offers, Wallets & banks (testnet only), Investor leads. Everything
is marked **Test networks**.

### Connecting Supabase

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
3. Restart — storage switches from `.data/db.json` to Supabase automatically.

Production build:

```bash
npm run build
```

```bash
npm run start
```

### 3D model

`public/models/roadster.glb` is an optimised copy of the CC BY 4.0 model
“Tesla Roadster (2028).” by *morolucky* (see ASSET_SOURCES.md). If it is removed,
the site falls back to a procedural car. To rebuild it, sign in to Sketchfab,
download the GLB into `model-source/candidates/morolucky/`, then run:

```bash
npm run model:optimize -- --src=model-source/candidates/morolucky --inspect
```

Useful flags: `--front=+x|-x|+z|-z`, `--paint=MatA`, `--glass=MatB`,
`--wheels=NodeA,…`, `--ratio=0.5`, `--budget=110000`, `--texture=2048`.

## The sequence

| # | Scene | What happens | Driven by |
|---|---|---|---|
| 1 | White introduction | Minimal nav, editorial line, title block | autoplay on load |
| 2 | Live technical drawing | Ground line, axle centres, wheel circles and dimensions draw first; then silhouette → wheels → section cuts → body contours → details, each stroke traced like a pen with a red "nib" | autoplay (scroll can finish it) |
| 3 | Wireframe → photoreal | A red scanner plane sweeps nose-to-tail; materials resolve behind it via a clipping plane while lines dissolve; contact shadow fades in; camera dollies to a ¾ hero | scroll |
| 4 | Red performance band | A red line opens into a band, a giant ROADSTER rises *behind* the car, figures from the Oct 2026 reveal count up, and the car fires its thrusters into a full barrel roll above its shadow | scroll |
| 5 | Cinematic movement | Rear → profile → ¾ → spiral crane into plan view, with viewfinder and captions | scroll |
| 6 | Multiple perspectives | The hero view shrinks into a panel; two more cameras render the *same* car into scissored viewports that slide in | scroll |
| 7 | Vertical red transition | Plan view; the red panel is the car's wake — its edge tracks the projected tail every frame, then floods the screen | scroll |
| 8 | Typography reveal | The red screen *is* the inside of the T: the word zooms out ~140× until oversized red ROADSTER sits on white | scroll |
| 9 | Arena finale | Shader smoke clears to a recreation of the 15 Oct 2026 reveal stage: **Stunt 01** — suction climb of a curved ramp to inverted, thruster release, flip and landing; **Stunt 02** — thruster hop with a barrel roll over a five-vehicle lineup; cold-gas plumes and scroll-reversible smoke trails; final title and credits | scroll |

## Architecture

```
src/
  app/                      layout (fonts, metadata), page, globals.css
  lib/
    rig.ts                  single mutable animation state (no React state in the loop)
    store.ts                tiny pub-sub for loading/readiness
    lineart.mjs             mesh → technical drawing (shared by browser + Node)
    stunts.ts               stunt trajectories as pure functions of progress
  components/
    animation/
      AnimationTimeline.ts  scene map, nav, concept figures
      ScrollDirector.ts     Lenis + ONE GSAP ScrollTrigger master timeline
    experience/             scene markup (Intro, WireframeReveal, Performance,
                            VehicleShowcase, VerticalTransition, TypographyReveal,
                            AtmosphericFinale) + RoadsterExperience composition
    three/
      Stage.tsx             Canvas, adaptive DPR, fallbacks
      RoadsterModel.tsx     glTF or procedural car → shared rig (lines, sweep, shadow)
      ProceduralRoadster.ts lofted fallback car
      Materials.ts          studio paint / glass / trim materials
      lineShader.ts         pen-drawing shader + construction geometry
      contactShadow.ts      one-shot baked contact shadow
      VehicleLighting.tsx   Lightformer studio environment + rim light
      AtmosphericSmoke.tsx  fBm smoke shader (front cover + floor haze)
      StuntSet.tsx          reveal-stage arena, ramp, lineup, smoke trails
      CameraController.tsx  render loop, multi-viewport showcase, DOM sync
scripts/optimize-model.mjs  glTF-Transform pipeline + line-art bake
```

Key decisions:

- **One timeline, one owner per property.** Every animated value lives in
  `rig` or the DOM and is tweened by exactly one non-overlapping sequence in
  `ScrollDirector.ts`; a development guard warns on overlaps. Autoplay intro
  animations target *inner* elements, scroll animations the *outer* ones.
- **Same geometry for drawing and render.** Line art is extracted from the very
  meshes that are rendered (feature edges, side-view silhouette, planar section
  cuts), chained into polylines and given per-vertex "draw times". A depth-only
  pre-pass hides occluded strokes, so the sketch reads as a clean hidden-line drawing.
- **No per-frame React.** The render loop reads `rig`, positions labels and the
  red wake by projecting 3D anchors, and renders manually (including scissored
  multi-camera viewports).
- **Performance.** Baked environment and shadows, meshopt-compressed geometry,
  WebP textures, adaptive DPR via `PerformanceMonitor`, smoke quads skipped when
  invisible, reduced octaves on mobile.
- **Accessibility.** Semantic headings for every scene, `prefers-reduced-motion`
  (no smooth scrolling or autoplay; animations become direct scroll positions),
  native `<dialog>` for credits, keyboard-focusable nav, WebGL-less fallback.

## Promo video

To rebuild the TikTok clip: run the production site on port 3100, then

```bash
node scripts/film.mjs --gpu --url=http://localhost:3100 --out=video/frames
```

start the `video-workspace` server (`node video/tools/serve.mjs`), open
http://localhost:3300/compose.html and run `await prepare(); await render()`
in the console. The result lands in `video/out/roadster-tiktok.mp4`. The desk
and hand plate (`video/src/hand.mp4`) is AI-generated.

## Testing

Visual QA uses headless Edge/Chrome over the DevTools protocol (no extra
installs). With the dev server running:

```bash
node scripts/capture.mjs --url=http://localhost:3000 --w=1440 --h=900 --out=qa/desktop
```

```bash
node scripts/capture.mjs --url=http://localhost:3000 --mobile --w=390 --h=844 --out=qa/mobile
```

It jumps to timeline beats, saves screenshots to `qa/`, and lists console
warnings/errors. In development, `ScrollDirector` also warns if two tweens
ever animate the same property at the same time.

> **Windows note:** `npm run dev` / `build` use `--webpack` because some Windows
> machines (Smart App Control / Application Control) block Next's native
> Turbopack binary. On those machines `sharp` may also be blocked; the model
> script then skips texture re-encoding automatically.

## Assets & licences

See [ASSET_SOURCES.md](ASSET_SOURCES.md).
#   r o a d s t e r  
 