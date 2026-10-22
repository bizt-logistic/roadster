import { NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which payment methods an admin has enabled, and the demo conversion rates. */
export async function GET() {
  const repo = getRepo();
  const [wallets, banks, settings] = await Promise.all([repo.listWallets(), repo.listBanks(), repo.getSettings()]);
  const active = wallets.filter((w) => w.active);
  return NextResponse.json({
    methods: {
      btc: active.some((w) => w.network === "btc-testnet"),
      eth: active.some((w) => w.network === "eth-sepolia"),
      bank: banks.some((b) => b.active),
    },
    rates: { btcUsd: settings.btcUsd, ethUsd: settings.ethUsd },
  });
}
