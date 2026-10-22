import type { Metadata } from "next";
import { CommerceShell } from "@/components/commerce/CommerceShell";
import { TestDriveFlow } from "@/components/commerce/TestDriveFlow";
import { driveDates, driveFrom } from "@/lib/commerce/offers";
import { formatMoney } from "@/lib/commerce/pricing";
import { publicCatalog } from "@/lib/server/catalog";
import { getRepo } from "@/lib/server/repo";
import { slotLoad } from "@/lib/server/slots";

export const metadata: Metadata = {
  title: "Book a test drive | Roadster Concept",
  description: "Book a private Roadster test drive in a European city. Test mode, no real payments. Not affiliated with Tesla.",
};
export const dynamic = "force-dynamic";

export default async function TestDrivePage() {
  const [catalog, orders] = await Promise.all([publicCatalog(), getRepo().listOrders()]);
  const dates = driveDates(catalog.testDrive);
  const taken = Object.fromEntries(slotLoad(orders));
  return (
    <CommerceShell active="drive">
      <div className="shop__intro">
        <p className="mono eyebrow">Test drive · Europe · from {formatMoney(driveFrom(catalog.testDrive))}</p>
        <h1>Feel it before you reserve.</h1>
        <p>
          Choose your Roadster, an experience, your city and a time. Pay in Bitcoin, Ethereum or by bank transfer in US
          dollars. Once your payment is confirmed we email you the exact meeting point.
        </p>
      </div>
      <TestDriveFlow catalog={catalog} dates={dates} taken={taken} />
    </CommerceShell>
  );
}
