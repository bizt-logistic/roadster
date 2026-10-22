import { NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";
import { adminAuthorized } from "@/lib/server/validate";
import { ADMIN_OPS } from "@/lib/server/admin-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin API for the separate admin app (admin-dashboard/).
// Auth: `Authorization: Bearer <ADMIN_API_TOKEN>` — the same token is set in
// both apps' environment. Disabled (503) until the token is configured.

function guard(req: Request) {
  const auth = adminAuthorized(req);
  if (auth === null) return NextResponse.json({ error: "Admin API disabled. Set ADMIN_API_TOKEN." }, { status: 503 });
  if (!auth) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return null;
}

/** GET /api/admin?resource=orders|order&id=…|investors|wallets|banks|settings|catalog|emails|summary */
export async function GET(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const repo = getRepo();
  switch (url.searchParams.get("resource")) {
    case "orders":
      return NextResponse.json({ orders: await repo.listOrders() });
    case "order": {
      const o = await repo.getOrder(url.searchParams.get("id") ?? "");
      return o ? NextResponse.json({ order: o }) : NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    case "investors":
      return NextResponse.json({ investors: await repo.listLeads() });
    case "wallets":
      return NextResponse.json({ wallets: await repo.listWallets() });
    case "banks":
      return NextResponse.json({ banks: await repo.listBanks() });
    case "settings":
      return NextResponse.json({ settings: await repo.getSettings() });
    case "emails":
      return NextResponse.json({ emails: await repo.listEmails() });
    case "catalog":
      return NextResponse.json({ catalog: await repo.getCatalog() });
    case "summary": {
      const [orders, leads, wallets, banks, settings, catalog] = await Promise.all([
        repo.listOrders(), repo.listLeads(), repo.listWallets(), repo.listBanks(), repo.getSettings(), repo.getCatalog(),
      ]);
      return NextResponse.json({ orders, leadsCount: leads.length, wallets, banks, settings, catalog, storage: repo.kind, testMode: true });
    }
    default:
      return NextResponse.json({ error: "Unknown resource." }, { status: 400 });
  }
}

/** POST /api/admin  { action: "<op>", ...payload } */
export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const op = body && typeof body.action === "string" ? ADMIN_OPS[body.action] : undefined;
  if (!op) return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  const result = await op(body!);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
