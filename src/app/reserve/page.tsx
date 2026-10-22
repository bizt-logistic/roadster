import type { Metadata } from "next";
import { CommerceShell } from "@/components/commerce/CommerceShell";
import { ReserveFlow } from "@/components/commerce/ReserveFlow";
import { publicCatalog } from "@/lib/server/catalog";

export const metadata: Metadata = {
  title: "Reserve | Roadster Concept",
  description: "Concept reservation flow with installment plans. Test mode, no real payments. Not affiliated with Tesla.",
};

export const dynamic = "force-dynamic";

export default async function ReservePage() {
  const catalog = await publicCatalog();
  return (
    <CommerceShell active="reserve">
      <div className="shop__intro">
        <p className="mono eyebrow">Reserve · 2026 Roadster</p>
        <h1>Reserve your Roadster.</h1>
        <p>
          Pay the reservation in Bitcoin, Ethereum or by bank transfer, in full or in monthly installments. Production is planned for 2028; vehicle
          pricing has not been announced.
        </p>
      </div>
      <ReserveFlow catalog={catalog} />
    </CommerceShell>
  );
}
