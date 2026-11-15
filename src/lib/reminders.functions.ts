import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendReminderNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    // The caller-scoped RPC authorizes ownership before privileged recipient email reads.
    const result = await context.supabase.rpc("send_smart_reminder", { p_sync: data });
    if (result.error) throw new Error(result.error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const notice = await supabaseAdmin.from("notifications").select("*").eq("id", result.data).eq("sync_request_id", data).single();
    if (notice.error) throw new Error(notice.error.message);
    const { dispatchReminder } = await import("./reminders.server");
    return { notification: await dispatchReminder(supabaseAdmin, notice.data) };
  });