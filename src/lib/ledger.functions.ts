import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPartyStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ party: z.string().trim().min(1).max(200) }))
  .handler(async ({ data, context }) => {
    // Retrieve every owned row, not the latest dashboard page; exact party matches prevent combining unrelated users.
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const page = await context.supabase.from("transactions").select("*").eq("user_id", context.userId)
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (page.error) throw new Error(page.error.message);
      rows.push(...page.data.filter((r) => [r.from_party,r.to_party,r.from_upi,r.to_upi,r.from_email,r.to_email].some((v) => v.trim().toLowerCase() === data.party.toLowerCase())));
      if (page.data.length < 500) break;
    }
    return rows;
  });