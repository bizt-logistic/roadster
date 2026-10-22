// Server-side module: the catalogue as public pages see it (no promo codes).
import type { PublicCatalog } from "@/lib/commerce/offers";
import { getRepo } from "@/lib/server/repo";

export async function publicCatalog(): Promise<PublicCatalog> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { promos, ...rest } = await getRepo().getCatalog();
  return rest;
}
