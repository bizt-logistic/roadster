import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { isSignedIn } from "@/lib/auth";
import { payState } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Polled by the dashboard for live alerts: payment requests and payments to verify. */
export async function GET() {
  if (!(await isSignedIn())) return NextResponse.json({ error: "Signed out." }, { status: 401 });
  try {
    const s = await api.summary();
    const open = s.orders.filter((o) => !["cancelled", "paid", "invitation_requested"].includes(o.status));
    const requests = open
      .filter((o) => payState(o).requested)
      .sort((a, b) => b.request!.requestedAt.localeCompare(a.request!.requestedAt));
    const review = s.orders.filter((o) => o.schedule.some((x) => x.status === "submitted"));
    const latest = requests[0];
    return NextResponse.json({
      requests: requests.length,
      review: review.length,
      latest: latest ? { id: latest.id, number: latest.number, name: latest.customer.name, at: latest.request!.requestedAt } : null,
      latestSent: review[0] ? { id: review[0].id, number: review[0].number, name: review[0].customer.name } : null,
    });
  } catch {
    return NextResponse.json({ error: "Site unreachable." }, { status: 502 });
  }
}
