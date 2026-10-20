import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { quote } from "@/lib/commerce/pricing";
import { METHOD_NETWORK, NETWORKS, cryptoAmount } from "@/lib/commerce/crypto";
import { getRepo, type Destination, type Order } from "@/lib/server/repo";
import { clientKey, rateLimited, validateOrder } from "@/lib/server/validate";

export const runtime = "nodejs";

/**
 * Create a reservation. Amounts are recomputed here (never trusted from the
 * browser), a receiving destination configured by an admin is assigned, and
 * the crypto rate is locked for the whole installment schedule.
 */
export async function POST(req: Request) {
  if (rateLimited(`order:${clientKey(req)}`)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const v = validateOrder(body);
  if (!v.ok) return NextResponse.json({ error: "Please check the highlighted fields.", fields: v.errors }, { status: 422 });
  const input = v.value;
  const repo = getRepo();
  const now = new Date().toISOString();
  const base = {
    id: randomUUID(),
    number: `RDS-${randomBytes(4).toString("hex").toUpperCase()}`,
    createdAt: now,
    trimId: input.trimId,
    colorId: input.colorId,
    customer: input.customer,
    testMode: true as const,
  };

  // Rocket is invitation-only: record the request, take no payment.
  if (input.trimId === "rocket") {
    const order: Order = {
      ...base, status: "invitation_requested", planId: "full", totalCents: 0, paidCents: 0, schedule: [],
      method: "none", destination: null, lockedRate: null,
      events: [{ at: now, type: "invitation_requested", note: "Rocket invitation requested", by: "customer" }],
    };
    await repo.createOrder(order);
    return NextResponse.json({ id: order.id, number: order.number, status: order.status });
  }

  const q = quote(input.trimId, input.planId);
  if (!q) return NextResponse.json({ error: "This version cannot be reserved online." }, { status: 400 });

  const [settings, orders] = await Promise.all([repo.getSettings(), repo.listOrders()]);
  // Pick the active destination with the fewest assigned orders (simple rotation).
  const load = (key: string) => orders.filter((o) => o.destination && ("walletId" in o.destination ? o.destination.walletId : o.destination.bankId) === key).length;
  let destination: Destination | null = null;
  let lockedRate: number;
  if (input.method === "bank") {
    const banks = (await repo.listBanks()).filter((b) => b.active).sort((a, b) => load(a.id) - load(b.id));
    if (!banks.length) return NextResponse.json({ error: "Bank transfer isn't available yet — the admin hasn't added an account." }, { status: 409 });
    const b = banks[0];
    destination = { kind: "bank", bankId: b.id, bankName: b.bankName, accountName: b.accountName, accountNumber: b.accountNumber, currency: b.currency };
    lockedRate = b.currency === "NGN" ? settings.ngnPerUsd : 1;
  } else {
    const network = METHOD_NETWORK[input.method as "btc" | "eth"];
    const wallets = (await repo.listWallets()).filter((w) => w.active && w.network === network).sort((a, b) => load(a.id) - load(b.id));
    if (!wallets.length) return NextResponse.json({ error: `${NETWORKS[network].label} isn't available yet — the admin hasn't added a receiving address.` }, { status: 409 });
    const w = wallets[0];
    destination = { kind: "wallet", walletId: w.id, network, address: w.address };
    lockedRate = network === "btc-testnet" ? settings.btcUsd : settings.ethUsd;
  }

  const net = destination.kind === "wallet" ? NETWORKS[destination.network] : null;
  const order: Order = {
    ...base,
    status: "awaiting_payment",
    planId: input.planId,
    totalCents: q.totalCents,
    paidCents: 0,
    schedule: q.schedule.map((s) => ({
      ...s,
      status: "due" as const,
      ...(net ? { cryptoAmount: cryptoAmount(s.amountCents, lockedRate, net.decimals) } : {}),
    })),
    method: input.method as Order["method"],
    destination,
    lockedRate,
    events: [
      {
        at: now,
        type: "created",
        note: net ? `Reservation created · pay in ${net.asset} on ${net.label} · rate locked at $${lockedRate.toLocaleString("en-US")}/${net.asset}` : "Reservation created · bank transfer",
        by: "customer",
      },
    ],
  };
  await repo.createOrder(order);
  return NextResponse.json({ id: order.id, number: order.number, status: order.status });
}
