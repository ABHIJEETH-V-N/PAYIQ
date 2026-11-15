import { createFileRoute } from "@tanstack/react-router";
import { accountEventSchema, eventRequiresEmail } from "@/lib/event-validation";

export const Route = createFileRoute("/api/public/account-events")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env["PAYIQ_EVENT_SECRET"];
    if (!secret) return new Response("Event notifications are not configured", { status: 503 });
    // Hash both values to compare fixed-size buffers without leaking partial matches.
    const { timingSafeEqual } = await import("node:crypto");
    const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
    if (!timingSafeEqual(await digest(request.headers.get("authorization") ?? ""), await digest(`Bearer ${secret}`))) return new Response("Unauthorized", { status: 401 });
    const parsed = accountEventSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return new Response("Invalid account event", { status: 400 });
    const event = parsed.data;
    if (!eventRequiresEmail(event)) return Response.json({ skipped: true });
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { notifyAccount } = await import("@/lib/notifications.server");
    // Read the authoritative row, not arbitrary webhook text or recipient fields.
    if (event.table === "transactions") {
      const r = await db.from("transactions").select("*").eq("id", event.record.id).eq("user_id", event.record.user_id).single();
      if (r.error || !r.data || r.data.updated_at !== event.record.updated_at) return new Response("Event is stale or unavailable", { status: 409 });
      let replyTo: string | undefined;
      if (r.data.sync_request_id) {
        const sync = await db.from("sync_requests").select("email_updates,sender_email").eq("id", r.data.sync_request_id).eq("user_id", r.data.user_id).single();
        if (sync.error) return new Response("Linked request unavailable", { status: 409 });
        if (!sync.data.email_updates) return Response.json({ skipped: true });
        replyTo = sync.data.sender_email || undefined;
      }
      const sent = await notifyAccount(db, r.data.user_id, `transaction-${r.data.id}-${r.data.updated_at}`, "Transaction update", [["Order", r.data.order_id], ["From", r.data.from_party], ["To", r.data.to_party], ["Amount", `₹${r.data.amount}`], ["Status", r.data.status], ["Retries", String(r.data.retry_count)]], replyTo, undefined, r.data.sync_request_id || undefined);
      return Response.json({ status: sent.status }, { status: sent.status === "FAILED" ? 502 : 200 });
    }
    const r = await db.from("sync_requests").select("*").eq("id", event.record.id).eq("user_id", event.record.user_id).single();
    if (r.error || !r.data || r.data.updated_at !== event.record.updated_at) return new Response("Event is stale or unavailable", { status: 409 });
    if (!r.data.email_updates) return Response.json({ skipped: true });
    const sent = await notifyAccount(db, r.data.user_id, `sync-status-${r.data.id}-${r.data.updated_at}`, "Smart Transfer status changed", [["Request", r.data.name], ["Status", r.data.status]], r.data.sender_email || undefined, undefined, r.data.id);
    return Response.json({ status: sent.status }, { status: sent.status === "FAILED" ? 502 : 200 });
  } } },
});