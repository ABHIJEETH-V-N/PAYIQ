import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fakeAmount, financeCommandSchema } from "../../finance-validation";
import { executeFinance } from "../../finance.server";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "search_knowledge_base",
  title: "Find documents",
  description: "Search your uploaded filenames, not unindexed document contents.",
  inputSchema: { query: z.string().min(1).max(200) },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const owner = ctx.getUserId();
    if (!owner) throw new Error("Sign in required");
    const result = await executeFinance(
      supabaseForUser(ctx),
      owner,
      financeCommandSchema.parse({ tool: "search_knowledge_base", args }),
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
});
