import { api, ApiError } from "@/lib/api";
import { when, type InvestorLead } from "@/lib/types";
import { ApiProblem } from "../../ui";

export default async function Investors() {
  let leads: InvestorLead[];
  try {
    leads = await api.investors();
  } catch (e) {
    return <ApiProblem message={e instanceof ApiError ? e.message : "Unknown error."} />;
  }
  return (
    <>
      <header className="adm-head">
        <h1>Investor &amp; partner leads</h1>
        <p className="adm-muted">{leads.length} registered. Interest only: the site collects no funds and makes no securities offer.</p>
      </header>
      <div className="adm-card adm-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Organization</th>
              <th>Type</th>
              <th>Interest</th>
              <th>Size</th>
              <th>Country</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td className="adm-muted">{when(l.createdAt)}</td>
                <td>
                  {l.name}
                  <div className="adm-muted">
                    <a href={`mailto:${l.email}`}>{l.email}</a>
                    {l.phone && ` · ${l.phone}`}
                  </div>
                </td>
                <td>{l.organization}</td>
                <td>{l.investorType}</td>
                <td>{l.interest}</td>
                <td>{l.ticket}</td>
                <td>{l.country}</td>
                <td className="adm-wrap">{l.message}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={8} className="adm-muted">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
