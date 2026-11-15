import { describe, expect, it } from "vitest";
import { assistantResultSchema, VOICE_SECONDS } from "@/lib/assistant-validation";
describe("Sarvam app requests", () => {
  it("accepts navigation only to existing app pages", () => {
    expect(
      assistantResultSchema.parse({
        reply: "Opening ledger",
        action: "navigate",
        destination: "/ledger",
        draft: null,
      }).destination,
    ).toBe("/ledger");
    expect(
      assistantResultSchema.safeParse({
        reply: "Open",
        action: "navigate",
        destination: "https://example.com",
        draft: null,
      }).success,
    ).toBe(false);
  });
  it("cannot execute a payment", () => {
    expect(
      assistantResultSchema.safeParse({
        reply: "Paid",
        action: "execute_payment",
        destination: null,
        draft: null,
      }).success,
    ).toBe(false);
  });
  it("requires complete draft details and a positive amount", () => {
    const draft = {
      name: "Vendor payment",
      counterparty: "Vendor",
      counterparty_address: "vendor@paytm",
      direction: "DEBIT",
      amount: 1500,
    };
    expect(
      assistantResultSchema.parse({
        reply: "Review",
        action: "draft_sync",
        destination: null,
        draft,
      }).draft?.amount,
    ).toBe(1500);
    expect(
      assistantResultSchema.safeParse({
        reply: "Review",
        action: "draft_sync",
        destination: null,
        draft: { ...draft, amount: -1500 },
      }).success,
    ).toBe(false);
    expect(
      assistantResultSchema.safeParse({
        reply: "Review",
        action: "draft_sync",
        destination: null,
        draft: null,
      }).success,
    ).toBe(false);
  });
  it("stops voice capture at the Sarvam REST duration limit", () => {
    expect(VOICE_SECONDS).toBe(30);
  });
});
