# Roadster Admin

The back office for the Roadster fan-concept site, built as a **separate
Next.js app**. It has no database of its own: every read and write goes to the
public site's `/api/admin` endpoint with a shared bearer token.

> **Test networks.** Bitcoin testnet and Ethereum Sepolia addresses only (mainnet
> is rejected), watch-only (no private keys). Concept design & development by
> Philip Ojo Oladeji · Unofficial concept · Not affiliated with Tesla, Inc.

## Setup

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `ADMIN_PASSWORD` | Password for the admin login screen |
| `ADMIN_SESSION_SECRET` | Long random string used to sign the session cookie |
| `SITE_URL` | Where the public site runs, e.g. `http://localhost:3100` |
| `ADMIN_API_TOKEN` | Must equal `ADMIN_API_TOKEN` in the site's `.env.local` |

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3200 (the public site must be running at `SITE_URL`).

## Pages

- **Payment requests**: customers waiting for payment details. Pick the wallet or bank
  account, confirm the USD amount and choose an expiry; the customer sees it instantly.
  New requests chime, show a toast and badge the tab (desktop alerts optional).
- **Overview**: money received, revenue by stream (reservations, test drives, add-ons, discounts), payments waiting for review, upcoming drives.
- **Reservations**: filter and search orders; open one to confirm an installment
  (optionally with the tx hash), mark a submission "Not found", or cancel.
- **Test drives**: upcoming bookings by day; confirm payment, mark completed or
  no-show, reschedule or cancel (frees the slot). **Setup** edits experiences
  and upgrade prices, per-car test-drive prices, European cities (country, time
  zone, private meeting point), start times, cars per slot, booking window and closed days.
- **Pricing & offers**: vehicle reservation prices, checkout add-ons and promo
  codes. All prices are in US dollars.
- **Wallets & banks**: add or pause testnet receiving addresses and bank
  accounts (USD), and set the BTC/ETH rates.
- **Emails**: every meeting-point email sent to customers, with a preview. Confirming a
  test-drive payment sends one automatically.
- **Investor leads**: interest-only registrations (no funds, no securities offer).

## Production

```bash
npm run build
```

```bash
npm run start
```

Responses are sent with `X-Robots-Tag: noindex` and `X-Frame-Options: DENY`.
Serve it on a private host and use a strong password and token.
