import { z } from "zod";
import { policyFields } from "./policy-validation";
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40),
  paytm_number: z.string().trim().max(40),
  upi_id: z.string().trim().max(150),
});
export const syncSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    counterparty: z.string().trim().min(1).max(200),
    counterparty_email: z.union([z.string().email(), z.literal("")]),
    sender_email: z.union([z.string().trim().email().max(254), z.literal("")]).default(""),
    email_updates: z.boolean().default(true),
    reminder_cadence: z.enum(["NONE", "5_HOURS", "10_HOURS", "MORNING", "DUE_FAILURE"]).default("NONE"),
    email_reminders: z.boolean().default(true),
    counterparty_address: z.string().trim().min(1).max(200),
    direction: z.enum(["DEBIT", "CREDIT"]),
    amount_type: z.enum(["FIXED", "VARIABLE"]),
    amount: z.number().positive().nullable(),
    max_cap: z.number().positive().nullable(),
    policy_id: z.string().uuid().optional(),
    new_policy: z
      .object(policyFields)
      .optional(),
  })
  .superRefine((v, c) => {
    if (v.amount_type === "FIXED" && (v.amount === null || v.max_cap !== null))
      c.addIssue({ code: "custom", message: "Enter a positive fixed amount" });
    if (v.amount_type === "VARIABLE" && v.amount !== null)
      c.addIssue({ code: "custom", message: "Variable requests cannot have a fixed amount" });
    if (!v.policy_id && !v.new_policy) c.addIssue({ code: "custom", message: "Choose a policy" });
  });
export const updateSyncSchema = z.object({ id: z.string().uuid(), values: syncSchema });
