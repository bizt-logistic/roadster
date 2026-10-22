import { NextResponse } from "next/server";
import { METHOD_LABEL, METHOD_NETWORK, type Method } from "@/lib/commerce/crypto";
import { getRepo, paymentState, recompute } from "@/lib/server/repo";
import { clientKey, rateLimited } from "@/lib/server/validate";

export const runtime = "nodejs";

/**
 * Customer asks for payment details for the next installment (first payment,
 * a later installment, or after the previous details expired). The admin is
 * notified in the admin app and issues an address or account with an expiry.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (rateLimited(`request:${clientKey(req)}`, 10)) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { method?: string };
  const repo = getRepo();
  const order = await repo.getOrder(id);
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (order.status === "cancelled" || order.status === "invitation_requested") {
    return NextResponse.json({ error: "This order can't take payments." }, { status: 409 });
  }
  const st = paymentState(order);
  if (!st.next || st.next.status !== "due") return NextResponse.json({ error: "Nothing is due right now." }, { status: 409 });
  if (st.live) return NextResponse.json({ error: "Your payment details are still valid." }, { status: 409 });
  if (st.requested) return NextResponse.json({ ok: true, already: true });

  let method = order.method === "none" ? "btc" : (order.method as Method);
  if (body.method === "btc" || body.method === "eth" || body.method === "bank") {
    const ok =
      body.method === "bank"
        ? (await repo.listBanks()).some((b) => b.active)
        : (await repo.listWallets()).some((w) => w.active && w.network === METHOD_NETWORK[body.method as "btc" | "eth"]);
    if (!ok) return NextResponse.json({ error: "That payment method isn't available right now." }, { status: 409 });
    method = body.method;
  }
  const now = new Date().toISOString();
  await repo.updateOrder(id, (o) => {
    o.request = { n: st.next!.n, method, requestedAt: now };
    o.method = method;
    o.window = null;
    recompute(o);
    o.events.push({
      at: now,
      type: "payment_requested",
      note: `${st.expired ? "New payment details" : "Payment details"} requested for ${o.schedule.length > 1 ? `installment ${st.next!.n}` : "the payment"} · ${METHOD_LABEL[method]}`,
      by: "customer",
    });
  });
  return NextResponse.json({ ok: true });
}
