import RoadsterExperience from "@/components/experience/RoadsterExperience";
import { HomeSections } from "@/components/home/HomeSections";
import { publicCatalog } from "@/lib/server/catalog";
import "./home.css";

// Prices on the home sections come from the admin's live catalogue.
export const dynamic = "force-dynamic";

export default async function Home() {
  const catalog = await publicCatalog();
  return (
    <>
      <RoadsterExperience />
      <HomeSections catalog={catalog} />
    </>
  );
}
