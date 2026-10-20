import { NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";

export const runtime = "nodejs";

/** Receipt lookup. Order ids are random UUIDs, so they act as the access key. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const order = await getRepo().getOrder(id);
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(order);
}
