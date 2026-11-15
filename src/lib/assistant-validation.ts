import { z } from "zod";
import { financeCommandSchema } from "./finance-validation";

export const assistantResultSchema = z
  .object({
    reply: z.string().trim().min(1).max(10000),
    action: z.enum(["reply", "navigate", "draft_sync", "finance"]),
    command: financeCommandSchema.optional(),
    destination: z
      .enum(["/dashboard", "/ledger", "/sync-requests", "/profile", "/workspace", "/wallet"])
      .nullable(),
    draft: z
      .object({
        name: z.string().trim().min(1).max(200),
        counterparty: z.string().trim().min(1).max(200),
        counterparty_address: z.string().trim().min(1).max(200),
        direction: z.enum(["DEBIT", "CREDIT"]),
        amount: z.number().positive(),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.action === "finance" && !v.command)
      ctx.addIssue({ code: "custom", message: "Missing finance command" });
    if (v.action === "navigate" && !v.destination)
      ctx.addIssue({ code: "custom", message: "Missing destination" });
    if (v.action === "draft_sync" && !v.draft)
      ctx.addIssue({ code: "custom", message: "Missing draft details" });
  });
export type AssistantResult = z.infer<typeof assistantResultSchema>;
export const VOICE_SECONDS = 30;

export const assistantJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "action", "destination", "draft"],
  properties: {
    reply: { type: "string" },
    action: { type: "string", enum: ["reply", "navigate", "draft_sync", "finance"] },
    command: {
      type: "object",
      description:
        "Only with action finance: {tool, args}. Tools: create_sync_request {name,counterparty,counterparty_email,sender_email,email_updates,counterparty_address,direction,amount_type,amount,max_cap,policy_id}, get_wallet {}, list_policies {}, query_ledger {party?,from_party?,to_party?,status?,direction?,source_type?,from_date?,to_date?,min_amount?,max_amount?,limit:20}, search_recipient {query}, prepare_transfer {query,amount}, create_policy {name,requires_user_auth,max_retries:2,auto_refund_limit:0,auto_email:true}, search_knowledge_base {query}, generate_invoice {transaction_id?,party?,format:PDF|CSV}. Never confirm a transfer through a model command.",
    },
    destination: {
      type: ["string", "null"],
      enum: ["/dashboard", "/ledger", "/sync-requests", "/profile", "/workspace", "/wallet", null],
    },
    draft: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["name", "counterparty", "counterparty_address", "direction", "amount"],
          properties: {
            name: { type: "string" },
            counterparty: { type: "string" },
            counterparty_address: { type: "string" },
            direction: { type: "string", enum: ["DEBIT", "CREDIT"] },
            amount: { type: "number" },
          },
        },
      ],
    },
  },
};
