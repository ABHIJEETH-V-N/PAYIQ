import { describe, expect, it, vi, beforeEach } from "vitest";
import { syncSchema, updateSyncSchema } from "@/lib/account-validation";
import { accountEventSchema, eventRequiresEmail } from "@/lib/event-validation";
import { notifyAccount } from "@/lib/notifications.server";

const sync = { name: "Vendor", counterparty: "Shop", counterparty_email: "", counterparty_address: "shop@paytm", direction: "DEBIT", amount_type: "FIXED", amount: 1500, max_cap: null, policy_id: "a0000000-0000-4000-8000-000000000001", sender_email: "sender@example.com", email_updates: true };
describe("Email updates and sync editing", () => {
  it("keeps sender email and the request email preference", () => {
    expect(syncSchema.parse({ ...sync, email_updates: false })).toMatchObject({ sender_email: "sender@example.com", email_updates: false });
    expect(syncSchema.safeParse({ ...sync, sender_email: "invalid" }).success).toBe(false);
  });
  it("validates edited requests with their unchanged identity", () => {
    const id = "a0000000-0000-4000-8000-000000000002";
    expect(updateSyncSchema.parse({ id, values: { ...sync, amount: 2200 } })).toMatchObject({ id, values: { amount: 2200 } });
    expect(updateSyncSchema.safeParse({ id: "invalid", values: sync }).success).toBe(false);
  });
  it("sends transaction creation, status changes and retry events, not unrelated edits", () => {
    const event = accountEventSchema.parse({ type: "UPDATE", table: "transactions", schema: "public", record: { id: "a0000000-0000-4000-8000-000000000001", user_id: "a0000000-0000-4000-8000-000000000002", updated_at: "2026-11-14T16:00:00Z", status: "FAILED", retry_count: 2 }, old_record: { status: "FAILED", retry_count: 1 } });
    expect(eventRequiresEmail(event)).toBe(true);
    expect(eventRequiresEmail({ ...event, old_record: { status: "FAILED", retry_count: 2 } })).toBe(false);
    expect(eventRequiresEmail({ ...event, type: "INSERT" })).toBe(true);
    expect(eventRequiresEmail({ ...event, table: "sync_requests", record: { ...event.record, status: "ACTIVE" }, old_record: { status: "DRAFT" } })).toBe(true);
    expect(accountEventSchema.safeParse({ ...event, table: "profiles" }).success).toBe(false);
  });
});
describe("Resend sends", () => {
  beforeEach(() => { vi.stubEnv("RESEND_API_KEY", "test"); vi.stubEnv("LOVABLE_API_KEY", "test"); });
  function database(sent = false) {
    const update = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
    const db = { from: (table: string) => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: sent ? { status: "SENT" } : null, error: null }) }), single: async () => ({ data: { name: "Owner" }, error: null }) }) }),
      upsert: () => ({ select: () => ({ single: async () => ({ data: { id: "notice" }, error: null }) }) }), update,
    }), auth: { getUser: async () => ({ data: { user: { id: "owner", email: "owner@example.com" } } }) } };
    return { db: db as unknown as Parameters<typeof notifyAccount>[0], update };
  }
  it("sends only to the account owner and uses the sender as reply-to", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ id: "email-1" }));
    vi.stubGlobal("fetch", fetcher);
    expect(await notifyAccount(database().db, "owner", "event-1", "Sync request created", [["Amount", "₹1500"]], "sender@example.com")).toEqual({ status: "SENT" });
    const body = JSON.parse(fetcher.mock.calls[0]?.[1].body);
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.from).toBe("payIQ <onboarding@resend.dev>");
    expect(body.reply_to).toBe("sender@example.com");
    expect(fetcher.mock.calls[0]?.[1].headers["Idempotency-Key"]).toBe("event-1");
  });
  it("preserves Resend's exact recipient rejection and never resends completed events", async () => {
    const body = '{"message":"You can only send testing emails to your own email address"}';
    const fetcher = vi.fn().mockResolvedValue(new Response(body, {status:403})); vi.stubGlobal("fetch", fetcher);
    expect(await notifyAccount(database().db, "owner", "event-2", "Sync request created", [])).toEqual({status:"FAILED",error:`Resend request failed [403]: ${body}`});
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await notifyAccount(database(true).db, "owner", "event-1", "Sync request created", [])).toEqual({ status: "SENT" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("addresses updates to the entered recipient instead of the reply-to address", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({id:"email-2"})); vi.stubGlobal("fetch",fetcher);
    await notifyAccount(database().db,"owner","event-3","Sync request created",[],"devnarayananmp@outlook.com","recipient@example.com");
    expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toMatchObject({from:"payIQ <onboarding@resend.dev>",to:["recipient@example.com"],reply_to:"devnarayananmp@outlook.com"});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});