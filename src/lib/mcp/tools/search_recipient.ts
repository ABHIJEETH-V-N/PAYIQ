import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fakeAmount, financeCommandSchema } from "../../finance-validation";
import { executeFinance } from "../../finance.server";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "search_recipient",
  title: "Search wallet recipient",
   description: "Find a discoverable wallet recipient by exact account email, phone or UPI alias.",
  inputSchema: { query: z.string().min(3).max(150) },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const owner = ctx.getUserId();
    if (!owner) throw new Error("Sign in required");
    const result = await executeFinance(
      supabaseForUser(ctx),
      owner,
      financeCommandSchema.parse({ tool: "search_recipient", args }),
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
