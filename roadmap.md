# payIQ accounts and saved data
## Teams module
- [x] Build the Teams grid, guided teammate builder and eight-tab management pages without changing the five bottom tabs or IQ conversations.
- [x] Add owner-scoped teammate records, separate conversations, human-granted permissions, immutable audit and activation checks.
- [x] Add PDF/TXT/CSV/XLSX summary parsing, read-only gated teammate runs, model evaluations, human handoffs, grievances and kill switches.
- [x] Test permission gates and actual SQL ownership, audit immutability, 90-day expiry, redaction, pause cancellation, stale evaluation and 30-day retirement recovery; verify signed-out desktop/mobile page gates.
- [ ] Enable external connection wizard/broker, rotation and tests — needs verified Vault access, SSRF-safe resolved-address transport and read-only database credential verification; forms remain unavailable, not simulated.
- [ ] Enable transactional teammate refunds/reversals and maker-checker approvals with demo step-up — needs verified second-human authorisation and reversal accounting; all teammate money actions remain blocked.
- [ ] Enable scheduled/event-triggered teammate runs and ownership transfer — needs verified external event delivery, durable runner and human invitation/checker workflow; only explicit conversation runs are available.
- [ ] Verify India-region project/storage/backups and configure SUPABASE_REGION — production Teams actions fail closed until this is supplied; region is not verified.
- [ ] Verify signed-in creation, activation and conversation on desktop/mobile — external Supabase provides no available managed test session. Live provider evaluation and upload/readback remain unverified.

## Branded Smart Transfer emails
- [x] Apply the requested email theme and structured sender, amount/cap, schedule and policy summary to Smart Transfer dispatch paths.
- [x] Verify all four generated email types at desktop/mobile widths and test unchanged From, Reply-To and recipient routing.
- [ ] Verify inbox delivery — Resend test sender restricts recipients; scheduled sends require the external notification webhook.
## Cross-user Smart Transfer workflow
- [x] Add category filters, reminder preferences and immediate reminder actions without changing IQ.
- [x] Add recipient request details, Accept & Pay / Decline, atomic completion and correct Dashboard classification.
- [x] Test reminders, permissions, settlement and metrics; verify public page gates and unauthorized callback rejection.
- [ ] Verify signed-in cross-user screens and inbox delivery — external Supabase provides no test session and Resend test sender restricts recipients.
- [ ] Enable scheduled reminder emails — needs publication and an external Supabase notifications webhook; test sender restricts recipients.
## Wallet ledger and merchant receipts
- [x] Enrich atomic wallet ledger rows with source, counterparty identifiers, failure codes and audit trail; preserve Dashboard styling.
- [x] Add scannable Ledger rows and party/status/direction/source/date filters.
- [x] Add individual receipts and all-record counterparty statements with profile details, prepared PDF/CSV downloads and print.
- [x] Test accounting, filters and export generation; verify browser PDF/CSV downloads using synthetic records.
- [ ] Verify signed-in wallet-to-Ledger and consolidated invoice UI — external Supabase has no available authenticated test session.
## Smart Transfers and incoming notifications
- [x] Rename Wallet and Smart Transfers terminology without changing Dashboard layout or styling.
- [x] Add recipient lookup, policy schedules, approval limits and retry delays.
- [x] Enforce policy-aware payouts and payer-approved collections; add private realtime notifications and immediate email dispatch.
- [x] Fix chronological IQ replies and bottom spacing; 66 tests passed and public desktop/tablet/mobile access checked.
- [ ] Enable scheduled notification email webhook — needs a published app URL and external Supabase notifications INSERT webhook targeting /api/public/notification-events with the existing shared secret.
- [ ] Verify signed-in cross-user UI and inbox delivery — external Supabase cannot provide a test session; Resend test sender restricts recipients to its account owner.
## Requested IQ, wallet and email fixes
- [x] Rename AI Workspace to IQ and remove its subtitle.
- [x] Apply starting fake balances, default discovery, email lookup and safe sync execution; SQL tests cover balances, ledger rows, payout/collection and missing wallets.
- [x] Switch Resend to its test sender, preserve reply-to and surface dispatch results; tests preserve exact recipient errors.
- [ ] Verify live signed-in transfers and inbox delivery — external Supabase provides no authenticated test session; Resend test sender only delivers to its account owner.
## Simulated wallet and finance agent
- [x] Add private fake balances, exact opted-in recipient search, atomic paired transfers, and payer-only confirmation.
- [x] Add wallet screens, one-shot simulated sync requests, ledger exports, and reviewed policy creation.
- [x] Connect shared finance reads and reviewed actions to Sarvam/Groq; generate nine OAuth MCP tools and browser-local wallet/ledger reads.
- [x] Test actual SQL balance conservation, owner reads, payer approval, caps, duplicate prevention, CSV safety and agent validation; verify public access and consent errors.
- [ ] Verify signed-in wallet/agent flows and consent approve/deny — external Supabase has no available authenticated session.
- [ ] Activate external assistant access — publication and healthy Supabase OAuth discovery required; discovery currently returns feature_disabled.
- [ ] Add real-payment retries/refunds — blocked by missing verified real payment provider; no simulated bank errors or refund timeline claims added.
- [ ] Add content-level document search — requires an indexing pipeline, not filename metadata alone.
- [ ] Activate general counterparty status/recovery email delivery — Resend test sender cannot send to arbitrary users and supported payment recovery links are unavailable.

## Resend updates and sync editing
- [x] Add branded event emails, sender/reply-to fields, sync editing and owner-visible send results; validate with automated tests and desktop/mobile email inspection.
- [x] Add a verified transaction/status event endpoint without enabling payments; unauthorized calls return 401.
- [ ] Activate transaction/status callbacks — external Supabase webhooks must target the published event endpoint using the saved shared secret; app is not published yet.
- [ ] Verify general-user delivery — Resend test sender only delivers to its account owner; a verified domain is required for other users.
- [ ] Verify authenticated editing — external Supabase has no available test session.

- [x] Correct the AI saved-records lookup; regression tests verify transaction context, conversation saving, empty records, and genuine read failures. Signed-in live verification remains unavailable for external Supabase.
- [x] Create private user-owned tables and document storage.
- [x] Connect signup, sign-in, sign-out, and password recovery.
- [x] Protect app pages and connect profile, sync rules, ledger, dashboard, and chat history.
- [x] Validate forms, inspect access rules, check public account flows, and report external setup limitations.
- [ ] Verify authenticated persistence and email flows — blocked by the external Supabase project's unavailable test session and hosted auth settings.

## Sarvam requests
- [x] Recover empty, invalid, or unavailable Sarvam interpretation through Groq-only replies with saved context and no app actions; cover fallback and action preservation with regression tests.
- [x] Connect Sarvam natural-language interpretation and speech transcription; key saved and live text responses checked.
- [x] Add typed and spoken requests in IQ with validated app actions and no real payment execution.
- [x] Test request validation and private workspace access.
- [ ] Verify signed-in conversations, draft persistence, and microphone transcription — external Supabase has no available authenticated test session.