import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fakeAmount, financeCommandSchema } from "../../finance-validation";
import { executeFinance } from "../../finance.server";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "get_wallet",
  title: "Get wallet",
  description: "Read your available balance and account aliases.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const owner = ctx.getUserId();
    if (!owner) throw new Error("Sign in required");
    const result = await executeFinance(
      supabaseForUser(ctx),
      owner,
      financeCommandSchema.parse({ tool: "get_wallet", args }),
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
