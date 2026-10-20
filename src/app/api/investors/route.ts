import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getRepo } from "@/lib/server/repo";
import { clientKey, rateLimited, validateLead } from "@/lib/server/validate";

export const runtime = "nodejs";

/** Register investor / partner interest. No money is collected. */
export async function POST(req: Request) {
  if (rateLimited(`lead:${clientKey(req)}`, 8)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const v = validateLead(body);
  if (!v.ok) return NextResponse.json({ error: "Please check the highlighted fields.", fields: v.errors }, { status: 422 });
  const lead = { id: randomUUID(), createdAt: new Date().toISOString(), ...v.value };
  await getRepo().createLead(lead);
  return NextResponse.json({ id: lead.id });
}
