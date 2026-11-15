import { renderToStaticMarkup } from "react-dom/server";
import type { SmartEmail } from "./smart-email";

const theme = { navy: "#002E6E", sky: "#00BAF2", canvas: "#f5f9fc", ink: "#18304c", muted: "#66768b", border: "#e1eaf1" };
export function renderUpdateEmail(title: string, name: string, details: [string, string][]) {
  return "<!doctype html>" + renderToStaticMarkup(
    <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body style={{ margin: 0, backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: theme.ink }}>
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0"><tbody><tr><td style={{ padding: "32px 16px" }}>
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ maxWidth: 560, margin: "0 auto" }}><tbody>
            <tr><td style={{ padding: "8px 0 24px", fontSize: 30, fontWeight: 700, color: theme.navy }}>pay<span style={{ color: theme.sky }}>IQ</span><sup style={{ fontSize: 10 }}>™</sup></td></tr>
            <tr><td style={{ borderTop: `3px solid ${theme.sky}`, padding: "28px 24px", backgroundColor: theme.canvas, borderRadius: 8 }}>
              <h1 style={{ margin: "0 0 16px", fontSize: 24, color: theme.navy }}>{title}</h1>
              <p style={{ margin: "0 0 24px", fontSize: 15 }}>Hi {name || "there"}, here is your account update.</p>
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0"><tbody>{details.map(([label, value]) => <tr key={label}>
                <td style={{ padding: "12px 0", borderBottom: `1px solid ${theme.border}`, color: theme.muted, fontSize: 13, verticalAlign: "top", width: "38%" }}>{label}</td>
                <td style={{ padding: "12px 0 12px 12px", borderBottom: `1px solid ${theme.border}`, fontSize: 14, overflowWrap: "anywhere" }}>{value}</td>
              </tr>)}</tbody></table>
            </td></tr>
            <tr><td style={{ padding: "20px 0", fontSize: 12, color: theme.muted }}>payIQ · Account activity update<br />A saved draft is not a completed payment.</td></tr>
          </tbody></table>
        </td></tr></tbody></table>
      </body>
    </html>,
  );
}

const mailTheme = { background: "#F8FAFC", ink: "#0F172A", blue: "#0284C7", details: "#F1F5F9", card: "#FFFFFF", muted: "#475569", border: "#E2E8F0" };
export function renderSmartTransferEmail(email: SmartEmail, appUrl: string) {
  return "<!doctype html>" + renderToStaticMarkup(
    <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>{`@media only screen and (max-width:480px){.mail-outer{padding:20px 12px!important}.mail-card{padding:24px 18px!important}.mail-title{font-size:23px!important}.mail-amount{font-size:30px!important}}`}</style>
    </head><body style={{ margin: 0, backgroundColor: mailTheme.background, color: mailTheme.ink, fontFamily: "Arial, Helvetica, sans-serif", lineHeight: 1.5 }}>
      <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ backgroundColor: mailTheme.background }}><tbody><tr><td className="mail-outer" style={{ padding: "36px 16px" }}>
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ maxWidth: 600, margin: "0 auto", backgroundColor: mailTheme.card, border: `1px solid ${mailTheme.border}`, borderRadius: 8 }}><tbody><tr><td className="mail-card" style={{ padding: 36 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: mailTheme.ink, marginBottom: 24 }}>pay<span style={{ color: mailTheme.blue }}>IQ<sup style={{ fontSize: 12, verticalAlign: "super" }}>™</sup></span></div>
          <span style={{ display: "inline-block", backgroundColor: mailTheme.details, color: mailTheme.blue, borderRadius: 4, padding: "5px 10px", fontSize: 12, fontWeight: 700 }}>{email.badge}</span>
          <h1 className="mail-title" style={{ margin: "16px 0 12px", fontSize: 26, lineHeight: 1.3, overflowWrap: "anywhere" }}>{email.transferName}</h1>
          <p style={{ margin: "0 0 12px", color: mailTheme.muted, fontSize: 14, overflowWrap: "anywhere" }}><strong style={{ color: mailTheme.ink }}>From:</strong> {email.senderName} ({email.senderEmail})</p>
          <p style={{ margin: "0 0 24px", fontSize: 15 }}>{email.summary}</p>
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ backgroundColor: mailTheme.details, borderRadius: 8 }}><tbody><tr><td style={{ padding: 20 }}>
            <p style={{ margin: 0, color: mailTheme.muted, fontSize: 12 }}>Smart Transfer Name</p>
            <p style={{ margin: "4px 0 16px", fontSize: 15, fontWeight: 700, overflowWrap: "anywhere" }}>{email.transferName}</p>
            <p style={{ margin: 0, color: mailTheme.muted, fontSize: 12 }}>Amount</p>
            <p className="mail-amount" style={{ margin: "4px 0", color: mailTheme.ink, fontSize: 34, fontWeight: 700, lineHeight: 1.25, overflowWrap: "anywhere" }}>{email.amount}</p>
            {email.cap && <p style={{ margin: "6px 0 0", color: mailTheme.muted, fontSize: 13 }}>Cap: {email.cap}</p>}
            <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ marginTop: 20 }}><tbody>{[
              ["Direction", email.direction], ["Due Date / Schedule", email.schedule],
              ["Policy & Retry Rule", `${email.policy} (Up to ${email.retries} automatic retries)`], ["Current status", ({ AWAITING_USER_AUTH: "Awaiting approval", SUCCESS: "Completed", COMPLETED: "Completed", FAILED: "Failed", DRAFT: "Draft · no money moved", CANCELLED: "Declined / cancelled", ACTIVE: "Active" } as Record<string, string>)[email.status] || email.status],
            ].map(([label, value]) => <tr key={label}><td style={{ padding: "8px 0", fontSize: 13, borderTop: `1px solid ${mailTheme.border}`, verticalAlign: "top" }}>
              <span style={{ display: "block", color: mailTheme.muted, fontSize: 12 }}>{label}</span>
              <span style={{ display: "block", marginTop: 3, fontWeight: 600, overflowWrap: "anywhere" }}>{value}</span>
            </td></tr>)}</tbody></table>
          </td></tr></tbody></table>
          <table role="presentation" cellPadding="0" cellSpacing="0" style={{ marginTop: 24 }}><tbody><tr><td style={{ borderRadius: 6, backgroundColor: mailTheme.blue }}><a href={appUrl} style={{ display: "inline-block", padding: "13px 24px", color: mailTheme.card, fontSize: 15, fontWeight: 700, textDecoration: "none" }}>Open in payIQ™</a></td></tr></tbody></table>
          <p style={{ margin: "16px 0 0", color: mailTheme.muted, fontSize: 12 }}>Simulated funds · real payments disconnected. A draft or reminder is not a completed payment.</p>
          <p style={{ margin: "24px 0 0", paddingTop: 20, borderTop: `1px solid ${mailTheme.border}`, color: mailTheme.muted, fontSize: 12, overflowWrap: "anywhere" }}>Sent via payIQ™ Autonomous Financial Operations • Reply directly to this email to contact {email.senderName}.</p>
        </td></tr></tbody></table>
      </td></tr></tbody></table>
    </body></html>,
  );
}