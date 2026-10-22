import { redirect } from "next/navigation";
import { login } from "../actions";
import { configured, isSignedIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isSignedIn()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="adm-login">
      <form action={login} className="adm-card adm-login__card">
        <div className="adm-brand">ROADSTER</div>
        <h1>Admin</h1>
        <p className="adm-muted">
          Payments run on test networks.
        </p>
        {!configured() ? (
          <p className="adm-flash adm-flash--error">
            Set <code>ADMIN_PASSWORD</code> in <code>.env.local</code> and restart to enable sign-in.
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
        <p className="adm-muted adm-small">Concept design &amp; development by Philip Ojo Oladeji · Unofficial concept · Not affiliated with Tesla, Inc.</p>
      </form>
    </main>
  );
}
