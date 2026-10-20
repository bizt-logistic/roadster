import type { Metadata } from "next";
import { CommerceShell } from "@/components/commerce/CommerceShell";
import { InvestForm } from "@/components/commerce/InvestForm";

export const metadata: Metadata = {
  title: "Invest & partner",
  description: "Register interest in partnerships, distribution or investment ",
};

const PILLARS = [
  { k: "01", t: "Distribution", d: "Dealer and import partners for West Africa and beyond." },
  { k: "02", t: "Fleet & corporate", d: "Executive fleets, hospitality and events." },
  { k: "03", t: "Strategic investment", d: "Conversations with qualified investors — interest only, no funds collected here." },
];

export default function InvestPage() {
  return (
    <CommerceShell active="invest">
      <div className="invest-page">
        <div className="shop__intro">
          <p className="mono eyebrow">Invest &amp; partner</p>
          <h1>Back the next line.</h1>
          <p>
            Interested in distribution, fleet orders or investment? Register your interest and the team follows up.
          </p>
          <ol className="pillars">
            {PILLARS.map((p) => (
              <li key={p.k}>
                <span className="mono">{p.k}</span>
                <strong>{p.t}</strong>
                <em>{p.d}</em>
              </li>
            ))}
          </ol>
        </div>
        <InvestForm />
      </div>
    </CommerceShell>
  );
}
