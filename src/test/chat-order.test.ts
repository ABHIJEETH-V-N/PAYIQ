import { describe, it, expect } from "vitest";
import { chronologicalMessages } from "@/lib/chat-order";
import { policyFields } from "@/lib/policy-validation";
import { z } from "zod";
describe("conversation ordering and policy bounds", () => {
  it("places the user before the assistant when timestamps tie", () => {
    const rows = [{ id: "a", role: "ai", created_at: "2026-11-14T12:00:00Z" }, { id: "u", role: "user", created_at: "2026-11-14T12:00:00Z" }];
    expect(chronologicalMessages(rows).map((r) => r.role)).toEqual(["user", "ai"]);
  });
  it("sorts oldest to newest", () => {
    expect(chronologicalMessages([{ id: "2", role: "ai", created_at: "2026-11-14T12:00:01Z" }, { id: "1", role: "user", created_at: "2026-11-14T12:00:00Z" }]).map((r) => r.id)).toEqual(["1", "2"]);
  });
  it("defaults to two retries and rejects a third", () => {
    const schema = z.object(policyFields);
    expect(schema.parse({ name: "Policy", requires_user_auth: false }).max_retries).toBe(2);
    expect(schema.safeParse({ name: "Policy", requires_user_auth: false, max_retries: 3 }).success).toBe(false);
  });
  it.each([5, 900, 3600])("accepts requested retry delay %i", (delay) => {
    expect(z.object(policyFields).parse({ name: "Policy", requires_user_auth: false, retry_delay_seconds: delay }).retry_delay_seconds).toBe(delay);
  });
});