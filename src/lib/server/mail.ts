// Server-side module: outgoing email.
//   • RESEND_API_KEY + MAIL_FROM set → delivered through Resend's HTTP API
//   • otherwise → kept in the outbox only (visible in the admin's Emails page)
// Every message is recorded either way, so the admin can see what went out.
import { randomUUID } from "node:crypto";
import { TRIMS } from "@/lib/commerce/catalog";
import { cityTime, formatDriveDate } from "@/lib/commerce/offers";
import { getRepo, type EmailRecord, type Order } from "@/lib/server/repo";

type Attachment = { filename: string; content: string };

export async function sendMail(m: {
  to: string;
  subject: string;
  text: string;
  html: string;
  kind: EmailRecord["kind"];
  orderId?: string;
  attachments?: Attachment[];
}): Promise<EmailRecord> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  let status: EmailRecord["status"] = "logged";
  let error: string | undefined;
  if (key && from) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, html: m.html, attachments: m.attachments }),
      });
      status = r.ok ? "sent" : "failed";
      if (!r.ok) error = `${r.status} ${(await r.text()).slice(0, 200)}`;
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : "Network error";
    }
  }
  const rec: EmailRecord = {
    id: randomUUID(), createdAt: new Date().toISOString(), to: m.to, subject: m.subject, text: m.text, html: m.html,
    kind: m.kind, orderId: m.orderId, status, provider: key && from ? "resend" : "none", ...(error ? { error } : {}),
  };
  await getRepo().saveEmail(rec);
  return rec;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** iCalendar invite for a booked drive, in the city's own time zone. */
export function driveIcs(o: Order) {
  const b = o.booking!;
  const start = cityTime(b.date, b.time, b.timeZone ?? "Europe/Paris");
  const end = new Date(start.getTime() + b.durationMin * 60_000);
  const z = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Roadster concept//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${o.id}@roadster`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(start)}`, `DTEND:${z(end)}`,
    `SUMMARY:Roadster ${b.packageName} (${o.number})`, `LOCATION:${b.locationAddress.replace(/,/g, "\\,")}`,
    "DESCRIPTION:Bring your driving licence and a photo ID. Payments run on test networks.", "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

/** "Where to meet" email for a paid test drive. */
export async function sendMeetingEmail(o: Order, update = false) {
  const b = o.booking!;
  const first = o.customer.name.split(/\s+/)[0];
  const car = `Roadster ${TRIMS.find((t) => t.id === o.trimId)?.name ?? o.trimId}`;
  const when = `${formatDriveDate(b.date)} at ${b.time} (local time, ${b.locationName})`;
  const site = (process.env.PUBLIC_SITE_URL ?? "http://localhost:3100").replace(/\/$/, "");
  const receipt = `${site}/reserve/confirmation/${o.id}`;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.locationAddress)}`;
  const subject = update
    ? `Updated: your Roadster test drive in ${b.locationName}`
    : `Your Roadster test drive in ${b.locationName}: where to meet`;
  const rows: [string, string][] = [
    ["When", when],
    ["Experience", `${b.packageName} · ${b.durationMin} min`],
    ["Car", car],
    ["Meeting point", b.locationAddress],
    ["Booking", o.number],
  ];
  const text = [
    `Hi ${first},`,
    "",
    update ? "Your test drive has been updated. Here are the new details." : "Your payment is confirmed and your test drive is booked. Here's where to meet us.",
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "Please arrive 10 minutes early and bring your driving licence and a photo ID.",
    `Directions: ${maps}`,
    `Your receipt: ${receipt}`,
    "",
    "Need to change something? Just reply to this email.",
    "",
    "Roadster · unofficial concept, not affiliated with Tesla, Inc.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:Helvetica,Arial,sans-serif;color:#0d0d0d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d9dbdd">
<tr><td style="background:#0b0b0c;color:#f2f2f2;padding:22px 28px;font-size:13px;letter-spacing:6px">ROADSTER</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;color:#e31937;text-transform:uppercase">Test drive · ${esc(b.locationName)}</p>
<h1 style="margin:0 0 14px;font-size:24px;font-weight:600">${update ? "Your test drive was updated" : "See you on the road"}, ${esc(first)}.</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#5b6066">${update ? "Here are your new details." : "Your payment is confirmed. Here's everything you need for your drive."}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #d9dbdd">
${rows.map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #d9dbdd;color:#5b6066;width:130px;vertical-align:top">${k}</td><td style="padding:10px 0;border-bottom:1px solid #d9dbdd;font-weight:${k === "Meeting point" ? 600 : 400}">${esc(v)}</td></tr>`).join("")}
</table>
<p style="margin:20px 0;font-size:14px;line-height:1.5">Please arrive 10 minutes early and bring your <strong>driving licence</strong> and a <strong>photo ID</strong>. A calendar invite is attached.</p>
<p style="margin:0 0 8px"><a href="${maps}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;padding:12px 18px;font-size:14px;font-weight:600">Get directions</a>
&nbsp;<a href="${receipt}" style="display:inline-block;color:#0d0d0d;padding:12px 6px;font-size:14px">View your receipt</a></p>
<p style="margin:18px 0 0;font-size:13px;color:#5b6066">Need to change something? Just reply to this email.</p>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #d9dbdd;font-size:11px;color:#5b6066">Roadster · unofficial concept, not affiliated with Tesla, Inc.</td></tr>
</table></td></tr></table></body></html>`;
  return sendMail({
    to: o.customer.email,
    subject,
    text,
    html,
    kind: update ? "meeting_point_update" : "meeting_point",
    orderId: o.id,
    attachments: [{ filename: `roadster-${o.number}.ics`, content: Buffer.from(driveIcs(o)).toString("base64") }],
  });
}
