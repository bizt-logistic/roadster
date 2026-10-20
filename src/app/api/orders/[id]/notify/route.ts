import { NextResponse } from "next/server";
import { isTxHash } from "@/lib/commerce/crypto";
import { getRepo } from "@/lib/server/repo";
import { clientKey, rateLimited } from "@/lib/server/validate";

export const runtime = "nodejs";

/**
 * Customer says "I've sent the payment" for the next due installment,
 * optionally with a transaction hash. An admin then verifies and confirms.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (rateLimited(`notify:${clientKey(req)}`, 10)) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { txHash?: string; reference?: string };
  const repo = getRepo();
  const current = await repo.getOrder(id);
  if (!current) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const next = current.schedule.find((s) => s.status === "due");
  if (!next) return NextResponse.json({ error: "Nothing is due on this reservation." }, { status: 409 });

  const tx = (body.txHash ?? "").trim();
  const ref = (body.reference ?? "").trim().slice(0, 80);
  if (current.destination?.kind === "wallet" && tx && !isTxHash(current.destination.network, tx)) {
    return NextResponse.json({ error: "That doesn't look like a transaction hash for this network." }, { status: 422 });
  }

  const updated = await repo.updateOrder(id, (o) => {
    const inst = o.schedule.find((s) => s.n === next.n)!;
    inst.status = "submitted";
    inst.submittedAt = new Date().toISOString();
    if (tx) inst.txHash = tx;
    o.events.push({
      at: inst.submittedAt,
      type: "payment_submitted",
      note: `Installment ${inst.n} marked as sent${tx ? ` · tx ${tx.slice(0, 12)}…` : ""}${ref ? ` · ref ${ref}` : ""}`,
      by: "customer",
    });
  });
  return NextResponse.json({ ok: true, status: updated?.status });
}
