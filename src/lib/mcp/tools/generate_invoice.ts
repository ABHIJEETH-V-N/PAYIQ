import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fakeAmount, financeCommandSchema } from "../../finance-validation";
import { executeFinance } from "../../finance.server";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "generate_invoice",
  title: "Export transaction summary",
  description: "Generate a private PDF receipt or CSV summary, not a tax invoice.",
  inputSchema: {
    transaction_id: z.string().uuid().optional(),
    party: z.string().max(200).optional(),
    format: z.enum(["PDF", "CSV"]).default("PDF"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const owner = ctx.getUserId();
    if (!owner) throw new Error("Sign in required");
    const result = await executeFinance(
      supabaseForUser(ctx),
      owner,
      financeCommandSchema.parse({ tool: "generate_invoice", args }),
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
