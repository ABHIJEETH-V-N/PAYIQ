import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/notifications.server", () => ({ notifyAccount: vi.fn() }));
import { updateSync } from "@/lib/data.functions";
import { notifyAccount } from "@/lib/notifications.server";

describe("Saved sync editing", () => {
  it("updates the owned request without changing payment execution state or emailing when disabled", async () => {
    const filters: [string, string][] = [];
    const write = vi.fn();
    const row = { id: "request", name: "Edited vendor", amount: 2200, email_updates: false };
    const chain = {
      eq: (key: string, value: string) => { filters.push([key, value]); return chain; },
      select: () => chain,
      single: async () => ({ data: row, error: null }),
    };
    const db = { from: () => ({ update: (values: unknown) => { write(values); return chain; } }) };
    const invoke = updateSync as unknown as (input: unknown) => Promise<unknown>;
    const values = { name: "Edited vendor", counterparty: "Shop", counterparty_email: "", counterparty_address: "shop@paytm", direction: "DEBIT", amount_type: "FIXED", amount: 2200, max_cap: null, policy_id: "policy", sender_email: "sender@example.com", email_updates: false };
    expect(await invoke({ data: { id: "request", values }, context: { supabase: db, userId: "owner" } })).toEqual({ ...row, notification: { status: "OFF" } });
    expect(filters).toEqual([["id", "request"], ["user_id", "owner"]]);
    expect(write).toHaveBeenCalledWith(values);
    expect(write.mock.calls[0]?.[0]).not.toHaveProperty("status");
    expect(notifyAccount).not.toHaveBeenCalled();
  });
});