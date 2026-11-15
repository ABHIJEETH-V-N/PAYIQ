import { describe, it, expect } from "vitest";
import { loadSmartEmail } from "@/lib/smart-email.server";
import { smartEmailPresentation } from "@/lib/smart-email";
function database() {
  return { from: (table: string) => {
    const data = table === "sync_requests" ? { user_id: "owner", policy_id: "policy", sender_email: "dev@example.com", name: "Courier collection", direction: "CREDIT", amount_type: "VARIABLE", amount: null, max_cap: 200, status: "AWAITING_USER_AUTH", next_execution_at: null } : table === "profiles" ? { name: "Dev" } : { name: "Standard Auto", max_retries: 2, frequency: "DAILY", execution_date: "2026-11-15" };
    const q = { select: () => q, eq: () => q, single: async () => ({ data, error: null }) }; return q;
  } } as unknown as Parameters<typeof loadSmartEmail>[0];
}
describe("Authoritative Smart Transfer email data", () => {
  it("keeps sender email, ₹100 reviewed amount, ₹200 cap, direction and policy schedule", async () => {
    expect(await loadSmartEmail(database(), "sync", "Smart Transfer reminder", [["Amount", "₹100"]], "other@example.com")).toMatchObject({ senderName: "Dev", senderEmail: "dev@example.com", amount: "₹100", cap: "₹200", direction: "Collect", schedule: "Daily · 2026-11-15", policy: "Standard Auto", retries: 2, badge: "Payment Reminder" });
  });
  it("does not label a draft payout as sent", () => {
    expect(smartEmailPresentation("Smart Transfer created", "DRAFT", "Pay out", "Dev").badge).toBe("Payout Request");
  });
  it("classifies collection acceptance, payout settlement, and failure separately", () => {
    expect(smartEmailPresentation("Transfer received", "SUCCESS", "Collect", "Dev").badge).toBe("Collection Completed");
    expect(smartEmailPresentation("Transfer received", "SUCCESS", "Pay out", "Dev").badge).toBe("Payout Sent");
    expect(smartEmailPresentation("Smart Transfer retry", "FAILED", "Pay out", "Dev").badge).toBe("Retry / Failure Notice");
  });
});