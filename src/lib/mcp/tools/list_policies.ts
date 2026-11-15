import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fakeAmount, financeCommandSchema } from "../../finance-validation";
import { executeFinance } from "../../finance.server";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "list_policies",
  title: "List policies",
  description: "Read your governance policies.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const owner = ctx.getUserId();
    if (!owner) throw new Error("Sign in required");
    const result = await executeFinance(
      supabaseForUser(ctx),
      owner,
      financeCommandSchema.parse({ tool: "list_policies", args }),
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
