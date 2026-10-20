"use client";

import dynamic from "next/dynamic";

const StudioRender = dynamic(() => import("@/components/commerce/StudioRender").then((m) => m.StudioRender), { ssr: false });

export default function StudioClient({ shot }: { shot: string }) {
  return <StudioRender shot={shot} />;
}
