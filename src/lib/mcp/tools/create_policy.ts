import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { policyFields } from "../../policy-validation";
import { fakeAmount, financeCommandSchema } from "../../finance-validation";
import { executeFinance } from "../../finance.server";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "create_policy",
  title: "Create policy",
  description: "Create a governance policy with bounded retry and refund settings.",
  inputSchema: {
    ...policyFields,
    auto_refund_limit: z.number().min(0).max(100000).default(0),
    auto_email: z.boolean().default(true),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const owner = ctx.getUserId();
    if (!owner) throw new Error("Sign in required");
    const result = await executeFinance(
      supabaseForUser(ctx),
      owner,
      financeCommandSchema.parse({ tool: "create_policy", args }),
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
