import { NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";
import { adminAuthorized } from "@/lib/server/validate";
import { isAdmin } from "@/lib/server/admin-auth";

export const runtime = "nodejs";

/**
 * JSON data feed (exports, integrations):
 *   GET /api/admin?resource=orders|investors|wallets|banks|settings
 * Auth: an admin dashboard session, or `Authorization: Bearer <ADMIN_API_TOKEN>`.
 */
export async function GET(req: Request) {
  if (!(await isAdmin()) && adminAuthorized(req) !== true) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const resource = new URL(req.url).searchParams.get("resource");
  const repo = getRepo();
  switch (resource) {
    case "orders":
      return NextResponse.json({ storage: repo.kind, orders: await repo.listOrders() });
    case "investors":
      return NextResponse.json({ storage: repo.kind, investors: await repo.listLeads() });
    case "wallets":
      return NextResponse.json({ wallets: await repo.listWallets() });
    case "banks":
      return NextResponse.json({ banks: await repo.listBanks() });
    case "settings":
      return NextResponse.json({ settings: await repo.getSettings() });
    default:
      return NextResponse.json({ error: "Use ?resource=orders|investors|wallets|banks|settings" }, { status: 400 });
  }
}
