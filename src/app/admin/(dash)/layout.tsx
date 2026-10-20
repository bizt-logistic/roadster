import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/server/admin-auth";
import { getRepo } from "@/lib/server/repo";
import { logout } from "../actions";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const repo = getRepo();
  const orders = await repo.listOrders();
  const review = orders.reduce((n, o) => n + o.schedule.filter((s) => s.status === "submitted").length, 0);
  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <div className="adm-brand">ROADSTER</div>
        <p className="adm-muted adm-side__sub">Admin · concept demo</p>
        <AdminNav review={review} />
        <div className="adm-side__foot">
          <span className="adm-pill adm-pill--warn">Testnet mode</span>
          <span className="adm-muted">Storage: {repo.kind === "supabase" ? "Supabase" : "local file"}</span>
          <form action={logout}>
            <button className="adm-btn adm-btn--ghost" type="submit">
              Sign out
            </button>
          </form>
          <a className="adm-muted" href="/" target="_blank" rel="noreferrer">
            Open public site ↗
          </a>
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
