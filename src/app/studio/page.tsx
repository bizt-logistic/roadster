import type { Metadata } from "next";
import StudioClient from "./StudioClient";

// Internal render studio used to produce the gallery stills
// (node scripts/capture.mjs --plain --url=…/studio?shot=hero). Not linked.
export const metadata: Metadata = { title: "Studio", robots: { index: false, follow: false } };

export default async function Studio({ searchParams }: { searchParams: Promise<{ shot?: string }> }) {
  const { shot = "hero" } = await searchParams;
  return <StudioClient shot={shot} />;
}
