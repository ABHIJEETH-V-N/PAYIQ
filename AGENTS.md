<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Teams use isolated owner-scoped records and gated server dispatch; external connections and money actions fail closed until their vault, endpoint verification and accounting support are verified.
- Teammate mutations go through atomic owner-checked SQL helpers; audit history is append-only and configuration changes invalidate evaluations to prevent stale activation.
- All Smart Transfer email paths pass an authoritative sync ID to the shared sender so identity, policy, schedule and presentation are consistent without changing delivery authorization.
- Account screens use authenticated TanStack server functions and user-owned Supabase records; real payment execution stays disconnected until a verified payment integration is added.
- Private pages live under the client-only _authenticated layout and share the account query; RLS and server middleware enforce ownership independently of the page gate.
- Documents use private Supabase Storage with user-prefixed paths; upload does not imply AI indexing.
- All app pages wrap content in AppShell (sidebar on desktop, bottom tabs on mobile/tablet) so navigation stays consistent.
- Natural-language requests use authenticated server functions with schema-validated, allowlisted actions; model output never executes payments or mutates records without explicit review.
- Groq always generates chat replies; if Sarvam interpretation is unavailable or invalid, pass user-owned context to Groq in reply-only mode with no proposed app action, so provider failures do not authorize mutations.
- Speech recordings are transient multipart uploads through authenticated server functions, with a 30-second capture limit matching the provider REST limit; transcripts are reviewed before sending.
- Resend sends event updates server-side through the connector gateway using its test sender; sync updates target the stored recipient email or owner fallback, and sender email is reply-to only, with provider rejection preserved.
- External account-event callbacks verify a shared secret and re-read authoritative owner rows before sending; event keys and Resend idempotency prevent duplicate sends while payments remain disconnected.
- Simulated wallets are separate from real funds; private SQL functions lock both wallets, enforce payer identity and caps, and insert paired simulated ledger rows atomically to prevent double spending.
- Wallet discovery is exact and user-disableable; only opted-in matches share name, matched alias and email, never balances.
- Smart Transfers execute through a caller-owned private SQL function: eligible debits auto-confirm under policy caps, all collections require payer approval, and wallet locks plus ledger inserts remain atomic.
- Private notification rows are inserted by transfer triggers, never browser writes; owner-scoped Realtime subscriptions refresh incoming requests and account balances.
- Policy schedules and bounded retries use one five-second SQL queue awakened on deadlines and unscheduled after drain; external email delivery for scheduled work requires an authenticated notification webhook.
- Chat pairs persist distinct increasing timestamps and shared chronological ordering handles legacy timestamp ties with the user first.
- Finance commands share runtime schemas and caller-scoped actions between authenticated server functions and OAuth MCP tools; chatbot mutations require review and MCP never exposes a transfer-confirmation tool.
- MCP transport and metadata are SDK-generated; validate Supabase OAuth client claims and keep database access caller-scoped so password-session tokens cannot become connector credentials.
- Browser-local tools register in owning wallet/ledger pages with fail-open static telemetry; exports escape CSV formula prefixes and distinguish simulation summaries from tax invoices.
- The existing transactions table is the accounting source of truth; ledger_transactions is an RLS-preserving invoker view, and SQL triggers enrich paired wallet rows and append execution events atomically to avoid duplicate ledgers.
- Consolidated merchant statements page through all caller-owned transactions and match exact counterparty identifiers; receipt downloads are prepared before the download click and never label simulated activity as tax invoices or verified gateway payments.
- Smart Transfer reminders reuse the bounded deadline queue and notification webhook; immediate sends authorize via an owner RPC before recipient reads, while pending collection detail RPCs expose only payer-owned actionable requests.
- Dashboard completion charts count successful Smart Transfer source rows as automated and Wallet rows as manual; attention deduplicates pending and failed transfer attempts by their parent request.
