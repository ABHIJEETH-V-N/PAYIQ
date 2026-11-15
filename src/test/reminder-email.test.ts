import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/notifications.server", () => ({ notifyAccount: vi.fn().mockResolvedValue({ status: "SENT" }) }));
import { dispatchReminder } from "@/lib/reminders.server";
import { notifyAccount } from "@/lib/notifications.server";
describe("Smart Transfer reminder dispatch", () => {
  beforeEach(() => vi.clearAllMocks());
  const row = { id: "notice", user_id: "payer", sync_request_id: "sync", related_id: "transfer", send_email: true } as Parameters<typeof dispatchReminder>[1];
  const db = { from: (table: string) => {
    const data = table === "sync_requests" ? { id: "sync", name: "Dev collection", user_id: "owner", amount: null, max_cap: 200, status: "AWAITING_USER_AUTH", next_execution_at: null, sender_email: "sender@example.com" } : table === "profiles" ? { name: "Dev" } : { amount: 100 };
    const q = { select: () => q, eq: () => q, single: async () => ({ data, error: null }) }; return q;
  } } as unknown as Parameters<typeof dispatchReminder>[0];
  it("sends requested ₹100, cap ₹200, sender and due status to the payer with sender reply-to", async () => {
    await dispatchReminder(db, row);
    expect(notifyAccount).toHaveBeenCalledWith(db, "payer", "reminder-notice", "Smart Transfer reminder", expect.arrayContaining([["Transfer", "Dev collection"], ["Sender", "Dev"], ["Amount", "₹100"], ["Cap", "₹200"], ["Due status", "AWAITING_USER_AUTH"]]), "sender@example.com", undefined, "sync");
  });
  it("does not send email when the reminder email toggle is off", async () => {
    expect(await dispatchReminder(db, { ...row, send_email: false })).toEqual({ status: "OFF" });
    expect(notifyAccount).not.toHaveBeenCalled();
  });
});