import { describe, expect, it } from "vitest";
import { profileSchema, syncSchema } from "@/lib/account-validation";
const fixed = {
  name: "Weekly vendor payment",
  counterparty: "Vendor",
  counterparty_email: "",
  counterparty_address: "vendor@paytm",
  direction: "DEBIT",
  amount_type: "FIXED",
  amount: 1850,
  max_cap: null,
  policy_id: "a0000000-0000-4000-8000-000000000001",
};
describe("Saved account data", () => {
  it("stores business name, phone, Paytm number and UPI ID", () => {
    expect(
      profileSchema.parse({
        name: "Sharma Kirana",
        phone: "9845012345",
        paytm_number: "9845012345",
        upi_id: "sharma@paytm",
      }),
    ).toEqual({
      name: "Sharma Kirana",
      phone: "9845012345",
      paytm_number: "9845012345",
      upi_id: "sharma@paytm",
    });
  });
  it("keeps the entered fixed amount and counterparty", () => {
    expect(syncSchema.parse(fixed)).toMatchObject({
      amount: 1850,
      counterparty: "Vendor",
      counterparty_address: "vendor@paytm",
    });
  });
  it("rejects a fixed request with no amount", () => {
    expect(syncSchema.safeParse({ ...fixed, amount: null }).success).toBe(false);
  });
  it("keeps a variable cap without a fixed amount", () => {
    expect(
      syncSchema.parse({ ...fixed, amount_type: "VARIABLE", amount: null, max_cap: 5000 }),
    ).toMatchObject({ amount: null, max_cap: 5000 });
  });
  it("requires an existing policy or a new policy", () => {
    expect(syncSchema.safeParse({ ...fixed, policy_id: undefined }).success).toBe(false);
  });
});
