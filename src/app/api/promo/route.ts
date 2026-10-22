import { NextResponse } from "next/server";
import { promoDiscount } from "@/lib/commerce/offers";
import { getRepo } from "@/lib/server/repo";
import { clientKey, rateLimited } from "@/lib/server/validate";

export const runtime = "nodejs";

/** Check a promo code for display. The order endpoint re-checks it when the order is placed. */
export async function POST(req: Request) {
  if (rateLimited(`promo:${clientKey(req)}`, 15)) return NextResponse.json({ ok: false, error: "Too many attempts." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { code?: unknown; kind?: unknown; subtotalCents?: unknown };
  const code = typeof b.code === "string" ? b.code.trim().toUpperCase().slice(0, 24) : "";
  const kind = b.kind === "test_drive" ? "test_drive" : "reservation";
  const subtotal = Math.max(0, Math.round(Number(b.subtotalCents) || 0));
  if (!code) return NextResponse.json({ ok: false, error: "Enter a code." });
  const catalog = await getRepo().getCatalog();
  const d = promoDiscount(catalog.promos.find((p) => p.code === code), kind, subtotal);
  return NextResponse.json(d.ok ? { ok: true, code, cents: d.cents, label: d.label } : { ok: false, error: d.error });
}
