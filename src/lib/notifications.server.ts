import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { renderUpdateEmail, renderSmartTransferEmail } from "./email-template";

const base = "https://connector-gateway.lovable.dev/resend";
async function resend(path: string, init?: RequestInit) {
  const key = process.env["RESEND_API_KEY"];
  const gateway = process.env["LOVABLE_API_KEY"];
  if (!key || !gateway) throw new Error("Resend is not configured.");
  const response = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${gateway}`, "X-Connection-Api-Key": key, ...init?.headers } });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Resend request failed [${response.status}]: ${body}`);
    throw new Error(`Resend request failed [${response.status}]: ${body}`);
  }
  return response.json();
}
export async function notifyAccount(db: SupabaseClient<Database>, userId: string, eventKey: string, title: string, details: [string, string][], replyTo?: string, updatesEmail?: string, syncId?: string) {
  try {
    const previous = await db.from("email_notifications").select("id,status").eq("event_key", eventKey).eq("user_id", userId).maybeSingle();
    if (previous.error) throw previous.error;
    if (previous.data?.status === "SENT") return { status: "SENT" as const };
    const row = await db.from("email_notifications").upsert({ user_id: userId, event_key: eventKey, event_type: title, status: "PENDING", error: null }, { onConflict: "event_key" }).select("id").single();
    if (row.error) throw row.error;
    try {
      const [profile, owner] = await Promise.all([
        db.from("profiles").select("name").eq("id", userId).single(),
        db.auth.getUser(),
      ]);
      // A server-service client has no user session; only verified event handlers may use this fallback.
      let email = owner.data.user?.id === userId ? owner.data.user.email : undefined;
      if (!email) {
        const account = await db.auth.admin.getUserById(userId);
        if (account.error) throw account.error;
        email = account.data.user?.email;
      }
      const recipient = z.string().email().parse(updatesEmail || email);
      let html = renderUpdateEmail(title, profile.data?.name ?? "", details);
      if (syncId) {
        const { loadSmartEmail } = await import("./smart-email.server");
        const smart = await loadSmartEmail(db, syncId, title, details, replyTo);
        replyTo = smart.senderEmail;
        html = renderSmartTransferEmail(smart, "https://id-preview--09af57b1-72c4-4ecf-adc9-9169a1cdc5d6.lovable.app");
      }
      const result = await resend("/emails", { method: "POST", headers: { "Idempotency-Key": eventKey }, body: JSON.stringify({ from: "payIQ <onboarding@resend.dev>", to: [recipient], ...(replyTo ? { reply_to: z.string().email().parse(replyTo) } : {}), subject: `${title} — payIQ`, html }) });
      const sent = await db.from("email_notifications").update({ status: "SENT", provider_id: z.object({ id: z.string() }).parse(result).id, error: null }).eq("id", row.data.id).eq("user_id", userId);
      if (sent.error) throw sent.error;
      return { status: "SENT" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email could not be sent.";
      await db.from("email_notifications").update({ status: "FAILED", error: message }).eq("id", row.data.id).eq("user_id", userId);
      return { status: "FAILED" as const, error: message };
    }
  } catch (error) {
    console.error("Account notification failed", error);
    return { status: "FAILED" as const, error: "Your change was saved, but its email could not be sent." };
  }
}