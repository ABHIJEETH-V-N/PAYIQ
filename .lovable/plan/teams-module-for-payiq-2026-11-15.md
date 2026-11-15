# Teams module for payIQ

## What you’ll get
A new Teams space with individually managed AI teammates, their own conversations, permissions, connections, documents, policies and audit history. Existing IQ conversations, wallet behaviour, app theme and five bottom tabs stay intact. All money remains simulated.

## 1. Teams and teammate creation
- Add `/teams` and `/teams/$id` inside the existing signed-in layout.
- Make Teams accessible from the avatar menu and a Dashboard tile; do not add a sixth bottom tab.
- Show teammate cards, active count, All / Active / Needs setup / Paused filters, Create teammate and a confirmed Stop all action.
- Build an IQ-style chat modal on desktop and full-height sheet on mobile, with close, minimise and resume controls.
- Ask one question at a time in the brief’s order, with at most three quick replies and free text. Use Sarvam for validated interpretation and Groq for visible replies, preserving the existing provider responsibilities.
- Offer the specified templates and reviewed custom types. Propose an editable profile; only the human’s Create teammate action saves it as configuring.
- Retain cancelled builder drafts for 24 hours. Policies are attached later, never requested during creation.

## 2. Individual management
Provide the eight tabs: Overview, Conversation, Permissions, Connections, Knowledge, Policies, Runs and audit, Settings.
- Keep teammate conversations and run summaries isolated from IQ and other teammates.
- Support rename, pause, retire with a 30-day recovery period, policy attachment and permission renewal/revocation.
- Show explicit AI teammate labels, Ask a human, visible IQ handoffs, grievances and incident alerts.
- Require a verified ownership-transfer workflow; never let an arbitrary user ID claim a teammate or its connections.

## 3. Permissions and execution safety
- New teammates have no effective access until a human grants scopes with purpose and data categories.
- Enforce active status, non-expired scope, connection mode, per-action and daily caps, velocity limits, kill switches and approval requirements outside the model.
- Permissions expire after 90 days. `write:scope` and `write:payout` cannot be granted.
- Over-limit simulated refund/reversal requests create approvals instead of executing. Above ₹10,000, require a different authorised human from the rule creator; block execution if no eligible checker is configured.
- Money actions require a labelled demo step-up control and attributable approval records; demo verification must never become production authentication.
- Make simulated reversals idempotent, wallet-locked and attributable in the existing Ledger. Do not invent settlement/refund tools without matching accounting support.
- Pause and Stop all cancel queued jobs and prevent further tool dispatch. Re-check safety state immediately before committing an action.

## 4. Connections and knowledge
- Add secure connection forms outside chat, read-only defaults, tests with latency/result, rotation and disconnect.
- Keep credentials exclusively in the server-side vault; expose connection IDs and non-secret connection status, never vault references or credential fragments.
- Support REST, outbound webhook and MCP through a single gated broker. Database URI connections remain read-only, with verified read-only credentials, table allowlists and single-SELECT validation.
- Reject private/local/link-local endpoints by default, including redirects and resolved addresses. Enforce 10-second timeouts, 1 MB responses and per-teammate rate limits.
- If safe database connectivity or endpoint verification cannot be supported by the hosted runtime, leave that connection unavailable rather than accepting an unverified connection.
- Upload PDF, CSV, XLSX and TXT files up to 10 MB to private teammate-scoped storage. Parse summaries only; profile CSV columns, null rates and masked sample rows.
- Reject sensitive identifiers/credentials in uploads; redact them before storing chat or sending model context. Required documents must be parsed before activation.

## 5. Activation, runtime and audit
- Activation requires published attached policies, parsed required documents, healthy required connections, human-granted scopes and a passed evaluation for the current configuration/model version.
- Use the existing agent services through a teammate-specific gated dispatcher, with isolated context and masked tool results. Do not silently reuse IQ’s broader access.
- Add durable runs, approval requests, schedules/events, evaluation results, grievances and append-only audit entries.
- Record tool calls, blocked checks, consent, scope changes, connection tests/rotation, step-up decisions, kill switches and outcomes without secrets or raw personal data.
- Invalidate evaluation/activation readiness when relevant policies, scopes, connections or model configuration change.
- Add read-only audit filtering and safe exports.

## Technical implementation
- Adapt the brief’s Python broker/runtime and `/v1` examples to this app’s TanStack authenticated server functions and Worker-compatible TypeScript modules. Use authenticated raw HTTP routes only where streaming or external event callers need them.
- Apply Supabase migrations through the migration tool, with explicit grants, owner-scoped RLS and immutable audit protections. Create missing session/approval/audit structures instead of assuming the brief’s base schema exists.
- Use transactional database functions for limit reservations, accounting, approval transitions and audit writes so concurrent runs cannot bypass caps.
- Verify Supabase Vault availability and India-region storage/backup configuration. A bucket cannot independently change the project’s region. Production must fail closed unless India-region configuration is verified; do not claim regulatory compliance from a configuration string alone.
- Preserve current authentication middleware and existing account queries; introduce a separate Teams query for the additional records.
- Add unique page metadata and document the structural rules in `AGENTS.md`.

## Validation and delivery
- Add concrete tests for no default access, forbidden scopes, 90-day expiry, caps, concurrent spending, ₹10,000 maker-checker, step-up, pause/Stop all, audit immutability, isolation, redaction, SSRF and activation prerequisites.
- Evaluate prompt-injection attempts and model failures; neither may authorise an action.
- Exercise creation → document/connection setup → scope grant → policy attachment → evaluation → activation → isolated conversation → blocked approval → pause on desktop and mobile.
- The external Supabase connection currently provides no managed test session. Verify available public flows and automated security tests; identify signed-in checks that still need an available session without requesting credentials in chat.
- Report any unavailable external connection, region, second-approver or delivery prerequisite explicitly. Do not mark placeholders, demo results or unverified integrations as working services.

## Boundaries
No real payments, bank passwords, OTP collection in chat, real card data, lending/investment advice or changes to the existing IQ experience. India-region hosting, production authentication and regulatory review must be confirmed before production use.