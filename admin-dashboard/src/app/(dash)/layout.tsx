import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/auth";
import { api } from "@/lib/api";
import { isDrive, payState } from "@/lib/types";
import { logout } from "../actions";
import { AdminNav } from "./AdminNav";
import { Pulse } from "./Pulse";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: ReactNode }) {
  if (!(await isSignedIn())) redirect("/login");
  const counts: Record<string, number> = {};
  let storage = "unknown";
  try {
    const s = await api.summary();
    const toReview = (drive: boolean) =>
      s.orders.filter((o) => isDrive(o) === drive).reduce((n, o) => n + o.schedule.filter((x) => x.status === "submitted").length, 0);
    counts["/orders"] = toReview(false);
    counts["/test-drives"] = toReview(true);
    counts["/requests"] = s.orders.filter((o) => !["cancelled", "paid", "invitation_requested"].includes(o.status) && payState(o).requested).length;
    storage = s.storage === "supabase" ? "Supabase" : "local file";
  } catch {
    /* pages show the connection problem */
  }
  const site = process.env.SITE_URL ?? "";
  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <div className="adm-brand">ROADSTER</div>
        <p className="adm-muted adm-side__sub">Admin dashboard</p>
        <AdminNav counts={counts} />
        <div className="adm-side__foot">
          <span className="adm-pill adm-pill--muted">Test networks</span>
          <Pulse />
          <span className="adm-muted">Data: {storage}</span>
          <a className="adm-muted" href={site} target="_blank" rel="noreferrer">
            Open public site ↗
          </a>
          <form action={logout}>
            <button className="adm-btn adm-btn--ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="adm-main">
        {children}
        <footer className="adm-muted adm-small">Concept design &amp; development by Philip Ojo Oladeji · Unofficial concept · Not affiliated with Tesla, Inc.</footer>
      </main>
    </div>
  );
}
