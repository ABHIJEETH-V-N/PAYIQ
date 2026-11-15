import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fakeAmount, financeCommandSchema } from "../../finance-validation";
import { executeFinance } from "../../finance.server";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "prepare_transfer",
  title: "Prepare transfer",
  description: "Prepare a wallet transfer; only the payer can confirm in the wallet screen.",
  inputSchema: { query: z.string().min(3).max(150), amount: fakeAmount },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const owner = ctx.getUserId();
    if (!owner) throw new Error("Sign in required");
    const result = await executeFinance(
      supabaseForUser(ctx),
      owner,
      financeCommandSchema.parse({ tool: "prepare_transfer", args }),
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
