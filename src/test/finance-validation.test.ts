import { describe, it, expect } from "vitest";
import {
  financeCommandSchema,
  fakeAmount,
  isReviewedCommand,
  policySchema,
  ledgerFilterSchema,
} from "@/lib/finance-validation";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { csvCell, createFinanceExport } from "@/lib/finance-export";
describe("finance command constraints", () => {
  it("requires review for fake transfer and policy creation", () => {
    expect(
      isReviewedCommand(
        financeCommandSchema.parse({
          tool: "prepare_transfer",
          args: { query: "bob@sim", amount: 1500 },
        }),
      ),
    ).toBe(true);
    expect(
      isReviewedCommand(
        financeCommandSchema.parse({
          tool: "create_policy",
          args: { name: "Standard", requires_user_auth: true },
        }),
      ),
    ).toBe(true);
    expect(
      isReviewedCommand(
        financeCommandSchema.parse({ tool: "query_ledger", args: { party: "Bob" } }),
      ),
    ).toBe(false);
  });
  it("cannot make a model confirm, refund, or spend real funds", () => {
    for (const tool of ["confirm_transfer", "execute_payment", "refund"])
      expect(financeCommandSchema.safeParse({ tool, args: {} }).success).toBe(false);
  });
  it("rejects overprecision and nonpositive amounts", () => {
    expect(fakeAmount.parse(1500)).toBe(1500);
    for (const amount of [0, -1, 0.001, NaN, Infinity])
      expect(fakeAmount.safeParse(amount).success).toBe(false);
  });
  it("defaults policy retries to two", () => {
    expect(policySchema.parse({ name: "Standard", requires_user_auth: true }).max_retries).toBe(2);
  });
  it("rejects invalid ledger ranges and dates", () => {
    expect(ledgerFilterSchema.safeParse({ from_date: "2026-02-30" }).success).toBe(false);
    expect(ledgerFilterSchema.safeParse({ min_amount: 200, max_amount: 100 }).success).toBe(false);
  });
  it("preserves valid consent parameters and rejects external returns", () => {
    const path = "/.lovable/oauth/consent?authorization_id=abc#review";
    expect(oauthReturnPath(path)).toBe(path);
    for (const path of ["//outside.test", "/\\outside.test", "/\nwrong", "https://outside.test"])
      expect(oauthReturnPath(path)).toBe("/");
  });
  it("neutralizes spreadsheet formulas and generates PDF summaries", async () => {
    expect(csvCell('=IMPORTDATA("bad")')).toBe('"\'=IMPORTDATA(""bad"")"');
    const pdf = await createFinanceExport(
      [
        {
          order_id: "SIM-1",
          from_party: "A",
          to_party: "B",
          amount: 1500,
          status: "SUCCESS",
          created_at: "2026-11-14",
          is_simulated: true,
        },
      ],
      "PDF",
    );
    expect(pdf.mime).toBe("application/pdf");
    expect(atob(pdf.base64 ?? "").startsWith("%PDF")).toBe(true);
  });
});
