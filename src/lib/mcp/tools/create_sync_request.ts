import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { financeCommandSchema } from "../../finance-validation";
import { executeFinance } from "../../finance.server";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "create_sync_request",
  title: "Create Smart Transfer draft",
  description:
    "Save a user-owned payout or collection draft with an existing policy; no money moves.",
  inputSchema: {
    name: z.string().min(1).max(200),
    counterparty: z.string().min(1).max(200),
    counterparty_email: z.union([z.string().email(), z.literal("")]),
    sender_email: z.union([z.string().email(), z.literal("")]).default(""),
    email_updates: z.boolean().default(true),
    counterparty_address: z.string().min(1).max(200),
    direction: z.enum(["DEBIT", "CREDIT"]),
    amount_type: z.enum(["FIXED", "VARIABLE"]),
    amount: z.number().positive().nullable(),
    max_cap: z.number().positive().nullable(),
    policy_id: z.string().uuid(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const owner = ctx.getUserId();
    if (!owner) throw new Error("Sign in required");
    const result = await executeFinance(
      supabaseForUser(ctx),
      owner,
      financeCommandSchema.parse({ tool: "create_sync_request", args }),
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
