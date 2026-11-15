import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fakeAmount, financeCommandSchema } from "../../finance-validation";
import { executeFinance } from "../../finance.server";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "query_ledger",
  title: "Query ledger",
  description: "Search your recorded transactions before answering finance questions.",
  inputSchema: {
    party: z.string().max(200).optional(),
    from_party: z.string().max(200).optional(),
    to_party: z.string().max(200).optional(),
    status: z.enum(["ALL", "SUCCESS", "RETRYING", "FAILED"]).optional(),
    direction: z.enum(["DEBIT", "CREDIT"]).optional(),
    source_type: z.enum(["SYNC_REQUEST", "DIRECT_PAYMENT", "WALLET_TRANSFER"]).optional(),
    from_date: z.string().date().optional(),
    to_date: z.string().date().optional(),
    min_amount: z.number().nonnegative().optional(),
    max_amount: z.number().nonnegative().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const owner = ctx.getUserId();
    if (!owner) throw new Error("Sign in required");
    const result = await executeFinance(
      supabaseForUser(ctx),
      owner,
      financeCommandSchema.parse({ tool: "query_ledger", args }),
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
