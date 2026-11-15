# PayIQ


## What this module covers

| Area | Summary |
|---|---|
| Teammate builder | A **Create teammate** button opens a pop-up with an IQ-style chat. |
| Connections | Secrets are entered through a secure form, never through chat. |
| Documents | Each agent type has a template of required and optional documents. |
| Separate agents | Every teammate is isolated, with its own conversation, tools, scopes and audit trail. |
| Permissions | Human-granted, expiring scopes with caps and two-person approval. |
| RBI controls | Section 9 maps each control to where it is enforced in code. |
| SQL migration | Included in the module file. |

## 1. Teammate builder

- The builder asks **one question at a time**.
- It proposes a teammate profile and creates the teammate **only after you confirm**.
- Policies are attached later. Until policies are attached and the required documents are parsed, the teammate stays in a **configuring** state.

## 2. Connections

- Connection strings, REST endpoints, bearer tokens and API keys go through a **secure form inside the pop-up**, never the chat.
- Secrets are stored in **Supabase Vault**.
- The AI only ever sees a **connection ID**.
- Database access is **read-only** (`SELECT` only) and goes through a broker.

## 3. Documents

- Each agent type has a template listing the documents it needs.
- The builder explains why each document is needed and marks it **required** or **optional**.
- A teammate **cannot activate** until all required documents are parsed.

## 4. Separate agents

Each teammate has its own:

- conversation
- tools
- scopes
- audit trail
- management tabs

A teammate cannot read IQ's chats. It can only ask IQ for help through a **visible handoff**.

## 5. Permission model

- Scopes are granted by a **human**. A teammate cannot grant itself scopes.
- Scopes **expire after 90 days**.
- Each scope carries **per-action and daily caps**.
- High-value actions need a **second person to approve**, and the person who wrote the rule cannot approve it.

## 6. RBI controls (section 9)

Section 9 maps each control to the place in code where it is enforced:

- licensing
- data localisation
- step-up authentication
- limits
- audit retention
- secret handling
- customer transparency
- grievances
- prompt-injection tests

## Usage

1. Give the main build prompt to your build tool first.
2. Then give `teams-module-prompt.md` as an extension of it.
3. Run the SQL migration from the module file against your Supabase project.
4. Walk through creating a teammate. Check that it stays in **configuring** until policies are attached and required documents are parsed.

## Before you build

- **Real money is out of scope.** Moving customer funds needs a payment aggregator licence, or a bank or PA partnership. Until then, keep the prototype simulated.
- **Compliance is not legal advice.** The RBI section is a design baseline. RBI circulars change and the current rules have not been checked. Have payments-regulatory counsel confirm each control before any production use.

## Suggested test checklist

- [ ] A secret pasted into chat is rejected or redirected to the secure form.
- [ ] The AI never sees raw credentials, only connection IDs.
- [ ] A non-`SELECT` database query is blocked by the broker.
- [ ] A teammate cannot activate with a required document missing.
- [ ] A teammate cannot grant itself scopes.
- [ ] An expired scope stops working.
- [ ] A high-value action requires a second approver who is not the rule author.
- [ ] A teammate cannot read IQ's chat history.
- [ ] Prompt-injection tests pass.
