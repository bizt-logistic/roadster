import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { quote } from "@/lib/commerce/pricing";
import { applies, driveDates, drivePrice, promoDiscount, slotKey } from "@/lib/commerce/offers";
import { slotLoad } from "@/lib/server/slots";
import { emailMeetingPoint } from "@/lib/server/admin-ops";
import { METHOD_LABEL, METHOD_NETWORK, NETWORKS } from "@/lib/commerce/crypto";
import { getRepo, type Booking, type Order, type OrderItem } from "@/lib/server/repo";
import { clientKey, rateLimited, validateOrder } from "@/lib/server/validate";

export const runtime = "nodejs";

const bad = (error: string, fields?: Record<string, string>, status = 422) => NextResponse.json({ error, fields }, { status });

/**
 * Create a reservation or a paid test-drive booking. Every amount comes from
 * the admin-managed catalogue (never from the browser). The order starts as a
 * payment request: the admin is notified and issues the payment details
 * (receiving address or account, locked rate, expiry) from the admin app.
 */
export async function POST(req: Request) {
  if (rateLimited(`order:${clientKey(req)}`)) return bad("Too many attempts. Please wait a minute.", undefined, 429);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request.", undefined, 400);
  }
  const v = validateOrder(body);
  if (!v.ok) return bad("Please check the highlighted fields.", v.errors);
  const input = v.value;
  const repo = getRepo();
  const [catalog, orders] = await Promise.all([repo.getCatalog(), repo.listOrders()]);
  const now = new Date().toISOString();
  const isDrive = input.kind === "test_drive";
  const base = {
    id: randomUUID(),
    kind: input.kind,
    number: `${isDrive ? "TD" : "RDS"}-${randomBytes(4).toString("hex").toUpperCase()}`,
    createdAt: now,
    trimId: input.trimId,
    colorId: input.colorId,
    customer: input.customer,
    testMode: true as const,
  };

  // ── what is being bought ────────────────────────────────────────────────
  let baseCents: number;
  let baseItem: OrderItem;
  let booking: Booking | undefined;
  if (isDrive) {
    const cfg = catalog.testDrive;
    if (!cfg.enabled) return bad("Test drives aren't open for booking right now.", undefined, 409);
    if (!cfg.cars.includes(input.trimId)) return bad("That car isn't available for test drives.", { trimId: "Choose another car." });
    const pkg = cfg.packages.find((p) => p.id === input.drive!.packageId && p.active);
    const loc = cfg.locations.find((l) => l.id === input.drive!.locationId && l.active);
    if (!pkg) return bad("That experience isn't available.", { packageId: "Choose an experience." });
    if (!loc) return bad("That location isn't available.", { locationId: "Choose a location." });
    const { date, time } = input.drive!;
    if (!driveDates(cfg).includes(date)) return bad("That date can't be booked.", { date: "Choose another date." });
    if (!cfg.slots.includes(time)) return bad("That time can't be booked.", { time: "Choose another time." });
    if ((slotLoad(orders).get(slotKey(date, time, loc.id)) ?? 0) >= cfg.capacityPerSlot) {
      return bad("Sorry, that slot was just taken. Please pick another time.", { time: "Fully booked." }, 409);
    }
    baseCents = drivePrice(cfg, input.trimId, pkg);
    baseItem = { id: `pkg:${pkg.id}`, name: `${pkg.name} · ${pkg.durationMin} min`, priceCents: baseCents };
    booking = {
      packageId: pkg.id, packageName: pkg.name, durationMin: pkg.durationMin, date, time,
      locationId: loc.id, locationName: loc.name, locationAddress: loc.address, country: loc.country, timeZone: loc.timeZone,
      creditable: pkg.creditable, status: "scheduled",
    };
  } else {
    const trim = catalog.trims.find((t) => t.id === input.trimId);
    if (!trim || !trim.available) return bad("That version isn't available right now.", { trimId: "Choose another version." });
    // Invitation-only versions (no reservation price): record the request, take no payment.
    if (trim.reservationCents == null) {
      const order: Order = {
        ...base, status: "invitation_requested", planId: "full", totalCents: 0, paidCents: 0, schedule: [],
        method: "none", destination: null, lockedRate: null,
        events: [{ at: now, type: "invitation_requested", note: "Invitation requested", by: "customer" }],
      };
      await repo.createOrder(order);
      return NextResponse.json({ id: order.id, number: order.number, status: order.status });
    }
    if (input.method === "none") return bad("Choose a payment method.", { method: "Choose a payment method." });
    baseCents = trim.reservationCents;
    baseItem = { id: `trim:${trim.id}`, name: "Reservation", priceCents: trim.reservationCents };
  }

  const extras: OrderItem[] = catalog.addons
    .filter((a) => a.active && applies(a.appliesTo, input.kind) && input.addonIds.includes(a.id))
    .map((a) => ({ id: a.id, name: a.name, priceCents: a.priceCents }));
  const subtotalCents = baseCents + extras.reduce((s, a) => s + a.priceCents, 0);

  let discount: Order["discount"] = null;
  if (input.promoCode) {
    const promo = catalog.promos.find((p) => p.code === input.promoCode);
    const d = promoDiscount(promo, input.kind, subtotalCents);
    if (!d.ok) return bad(d.error, { promoCode: d.error });
    discount = { code: input.promoCode, cents: d.cents };
  }
  const totalCents = subtotalCents - (discount?.cents ?? 0);
  const q = quote(totalCents, input.planId);
  if (!q) return bad("Couldn't price this order.", undefined, 400);

  // The chosen method must be one the admin has set up; the admin picks the
  // exact address or account when issuing the payment details.
  if (input.method === "bank") {
    if (!(await repo.listBanks()).some((b) => b.active)) return bad("Bank transfer isn't available yet. Please choose crypto.", undefined, 409);
  } else {
    const network = METHOD_NETWORK[input.method as "btc" | "eth"];
    if (!(await repo.listWallets()).some((w) => w.active && w.network === network)) {
      return bad(`${NETWORKS[network].label} isn't available yet. Please choose another method.`, undefined, 409);
    }
  }

  const method = input.method as "btc" | "eth" | "bank";
  const what = isDrive ? `Test drive booked · ${booking!.packageName} on ${booking!.date} at ${booking!.time}` : "Reservation created";
  const free = totalCents === 0;
  const order: Order = {
    ...base,
    status: free ? "paid" : "payment_requested",
    planId: input.planId,
    subtotalCents,
    items: [baseItem, ...extras],
    discount,
    ...(booking ? { booking } : {}),
    totalCents,
    paidCents: 0,
    schedule: free ? [] : q.schedule.map((s) => ({ ...s, status: "due" as const })),
    method,
    destination: null,
    lockedRate: null,
    request: free ? null : { n: 1, method, requestedAt: now },
    window: null,
    events: [
      { at: now, type: "created", note: `${what} · payment requested by ${METHOD_LABEL[method]}`, by: "customer" },
      ...(discount ? [{ at: now, type: "promo", note: `Promo ${discount.code} applied`, by: "system" as const }] : []),
    ],
  };
  await repo.createOrder(order);
  if (discount) {
    const c = await repo.getCatalog();
    const p = c.promos.find((x) => x.code === discount.code);
    if (p) {
      p.used += 1;
      await repo.saveCatalog(c);
    }
  }
  if (free && isDrive) await emailMeetingPoint(order.id);
  return NextResponse.json({ id: order.id, number: order.number, status: order.status });
}
