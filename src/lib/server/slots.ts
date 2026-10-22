// Server-side module: test-drive slot occupancy.
import { slotKey } from "@/lib/commerce/offers";
import type { Order } from "@/lib/server/repo";

/** Bookings that still hold a test-drive slot, keyed by date|time|location. */
export function slotLoad(orders: Order[], exceptId?: string) {
  const load = new Map<string, number>();
  for (const o of orders) {
    if (o.kind !== "test_drive" || !o.booking || o.status === "cancelled" || o.id === exceptId) continue;
    const k = slotKey(o.booking.date, o.booking.time, o.booking.locationId);
    load.set(k, (load.get(k) ?? 0) + 1);
  }
  return load;
}
