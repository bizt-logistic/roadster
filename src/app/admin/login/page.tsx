import { redirect } from "next/navigation";
import { login } from "../actions";
import { adminConfigured, isAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="adm-login">
      <form action={login} className="adm-card adm-login__card">
        <div className="adm-brand">ROADSTER</div>
        <h1>Admin</h1>
        <p className="adm-muted">Concept demo · test networks only</p>
        {!adminConfigured() ? (
          <p className="adm-flash adm-flash--error">
            Set <code>ADMIN_PASSWORD</code> in <code>.env.local</code> and restart the server to enable the dashboard.
          </p>
        ) : (
          <>
            {error && <p className="adm-flash adm-flash--error">{error}</p>}
            <label className="adm-field">
              <span>Password</span>
              <input type="password" name="password" autoComplete="current-password" required autoFocus />
            </label>
            <button className="adm-btn adm-btn--primary" type="submit">
              Sign in
            </button>
          </>
        )}
      </form>
    </main>
  );
}
