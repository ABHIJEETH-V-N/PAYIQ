import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const incomingNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await context.supabase.from("notifications").select("*")
      .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100);
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    const result = await context.supabase.from("notifications").update({ is_read: true })
      .eq("id", data).eq("user_id", context.userId);
    if (result.error) throw new Error(result.error.message);
  });

export const lookupRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().trim().min(3).max(200))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("lookup_wallet_recipient", { p_query: data });
    if (result.error) throw new Error(result.error.message);
    if (result.data.length !== 1) throw new Error("No unique match. Ask the recipient to enable account lookup.");
    return result.data[0];
  });