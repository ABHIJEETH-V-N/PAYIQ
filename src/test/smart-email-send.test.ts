import { it, expect, vi } from "vitest";
import { notifyAccount } from "@/lib/notifications.server";
it("keeps the Resend test sender and routes the structured email to recipient with the real sender reply-to", async () => {
  vi.stubEnv("RESEND_API_KEY", "test"); vi.stubEnv("LOVABLE_API_KEY", "test");
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "sent" })); vi.stubGlobal("fetch", fetcher);
  const db = { from: (table: string) => {
    const data = table === "sync_requests" ? { user_id: "sender", policy_id: "policy", sender_email: "dev@example.com", name: "Courier payment", direction: "DEBIT", amount_type: "FIXED", amount: 100, max_cap: null, status: "SUCCESS", next_execution_at: null } : table === "payment_policies" ? { name: "Standard Auto", frequency: "ONCE", execution_date: null, max_retries: 2 } : { name: "Dev", id: "notice" };
    const q = { select: () => q, eq: () => q, single: async () => ({ data, error: null }), maybeSingle: async () => ({ data: null, error: null }) };
    return { ...q, upsert: () => q, update: () => q };
  }, auth: { getUser: async () => ({ data: { user: { id: "recipient", email: "recipient@example.com" } } }) } } as unknown as Parameters<typeof notifyAccount>[0];
  expect(await notifyAccount(db, "recipient", "smart-event", "Transfer received", [["Status", "SUCCESS"]], "dev@example.com", undefined, "sync")).toEqual({ status: "SENT" });
  const body = JSON.parse(fetcher.mock.calls[0]?.[1].body);
  expect(body.from).toBe("payIQ <onboarding@resend.dev>"); expect(body.to).toEqual(["recipient@example.com"]); expect(body.reply_to).toBe("dev@example.com");
});