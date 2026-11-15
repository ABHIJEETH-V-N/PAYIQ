import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/public/notification-events")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env["PAYIQ_EVENT_SECRET"];
    if (!secret) return new Response("Notifications unavailable", { status: 503 });
    const { timingSafeEqual } = await import("node:crypto");
    const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
    if (!timingSafeEqual(await digest(request.headers.get("authorization") ?? ""), await digest(`Bearer ${secret}`))) return new Response("Unauthorized", { status: 401 });
    const event = z.object({ type: z.literal("INSERT"), table: z.literal("notifications"), record: z.object({ id: z.string().uuid(), user_id: z.string().uuid() }) }).safeParse(await request.json().catch(() => null));
    if (!event.success) return new Response("Invalid notification", { status: 400 });
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const row = await db.from("notifications").select("*").eq("id", event.data.record.id).eq("user_id", event.data.record.user_id).single();
    if (row.error) return new Response("Notification unavailable", { status: 409 });
    if (!row.data.send_email) return Response.json({ skipped: true });
    if (row.data.type === "REMINDER") {
      const { dispatchReminder } = await import("@/lib/reminders.server");
      const sent = await dispatchReminder(db, row.data);
      return Response.json(sent, { status: sent.status === "FAILED" ? 502 : 200 });
    }
    if (row.data.type === "APPROVAL") return Response.json({ skipped: true });
    const { notifyAccount } = await import("@/lib/notifications.server");
    let replyTo: string | undefined;
    let syncId = row.data.sync_request_id || undefined;
    let amount: number | undefined;
    if (row.data.related_id) {
      const transfer = await db.from("simulation_transfers").select("requester_id,sync_request_id,amount").eq("id", row.data.related_id).single();
      if (transfer.error) return new Response("Transfer unavailable", { status: 409 });
      amount = transfer.data.amount;
      if (transfer.data.sync_request_id) {
        syncId = transfer.data.sync_request_id;
        const sync = await db.from("sync_requests").select("sender_email,email_updates,policy_id").eq("id", transfer.data.sync_request_id).single();
        if (sync.error) return new Response("Smart Transfer unavailable", { status: 409 });
        if (!sync.data.email_updates) return Response.json({ skipped: true });
        replyTo = sync.data.sender_email || undefined;
        if (["FAILURE", "RETRY"].includes(row.data.type)) {
          const policy = await db.from("payment_policies").select("auto_email").eq("id", sync.data.policy_id).single();
          if (!policy.data?.auto_email) return Response.json({ skipped: true });
        }
      }
      if (!replyTo) replyTo = (await db.auth.admin.getUserById(transfer.data.requester_id)).data.user?.email;
    }
    const status = row.data.type === "COLLECTION" ? "AWAITING_USER_AUTH" : row.data.type === "TRANSFER" ? "SUCCESS" : row.data.type === "DECLINED" ? "CANCELLED" : "FAILED";
    const eventKey = row.data.related_id ? `smart-transfer-${row.data.related_id}-${status}` : `incoming-${row.data.id}`;
    const details: [string, string][] = [["Update", row.data.message], ["Status", status], ["Funds", "Simulated funds · real payments disconnected"]];
    if (amount !== undefined) details.push(["Amount", `₹${amount}`]);
    const sent = await notifyAccount(db, row.data.user_id, eventKey, row.data.title, details, replyTo, undefined, syncId);
    return Response.json(sent, { status: sent.status === "FAILED" ? 502 : 200 });
  } } },
});